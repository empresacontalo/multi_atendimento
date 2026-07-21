import {
  buscarAgendamentosParaLembrete30Min,
  marcarLembrete30mEnviado,
  atualizarStatusAgendamentoPendente,
} from "../db/agendamentos-pendentes.ts";
import { consultarCobrancaAsaas } from "../services/asaas.ts";
import { enviarMensagem, atualizarContato } from "../services/chatwoot.ts";
import { buscarProfissional } from "../config/profissionais.ts";
import { atualizarEvento } from "../services/google-calendar.ts";
import { env } from "../config/env.ts";
import { logger } from "../lib/logger.ts";
import { pool } from "../db/pool.ts";

export async function executarVerificacaoPendencias30m() {
  try {
    // Primeiro: expirar silenciosamente bookings PENDING antigos cuja conversa já tem CONFIRMED mais novo.
    // Isso evita que lembretes sejam enviados para cobranças antigas quando o cliente já fez um novo agendamento confirmado.
    try {
      await pool.query(
        `UPDATE n8n_agendamentos_pendentes p
         SET status = 'EXPIRED', updated_at = NOW()
         WHERE p.status = 'PENDING'
           AND EXISTS (
             SELECT 1 FROM n8n_agendamentos_pendentes c
             WHERE c.id_conversa = p.id_conversa
               AND c.status = 'CONFIRMED'
               AND c.created_at > p.created_at
           )`
      );
    } catch (e) {
      logger.error("jobs:verificar-pendencias", "Erro ao expirar bookings órfãos:", e);
    }

    const pendentes = await buscarAgendamentosParaLembrete30Min();
    if (pendentes.length === 0) return;

    logger.info("jobs:verificar-pendencias", `Verificando ${pendentes.length} agendamentos pendentes (> 30min)`);

    for (const item of pendentes) {
      try {
        // Consultar status atualizado no ASAAS ANTES de qualquer ação
        logger.info("jobs:verificar-pendencias", `Consultando ASAAS para agendamento id ${item.id}`, { paymentId: item.asaasPaymentId });
        const cobranca = await consultarCobrancaAsaas(item.asaasPaymentId);
        logger.info("jobs:verificar-pendencias", `ASAAS status para id ${item.id}`, { status: cobranca.status });

        if (cobranca.status === "RECEIVED" || cobranca.status === "CONFIRMED" || cobranca.status === "RECEIVED_IN_CASH") {
          // Pagamento já foi efetuado! Confirmar no GCal e DB — NÃO enviar lembrete
          const profissional = buscarProfissional(item.idProfissional);
          if (profissional && item.idEventoGcal) {
            const descricaoConfirmada = `${item.descricao}\n\nTelefone: ${item.telefone}\nConfirmaçao_Finaceira: Confirmada R$50`;
            await atualizarEvento(profissional.calendarId, item.idEventoGcal, { description: descricaoConfirmada });
          }

          await atualizarStatusAgendamentoPendente(item.id, "CONFIRMED");

          try {
            await atualizarContato(item.idConta, item.idContato, {
              data_ultima_consulta: item.eventoInicio.toISOString().split("T")[0],
            });
          } catch (e) {
            logger.error("jobs:verificar-pendencias", "Erro ao atualizar contato no Chatwoot:", e);
          }

          const dataFormatada = item.eventoInicio.toLocaleString("pt-BR", {
            timeZone: env.TZ,
            dateStyle: "short",
            timeStyle: "short",
          });

          const msgConfirmacao =
            `✅ *Pagamento da taxa de reserva confirmado com sucesso!*\n\n` +
            `Sua confirmação financeira foi atualizada para *Confirmada R$50*:\n` +
            `📅 *Data e Horário:* ${dataFormatada}\n` +
            `📋 *Serviço:* ${item.titulo}\n\n` +
            `⚠️ *Importante:* Caso precise remarcar ou cancelar, informe-nos com pelo menos *24 horas de antecedência*. Te esperamos!`;

          await enviarMensagem(item.idConta, item.idConversa, msgConfirmacao);
          logger.info("jobs:verificar-pendencias", `Pagamento já confirmado no ASAAS para id ${item.id} — confirmação enviada, nenhum lembrete enviado`);

        } else if (cobranca.status === "PENDING") {
          // Ainda pendente no ASAAS! Enviar mensagem de lembrete dos 30 minutos
          const mensagemLembrete =
            `⚠️ *Lembrete de Agendamento*\n\n` +
            `A taxa de reserva de horário (R$ 50,00) não consta como paga até o momento.\n\n` +
            `Lembramos que se após 1 hora da realização do agendamento a taxa ainda não constar como confirmada, o horário poderá ser liberado e substituído por outro agendamento.\n\n` +
            `Caso você já tenha efetuado o pagamento, por favor nos confirme por aqui e desconsidere esta mensagem.`;

          await enviarMensagem(item.idConta, item.idConversa, mensagemLembrete);
          await marcarLembrete30mEnviado(item.id);
          logger.info("jobs:verificar-pendencias", `Lembrete de 30 minutos enviado com sucesso para agendamento id ${item.id}`);

        } else {
          // Cancelado ou expirado no ASAAS
          await atualizarStatusAgendamentoPendente(item.id, "EXPIRED");
          logger.info("jobs:verificar-pendencias", `Agendamento id ${item.id} marcado como EXPIRED (status ASAAS: ${cobranca.status})`);
        }
      } catch (e) {
        logger.error("jobs:verificar-pendencias", `Erro ao processar item id ${item.id}:`, e);
      }
    }
  } catch (e) {
    logger.error("jobs:verificar-pendencias", "Erro geral no job de verificação de 30m:", e);
  }
}

export function iniciarJobVerificacaoPendencias(intervaloMs = 120000) { // Executa a cada 2 minutos
  logger.info("jobs:verificar-pendencias", `Iniciando job periódico de verificação a cada ${intervaloMs / 1000}s`);
  setInterval(() => {
    void executarVerificacaoPendencias30m();
  }, intervaloMs);
}

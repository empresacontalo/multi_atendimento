import { Elysia } from "elysia";
import { z } from "zod";
import { env } from "../config/env.ts";
import { logger } from "../lib/logger.ts";
import {
  buscarAgendamentoPendentePorPaymentId,
  atualizarStatusAgendamentoPendente,
} from "../db/agendamentos-pendentes.ts";
import { buscarProfissional } from "../config/profissionais.ts";
import { criarEvento, atualizarEvento } from "../services/google-calendar.ts";
import { atualizarContato, enviarMensagem } from "../services/chatwoot.ts";

const asaasWebhookSchema = z.object({
  event: z.string(),
  payment: z.object({
    id: z.string(),
    status: z.string(),
    customer: z.string().optional(),
    value: z.number().optional(),
  }),
});

export const asaasWebhookRouter = new Elysia().post(
  "/webhook/asaas",
  async ({ body, headers }) => {
    logger.info("asaas-webhook", ">>> Webhook Asaas recebido", { event: (body as Record<string, unknown>)?.event });

    // Validar token se configurado
    if (env.ASSAAS_WEBHOOK_TOKEN) {
      const tokenRecebido = headers["asaas-access-token"] || headers["asaas_access_token"];
      if (tokenRecebido !== env.ASSAAS_WEBHOOK_TOKEN) {
        logger.warn("asaas-webhook", "Token de webhook Asaas inválido");
        return { status: "unauthorized" };
      }
    }

    const parsed = asaasWebhookSchema.safeParse(body);
    if (!parsed.success) {
      logger.warn("asaas-webhook", "Payload de webhook Asaas inválido", parsed.error.issues);
      return { status: "ignored", reason: "invalid_payload" };
    }

    const { event, payment } = parsed.data;

    // Verificar se é pagamento confirmado ou recebido
    if (event !== "PAYMENT_RECEIVED" && event !== "PAYMENT_CONFIRMED") {
      logger.info("asaas-webhook", "Evento ignorado:", event);
      return { status: "ignored", reason: "event_not_handled" };
    }

    // Buscar agendamento pendente
    const agendamentoPendente = await buscarAgendamentoPendentePorPaymentId(payment.id);
    if (!agendamentoPendente) {
      logger.warn("asaas-webhook", "Agendamento pendente não encontrado para o payment.id:", payment.id);
      return { status: "ignored", reason: "payment_not_found" };
    }

    if (agendamentoPendente.status !== "PENDING") {
      logger.info("asaas-webhook", "Agendamento pendente já processado:", { id: agendamentoPendente.id, status: agendamentoPendente.status });
      return { status: "ok", action: "already_processed" };
    }

    const profissional = buscarProfissional(agendamentoPendente.idProfissional);
    if (!profissional) {
      logger.error("asaas-webhook", "Profissional não encontrado para o agendamento pendente:", agendamentoPendente.idProfissional);
      return { status: "error", reason: "profissional_not_found" };
    }

    // Atualizar evento no Google Calendar para "Confirmaçao_Finaceira: Confirmada R$50"
    try {
      const eventoInicio = agendamentoPendente.eventoInicio;
      const eventoFim = new Date(eventoInicio.getTime() + agendamentoPendente.duracaoMinutos * 60000);
      const descricaoConfirmada = `${agendamentoPendente.descricao}\n\nTelefone: ${agendamentoPendente.telefone}\nConfirmaçao_Finaceira: Confirmada R$50`;

      let gcalId = agendamentoPendente.idEventoGcal;

      if (gcalId) {
        await atualizarEvento(profissional.calendarId, gcalId, {
          description: descricaoConfirmada,
        });
      } else {
        const eventoCriado = await criarEvento(profissional.calendarId, {
          summary: agendamentoPendente.titulo,
          description: descricaoConfirmada,
          start: { dateTime: eventoInicio.toISOString(), timeZone: env.TZ },
          end: { dateTime: eventoFim.toISOString(), timeZone: env.TZ },
        });
        gcalId = eventoCriado.id ?? null;
      }

      // Atualizar status no banco
      await atualizarStatusAgendamentoPendente(agendamentoPendente.id, "CONFIRMED", gcalId);

      // Atualizar data_ultima_consulta do contato no Chatwoot
      try {
        await atualizarContato(agendamentoPendente.idConta, agendamentoPendente.idContato, {
          data_ultima_consulta: eventoInicio.toISOString().split("T")[0],
        });
      } catch (e) {
        logger.error("asaas-webhook", "Erro ao atualizar contato no Chatwoot:", e);
      }

      // Enviar mensagem de confirmação para o cliente via Chatwoot
      const dataFormatada = eventoInicio.toLocaleString("pt-BR", {
        timeZone: env.TZ,
        dateStyle: "short",
        timeStyle: "short",
      });

      const mensagemConfirmacao =
        `✅ *Pagamento da taxa de reserva confirmado com sucesso!*\n\n` +
        `Sua confirmação financeira foi atualizada para *Confirmada R$50*:\n` +
        `📅 *Data e Horário:* ${dataFormatada}\n` +
        `💇‍♀️ *Profissional:* ${profissional.nome}\n` +
        `📋 *Serviço:* ${agendamentoPendente.titulo}\n\n` +
        `⚠️ *Importante:* Caso precise remarcar ou cancelar, informe-nos com pelo menos *24 horas de antecedência*. Te esperamos!`;

      await enviarMensagem(agendamentoPendente.idConta, agendamentoPendente.idConversa, mensagemConfirmacao);

      logger.info("asaas-webhook", "Agendamento confirmado com sucesso!", { id: agendamentoPendente.id, gcalId });
      return { status: "ok", action: "booking_confirmed", gcalId };
    } catch (err) {
      logger.error("asaas-webhook", "Erro ao atualizar evento no Google Calendar:", err);
      return { status: "error", message: (err as Error).message };
    }
  }
);

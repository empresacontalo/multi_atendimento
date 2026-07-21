import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  buscarUltimoAgendamentoPendentePorTelefone,
  atualizarStatusAgendamentoPendente,
} from "../db/agendamentos-pendentes.ts";
import { consultarCobrancaAsaas } from "../services/asaas.ts";
import { buscarProfissional } from "../config/profissionais.ts";
import { criarEvento, atualizarEvento } from "../services/google-calendar.ts";
import { atualizarContato } from "../services/chatwoot.ts";
import { env } from "../config/env.ts";
import { logger } from "../lib/logger.ts";

interface ContextoVerificarStatusPagamento {
  idConta: string;
  idConversa: string;
  idContato: string;
  telefone: string;
}

export function criarToolVerificarStatusPagamento(contexto: ContextoVerificarStatusPagamento) {
  return tool(
    async () => {
      logger.info("tool:verificar-status-pagamento", "Consultando agendamento pendente para telefone", { telefone: contexto.telefone });

      const agendamentoPendente = await buscarUltimoAgendamentoPendentePorTelefone(contexto.telefone);
      if (!agendamentoPendente) {
        return JSON.stringify({
          resultado: "SEM_PENDENCIA",
          mensagem: "Nenhum agendamento pendente de pagamento foi encontrado para este cliente.",
        });
      }

      try {
        const cobranca = await consultarCobrancaAsaas(agendamentoPendente.asaasPaymentId);
        logger.info("tool:verificar-status-pagamento", "Status da cobrança no ASAAS", { id: cobranca.id, status: cobranca.status });

        if (cobranca.status === "RECEIVED" || cobranca.status === "CONFIRMED" || cobranca.status === "RECEIVED_IN_CASH") {
          const profissional = buscarProfissional(agendamentoPendente.idProfissional);
          if (!profissional) {
            return JSON.stringify({ erro: `Profissional "${agendamentoPendente.idProfissional}" não encontrado.` });
          }

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

          await atualizarStatusAgendamentoPendente(agendamentoPendente.id, "CONFIRMED", gcalId);

          try {
            await atualizarContato(agendamentoPendente.idConta, agendamentoPendente.idContato, {
              data_ultima_consulta: eventoInicio.toISOString().split("T")[0],
            });
          } catch (e) {
            logger.error("tool:verificar-status-pagamento", "Erro ao atualizar contato no Chatwoot:", e);
          }

          const dataFormatada = eventoInicio.toLocaleString("pt-BR", {
            timeZone: env.TZ,
            dateStyle: "short",
            timeStyle: "short",
          });

          return JSON.stringify({
            resultado: "PAGAMENTO_CONFIRMADO_E_AGENDADO",
            id_evento: gcalId,
            confirmacao_financeira: "Confirmada R$50",
            data_hora: dataFormatada,
            profissional: profissional.nome,
            mensagem: `O pagamento da taxa de reserva (R$ 50,00) foi confirmado. A confirmação financeira do agendamento foi alterada para 'Confirmaçao_Finaceira: Confirmada R$50' no calendário para ${dataFormatada} com ${profissional.nome}.`,
          });
        } else if (cobranca.status === "PENDING") {
          return JSON.stringify({
            resultado: "PAGAMENTO_PENDENTE",
            mensagem: "O pagamento da taxa de R$ 50 ainda consta como PENDENTE no sistema ASAAS. Caso o cliente tenha efetuado o PIX há poucos instantes, peça a ele que aguarde alguns segundos.",
          });
        } else {
          await atualizarStatusAgendamentoPendente(agendamentoPendente.id, "CANCELLED");
          return JSON.stringify({
            resultado: "COBRANCA_CANCELADA_OU_EXPIRADA",
            status_asaas: cobranca.status,
            mensagem: "A cobrança no ASAAS expirou ou foi cancelada. É necessário gerar uma nova cobrança de agendamento.",
          });
        }
      } catch (e) {
        logger.error("tool:verificar-status-pagamento", "Erro ao verificar pagamento ASAAS:", e);
        return JSON.stringify({ erro: "Erro ao consultar status do pagamento no ASAAS: " + (e as Error).message });
      }
    },
    {
      name: "Verificar_status_pagamento",
      description:
        "Utilize esta ferramenta quando o cliente avisar que já efetuou o pagamento da taxa de reserva do agendamento (ex: 'Já paguei', 'Fiz o PIX'). " +
        "Ela consulta o portal ASAAS para verificar a confirmação do pagamento e realiza a reserva do horário no Google Calendar caso o pagamento seja confirmado.",
      schema: z.object({}),
    }
  );
}

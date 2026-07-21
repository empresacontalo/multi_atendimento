import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { buscarProfissional } from "../config/profissionais.ts";
import { listarEventos, criarEvento, deletarEvento } from "../services/google-calendar.ts";
import { buscarOuCriarClienteAsaas, criarCobrancaAsaas, obterQrCodePixAsaas } from "../services/asaas.ts";
import { salvarAgendamentoPendente } from "../db/agendamentos-pendentes.ts";
import { enviarArquivo, atualizarContato } from "../services/chatwoot.ts";
import { env } from "../config/env.ts";
import { logger } from "../lib/logger.ts";

interface ContextoCriarCobrancaAgendamento {
  idConta: string;
  idConversa: string;
  idContato: string;
  telefone: string;
}

export function criarToolCriarCobrancaAgendamento(contexto: ContextoCriarCobrancaAgendamento) {
  return tool(
    async (input) => {
      logger.info("tool:criar-cobranca-agendamento", "Iniciando criação de agendamento e cobrança", {
        profissional: input.idProfissional,
        inicio: input.eventoInicio,
        duracao: input.duracaoMinutos,
        titulo: input.titulo,
        formaPagamento: input.formaPagamento,
      });

      const profissional = buscarProfissional(input.idProfissional);
      if (!profissional) {
        return JSON.stringify({ erro: `Profissional "${input.idProfissional}" não encontrado.` });
      }

      const eventoInicio = new Date(input.eventoInicio);
      const eventoFim = new Date(eventoInicio.getTime() + input.duracaoMinutos * 60000);

      // Verificar disponibilidade no Google Calendar
      try {
        const eventos = await listarEventos(
          profissional.calendarId,
          eventoInicio.toISOString(),
          eventoFim.toISOString(),
        );

        const eventosComConflitoValido = eventos.filter((ev) => {
          const evInicio = new Date(ev.start?.dateTime ?? ev.start?.date ?? "");
          const evFim = new Date(ev.end?.dateTime ?? ev.end?.date ?? "");
          const conflito = eventoInicio < evFim && eventoFim > evInicio;
          if (!conflito) return false;

          const desc = ev.description ?? "";
          const isNaoConfirmado = desc.includes("Confirmaçao_Finaceira: Não confirmada");
          if (isNaoConfirmado) {
            const tempoCriacao = new Date(ev.created ?? "").getTime();
            const umHoraEmMs = 60 * 60 * 1000;
            if (Date.now() - tempoCriacao > umHoraEmMs) {
              // Caducou há mais de 1h sem confirmação! Pode ser substituído.
              return false;
            }
          }
          return true;
        });

        if (eventosComConflitoValido.length > 0) {
          return JSON.stringify({
            erro: "HORÁRIO INDISPONÍVEL. O horário desejado possui conflito de agenda. Verifique outros horários disponíveis antes de tentar agendar.",
          });
        }

        // Remover eventos antigos não confirmados que caducaram (> 1h) para dar lugar ao novo agendamento
        const eventosCaducados = eventos.filter((ev) => {
          const evInicio = new Date(ev.start?.dateTime ?? ev.start?.date ?? "");
          const evFim = new Date(ev.end?.dateTime ?? ev.end?.date ?? "");
          const conflito = eventoInicio < evFim && eventoFim > evInicio;
          if (!conflito) return false;

          const desc = ev.description ?? "";
          const isNaoConfirmado = desc.includes("Confirmaçao_Finaceira: Não confirmada");
          if (isNaoConfirmado) {
            const tempoCriacao = new Date(ev.created ?? "").getTime();
            return Date.now() - tempoCriacao > 60 * 60 * 1000;
          }
          return false;
        });

        for (const evCaducado of eventosCaducados) {
          if (evCaducado.id) {
            try {
              await deletarEvento(profissional.calendarId, evCaducado.id);
              logger.info("tool:criar-cobranca-agendamento", "Evento antigo não confirmado (>1h) deletado do GCal para dar vaga ao novo agendamento:", evCaducado.id);
            } catch (e) {
              logger.warn("tool:criar-cobranca-agendamento", "Erro ao deletar evento caducado do GCal:", e);
            }
          }
        }
      } catch (e) {
        logger.error("tool:criar-cobranca-agendamento", "Erro ao listar eventos no calendário:", e);
      }

      // 1. Criar Evento no Google Calendar imediatamente com "Confirmaçao_Finaceira: Não confirmada"
      const descricaoCompleta = `${input.descricao}\n\nTelefone: ${contexto.telefone}\nConfirmaçao_Finaceira: Não confirmada`;
      let eventoCriado: { id?: string | null; htmlLink?: string | null } | null = null;
      try {
        eventoCriado = await criarEvento(profissional.calendarId, {
          summary: input.titulo,
          description: descricaoCompleta,
          start: { dateTime: eventoInicio.toISOString(), timeZone: env.TZ },
          end: { dateTime: eventoFim.toISOString(), timeZone: env.TZ },
        });

        // Atualizar data_ultima_consulta no contato Chatwoot
        try {
          await atualizarContato(contexto.idConta, contexto.idContato, {
            data_ultima_consulta: eventoInicio.toISOString().split("T")[0],
          });
        } catch (e) {
          logger.error("tool:criar-cobranca-agendamento", "Erro ao atualizar contato no Chatwoot:", e);
        }
      } catch (e) {
        logger.error("tool:criar-cobranca-agendamento", "Erro ao criar evento no Google Calendar:", e);
        return JSON.stringify({ erro: "Erro ao criar agendamento no calendário: " + (e as Error).message });
      }

      // Mapear forma de pagamento para o padrão ASAAS
      let billingType: "PIX" | "CREDIT_CARD" | "DEBIT_CARD" = "PIX";
      const fp = input.formaPagamento.toLowerCase().trim();
      if (fp.includes("credito") || fp.includes("crédito")) {
        billingType = "CREDIT_CARD";
      } else if (fp.includes("debito") || fp.includes("débito")) {
        billingType = "DEBIT_CARD";
      }

      try {
        // 2. Buscar ou Criar Cliente no ASAAS
        const clienteAsaas = await buscarOuCriarClienteAsaas({
          nome: input.titulo,
          telefone: contexto.telefone,
          cpfCnpj: input.cpf,
        });

        // 3. Criar Cobrança de R$ 50 no ASAAS
        const extRef = `agendamento_${contexto.telefone}_${Date.now()}`;
        const cobranca = await criarCobrancaAsaas({
          customerId: clienteAsaas.id,
          valor: 50.0,
          formaPagamento: billingType,
          descricao: `Taxa de reserva de agendamento (R$ 50,00) - ${input.titulo}`,
          externalReference: extRef,
        });

        // 4. Salvar Agendamento Pendente no Banco vinculando id_evento_gcal
        await salvarAgendamentoPendente({
          idConta: contexto.idConta,
          idConversa: contexto.idConversa,
          idContato: contexto.idContato,
          telefone: contexto.telefone,
          idProfissional: input.idProfissional,
          titulo: input.titulo,
          descricao: input.descricao,
          eventoInicio,
          duracaoMinutos: input.duracaoMinutos,
          valorTaxa: 50.0,
          formaPagamento: billingType,
          asaasCustomerId: clienteAsaas.id,
          asaasPaymentId: cobranca.id,
          asaasInvoiceUrl: cobranca.invoiceUrl ?? undefined,
          idEventoGcal: eventoCriado?.id ?? undefined,
        });

        // 5. Se for PIX, obter o código copia e cola e a imagem do QR Code
        if (billingType === "PIX") {
          let qrPixPayload = "";
          let qrEnviado = false;
          let chaveEnviada = false;
          try {
            const pixData = await obterQrCodePixAsaas(cobranca.id);
            qrPixPayload = pixData.payload;

            // Enviar imagem do QR Code
            if (pixData.encodedImage) {
              const imageBuffer = Buffer.from(pixData.encodedImage, "base64");
              await enviarArquivo(
                contexto.idConta,
                contexto.idConversa,
                imageBuffer,
                "qrcode_pix.png",
                "image/png"
              );
              qrEnviado = true;
            }

            // Enviar chave PIX copia e cola como MENSAGEM DE TEXTO SEPARADA para fácil cópia no WhatsApp
            if (qrPixPayload) {
              await enviarMensagem(
                contexto.idConta,
                contexto.idConversa,
                qrPixPayload
              );
              chaveEnviada = true;
            }
          } catch (e) {
            logger.error("tool:criar-cobranca-agendamento", "Erro ao obter/enviar QR Code PIX:", e);
          }

          return JSON.stringify({
            resultado: "COBRANCA_E_AGENDAMENTO_CRIADOS",
            id_evento: eventoCriado?.id,
            confirmacao_financeira: "Não confirmada",
            forma_pagamento: "PIX",
            valor: "R$ 50,00",
            qr_code_imagem_enviada: qrEnviado,
            chave_pix_texto_enviada: chaveEnviada,
            link_pagamento: cobranca.invoiceUrl,
            instrucoes:
              "O agendamento foi realizado no calendário constando 'Confirmaçao_Finaceira: Não confirmada'. " +
              "A imagem do QR Code E a chave PIX copia e cola em texto limpo já foram enviadas como mensagens no chat para o cliente. " +
              "ATENÇÃO REGRA ABSOLUTA: NUNCA inclua o código da chave PIX copia e cola (a string de caracteres) no seu texto ou áudio de resposta! Apenas informe o cliente de forma verbal/amigável que o QR Code e a chave PIX copia e cola foram enviados no chat para ele copiar e pagar pelo app do banco. " +
              "Diga obrigatoriamente ao cliente: 'Se possível, me confirme por aqui quando efetuar o pagamento para confirmar sua reserva de horário'.",
          });
        } else {
          return JSON.stringify({
            resultado: "COBRANCA_E_AGENDAMENTO_CRIADOS",
            id_evento: eventoCriado?.id,
            confirmacao_financeira: "Não confirmada",
            forma_pagamento: billingType === "CREDIT_CARD" ? "Crédito" : "Débito",
            valor: "R$ 50,00",
            link_pagamento: cobranca.invoiceUrl,
            instrucoes:
              `O agendamento foi realizado no calendário constando 'Confirmaçao_Finaceira: Não confirmada'. ` +
              `Envie o link de pagamento (${cobranca.invoiceUrl}) para o cliente pagar a taxa com cartão de ${billingType === "CREDIT_CARD" ? "crédito" : "débito"}. ` +
              `Informe que o horário já está reservado e diga ao cliente: 'Se possível, me confirme por aqui quando efetuar o pagamento para confirmar sua reserva de horário'.`,
          });
        }
      } catch (e) {
        logger.error("tool:criar-cobranca-agendamento", "Erro ao gerar cobrança ASAAS:", e);
        return JSON.stringify({ erro: "Erro ao gerar cobrança de agendamento no ASAAS: " + (e as Error).message });
      }
    },
    {
      name: "Criar_cobranca_agendamento",
      description:
        "Utilize esta ferramenta para gerar a cobrança da taxa de reserva de R$ 50,00 no portal ASAAS para um agendamento. " +
        "Ela verifica a disponibilidade da vaga, registra o agendamento como pendente e retorna a chave PIX copia e cola ou o link de pagamento para cartão de débito/crédito. " +
        "IMPORTANTE: Sempre informe ao cliente antes de chamar essa ferramenta que a taxa de R$ 50 é cobrada para reservar o horário, e que cancelamentos/remarcações com menos de 24h antes perdem o valor.",
      schema: z.object({
        eventoInicio: z.string().describe("Data e horário do agendamento no futuro. Formato: YYYY-MM-DDThh:mm:ssTZD"),
        duracaoMinutos: z.number().describe("Duração do evento em minutos"),
        titulo: z.string().describe("Nome completo do cliente/paciente"),
        descricao: z.string().describe("Descrição do procedimento ou serviço agendado"),
        idProfissional: z.string().describe("Slug do profissional"),
        formaPagamento: z
          .enum(["pix", "debito", "credito"])
          .describe("Forma de pagamento escolhida pelo cliente: 'pix', 'debito' ou 'credito'"),
        cpf: z.string().optional().describe("CPF ou CNPJ do cliente se fornecido (opcional para PIX, recomendável para cartão)"),
      }),
    }
  );
}

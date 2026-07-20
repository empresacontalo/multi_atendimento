import { env } from "../../config/env.ts";
import { prompts } from "../../lib/prompt-loader.ts";
import { interpolatePrompt } from "../../lib/prompt-template.ts";

interface ContextoFollowUpPrompt {
  funilSteps: Array<{ id: number; name: string }>;
  board_step: { id: number; name: string };
  title: string;
  description: string | null;
  dueDate: string | null;
}

export function gerarPromptFollowup(ctx: ContextoFollowUpPrompt): string {
  const funilStepsDescricao = ctx.funilSteps
    .map((s) => `* ${s.name}: ${s.id}`)
    .join("\n      ");
  const dataHoraAtual = new Date().toLocaleString("pt-BR", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: env.TZ,
  });

  return interpolatePrompt(prompts.followup, {
    // Dados do cliente
    NOME_NEGOCIO: env.NOME_NEGOCIO,
    NOME_ASSISTENTE: env.NOME_ASSISTENTE,
    // Dados de runtime
    FUNIL_STEPS_DESCRICAO: funilStepsDescricao,
    BOARD_STEP_ID: String(ctx.board_step.id),
    BOARD_STEP_NAME: ctx.board_step.name,
    TITULO: ctx.title,
    DESCRICAO: ctx.description || "(vazia)",
    DUE_DATE: ctx.dueDate || "(nao definida)",
    DATA_HORA_ATUAL: dataHoraAtual,
  });
}

// Pré-interpolar prompts estáticos com dados do cliente no carregamento do módulo
const clientVars = {
  NOME_NEGOCIO: env.NOME_NEGOCIO,
  NOME_ASSISTENTE: env.NOME_ASSISTENTE,
  ENDERECO: env.ENDERECO,
  TELEFONE: env.TELEFONE,
  HORARIO_FUNCIONAMENTO: env.HORARIO_FUNCIONAMENTO,
};

export const PROMPT_LEMBRETE = interpolatePrompt(prompts.lembrete, clientVars);

export const PROMPT_POS_CONSULTA = interpolatePrompt(
  prompts.posConsulta,
  clientVars,
);

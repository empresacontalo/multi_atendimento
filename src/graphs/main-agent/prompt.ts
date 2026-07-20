import { env } from "../../config/env.ts";
import { prompts } from "../../lib/prompt-loader.ts";
import { interpolatePrompt, formatarTabelaProfissionais, formatarTabelaProcedimentos } from "../../lib/prompt-template.ts";

interface ContextoPrompt {
  tarefa: Record<string, unknown>;
  etapasDescricao: string;
  dataHoraAtual: string;
}

export function gerarPromptAgentePrincipal(ctx: ContextoPrompt): string {
  const tarefa = ctx.tarefa as {
    board_step?: { name: string };
    board_step_id?: number;
    title?: string;
    description?: string;
    due_date?: string;
  };

  return interpolatePrompt(prompts.agentePrincipal, {
    // Dados do cliente (env)
    NOME_NEGOCIO: env.NOME_NEGOCIO,
    NOME_ASSISTENTE: env.NOME_ASSISTENTE,
    RAMO_NEGOCIO: env.RAMO_NEGOCIO,
    HORARIO_FUNCIONAMENTO: env.HORARIO_FUNCIONAMENTO,
    ENDERECO: env.ENDERECO,
    TELEFONE: env.TELEFONE,
    FORMAS_PAGAMENTO: env.FORMAS_PAGAMENTO,
    CONVENIOS: env.CONVENIOS,
    PROFISSIONAIS_TABELA: formatarTabelaProfissionais(env.PROFISSIONAIS),
    PROCEDIMENTOS_TABELA: formatarTabelaProcedimentos(env.PROCEDIMENTOS),
    // Dados de runtime
    ETAPAS_DESCRICAO: ctx.etapasDescricao,
    DATA_HORA_ATUAL: ctx.dataHoraAtual,
    TAREFA_ETAPA_NOME: tarefa.board_step?.name ?? "Novo Lead",
    TAREFA_ETAPA_ID: String(tarefa.board_step_id ?? ""),
    TAREFA_TITULO: tarefa.title ?? "",
    TAREFA_DESCRICAO: tarefa.description || "(vazia)",
    TAREFA_DUE_DATE: tarefa.due_date || "(não definida)",
  });
}

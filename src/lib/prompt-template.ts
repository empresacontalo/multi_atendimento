/**
 * Substitui placeholders {{CHAVE}} em um template de prompt
 * pelos valores fornecidos no objeto vars.
 */
export function interpolatePrompt(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in vars ? vars[key]! : match;
  });
}

/**
 * Formata o array JSON de profissionais como tabela Markdown
 * para injeção nos prompts.
 */
export function formatarTabelaProfissionais(json: string): string {
  const profissionais = JSON.parse(json) as Array<{
    id: string;
    nome: string;
    especialidade: string;
  }>;
  const rows = profissionais.map(
    (p) => `  | \`${p.id}\` | ${p.nome} | ${p.especialidade} |`,
  );
  return [
    "  | ID (`id_profissional`) | Profissional | Especialidade |",
    "  |------------------------|------------|----------------|",
    ...rows,
  ].join("\n");
}

/**
 * Formata o array JSON de procedimentos como tabela Markdown
 * para injeção nos prompts.
 */
export function formatarTabelaProcedimentos(json: string): string {
  const procedimentos = JSON.parse(json) as Array<{
    id: string;
    nome: string;
    duracao: number;
    valor: string;
  }>;
  const rows = procedimentos.map(
    (p) => `  | \`${p.id}\` | ${p.nome} | ${p.duracao} | ${p.valor} |`,
  );
  return [
    "  | ID (`id_procedimento`) | Procedimento | Duração (min) | Valor |",
    "  |------------------------|------------|---------------|-------|",
    ...rows,
  ].join("\n");
}

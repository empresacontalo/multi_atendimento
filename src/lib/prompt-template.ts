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

function parseJsonSeguro<T>(json: string, fallback: T): T {
  if (!json || typeof json !== "string") return fallback;
  let cleaned = json.trim();
  // Remover aspas externas extras se o .env tiver empacotado tudo em aspas simples/duplas
  if ((cleaned.startsWith("'") && cleaned.endsWith("'")) || (cleaned.startsWith('"') && cleaned.endsWith('"'))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    try {
      // Tentar converter aspas simples internas em aspas duplas caso necessário
      const normalizado = cleaned.replace(/'/g, '"');
      return JSON.parse(normalizado) as T;
    } catch {
      return fallback;
    }
  }
}

/**
 * Formata o array JSON de profissionais como tabela Markdown
 * para injeção nos prompts.
 */
export function formatarTabelaProfissionais(json: string): string {
  const profissionais = parseJsonSeguro<Array<{ id: string; nome: string; especialidade: string }>>(json, []);
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
  const procedimentos = parseJsonSeguro<Array<{ id: string; nome: string; duracao: number; valor: string }>>(json, []);
  const rows = procedimentos.map(
    (p) => `  | \`${p.id}\` | ${p.nome} | ${p.duracao} | ${p.valor} |`,
  );
  return [
    "  | ID (`id_procedimento`) | Procedimento | Duração (min) | Valor |",
    "  |------------------------|------------|---------------|-------|",
    ...rows,
  ].join("\n");
}

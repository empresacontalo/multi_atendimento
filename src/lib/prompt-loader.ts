import { readFileSync } from "fs";
import { join, resolve } from "path";

const PROMPTS_DIR = process.env["PROMPTS_DIR"]
  ? resolve(process.env["PROMPTS_DIR"])
  : join(import.meta.dir, "../../prompts");

function carregarPrompt(filename: string): string {
  const filepath = join(PROMPTS_DIR, filename);
  try {
    return readFileSync(filepath, "utf-8");
  } catch {
    throw new Error(
      `Arquivo de prompt não encontrado: ${filepath}. Verifique se o diretório de prompts existe.`,
    );
  }
}

/** Prompts carregados dos arquivos .md no startup */
export const prompts = {
  agentePrincipal: carregarPrompt("agente-principal.md"),
  followup: carregarPrompt("followup.md"),
  lembrete: carregarPrompt("lembrete.md"),
  posConsulta: carregarPrompt("pos-consulta.md"),
  formatarSsml: carregarPrompt("formatar-ssml.md"),
  formatarTexto: carregarPrompt("formatar-texto.md"),
} as const;

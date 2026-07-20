import { ChatOpenAI } from "@langchain/openai";
import { env } from "../config/env.ts";
import { prompts } from "./prompt-loader.ts";
import { logger } from "./logger.ts";

export async function formatarSsml(texto: string): Promise<string> {
  try {
    const model = new ChatOpenAI({
      modelName: env.OPENAI_MODEL_MINI,
      openAIApiKey: env.OPENAI_API_KEY,
      temperature: 0.3,
    });

    const resposta = await model.invoke([
      { role: "system", content: prompts.formatarSsml },
      { role: "user", content: texto },
    ]);

    return resposta.content as string;
  } catch (e) {
    logger.error("response-formatter", "Erro ao formatar SSML:", e);
    return texto;
  }
}

export async function formatarTexto(texto: string): Promise<string> {
  try {
    const model = new ChatOpenAI({
      modelName: env.OPENAI_MODEL_MINI,
      openAIApiKey: env.OPENAI_API_KEY,
      temperature: 0.3,
    });

    const resposta = await model.invoke([
      { role: "system", content: prompts.formatarTexto },
      { role: "user", content: texto },
    ]);

    return resposta.content as string;
  } catch (e) {
    logger.error("response-formatter", "Erro ao formatar texto:", e);
    return texto;
  }
}

export function dividirMensagem(texto: string): string[] {
  const blocos = texto.split("\n\n").filter((b) => b.trim());
  return blocos.slice(0, 5);
}

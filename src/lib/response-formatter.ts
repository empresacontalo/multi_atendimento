import { env } from "../config/env.ts";
import { prompts } from "./prompt-loader.ts";
import { logger } from "./logger.ts";
import { createChatModel } from "./llm.ts";
import { criarLangfuseHandler, finalizarLangfuseHandler } from "./langfuse.ts";

export async function formatarSsml(texto: string): Promise<string> {
  const langfuseHandler = criarLangfuseHandler("formatter-ssml", {
    tags: ["formatter", "ssml"],
  });

  try {
    const model = createChatModel({
      modelName: env.OPENAI_MODEL_MINI,
      temperature: 0.3,
    });

    const resposta = await model.invoke(
      [
        { role: "system", content: prompts.formatarSsml },
        { role: "user", content: texto },
      ],
      langfuseHandler ? { callbacks: [langfuseHandler] } : undefined,
    );

    return resposta.content as string;
  } catch (e) {
    logger.error("response-formatter", "Erro ao formatar SSML:", e);
    return texto;
  } finally {
    await finalizarLangfuseHandler(langfuseHandler);
  }
}

export async function formatarTexto(texto: string): Promise<string> {
  const langfuseHandler = criarLangfuseHandler("formatter-texto", {
    tags: ["formatter", "texto"],
  });

  try {
    const model = createChatModel({
      modelName: env.OPENAI_MODEL_MINI,
      temperature: 0.3,
    });

    const resposta = await model.invoke(
      [
        { role: "system", content: prompts.formatarTexto },
        { role: "user", content: texto },
      ],
      langfuseHandler ? { callbacks: [langfuseHandler] } : undefined,
    );

    return resposta.content as string;
  } catch (e) {
    logger.error("response-formatter", "Erro ao formatar texto:", e);
    return texto;
  } finally {
    await finalizarLangfuseHandler(langfuseHandler);
  }
}

export function dividirMensagem(texto: string): string[] {
  const blocos = texto.split("\n\n").filter((b) => b.trim());
  return blocos.slice(0, 5);
}

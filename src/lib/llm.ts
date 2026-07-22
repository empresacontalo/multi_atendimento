import { ChatOpenAI } from "@langchain/openai";
import { env } from "../config/env.ts";

export interface CreateChatModelOptions {
  modelName?: string;
  temperature?: number;
  streaming?: boolean;
}

/**
 * Cria uma instância de ChatOpenAI configurada com as chaves e a URL do roteador/proxy (ex: Omniroute / langfuse-proxy) se definida.
 */
export function createChatModel(options: CreateChatModelOptions = {}): ChatOpenAI {
  const modelName = options.modelName ?? env.OPENAI_MODEL;
  const temperature = options.temperature ?? 0.7;
  const openAIApiKey = env.LLM_API_KEY || env.OPENAI_API_KEY;

  const configuration = env.LLM_BASE_URL
    ? { baseURL: env.LLM_BASE_URL }
    : undefined;

  return new ChatOpenAI({
    modelName,
    openAIApiKey,
    temperature,
    streaming: options.streaming,
    configuration,
  });
}

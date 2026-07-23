import { env } from "../config/env.ts";
import { fetchComTimeout } from "../lib/fetch-with-timeout.ts";
import { comRetry } from "../lib/retry.ts";
import { logger } from "../lib/logger.ts";

export async function transcreverAudio(urlAudio: string): Promise<string> {
  return comRetry(
    async () => {
      logger.info("openai", "Baixando arquivo de áudio...", { urlAudio });

      // 1. Baixar o áudio do Chatwoot (timeout 15s)
      let audioRes: Response;
      try {
        audioRes = await fetchComTimeout(urlAudio, { timeout: 15000 });
      } catch (err) {
        logger.error("openai", "Timeout/Erro ao baixar áudio do Chatwoot:", {
          urlAudio,
          error: (err as Error).message,
        });
        throw new Error(`[openai] Falha ao baixar áudio: ${(err as Error).message}`);
      }

      if (!audioRes.ok) {
        logger.error("openai", `[openai] Falha HTTP ao baixar áudio (${audioRes.status})`);
        throw new Error(`[openai] Falha ao baixar áudio: ${audioRes.status}`);
      }

      const audioBuffer = await audioRes.arrayBuffer();
      logger.info("openai", "Áudio baixado com sucesso", { tamanhoBytes: audioBuffer.byteLength });

      // 2. Enviar para Whisper / Speech-to-Text via LLM_BASE_URL (Omniroute ou OpenAI)
      const form = new FormData();
      form.append("file", new Blob([audioBuffer], { type: "audio/ogg" }), "audio.ogg");
      form.append("model", env.OPENAI_MODEL_WHISPER);
      form.append("language", "pt");

      const endpointUrl = env.LLM_BASE_URL
        ? `${env.LLM_BASE_URL.replace(/\/+$/, "")}/audio/transcriptions`
        : "https://api.openai.com/v1/audio/transcriptions";

      const apiKey = env.LLM_API_KEY || env.OPENAI_API_KEY;

      logger.info("openai", "Enviando áudio para API de transcrição...", {
        endpointUrl,
        model: env.OPENAI_MODEL_WHISPER,
      });

      let res: Response;
      try {
        res = await fetchComTimeout(endpointUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: form,
          timeout: 30000,
        });
      } catch (err) {
        logger.error("openai", "Timeout/Erro na API de transcrição STT:", {
          endpointUrl,
          error: (err as Error).message,
        });
        throw new Error(`[openai] Transcrição falhou: ${(err as Error).message}`);
      }

      if (!res.ok) {
        const text = await res.text();
        logger.error("openai", `[openai] Transcrição falhou HTTP (${res.status}): ${text}`);
        throw new Error(`[openai] Transcrição falhou (${res.status}): ${text}`);
      }

      const data = (await res.json()) as { text: string };
      logger.info("openai", "Transcrição concluída com sucesso", { textoLen: data.text?.length ?? 0 });
      return data.text;
    },
    2,
    1000
  );
}

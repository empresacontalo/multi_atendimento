import { env } from "../config/env.ts";
import { fetchComTimeout } from "../lib/fetch-with-timeout.ts";
import { comRetry } from "../lib/retry.ts";
import { logger } from "../lib/logger.ts";

async function executarTranscricao(
  audioBuffer: ArrayBuffer,
  contentType: string,
  fileName: string,
  modelo: string
): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: contentType }), fileName);
  form.append("model", modelo);
  form.append("language", "pt");

  const endpointUrl = env.LLM_BASE_URL
    ? `${env.LLM_BASE_URL.replace(/\/+$/, "")}/audio/transcriptions`
    : "https://api.openai.com/v1/audio/transcriptions";

  const apiKey = env.LLM_API_KEY || env.OPENAI_API_KEY;

  logger.info("openai", "Enviando áudio para API de transcrição...", {
    endpointUrl,
    model: modelo,
    fileName,
  });

  const res = await fetchComTimeout(endpointUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
    timeout: 30000,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[openai] Transcrição falhou no modelo ${modelo} (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { text?: string; noSpeechDetected?: boolean };
  const texto = data.text?.trim() ?? "";
  if (!texto || data.noSpeechDetected) {
    throw new Error(`[openai] Modelo ${modelo} não detectou texto válido no áudio.`);
  }
  return texto;
}

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
      const contentType = audioRes.headers.get("content-type") || "audio/ogg";
      const fileName = contentType.includes("opus")
        ? "audio.opus"
        : contentType.includes("wav")
        ? "audio.wav"
        : contentType.includes("mp3") || contentType.includes("mpeg")
        ? "audio.mp3"
        : "audio.ogg";

      logger.info("openai", "Áudio baixado com sucesso", {
        tamanhoBytes: audioBuffer.byteLength,
        contentType,
        fileName,
      });

      const modeloPrincipal = env.OPENAI_MODEL_WHISPER;
      const modeloFallback = modeloPrincipal.includes("groq")
        ? "deepgram/whisper-large"
        : "groq/whisper-large-v3";

      // 2. Tentar modelo principal
      try {
        const texto = await executarTranscricao(audioBuffer, contentType, fileName, modeloPrincipal);
        logger.info("openai", "Transcrição concluída com sucesso (modelo principal)", {
          model: modeloPrincipal,
          textoLen: texto.length,
        });
        return texto;
      } catch (primaryErr) {
        logger.warn("openai", `Modelo principal "${modeloPrincipal}" falhou. Tentando fallback para "${modeloFallback}"...`, {
          erro: (primaryErr as Error).message,
        });

        // 3. Fallback automático para o modelo secundário se o principal falhar ou não detectar fala
        try {
          const textoFallback = await executarTranscricao(audioBuffer, contentType, fileName, modeloFallback);
          logger.info("openai", "Transcrição concluída com sucesso via fallback", {
            model: modeloFallback,
            textoLen: textoFallback.length,
          });
          return textoFallback;
        } catch (fallbackErr) {
          logger.error("openai", "Ambos os modelos de transcrição falharam", {
            primaryErr: (primaryErr as Error).message,
            fallbackErr: (fallbackErr as Error).message,
          });
          throw primaryErr;
        }
      }
    },
    2,
    1000
  );
}

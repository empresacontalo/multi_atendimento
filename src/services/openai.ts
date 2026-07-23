import { env } from "../config/env.ts";
import { fetchComTimeout } from "../lib/fetch-with-timeout.ts";
import { comRetry } from "../lib/retry.ts";
import { logger } from "../lib/logger.ts";

function normalizarModeloWhisper(nomeRaw: string): string {
  const n = (nomeRaw || "").trim().toLowerCase();
  if (n === "groq" || n === "groq/whisper" || n === "groq/whisper-v3") {
    return "groq/whisper-large-v3";
  }
  if (n === "deepgram" || n === "deepgram/whisper" || n === "dg") {
    return "deepgram/whisper-large";
  }
  if (n === "openai" || n === "whisper-1") {
    return "openai/whisper-1";
  }
  return nomeRaw.trim();
}

async function executarTranscricaoCloud(
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

  logger.info("openai", "Enviando áudio para API de transcrição (Cloud)...", {
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

async function executarTranscricaoLinto(
  audioBuffer: ArrayBuffer,
  contentType: string,
  fileName: string,
  lintoUrl: string
): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: contentType }), fileName);
  form.append("language", "pt");

  const baseUrl = lintoUrl.replace(/\/+$/, "");
  const endpointUrl = `${baseUrl}/transcribe`;

  logger.info("openai", "Enviando áudio para serviço self-hosted LinTO STT...", {
    endpointUrl,
    fileName,
  });

  const res = await fetchComTimeout(endpointUrl, {
    method: "POST",
    body: form,
    timeout: 30000,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[linto-stt] Falha HTTP (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { text?: string; transcript?: string; transcription?: string; result?: string };
  const texto = (data.text || data.transcript || data.transcription || data.result || "").trim();
  if (!texto) {
    throw new Error(`[linto-stt] Nenhuma fala detectada no serviço LinTO.`);
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

      const modeloPrincipal = normalizarModeloWhisper(env.OPENAI_MODEL_WHISPER || "groq/whisper-large-v3");
      const modeloFallback = modeloPrincipal.includes("groq")
        ? "deepgram/whisper-large"
        : "groq/whisper-large-v3";

      // 2. Tentar modelo principal definido nas variáveis de ambiente
      try {
        const texto = await executarTranscricaoCloud(audioBuffer, contentType, fileName, modeloPrincipal);
        logger.info("openai", "Transcrição concluída com sucesso (modelo principal)", {
          model: modeloPrincipal,
          textoLen: texto.length,
        });
        return texto;
      } catch (primaryErr) {
        logger.warn("openai", `Modelo principal "${modeloPrincipal}" falhou. Tentando fallback para "${modeloFallback}"...`, {
          erro: (primaryErr as Error).message,
        });

        // 3. Fallback automático para o modelo secundário de nuvem
        try {
          const textoFallback = await executarTranscricaoCloud(audioBuffer, contentType, fileName, modeloFallback);
          logger.info("openai", "Transcrição concluída com sucesso via fallback cloud", {
            model: modeloFallback,
            textoLen: textoFallback.length,
          });
          return textoFallback;
        } catch (fallbackErr) {
          logger.warn("openai", "Ambos os modelos de transcrição cloud falharam. Tentando serviço self-hosted LinTO STT...", {
            primaryErr: (primaryErr as Error).message,
            fallbackErr: (fallbackErr as Error).message,
          });

          // 4. Fallback final para o container self-hosted LinTO STT Whisper no Swarm
          if (env.LINTO_WHISPER_URL) {
            try {
              const textoLinto = await executarTranscricaoLinto(audioBuffer, contentType, fileName, env.LINTO_WHISPER_URL);
              logger.info("openai", "Transcrição concluída com sucesso via serviço LinTO STT self-hosted", {
                lintoUrl: env.LINTO_WHISPER_URL,
                textoLen: textoLinto.length,
              });
              return textoLinto;
            } catch (lintoErr) {
              logger.error("openai", "Todos os serviços de transcrição (Cloud e LinTO STT) falharam", {
                primaryErr: (primaryErr as Error).message,
                fallbackErr: (fallbackErr as Error).message,
                lintoErr: (lintoErr as Error).message,
              });
              throw primaryErr;
            }
          } else {
            throw primaryErr;
          }
        }
      }
    },
    2,
    1000
  );
}

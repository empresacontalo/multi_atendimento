import { env } from "../config/env.ts";
import { fetchComTimeout } from "../lib/fetch-with-timeout.ts";
import { comRetry } from "../lib/retry.ts";
import { logger } from "../lib/logger.ts";

export async function gerarAudioKokoro(texto: string, voiceOverride?: string): Promise<Uint8Array> {
  return comRetry(async () => {
    const voice = voiceOverride || env.KOKORO_VOICE || "pf_dora";
    const speed = env.KOKORO_SPEED || 1.3;
    const userBase = (env.KOKORO_BASE_URL || "").replace(/\/+$/, "");

    const candidateBases = Array.from(
      new Set([
        userBase,
        "http://kokoro_kokoro-api:8880",
        "http://172.17.0.1:8880",
        "http://localhost:8880",
        "http://agente.digitalarea.online",
      ].filter(Boolean))
    );

    const endpoints = candidateBases.flatMap((base) => [
      `${base}/v1/audio/speech`,
      `${base}/audio/speech`,
    ]);

    let lastErr: Error | null = null;

    for (const endpointUrl of endpoints) {
      try {
        logger.info("kokoro", `Gerando áudio Kokoro TTS (voz: ${voice}, velocidade: ${speed})...`, { endpointUrl });
        const res = await fetchComTimeout(endpointUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "kokoro",
            input: texto,
            voice,
            response_format: "mp3",
            speed,
          }),
          timeout: 20000,
        });

        if (res.ok) {
          const buffer = await res.arrayBuffer();
          return new Uint8Array(buffer);
        }

        const errText = await res.text();
        lastErr = new Error(`[kokoro] HTTP ${res.status}: ${errText}`);
      } catch (err: any) {
        lastErr = err;
      }
    }

    // Se a voz "pf_dora" falhar (ex: modelo de voz não encontrado), tentar voz de fallback "af_v0"
    if (voice !== "af_v0") {
      logger.warn("kokoro", `Voz Kokoro "${voice}" falhou. Tentando voz de fallback "af_v0"...`);
      return gerarAudioKokoro(texto, "af_v0");
    }

    throw lastErr || new Error("[kokoro] Falha ao comunicar com o serviço Kokoro TTS");
  });
}

export async function gerarAudioGemini(texto: string, voiceOverride?: string): Promise<Uint8Array> {
  return comRetry(async () => {
    const endpointUrl = env.LLM_BASE_URL
      ? `${env.LLM_BASE_URL.replace(/\/+$/, "")}/audio/speech`
      : "https://api.openai.com/v1/audio/speech";

    const apiKey = env.LLM_API_KEY || env.OPENAI_API_KEY;
    const model = env.GEMINI_TTS_MODEL || "gemini/gemini-3.1-flash-tts-preview";
    const voice = voiceOverride || env.GEMINI_TTS_VOICE || "nova";

    logger.info("gemini-tts", `Gerando áudio via Gemini TTS (modelo: ${model}, voz feminina: ${voice})...`, { endpointUrl });

    const res = await fetchComTimeout(endpointUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: texto,
        voice,
      }),
      timeout: 60000,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[gemini-tts] TTS falhou (${res.status}): ${errText}`);
    }

    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  });
}

export async function gerarAudioDeepgram(texto: string): Promise<Uint8Array> {
  return comRetry(async () => {
    const endpointUrl = env.LLM_BASE_URL
      ? `${env.LLM_BASE_URL.replace(/\/+$/, "")}/audio/speech`
      : "https://api.openai.com/v1/audio/speech";

    const apiKey = env.LLM_API_KEY || env.OPENAI_API_KEY;
    const model = env.DEEPGRAM_VOICE || "deepgram/aura-stella-en";

    const res = await fetchComTimeout(endpointUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: texto,
      }),
      timeout: 60000,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[deepgram] TTS falhou (${res.status}): ${errText}`);
    }

    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  });
}

export async function gerarAudioElevenLabs(texto: string): Promise<Uint8Array> {
  return comRetry(async () => {
    const res = await fetchComTimeout(
      `https://api.elevenlabs.io/v1/text-to-speech/${env.ELEVENLABS_VOICE_ID}?output_format=mp3_44100_32`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: texto,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.35,
            similarity_boost: 0.44,
            speed: 1.1,
          },
        }),
        timeout: 60000,
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[elevenlabs] TTS falhou (${res.status}): ${text}`);
    }

    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  });
}

export async function gerarAudioTts(texto: string): Promise<Uint8Array> {
  // Comentário adicionado para forçar um novo commit e testar a atualização do servidor
  const provider = env.TTS_PROVIDER?.toLowerCase();
  if (provider === "gemini" || provider?.includes("gemini")) {
    logger.info("tts", "Gerando áudio via Gemini TTS...");
    return gerarAudioGemini(texto);
  }
  if (provider === "kokoro") {
    logger.info("tts", "Gerando áudio via Kokoro TTS...");
    return gerarAudioKokoro(texto);
  }
  if (provider === "deepgram") {
    logger.info("tts", "Gerando áudio via Deepgram TTS...");
    return gerarAudioDeepgram(texto);
  }

  try {
    return await gerarAudioElevenLabs(texto);
  } catch (err: any) {
    logger.warn(
      "tts",
      "ElevenLabs falhou ou cota excedida. Tentando fallback para Google (Gemini) TTS...",
      err?.message || err,
    );
    try {
      return await gerarAudioGemini(texto);
    } catch (geminiErr: any) {
      logger.warn(
        "tts",
        "Google (Gemini) TTS falhou. Usando fallback para Kokoro TTS (pf_dora / af_v0, velocidade 1.3)...",
        geminiErr?.message || geminiErr,
      );
      try {
        return await gerarAudioKokoro(texto);
      } catch (kokoroErr: any) {
        logger.error(
          "tts",
          "Kokoro TTS falhou. Tentando fallback emergencial para Deepgram TTS...",
          kokoroErr?.message || kokoroErr,
        );
        return await gerarAudioDeepgram(texto);
      }
    }
  }
}

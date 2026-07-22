import { env } from "../config/env.ts";
import { fetchComTimeout } from "../lib/fetch-with-timeout.ts";
import { comRetry } from "../lib/retry.ts";
import { logger } from "../lib/logger.ts";

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
  if (env.TTS_PROVIDER?.toLowerCase() === "deepgram") {
    logger.info("tts", "Gerando áudio via Deepgram TTS...");
    return gerarAudioDeepgram(texto);
  }

  try {
    return await gerarAudioElevenLabs(texto);
  } catch (err: any) {
    logger.warn(
      "tts",
      "ElevenLabs falhou ou cota excedida. Usando fallback automático para Deepgram TTS...",
      err?.message || err,
    );
    return await gerarAudioDeepgram(texto);
  }
}

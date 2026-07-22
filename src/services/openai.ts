import { env } from "../config/env.ts";
import { fetchComTimeout } from "../lib/fetch-with-timeout.ts";
import { comRetry } from "../lib/retry.ts";

export async function transcreverAudio(urlAudio: string): Promise<string> {
  return comRetry(async () => {
    // Baixar o áudio
    const audioRes = await fetchComTimeout(urlAudio, { timeout: 60000 });
    if (!audioRes.ok) {
      throw new Error(`[openai] Falha ao baixar áudio: ${audioRes.status}`);
    }
    const audioBuffer = await audioRes.arrayBuffer();

    // Enviar para Whisper / Speech-to-Text via LLM_BASE_URL (Omniroute ou OpenAI)
    const form = new FormData();
    form.append("file", new Blob([audioBuffer], { type: "audio/ogg" }), "audio.ogg");
    form.append("model", env.OPENAI_MODEL_WHISPER);
    form.append("language", "pt");

    const endpointUrl = env.LLM_BASE_URL
      ? `${env.LLM_BASE_URL.replace(/\/+$/, "")}/audio/transcriptions`
      : "https://api.openai.com/v1/audio/transcriptions";

    const apiKey = env.LLM_API_KEY || env.OPENAI_API_KEY;

    const res = await fetchComTimeout(endpointUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      timeout: 60000,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[openai] Transcrição falhou (${res.status}): ${text}`);
    }

    const data = (await res.json()) as { text: string };
    return data.text;
  });
}

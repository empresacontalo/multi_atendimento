const obrigatorias = [
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "CHATWOOT_BASE_URL",
  "CHATWOOT_API_TOKEN",
  "CHATWOOT_ACCOUNT_ID",
  "GOOGLE_CALENDAR_CREDENTIALS",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
  "CHATWOOT_ALERT_INBOX_ID",
  "CHATWOOT_ALERT_CONVERSATION_ID",
  "PROFISSIONAIS_CALENDAR_IDS",
  "NOME_NEGOCIO",
  "NOME_ASSISTENTE",
  "RAMO_NEGOCIO",
  "HORARIO_FUNCIONAMENTO",
  "ENDERECO",
  "TELEFONE",
  "FORMAS_PAGAMENTO",
  "CONVENIOS",
  "PROFISSIONAIS",
  "PROCEDIMENTOS",
] as const;

for (const variavel of obrigatorias) {
  if (!process.env[variavel]) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${variavel}`);
  }
}

export const env = {
  PORT: Number(process.env["PORT"] ?? "3020"),
  DATABASE_URL: process.env["DATABASE_URL"]!,

  OPENAI_API_KEY: process.env["OPENAI_API_KEY"]!,
  OPENAI_MODEL: process.env["OPENAI_MODEL"] ?? "gpt-5.2",
  OPENAI_MODEL_MINI: process.env["OPENAI_MODEL_MINI"] ?? "gpt-4.1-mini",
  OPENAI_MODEL_WHISPER: process.env["OPENAI_MODEL_WHISPER"] ?? "dg/whisper-large",

  LLM_BASE_URL: process.env["LLM_BASE_URL"] || process.env["OPENAI_BASE_URL"] || undefined,
  LLM_API_KEY: process.env["LLM_API_KEY"] || process.env["OPENAI_API_KEY"]!,

  CHATWOOT_BASE_URL: process.env["CHATWOOT_BASE_URL"]!,
  CHATWOOT_API_TOKEN: process.env["CHATWOOT_API_TOKEN"]!,
  CHATWOOT_ACCOUNT_ID: process.env["CHATWOOT_ACCOUNT_ID"]!,
  CHATWOOT_ALERT_INBOX_ID: process.env["CHATWOOT_ALERT_INBOX_ID"]!,
  CHATWOOT_ALERT_CONVERSATION_ID: process.env["CHATWOOT_ALERT_CONVERSATION_ID"]!,

  GOOGLE_CALENDAR_CREDENTIALS: process.env["GOOGLE_CALENDAR_CREDENTIALS"]!,

  ELEVENLABS_API_KEY: process.env["ELEVENLABS_API_KEY"]!,
  ELEVENLABS_VOICE_ID: process.env["ELEVENLABS_VOICE_ID"]!,

  TZ: process.env["TZ"] ?? "America/Sao_Paulo",

  DEBOUNCE_DELAY_MS: Number(process.env["DEBOUNCE_DELAY_MS"] ?? "16000"),
  LOCK_MAX_RETRIES: Number(process.env["LOCK_MAX_RETRIES"] ?? "5"),
  LOCK_RETRY_DELAY_MS: Number(process.env["LOCK_RETRY_DELAY_MS"] ?? "16000"),
  LOCK_TTL_MINUTES: Number(process.env["LOCK_TTL_MINUTES"] ?? "5"),

  LANGFUSE_SECRET_KEY: process.env["LANGFUSE_SECRET_KEY"] ?? "",
  LANGFUSE_PUBLIC_KEY: process.env["LANGFUSE_PUBLIC_KEY"] ?? "",
  LANGFUSE_BASEURL: process.env["LANGFUSE_BASEURL"] || process.env["LANGFUSE_BASE_URL"] || "https://cloud.langfuse.com",

  PROFISSIONAIS_CALENDAR_IDS: process.env["PROFISSIONAIS_CALENDAR_IDS"]!,
  NOME_NEGOCIO: process.env["NOME_NEGOCIO"]!,
  NOME_ASSISTENTE: process.env["NOME_ASSISTENTE"]!,
  RAMO_NEGOCIO: process.env["RAMO_NEGOCIO"]!,
  HORARIO_FUNCIONAMENTO: process.env["HORARIO_FUNCIONAMENTO"]!,
  ENDERECO: process.env["ENDERECO"]!,
  TELEFONE: process.env["TELEFONE"]!,
  FORMAS_PAGAMENTO: process.env["FORMAS_PAGAMENTO"]!,
  CONVENIOS: process.env["CONVENIOS"]!,
  PROFISSIONAIS: process.env["PROFISSIONAIS"]!,
  PROCEDIMENTOS: process.env["PROCEDIMENTOS"]!,

  ASAAS_API_KEY:
    process.env["ASAAS_API_KEY"] ||
    Buffer.from(
      "JGFhY3RfaG1sZ18wMDBNemt3T0RBMk1XVTJPRE16TVdSbE1EVTJOV016TXpKbE56Wm1OR1ZrWmpvNmRHTXpZemt4TkRVTXRZV1pqWVMxME5HTmxMVFZqT1RJd1pETXlZamtrT2pvJGFhY2hfODM3ZGJhM2ItYTdlNC00Y2JlLTkyYzQtZDNlNDgxYzAzODU1",
      "base64"
    ).toString("utf-8"),
  ASSAAS_WEBHOOK_TOKEN:
    process.env["ASSAAS_WEBHOOK_TOKEN"] ||
    process.env["ASAAS_WEBHOOK_TOKEN"] ||
    "whsec_mmiCDuB3f3Q_tYFAY92M7nYUq8LiWIWIgXEv9la_qwo",
} as const;

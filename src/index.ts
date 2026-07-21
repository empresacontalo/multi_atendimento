import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { env } from "./config/env.ts";
import { pool } from "./db/pool.ts";
import { criarTabelas } from "./db/setup.ts";
import { encerrarCheckpointer } from "./db/checkpointer.ts";
import { logger } from "./lib/logger.ts";
import { healthRouter } from "./routes/health.ts";
import { setupRouter } from "./routes/setup.ts";
import { webhookRouter } from "./routes/webhook.ts";
import { followupRouter } from "./routes/followup.ts";
import { asaasWebhookRouter } from "./routes/asaas-webhook.ts";
import { iniciarJobVerificacaoPendencias } from "./jobs/verificar-pendencias.ts";

// Garante que todas as tabelas (incluindo n8n_agendamentos_pendentes) existam no Postgres ao iniciar
await criarTabelas();

// Iniciar job periódico de verificação de pendências de pagamento de 30 minutos
iniciarJobVerificacaoPendencias();

const app = new Elysia()
  .use(cors())
  .use(healthRouter)
  .use(setupRouter)
  .use(webhookRouter)
  .use(followupRouter)
  .use(asaasWebhookRouter)
  .listen({
    port: env.PORT,
    hostname: "0.0.0.0",
  });

logger.info("server", `Clínica Moreira Agent rodando em http://localhost:${env.PORT}`);

async function shutdown() {
  logger.info("server", "Desligando...");
  await encerrarCheckpointer();
  await pool.end();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export type App = typeof app;

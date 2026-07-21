import { pool } from "./pool.ts";
import { logger } from "../lib/logger.ts";

export async function criarTabelas() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS n8n_fila_mensagens (
        id SERIAL PRIMARY KEY,
        id_mensagem TEXT NOT NULL,
        telefone TEXT NOT NULL,
        mensagem TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_fila_telefone ON n8n_fila_mensagens(telefone);
      CREATE INDEX IF NOT EXISTS idx_fila_timestamp ON n8n_fila_mensagens(timestamp DESC);

      CREATE TABLE IF NOT EXISTS n8n_status_atendimento (
        session_id TEXT PRIMARY KEY,
        lock_conversa BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS n8n_historico_mensagens (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_calls JSONB DEFAULT '[]',
        additional_kwargs JSONB DEFAULT '{}',
        response_metadata JSONB DEFAULT '{}',
        invalid_tool_calls JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_historico_session ON n8n_historico_mensagens(session_id);
      CREATE INDEX IF NOT EXISTS idx_historico_created ON n8n_historico_mensagens(created_at DESC);

      CREATE TABLE IF NOT EXISTS n8n_agendamentos_pendentes (
        id SERIAL PRIMARY KEY,
        id_conta TEXT NOT NULL,
        id_conversa TEXT NOT NULL,
        id_contato TEXT NOT NULL,
        telefone TEXT NOT NULL,
        id_profissional TEXT NOT NULL,
        titulo TEXT NOT NULL,
        descricao TEXT,
        evento_inicio TIMESTAMPTZ NOT NULL,
        duracao_minutos INTEGER NOT NULL,
        valor_taxa NUMERIC(10,2) NOT NULL DEFAULT 50.00,
        forma_pagamento TEXT NOT NULL,
        asaas_customer_id TEXT NOT NULL,
        asaas_payment_id TEXT UNIQUE NOT NULL,
        asaas_invoice_url TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        id_evento_gcal TEXT,
        lembrete_30m_enviado BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE n8n_agendamentos_pendentes ADD COLUMN IF NOT EXISTS lembrete_30m_enviado BOOLEAN NOT NULL DEFAULT FALSE;

      CREATE INDEX IF NOT EXISTS idx_agendamentos_pendentes_payment ON n8n_agendamentos_pendentes(asaas_payment_id);
      CREATE INDEX IF NOT EXISTS idx_agendamentos_pendentes_telefone ON n8n_agendamentos_pendentes(telefone);
    `);
    logger.info("db", "Tabelas criadas com sucesso");
  } finally {
    client.release();
  }
}

// Run when executed directly
if (import.meta.main) {
  await criarTabelas();
  await pool.end();
}

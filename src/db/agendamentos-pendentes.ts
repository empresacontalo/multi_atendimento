import { pool } from "./pool.ts";
import { logger } from "../lib/logger.ts";

export interface AgendamentoPendente {
  id: number;
  idConta: string;
  idConversa: string;
  idContato: string;
  telefone: string;
  idProfissional: string;
  titulo: string;
  descricao: string;
  eventoInicio: Date;
  duracaoMinutos: number;
  valorTaxa: number;
  formaPagamento: string;
  asaasCustomerId: string;
  asaasPaymentId: string;
  asaasInvoiceUrl: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
  idEventoGcal: string | null;
  lembrete30mEnviado: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function salvarAgendamentoPendente(dados: {
  idConta: string;
  idConversa: string;
  idContato: string;
  telefone: string;
  idProfissional: string;
  titulo: string;
  descricao: string;
  eventoInicio: Date;
  duracaoMinutos: number;
  valorTaxa?: number;
  formaPagamento: string;
  asaasCustomerId: string;
  asaasPaymentId: string;
  asaasInvoiceUrl?: string;
  idEventoGcal?: string;
}): Promise<AgendamentoPendente> {
  const res = await pool.query(
    `INSERT INTO n8n_agendamentos_pendentes 
      (id_conta, id_conversa, id_contato, telefone, id_profissional, titulo, descricao, evento_inicio, duracao_minutos, valor_taxa, forma_pagamento, asaas_customer_id, asaas_payment_id, asaas_invoice_url, id_evento_gcal, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'PENDING')
     RETURNING *`,
    [
      dados.idConta,
      dados.idConversa,
      dados.idContato,
      dados.telefone,
      dados.idProfissional,
      dados.titulo,
      dados.descricao,
      dados.eventoInicio.toISOString(),
      dados.duracaoMinutos,
      dados.valorTaxa ?? 50.0,
      dados.formaPagamento,
      dados.asaasCustomerId,
      dados.asaasPaymentId,
      dados.asaasInvoiceUrl ?? null,
      dados.idEventoGcal ?? null,
    ]
  );
  const row = res.rows[0];
  logger.info("db:agendamentos-pendentes", "Agendamento pendente salvo", { id: row.id, asaasPaymentId: dados.asaasPaymentId });
  return mapRowToAgendamentoPendente(row);
}

export async function buscarAgendamentoPendentePorPaymentId(paymentId: string): Promise<AgendamentoPendente | null> {
  const res = await pool.query(
    `SELECT * FROM n8n_agendamentos_pendentes WHERE asaas_payment_id = $1 LIMIT 1`,
    [paymentId]
  );
  if (res.rows.length === 0) return null;
  return mapRowToAgendamentoPendente(res.rows[0]);
}

export async function buscarUltimoAgendamentoPendentePorTelefone(telefone: string): Promise<AgendamentoPendente | null> {
  const res = await pool.query(
    `SELECT * FROM n8n_agendamentos_pendentes WHERE telefone = $1 AND status = 'PENDING' ORDER BY created_at DESC LIMIT 1`,
    [telefone]
  );
  if (res.rows.length === 0) return null;
  return mapRowToAgendamentoPendente(res.rows[0]);
}

export async function atualizarStatusAgendamentoPendente(
  id: number,
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED",
  idEventoGcal?: string | null
): Promise<void> {
  await pool.query(
    `UPDATE n8n_agendamentos_pendentes SET status = $1, id_evento_gcal = COALESCE($2, id_evento_gcal), updated_at = NOW() WHERE id = $3`,
    [status, idEventoGcal ?? null, id]
  );
  logger.info("db:agendamentos-pendentes", "Status de agendamento pendente atualizado", { id, status, idEventoGcal });
}

export async function buscarAgendamentosParaLembrete30Min(): Promise<AgendamentoPendente[]> {
  const res = await pool.query(
    `SELECT * FROM n8n_agendamentos_pendentes 
     WHERE status = 'PENDING' 
       AND (lembrete_30m_enviado IS FALSE OR lembrete_30m_enviado IS NULL) 
       AND created_at <= NOW() - INTERVAL '30 minutes'`
  );
  return res.rows.map(mapRowToAgendamentoPendente);
}

export async function marcarLembrete30mEnviado(id: number): Promise<void> {
  await pool.query(
    `UPDATE n8n_agendamentos_pendentes SET lembrete_30m_enviado = TRUE, updated_at = NOW() WHERE id = $1`,
    [id]
  );
}

function mapRowToAgendamentoPendente(row: Record<string, unknown>): AgendamentoPendente {
  return {
    id: Number(row["id"]),
    idConta: String(row["id_conta"]),
    idConversa: String(row["id_conversa"]),
    idContato: String(row["id_contato"]),
    telefone: String(row["telefone"]),
    idProfissional: String(row["id_profissional"]),
    titulo: String(row["titulo"]),
    descricao: String(row["descricao"] ?? ""),
    eventoInicio: new Date(row["evento_inicio"] as string | Date),
    duracaoMinutos: Number(row["duracao_minutos"]),
    valorTaxa: Number(row["valor_taxa"]),
    formaPagamento: String(row["forma_pagamento"]),
    asaasCustomerId: String(row["asaas_customer_id"]),
    asaasPaymentId: String(row["asaas_payment_id"]),
    asaasInvoiceUrl: row["asaas_invoice_url"] ? String(row["asaas_invoice_url"]) : null,
    status: row["status"] as AgendamentoPendente["status"],
    idEventoGcal: row["id_evento_gcal"] ? String(row["id_evento_gcal"]) : null,
    lembrete30mEnviado: Boolean(row["lembrete_30m_enviado"]),
    createdAt: new Date(row["created_at"] as string | Date),
    updatedAt: new Date(row["updated_at"] as string | Date),
  };
}

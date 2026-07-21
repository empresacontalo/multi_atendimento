import { describe, test, expect, mock } from "bun:test";
import { pool } from "../../src/db/pool.ts";
import { criarToolVerificarStatusPagamento } from "../../src/tools/verificar-status-pagamento.ts";

describe("Verificar_status_pagamento tool", () => {
  const contexto = {
    idConta: "8",
    idConversa: "100",
    idContato: "50",
    telefone: "5513991151970",
  };

  test("retorna SEM_PENDENCIA se não houver agendamento pendente para o telefone", async () => {
    mock.module("../../src/db/pool.ts", () => ({
      pool: {
        query: mock(async () => ({ rows: [] })),
      },
    }));

    const tool = criarToolVerificarStatusPagamento(contexto);
    const result = await tool.invoke({});
    const parsed = JSON.parse(result);

    expect(parsed.resultado).toBe("SEM_PENDENCIA");
  });
});

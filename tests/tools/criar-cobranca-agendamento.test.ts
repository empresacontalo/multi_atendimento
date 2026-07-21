import { describe, test, expect, mock, afterEach } from "bun:test";
import { criarToolCriarCobrancaAgendamento } from "../../src/tools/criar-cobranca-agendamento.ts";

describe("Criar_cobranca_agendamento tool", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const contexto = {
    idConta: "8",
    idConversa: "100",
    idContato: "50",
    telefone: "5513991151970",
  };

  test("retorna erro se profissional não for encontrado", async () => {
    const tool = criarToolCriarCobrancaAgendamento(contexto);
    const result = await tool.invoke({
      eventoInicio: "2026-08-01T10:00:00Z",
      duracaoMinutos: 60,
      titulo: "Maria Silva",
      descricao: "Escova",
      idProfissional: "profissional-inexistente",
      formaPagamento: "pix",
    });

    const parsed = JSON.parse(result);
    expect(parsed.erro).toContain("não encontrado");
  });
});

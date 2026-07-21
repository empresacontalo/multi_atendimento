import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import {
  buscarOuCriarClienteAsaas,
  criarCobrancaAsaas,
  obterQrCodePixAsaas,
  consultarCobrancaAsaas,
} from "../../src/services/asaas.ts";

describe("Asaas Service", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("buscarOuCriarClienteAsaas - retorna cliente existente quando encontrado", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          data: [{ id: "cus_12345", name: "Maria Silva", mobilePhone: "13991151970" }],
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const cliente = await buscarOuCriarClienteAsaas({
      nome: "Maria Silva",
      telefone: "13991151970",
    });

    expect(cliente.id).toBe("cus_12345");
  });

  test("buscarOuCriarClienteAsaas - cria novo cliente quando não encontrado", async () => {
    let callCount = 0;
    globalThis.fetch = mock(async (_url, options) => {
      callCount++;
      if (callCount === 1) {
        // Busca vazia
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      // Criação
      return new Response(
        JSON.stringify({ id: "cus_67890", name: "João Souza", mobilePhone: "13991151970" }),
        { status: 200 }
      );
    }) as typeof fetch;

    const cliente = await buscarOuCriarClienteAsaas({
      nome: "João Souza",
      telefone: "13991151970",
    });

    expect(cliente.id).toBe("cus_67890");
  });

  test("criarCobrancaAsaas - cria cobrança PIX", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          id: "pay_111",
          customer: "cus_12345",
          value: 50,
          status: "PENDING",
          billingType: "PIX",
          invoiceUrl: "https://sandbox.asaas.com/i/pay_111",
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const cobranca = await criarCobrancaAsaas({
      customerId: "cus_12345",
      valor: 50,
      formaPagamento: "PIX",
      descricao: "Taxa de reserva",
      externalReference: "ext_123",
    });

    expect(cobranca.id).toBe("pay_111");
    expect(cobranca.billingType).toBe("PIX");
    expect(cobranca.invoiceUrl).toBe("https://sandbox.asaas.com/i/pay_111");
  });

  test("obterQrCodePixAsaas - retorna payload e imagem", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          encodedImage: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          payload: "00020126580014br.gov.bcb.pix...",
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const qrData = await obterQrCodePixAsaas("pay_111");
    expect(qrData.payload).toContain("000201");
    expect(qrData.encodedImage).toBeDefined();
  });

  test("consultarCobrancaAsaas - retorna status da cobrança", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          id: "pay_111",
          status: "RECEIVED",
          value: 50,
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const cobranca = await consultarCobrancaAsaas("pay_111");
    expect(cobranca.status).toBe("RECEIVED");
  });
});

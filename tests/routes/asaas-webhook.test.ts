import { describe, test, expect, mock, afterEach } from "bun:test";
import { asaasWebhookRouter } from "../../src/routes/asaas-webhook.ts";

describe("Asaas Webhook Router", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("ignora eventos diferentes de PAYMENT_RECEIVED ou PAYMENT_CONFIRMED", async () => {
    const response = await asaasWebhookRouter.handle(
      new Request("http://localhost/webhook/asaas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "asaas-access-token": "whsec_test",
        },
        body: JSON.stringify({
          event: "PAYMENT_OVERDUE",
          payment: { id: "pay_999", status: "OVERDUE" },
        }),
      })
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe("ignored");
    expect(data.reason).toBe("event_not_handled");
  });

  test("retorna error se payload for inválido", async () => {
    const response = await asaasWebhookRouter.handle(
      new Request("http://localhost/webhook/asaas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "asaas-access-token": "whsec_test",
        },
        body: JSON.stringify({ invalid: true }),
      })
    );

    const data = await response.json();
    expect(data.status).toBe("ignored");
    expect(data.reason).toBe("invalid_payload");
  });
});

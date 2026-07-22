import { env } from "../config/env.ts";
import { fetchComTimeout } from "../lib/fetch-with-timeout.ts";
import { logger } from "../lib/logger.ts";

const ASAAS_BASE_URL = "https://sandbox.asaas.com/api/v3";

function getHeaders() {
  const token = env.ASAAS_API_KEY.replace(/^\\+/, "").trim();
  if (!token) {
    throw new Error("Variável ASAAS_API_KEY não foi configurada nas variáveis de ambiente (.env do servidor).");
  }
  return {
    "access_token": token,
    "Content-Type": "application/json",
    "User-Agent": "multi_atendimento",
  };
}

export interface ClienteAsaas {
  id: string;
  name: string;
  mobilePhone?: string;
  cpfCnpj?: string;
}

export interface CobrancaAsaas {
  id: string;
  customer: string;
  value: number;
  netValue?: number;
  status: string; // PENDING, RECEIVED, CONFIRMED, OVERDUE, CANCELLED, etc.
  billingType: string; // PIX, CREDIT_CARD, DEBIT_CARD
  invoiceUrl?: string;
  bankSlipUrl?: string;
  externalReference?: string;
}

export interface QrCodePixAsaas {
  encodedImage: string;
  payload: string;
  expirationDate?: string;
}

export async function buscarOuCriarClienteAsaas(dados: {
  nome: string;
  telefone: string;
  cpfCnpj?: string;
}): Promise<ClienteAsaas> {
  let phoneDigits = dados.telefone.replace(/\D/g, "");
  if (phoneDigits.startsWith("55") && (phoneDigits.length === 12 || phoneDigits.length === 13)) {
    phoneDigits = phoneDigits.slice(2);
  }

  try {
    const searchUrl = `${ASAAS_BASE_URL}/customers?mobilePhone=${encodeURIComponent(phoneDigits)}` +
      (dados.cpfCnpj ? `&cpfCnpj=${encodeURIComponent(dados.cpfCnpj.replace(/\D/g, ""))}` : "");

    const res = await fetchComTimeout(searchUrl, {
      method: "GET",
      headers: getHeaders(),
    });

    if (res.ok) {
      const data = await res.json() as { data?: ClienteAsaas[] };
      if (data.data && data.data.length > 0 && data.data[0]?.id) {
        const clienteExistente = data.data[0];
        logger.info("asaas", "Cliente Asaas encontrado", { id: clienteExistente.id, nome: dados.nome });

        // Se CPF foi fornecido e o cliente existente no Asaas não possui CPF ou precisa atualizar
        if (dados.cpfCnpj) {
          const cpfLimpo = dados.cpfCnpj.replace(/\D/g, "");
          if (clienteExistente.cpfCnpj !== cpfLimpo) {
            try {
              const updateRes = await fetchComTimeout(`${ASAAS_BASE_URL}/customers/${clienteExistente.id}`, {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify({
                  cpfCnpj: cpfLimpo,
                }),
              });
              if (updateRes.ok) {
                const clienteAtualizado = await updateRes.json() as ClienteAsaas;
                logger.info("asaas", "CPF do cliente Asaas atualizado com sucesso", { id: clienteAtualizado.id, cpfCnpj: cpfLimpo });
                return clienteAtualizado;
              }
            } catch (errUpd) {
              logger.warn("asaas", "Erro ao atualizar CPF do cliente no Asaas", errUpd);
            }
          }
        }
        return clienteExistente;
      }
    }
  } catch (err) {
    logger.warn("asaas", "Erro ao buscar cliente no Asaas, tentando criar", err);
  }

  const createRes = await fetchComTimeout(`${ASAAS_BASE_URL}/customers`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      name: dados.nome,
      mobilePhone: phoneDigits,
      cpfCnpj: dados.cpfCnpj ? dados.cpfCnpj.replace(/\D/g, "") : undefined,
      notificationDisabled: true,
    }),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text();
    logger.error("asaas", `Erro ao criar cliente no Asaas (status ${createRes.status})`, { status: createRes.status, errBody });
    throw new Error(`Erro ao criar cliente no Asaas (${createRes.status}): ${errBody}`);
  }

  const cliente = await createRes.json() as ClienteAsaas;
  logger.info("asaas", "Cliente Asaas criado com sucesso", { id: cliente.id });
  return cliente;
}

export async function criarCobrancaAsaas(dados: {
  customerId: string;
  valor: number;
  formaPagamento: "PIX" | "CREDIT_CARD" | "DEBIT_CARD";
  descricao: string;
  externalReference: string;
}): Promise<CobrancaAsaas> {
  const hoje = new Date();
  const dueDate = hoje.toISOString().split("T")[0];

  const body = {
    customer: dados.customerId,
    billingType: dados.formaPagamento,
    value: dados.valor,
    dueDate,
    description: dados.descricao,
    externalReference: dados.externalReference,
  };

  const res = await fetchComTimeout(`${ASAAS_BASE_URL}/payments`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error("asaas", `Erro ao criar cobrança no Asaas (status ${res.status})`, { status: res.status, errText });
    throw new Error(`Erro ao criar cobrança no Asaas (${res.status}): ${errText}`);
  }

  const cobranca = await res.json() as CobrancaAsaas;
  logger.info("asaas", "Cobrança Asaas criada com sucesso", { id: cobranca.id, status: cobranca.status, invoiceUrl: cobranca.invoiceUrl });
  return cobranca;
}

export async function obterQrCodePixAsaas(paymentId: string): Promise<QrCodePixAsaas> {
  const res = await fetchComTimeout(`${ASAAS_BASE_URL}/payments/${paymentId}/pixQrCode`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error("asaas", `Erro ao obter QR Code PIX (status ${res.status})`, { status: res.status, errText });
    throw new Error(`Erro ao obter QR Code PIX (${res.status}): ${errText}`);
  }

  const qrData = await res.json() as QrCodePixAsaas;
  return qrData;
}

export async function consultarCobrancaAsaas(paymentId: string): Promise<CobrancaAsaas> {
  const res = await fetchComTimeout(`${ASAAS_BASE_URL}/payments/${paymentId}`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error("asaas", `Erro ao consultar cobrança no Asaas (status ${res.status})`, { status: res.status, errText });
    throw new Error(`Erro ao consultar cobrança no Asaas (${res.status}): ${errText}`);
  }

  const cobranca = await res.json() as CobrancaAsaas;
  return cobranca;
}

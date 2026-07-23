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
  const cpfLimpo = dados.cpfCnpj ? dados.cpfCnpj.replace(/\D/g, "") : undefined;

  let clienteExistente: ClienteAsaas | null = null;

  // 1. Tentar buscar por CPF/CNPJ primeiro se informado
  if (cpfLimpo) {
    try {
      const resCpf = await fetchComTimeout(`${ASAAS_BASE_URL}/customers?cpfCnpj=${encodeURIComponent(cpfLimpo)}`, {
        method: "GET",
        headers: getHeaders(),
      });
      if (resCpf.ok) {
        const data = (await resCpf.json()) as { data?: ClienteAsaas[] };
        if (data.data && data.data.length > 0 && data.data[0]?.id) {
          clienteExistente = data.data[0];
          logger.info("asaas", "Cliente Asaas encontrado por CPF", {
            id: clienteExistente.id,
            nome: clienteExistente.name,
            cpfCnpjNoRegistro: clienteExistente.cpfCnpj ?? "(VAZIO/NULL)",
            mobilePhone: clienteExistente.mobilePhone,
          });
        }
      }
    } catch (e) {
      logger.warn("asaas", "Erro ao buscar cliente por CPF no Asaas:", e);
    }
  }

  // 2. Se não encontrou por CPF, buscar por telefone
  if (!clienteExistente && phoneDigits) {
    try {
      const resPhone = await fetchComTimeout(`${ASAAS_BASE_URL}/customers?mobilePhone=${encodeURIComponent(phoneDigits)}`, {
        method: "GET",
        headers: getHeaders(),
      });
      if (resPhone.ok) {
        const data = (await resPhone.json()) as { data?: ClienteAsaas[] };
        if (data.data && data.data.length > 0 && data.data[0]?.id) {
          clienteExistente = data.data[0];
          logger.info("asaas", "Cliente Asaas encontrado por telefone", { id: clienteExistente.id, nome: dados.nome });
        }
      }
    } catch (e) {
      logger.warn("asaas", "Erro ao buscar cliente por telefone no Asaas:", e);
    }
  }

  // 3. Se o cliente foi encontrado e foi informado um CPF, SEMPRE forçar atualização via PUT
  //    (a busca do Asaas pode retornar o cliente por CPF mas o campo cpfCnpj não estar realmente gravado no perfil,
  //     causando rejeição em cobranças de cartão de crédito/débito)
  if (clienteExistente) {
    if (cpfLimpo) {
      try {
        logger.info("asaas", "Forçando PUT para garantir CPF no cadastro do cliente Asaas", {
          id: clienteExistente.id,
          cpfCnpjAtual: clienteExistente.cpfCnpj,
          cpfNovo: cpfLimpo,
        });
        const updateRes = await fetchComTimeout(`${ASAAS_BASE_URL}/customers/${clienteExistente.id}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({
            name: clienteExistente.name || dados.nome,
            cpfCnpj: cpfLimpo,
            mobilePhone: phoneDigits || clienteExistente.mobilePhone,
          }),
        });
        if (updateRes.ok) {
          const clienteAtualizado = (await updateRes.json()) as ClienteAsaas;
          logger.info("asaas", "CPF do cliente Asaas atualizado/confirmado com sucesso", { id: clienteAtualizado.id, cpfCnpj: clienteAtualizado.cpfCnpj });
          return clienteAtualizado;
        } else {
          const errTxt = await updateRes.text();
          logger.warn("asaas", `Falha ao atualizar CPF no Asaas (${updateRes.status}): ${errTxt}`);
        }
      } catch (errUpd) {
        logger.warn("asaas", "Erro ao atualizar CPF do cliente no Asaas", errUpd);
      }
    }
    return clienteExistente;
  }

  // 4. Se não existe por CPF nem por telefone, criar novo cliente no Asaas
  const createRes = await fetchComTimeout(`${ASAAS_BASE_URL}/customers`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      name: dados.nome,
      mobilePhone: phoneDigits,
      cpfCnpj: cpfLimpo,
      notificationDisabled: true,
    }),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text();
    logger.error("asaas", `Erro ao criar cliente no Asaas (status ${createRes.status})`, { status: createRes.status, errBody });
    throw new Error(`Erro ao criar cliente no Asaas (${createRes.status}): ${errBody}`);
  }

  const cliente = (await createRes.json()) as ClienteAsaas;
  logger.info("asaas", "Cliente Asaas criado com sucesso", { id: cliente.id, cpfCnpj: cpfLimpo });
  return cliente;
}

export async function criarCobrancaAsaas(dados: {
  customerId: string;
  valor: number;
  formaPagamento: "PIX" | "UNDEFINED";
  descricao: string;
  externalReference: string;
}): Promise<CobrancaAsaas> {
  const hoje = new Date();
  const dueDate = hoje.toISOString().split("T")[0];

  // PIX  → cobrança PIX direta
  // UNDEFINED → link de checkout multi-forma (boleto, PIX, cartão)
  //             As formas disponíveis dependem do que está habilitado na conta Asaas.
  //             Para que cartão apareça no checkout, habilite-o no painel do Asaas.
  const billingTypeAsaas = dados.formaPagamento;
  logger.info("asaas", `Criando cobrança com billingType: "${billingTypeAsaas}"`);


  const body = {
    customer: dados.customerId,
    billingType: billingTypeAsaas,
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

  const cobranca = (await res.json()) as CobrancaAsaas;
  logger.info("asaas", "Cobrança Asaas criada com sucesso", { id: cobranca.id, status: cobranca.status, billingType: billingTypeAsaas, invoiceUrl: cobranca.invoiceUrl });
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

  const qrData = (await res.json()) as QrCodePixAsaas;
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

  const cobranca = (await res.json()) as CobrancaAsaas;
  return cobranca;
}

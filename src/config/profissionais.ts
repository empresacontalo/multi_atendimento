import { logger } from "../lib/logger.ts";
import { env } from "./env.ts";

export interface Profissional {
  id: string;
  nome: string;
  especialidade: string;
  calendarId: string;
  disponibilidade: Record<number, Array<{ inicio: string; fim: string }>>;
}

const DISPONIBILIDADE_PADRAO: Record<number, Array<{ inicio: string; fim: string }>> = {
  1: [{ inicio: "09:00", fim: "19:00" }], // Segunda
  2: [{ inicio: "09:00", fim: "19:00" }], // Terça
  3: [{ inicio: "09:00", fim: "19:00" }], // Quarta
  4: [{ inicio: "09:00", fim: "19:00" }], // Quinta
  5: [{ inicio: "09:00", fim: "19:00" }], // Sexta
  6: [{ inicio: "09:00", fim: "19:00" }], // Sábado
};

function parseJsonSeguro<T>(jsonStr: string | undefined, fallback: T): T {
  if (!jsonStr || typeof jsonStr !== "string") return fallback;
  let cleaned = jsonStr.trim();
  if ((cleaned.startsWith("'") && cleaned.endsWith("'")) || (cleaned.startsWith('"') && cleaned.endsWith('"'))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    try {
      const fixed = cleaned.replace(/'/g, '"');
      return JSON.parse(fixed) as T;
    } catch {
      return fallback;
    }
  }
}

export function obterProfissionais(): Record<string, Profissional> {
  const calendarIds = parseJsonSeguro<Record<string, string>>(
    process.env["PROFISSIONAIS_CALENDAR_IDS"] ?? env.PROFISSIONAIS_CALENDAR_IDS,
    {},
  );

  const rawProfissionais = parseJsonSeguro<Array<{ id: string; nome: string; especialidade: string }>>(
    process.env["PROFISSIONAIS"] ?? env.PROFISSIONAIS,
    [],
  );

  const mapa: Record<string, Profissional> = {};

  for (const p of rawProfissionais) {
    if (!p.id) continue;
    const calendarId = calendarIds[p.id] ?? calendarIds[p.id.toLowerCase()] ?? "";
    const item: Profissional = {
      id: p.id,
      nome: p.nome,
      especialidade: p.especialidade,
      calendarId,
      disponibilidade: DISPONIBILIDADE_PADRAO,
    };
    mapa[p.id] = item;
    mapa[p.id.toLowerCase()] = item;
  }

  // Fallbacks de legado se o .env estiver vazio (Clínica Moreira)
  if (Object.keys(mapa).length === 0) {
    const legacyList = ["dra-ana-costa", "dr-ricardo-lima", "dra-beatriz-souza", "dr-felipe-torres"];
    for (const leg of legacyList) {
      mapa[leg] = {
        id: leg,
        nome: leg,
        especialidade: "Odontologia",
        calendarId: calendarIds[leg] ?? `${leg}@clinic.com`,
        disponibilidade: DISPONIBILIDADE_PADRAO,
      };
    }
  }

  return mapa;
}

// Export para compatibilidade retroativa
export const profissionais: Record<string, Profissional> = new Proxy({}, {
  get(_target, prop: string) {
    return obterProfissionais()[prop];
  },
  ownKeys() {
    return Object.keys(obterProfissionais());
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    return {
      enumerable: true,
      configurable: true,
      value: obterProfissionais()[prop],
    };
  },
});

export function buscarProfissional(id: string): Profissional | undefined {
  if (!id) return undefined;
  const mapa = obterProfissionais();
  const exato = mapa[id] ?? mapa[id.toLowerCase()];
  if (exato) return exato;

  // Busca insensível por nome/slug parcial (ex: "luci", "cabelereira-luci", "Luci")
  const idNorm = id.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const key of Object.keys(mapa)) {
    const keyNorm = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (keyNorm.includes(idNorm) || idNorm.includes(keyNorm)) {
      return mapa[key];
    }
  }

  return undefined;
}

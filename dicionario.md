# Dicionário de Dados Variáveis — FranHair (n8n)

> Arquivo gerado em 2026-07-18 a partir dos workflows da pasta `workflows/`.

---

## 1. CREDENCIAIS (n8n Credential References)

As credenciais abaixo são **referências** gerenciadas pelo n8n. Os valores secretos reais (API keys, tokens, senhas) **não** são exportados nos JSONs.

| Serviço | ID da Credencial | Nome / Conta | Workflows que usam |
|---|---|---|---|
| **PostgreSQL** | `bJMj9EJhrz4LUXvz` | `Postgres local stack` | 00, 01, 08 |
| **Chatwoot** | `xcQxsrtmP5E57HW1` | `Chatwoot fazer.ai account` | 00, 01, 03, 07, 08 |
| **OpenAI** | `wDFu57w7WZw0Fd1n` | `empresa.contalo@gmail.com` | 01, 08 |
| **Google Calendar OAuth2** | `y4ylZimOlc3KFXQU` | `franhairpg@gmail.com` | 02, 03, 04, 05, 06 |
| **ElevenLabs** | `RDSll1U4PYUIynGK` | `contalo@gmail.com` | 01 |
| **Gemini (1)** | `zr11lnBZ7vvDYH4H` | `empresa.contalo@gmail.com` | 01 |
| **Gemini (2)** | `zSphRdU7Z776VDZD` | `conta.mdm1@gmail.com` | 01 |
| **Gemini (3)** | `ekJ6772OOd8BFOcj` | `paz.de.espiritu` | 01 |

---

## 2. CHATWOOT

### URL base
```
https://chat3.digitalarea.online
```

### Conta
| Campo | Valor |
|---|---|
| Account ID | `1` |
| Nome | `#1 - digitalarea.online` |
| Dashboard | `https://chat3.digitalarea.online/app/accounts/1/dashboard` |

### Inboxes
| ID | Nome | URL |
|---|---|---|
| `1` | Instagram | `https://chat3.digitalarea.online/app/accounts/1/settings/inboxes/1` |
| `2` | WhatsApp (FranHair) | `https://chat3.digitalarea.online/app/accounts/1/settings/inboxes/2` |
| `3` | Site | `https://chat3.digitalarea.online/app/accounts/1/settings/inboxes/3` |

### Labels
| Label | Cor | Descrição |
|---|---|---|
| `testando-agente` | `#6BBF8A` | Habilita agente IA em modo teste |
| `agente-off` | `#E8735A` | Desabilita agente IA |
| `retorno` | — | (usado pelo WF 01) |

### Kanban — Board: "Salão de Beleza"

| Etapa | Cor | Descrição | Flags |
|---|---|---|---|
| Novo Lead | `#5B9BD5` | Primeiro contato | |
| Qualificado | `#F4C542` | IA coletando informações | |
| Agendado | `#6BBF8A` | Agendado, pendente confirmação | |
| Confirmado | `#9B7ED8` | Cliente confirmou presença | |
| Compareceu | `#3A8F5C` | Cliente compareceu à consulta | |
| No-show | `#E8735A` | Cliente não compareceu | |
| Perdido (reativar) | `#A0A0A0` | Cliente cancelou/não respondeu | `perdida: true`, `cancelled: true` |
| Pós-venda | `#5CC0C7` | Follow-up pós-consulta | |

### Webhook IDs (Chatwoot Triggers)
| Workflow | Event | Webhook ID |
|---|---|---|
| WF 01 — Agente Clínica | `message_incoming` | `8a6bbf36-ec0e-4bfd-97d2-f2ab2304add0` |
| WF 08 — Follow-up | `kanban_task_overdue` | `ff6c894a-0f59-43c0-951a-b0c93bc5855c` |
| WF 08 — Follow-up | `kanban_task_updated` | `3b71c2d3-93c7-4b45-825e-d7504e0490d4` |

### Atributo customizado de contato
| Chave | Nome | Tipo |
|---|---|---|
| `data_ultima_consulta` | Data da última consulta | `text` |

---

## 3. GOOGLE CALENDAR

### IDs das agendas
| Profissional | Calendar ID |
|---|---|
| **Luci** | `42648de09c30573b675c13ae8ff4f851555231efd1c32850bb54bdd8fbd2403b@group.calendar.google.com` |
| **Larissa** | `651b6971b20c7795ef392fde36bd3b51faa2ef6fcc82c6ac895ea37bce806717@group.calendar.google.com` |

### Disponibilidade semanal (ambas)
| Dia | Horários |
|---|---|
| Segunda a Sábado | `09:00–13:00` e `14:00–19:00` |
| Domingo | Indisponível |

### Mapeamento dinâmico
```javascript
={{$('ID agendas').item.json[$('Gatilho').item.json.id_profissional]}}
```
onde `id_profissional` é `"Luci"` ou `"Larissa"`.

---

## 4. MODELOS DE IA

| Função | Modelo | Provedor | Workflow |
|---|---|---|---|
| Agente principal (vendedora) | `models/gemini-3.5-flash` (rotacionado entre 3 contas Gemini) | Gemini | 01 |
| Fallback do agente | `gpt-5.2` | OpenAI | 01 |
| Formatação SSML | `gpt-4.1-mini` | OpenAI | 01 |
| Formatação WhatsApp | `gpt-4.1-mini` | OpenAI | 01 |
| TTS (voz) | `eleven_multilingual_v2` | ElevenLabs | 01 |
| Follow-ups / Lembretes / Pós-venda | `gpt-4.1` | OpenAI | 08 |

---

## 5. ELEVENLABS (TTS)

| Parâmetro | Valor |
|---|---|
| Voice ID | `XrExE9yKIg1WjnnlVkGX` |
| Modelo | `eleven_multilingual_v2` |
| Stability | `1` |
| Similarity Boost | `1` |
| Style | `0` |
| Speaker Boost | `true` |
| Speed | `1.10` |
| API Keys URL | `https://elevenlabs.io/app/developers/api-keys` |
| Voice Library | `https://elevenlabs.io/app/voice-library?voiceId=33B4UnXyTNbgLmdEDh5P` |

---

## 6. WEBHOOKS & URLs OPERACIONAIS

| Tipo | ID / URL |
|---|---|
| Chatwoot Active Site Webhook | `8a6bbf36-ec0e-4bfd-97d2-f2ab2304add0` |
| Instagram Webhook (desativado) | `aacad26d-4508-4a77-b0df-ef01af2fcd90` |
| Wait Resume Webhook (n8n interno) | `6bde6500-8ea5-4d91-9a58-e9e844929ea3` |
| n8n Data Table (contador IA) | `/projects/bIvKSWeSZaYn2xvJ/datatables/dnztacvFfgZEyoEM` |
| Chatwoot URL | `https://chat3.digitalarea.online` |

### Workflows referenciados (sub-workflows)
| ID | Nome |
|---|---|
| `URon3fYLQ58mZJ1w` | FranHair 02. Buscar janelas profissional |
| `Cms5Du3I8kEDJdoh` | FranHair 05. Atualizar agendamento |
| `bqqXdyE5NXijtPS7` | FranHair 07. Escalar humano v2 |
| `Nx5YbSdzplZjxYX1` | FranHair 04. Buscar agendamentos do contato |
| `pJte4sPE630hU7Wz` | FranHair 06. Cancelar agendamento |
| `uZuXhl6NZsAH8BB0` | FranHair 03. Criar evento com profissional |

---

## 7. E-MAILS

| Conta | Tradução |
|---|---|
| `franhairpg@gmail.com` | Google Calendar (agenda) |
| `empresa.contalo@gmail.com` | OpenAI + Gemini (1) |
| `contalo@gmail.com` | ElevenLabs |
| `conta.mdm1@gmail.com` | Gemini (2) |
| `paz.de.espiritu` | Gemini (3) |

---

## 8. TELEFONES

| Número | Contexto |
|---|---|
| `(13) 99115-1970` | Telefone do salão FranHair (system prompt) |
| `(11) 99115-1970` | Conflito — exemplo emergência no prompt (DDD 11 vs 13) |
| `(11) 1234-5678` | Exemplo SSML |
| `(11) 99999-9999` | Exemplo SSML |
| `(11) 4456-7890` | Exemplo SSML |
| `99999999999` | Fallback quando não há telefone do sender |

---

## 9. CONFIGURAÇÕES DE NEGÓCIO

### Salão
| Campo | Valor |
|---|---|
| **Nome** | FranHair salão de beleza |
| **Endereço** | Avenida Costa e Silva 501, box 87, Galeria PG — Boqueirão, Praia Grande/SP |
| **Horário** | Seg–Sáb 09h às 19h |
| **Pagamentos** | PIX, dinheiro, débito, crédito |

### Profissionais
| Nome | Especialidade |
|---|---|
| Luci | (não especificado no prompt) |
| Larissa | (não especificado no prompt) |

### Serviços / Preços
- **Avaliação**: gratuita
- **Procedimentos**: a partir de R$40, R$60, R$80, ou R$150
- **Duração**: 20 a 240 minutos
- **Demais valores**: informados após avaliação

### Regras de agendamento
- Máximo **1** agendamento ativo por cliente
- Reagendamento permitido até **24h antes**
- Máximo **3** buscas de disponibilidade por interação
- Granularidade de disponibilidade: **15 minutos**
- Formato data/hora: `YYYY-MM-DDThh:mm:ssTZD`

---

## 10. INPUTS DOS WORKFLOWS

### WF 00 — Configurações IA Vendedora
*(sem inputs — manual trigger)*

### WF 01 — Agente Clínica
*(webhook trigger — mensagens do Chatwoot)*
| Campo | Origem |
|---|---|
| `id_mensagem` | `$json.id` |
| `id_mensagem_referenciada` | `$json.content_attributes.in_reply_to` |
| `id_conta` | `$json.account.id` |

### WF 02 — Buscar janelas profissional
| Campo | Tipo |
|---|---|
| `periodo_inicio` | string |
| `periodo_fim` | string |
| `id_profissional` | string |
| `tamanho_janela_minutos` | number |
| `granularidade` | number |
| `amostras` | (não tipado) |

### WF 03 — Criar evento com profissional
| Campo | Descrição |
|---|---|
| `evento_inicio` | Início do evento |
| `duracao_minutos` | Duração em minutos |
| `titulo` | Título do evento |
| `descricao` | Descrição |
| `id_profissional` | "Luci" ou "Larissa" |
| `id_conta` | Account ID Chatwoot |
| `id_contato` | Contact ID Chatwoot |

### WF 04 — Buscar agendamentos do contato
| Campo | Descrição |
|---|---|
| `id_profissional` | "Luci" ou "Larissa" |
| `telefone` | Telefone do contato (usado como query no Google Calendar) |

### WF 05 — Atualizar agendamento
| Campo | Descrição |
|---|---|
| `id_profissional` | "Luci" ou "Larissa" |
| `id_evento` | ID do evento no Google Calendar |
| `titulo` | Novo título |
| `descricao` | Nova descrição |

### WF 06 — Cancelar agendamento
| Campo | Tipo |
|---|---|
| `id_profissional` | string |
| `id_conversa` | string |
| `id_evento` | string |
| `id_conta` | string |
| `tarefa` | object |
| `motivo_cancelamento` | string |

### WF 07 — Escalar humano v2
| Campo | Descrição |
|---|---|
| `telefone` | Telefone do contato |
| `nome` | Nome do contato |
| `ultima_mensagem` | Última mensagem |
| `resumo_conversa` | Resumo da conversa |
| `id_conta` | Account ID Chatwoot |
| `id_conversa` | Conversation ID Chatwoot |
| `id_inbox` | Inbox ID Chatwoot |

### WF 08 — Follow-ups
*(webhook trigger — eventos do Kanban)*
| Campo | Fonte |
|---|---|
| `account_id` | Evento Kanban |
| `board_id` | Evento Kanban |
| `board_step.name` | Etapa atual |
| `board_step.id` | ID da etapa |
| `conversations[0].inbox.id` | Inbox da conversa |
| `conversations[0].display_id` | ID de exibição |
| `conversations[0].contact.phone_number` | Telefone do contato |

---

## 11. BANCO DE DADOS (PostgreSQL)

**Credencial:** `Postgres local stack` (ID `bJMj9EJhrz4LUXvz`)
**Schema:** `public`

### Tabela: `n8n_historico_mensagens`
| Coluna | Tipo |
|---|---|
| `id` | `SERIAL PRIMARY KEY` |
| `session_id` | `VARCHAR(40) NOT NULL` |
| `message` | `JSONB NOT NULL` |
| `created_at` | `TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP` |
| **Índice** | `idx_historico_session(session_id)` |

Usada como **memória de conversa** (context window: 50 mensagens).

### Tabela: `n8n_fila_mensagens`
| Coluna | Tipo |
|---|---|
| `id` | `BIGSERIAL PRIMARY KEY` |
| `id_mensagem` | `VARCHAR(40) NOT NULL` |
| `telefone` | `VARCHAR(40) NOT NULL` |
| `mensagem` | `TEXT NOT NULL` |
| `timestamp` | `TIMESTAMP WITHOUT TIME ZONE NOT NULL` |
| **Índice** | `idx_fila_telefone(telefone)` |

Usada para **debounce** de mensagens (batch de 4 em 4).

### Tabela: `n8n_status_atendimento`
| Coluna | Tipo |
|---|---|
| `id` | `SERIAL PRIMARY KEY` |
| `session_id` | `VARCHAR(40) UNIQUE NOT NULL` |
| `lock_conversa` | `BOOLEAN DEFAULT FALSE` |
| `updated_at` | `TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP` |
| **Índice** | `idx_status_session(session_id)` |

Usada para **lock de concorrência** (evita processamento duplicado).

### Tabela n8n interna: `contador`
| Campo | Valor |
|---|---|
| Projeto | `bIvKSWeSZaYn2xvJ` |
| Tabela | `dnztacvFfgZEyoEM` |
| Campo numérico | `IA` (usado para round-robin entre contas Gemini) |

---

## 12. SYSTEM PROMPTS COMPLETOS

### Prompt 1 — Agente IA Vendedora (WF 01, ~31KB)
**Identidade:** Camila, secretária virtual da FranHair salão de beleza.
**Tom:** acolhedor, profissional, conciso, uma pergunta por vez.

**Seções do prompt:**
- Identidade e tom de voz
- Informações do salão (endereço, horário, pagamentos, profissionais)
- Procedimentos (avaliação gratuita, preços a partir de R$40)
- Regras de agendamento (máx. 1 ativo, granularidade 15min, máx. 3 buscas)
- SOP de cancelamento / reagendamento
- Fluxo de confirmação
- Regras de escalonamento humano (etiqueta `agente-off`)
- Regras do Kanban (movimentação de etapas)
- Validações e exemplos
- Ferramentas disponíveis (criar/buscar/atualizar/cancelar agendamentos, Kanban)
- Comandos: `/reset`, `/teste`
- Reações permitidas: `😀 ❤️ 👍 👀 ✅` (máx. 3 por conversa)
- **Instrução:** "Você é a Camila, não uma IA ou assistente virtual."

### Prompt 2 — Formatar SSML (WF 01)
Converte números, datas, horas, telefones, CEPs e valores monetários para português falado.
Remove emojis. Wraps em `<speak><break time="1.0s"/>...</speak>`.

### Prompt 3 — Formatar texto WhatsApp (WF 01)
- Markdown `**` → WhatsApp `*`
- Remove headings markdown
- Máximo 5 blocos de mensagem
- Preserva links, e-mails, telefones e valores

### Prompt 4 — Agente follow-up (WF 08, Qualificado / No-show)
**Identidade:** Maria, secretária virtual da Clínica Rodriguez (⚠️ nome diferente do WF 01).
**Missão:** Follow-up para leads qualificados ou no-show.
**Regras:**
- 1º ou 2º follow-up: atualiza `End_Date` (+24h qualificado, +48h no-show)
- 3º disparo sem resposta: mensagem de despedida → mover para "Perdido (reativar)"
- Máx. 3 linhas
- Nunca mencionar que é automático

### Prompt 5 — Agente lembrete de agendamento (WF 08)
**Identidade:** Camila, secretária virtual da FranHair.
**Missão:** Lembrar cliente sobre agendamento e pedir confirmação.
**Máx.:** 4 linhas.

### Prompt 6 — Agente follow-up pós-consulta (WF 08)
**Identidade:** Camila, secretária virtual da FranHair.
**Missão:** Acompanhamento pós-consulta para clientes que compareceram.
**Máx.:** 4 linhas.

---

## 13. DEMAIS CONSTANTES

| Constante | Valor |
|---|---|
| Timezone | `America/Sao_Paulo` |
| Ordem de execução n8n | `v1` |
| Número da instância n8n | `a70ebe5ded2a76596220d0a50f6c0503b5451630465a282dc543d62ceaab3224` |
| Mensagem de erro (WF 02) | `"Tamanho da janela ou granularidade inválidos. Utilize um desses valores: [10, 15, 20, 30, 45, 60, 90, 120]"` |
| Mensagem de erro (WF 02) | `"Período informado já passou."` |
| Mensagem de erro (WF 02) | `"Disponibilidade não cadastrada para agenda. Verificar nó 'Disponibilidade'"` |
| Valores aceitos janela/granularidade | `[10, 15, 20, 30, 45, 60, 90, 120, 180, 240]` |
| Valor padrão janela | `60` minutos |
| Valor padrão granularidade | `30` minutos |
| Mensagem de erro (WF 03) | `"HORÁRIO INDISPONÍVEL. VERIFICAR SE AGENDAMENTO JÁ NÃO FOI REALIZADO PARA ESSE CONTATO."` |
| Mensagem de sucesso (WF 03) | `"AGENDAMENTO CRIADO"` |
| Cupom Hostinger | `FAZERAI` (10% off) |
| YouTube Channel ID | `UCtmp6SxzLscu0GRTbgM8FTw` |
| Instagram handle | `eulucassmoreira` |

---

## 14. URLs PROMOCIONAIS (sticky notes)

```
https://www.youtube.com/watch?v=vYtaGw3vRII
https://lucasmoreira.fazer.ai
https://fazer.ai?utm_source=n8n&utm_campaign=sec-v3
https://youtube.com/@eulucassmoreira?si=0lH7hwX9pukjhmPQ
https://instagram.com/eulucassmoreira
https://github.com/fazer-ai
https://www.hostg.xyz/SHIwa
```

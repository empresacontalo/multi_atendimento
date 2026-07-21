// Set dummy environment variables for testing
process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["OPENAI_API_KEY"] = "sk-test";
process.env["CHATWOOT_BASE_URL"] = "https://test.chatwoot.com";
process.env["CHATWOOT_API_TOKEN"] = "test-token";
process.env["CHATWOOT_ACCOUNT_ID"] = "8";
process.env["GOOGLE_CALENDAR_CREDENTIALS"] = '{"type":"service_account","project_id":"test"}';
process.env["ELEVENLABS_API_KEY"] = "xi-test";
process.env["ELEVENLABS_VOICE_ID"] = "test-voice";
process.env["CHATWOOT_ALERT_INBOX_ID"] = "27";
process.env["CHATWOOT_ALERT_CONVERSATION_ID"] = "15";
process.env["PROFISSIONAIS_CALENDAR_IDS"] = '{"dra-ana-costa":"cal-ana","dr-ricardo-lima":"cal-ricardo","dra-beatriz-souza":"cal-beatriz","dr-felipe-torres":"cal-felipe"}';
process.env["NOME_NEGOCIO"] = "FranHair salão de beleza";
process.env["NOME_ASSISTENTE"] = "Camila";
process.env["RAMO_NEGOCIO"] = "salão de beleza";
process.env["HORARIO_FUNCIONAMENTO"] = "Segunda a Sábado: 09h às 19h";
process.env["ENDERECO"] = "Avenida Costa e Silva 501, box 87, Galeria PG";
process.env["TELEFONE"] = "(13) 99115-1970";
process.env["FORMAS_PAGAMENTO"] = "PIX, dinheiro, cartão (débito/crédito)";
process.env["CONVENIOS"] = "Não aplicável";
process.env["PROFISSIONAIS"] = '[{"id":"dra-ana-costa","nome":"Dra. Ana","especialidade":"Geral"}]';
process.env["PROCEDIMENTOS"] = '[{"id":"escova","nome":"Escova","duracao":60,"valor":"R$ 60"}]';
process.env["ASAAS_API_KEY"] = "$aact_test";
process.env["ASSAAS_WEBHOOK_TOKEN"] = "whsec_test";


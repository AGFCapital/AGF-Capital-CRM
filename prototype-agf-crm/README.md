# AGF CRM

Aplicação web compartilhada da AGF para operar leads qualificados de implementação de IA em finanças corporativas. Ela substitui o uso do Linear como CRM operacional e usa o Supabase como fonte de verdade.

O briefing completo do projeto está em [../docs/AGF_PROJECT_BRIEF.md](../docs/AGF_PROJECT_BRIEF.md). Os contratos de automação estão em [../docs/N8N_INTEGRATION_CONTRACT.md](../docs/N8N_INTEGRATION_CONTRACT.md).

## Escopo atual

As bases ativas são:

- `Vagas — leads quentes`: empresas com vagas financeiras abertas;
- `Middle market — prospecção proativa`: empresas com possível necessidade financeira/operacional, mesmo sem vaga aberta.

M&A e startups estão pausados nesta versão.

## O que a interface já faz

- login por e-mail e senha do Supabase;
- Kanban compartilhado entre todos os usuários autenticados;
- pipeline completo: `Prontos para enviar → Aprovado → Enviar convite → Convite enviado → Enviar mensagem → Em conversa → Agendamento → Call marcada → Concluído`;
- detalhe expandido do lead com contexto, score, notícias, mensagem, histórico e horário da call;
- páginas de agendamentos e histórico;
- painel de configurações para extração, janela de envio e agenda;
- persistência de leads, estágios e configurações no Supabase quando configurado;
- endpoint protegido para solicitar uma `Extração extra` ao n8n.

Todos os usuários veem os mesmos cards e configurações. Giulio é o condutor comercial padrão, mas não existe base individual por operador.

## Integrações previstas

```text
PhantomBuster → Google Sheets → n8n → Supabase → aplicação AGF
                                             ↓
                                   Kanban / revisão humana
                                             ↓
                              n8n → Google Sheets (Status CRM)
```

- **PhantomBuster:** extração de dados do LinkedIn;
- **Google Sheets:** entrada e espelho auditável da coluna `Status CRM`;
- **n8n:** qualificação, deduplicação, Gemini, sincronizações e ações externas;
- **Supabase:** autenticação, banco, histórico, filas e fonte de verdade;
- **Google Calendar:** link de agendamento, evento, Meet e confirmação.

Nenhuma mensagem, convite, InMail ou agendamento externo é disparado pela aplicação hoje. Essas ações permanecem desligadas até o piloto interno com os sócios autorizados.

## Rodar localmente

Requisito: Node.js 18 ou superior.

No diretório raiz do repositório:

```powershell
node .\prototype-agf-crm\server.mjs
```

Abra `http://localhost:4173`.

Para usar outra porta:

```powershell
$env:PORT = 4174
node .\prototype-agf-crm\server.mjs
```

## Configuração local

Copie `.env.example` para `.env.local` dentro desta pasta e preencha apenas variáveis não sensíveis à interface:

```text
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
N8N_COMMAND_WEBHOOK_URL=https://seu-n8n/webhook/...
N8N_COMMAND_WEBHOOK_TOKEN=segredo-interno-do-webhook
```

Regras de segurança:

- `.env.local` não deve ser commitado;
- nunca usar a `service_role` do Supabase no navegador;
- tokens do PhantomBuster, Gemini e Google pertencem ao cofre de credenciais do n8n;
- o token interno do webhook n8n fica apenas no servidor da aplicação e no workflow correspondente.

Sem configuração Supabase, a interface usa dados locais de demonstração. Esse modo serve apenas para desenvolvimento visual; não valida integrações nem deve ser usado em produção.

## Banco de dados

Antes de conectar a aplicação ao Supabase, aplique as migrations na ordem abaixo:

1. `../supabase/migrations/20260722_001_initial_agf_crm.sql`
2. `../supabase/migrations/20260722_002_pipeline_and_sheet_sync.sql`
3. `../supabase/migrations/20260722_003_sheet_status_sync.sql`
4. `../supabase/migrations/20260722_004_score_to_ten.sql`

O score comercial é de até 10:

```text
porte (0–3) + urgência/momento (0–3) + decisor (0–2) + economia real (0–2)
```

Os cortes técnicos permanecem sobre a base, antes do bônus: Vagas `>= 3` e Middle market `>= 5`.

## Estado das integrações

| Integração | Estado |
|---|---|
| Supabase | estrutura e usuários iniciais preparados |
| Google Sheets | abas preparadas; espelho de status ainda precisa de workflow n8n validado |
| Gemini | credencial conectada; enriquecimento estruturado ainda precisa ser implementado |
| PhantomBuster | credencial de teste conectada; Phantoms e IDs ainda precisam ser definidos/testados |
| Google Calendar | regras definidas; appointment schedule e retorno de booking ainda precisam ser validados |
| LinkedIn outbound | desligado; depende de piloto interno e confirmação das capacidades dos Phantoms |

## Próximos passos técnicos

1. concluir o workflow `Supabase → Google Sheets`;
2. importar os leads existentes do Sheets preservando aba e linha de origem;
3. implementar ingestão e enriquecimento de Vagas e Middle market;
4. conectar as configurações da interface aos agendamentos e extrações do n8n;
5. validar o agendamento nativo do Google Calendar;
6. fazer o piloto interno antes de habilitar qualquer outreach externo.

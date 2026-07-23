# AGF CRM — contrato de integrações n8n

**Versão:** 1.0
**Atualizado em:** 22 de julho de 2026
**Escopo:** Vagas e Middle market. M&A e startups não fazem parte dos workflows ativos.

Este documento define contratos entre aplicação AGF, Supabase, Google Sheets, PhantomBuster, Gemini e Google Calendar. Cada workflow deve ser idempotente, auditável e seguro. Detalhes comerciais completos estão em [AGF_PROJECT_BRIEF.md](./AGF_PROJECT_BRIEF.md).

## 1. Princípios obrigatórios

- **Supabase é a fonte de verdade:** estágio, score, histórico e dados do CRM vivem no banco.
- **Google Sheets é entrada e espelho:** o CRM altera automaticamente apenas `Status CRM` na linha correspondente.
- **PhantomBuster extrai; n8n decide:** resultado bruto não cria lead sem validação AGF.
- **Gemini enriquece; não decide sozinho:** toda saída é estruturada, tem fontes e passa por regras determinísticas.
- **A aplicação não carrega segredos:** PhantomBuster, Google, Gemini, service role e segredos de webhook ficam no n8n ou no ambiente privado do servidor web.
- **Outreach começa desligado:** convite, mensagem, InMail e link de agenda só podem ser habilitados depois de piloto interno autorizado.
- **Toda ação externa é auditável:** registrar execução, tentativa, resultado e erro resumido sem armazenar tokens ou segredos.

## 2. Identificadores e configuração conhecida

| Recurso | Valor operacional |
|---|---|
| Planilha | `AGF Capital — Leads Outbound | Puxada 1` |
| Aba Vagas | `Vagas`, `gid 1949708938`, cabeçalho 4, dados a partir da linha 5 |
| Aba Middle market | `Middle market`, `gid 369711894`, cabeçalho 4, dados a partir da linha 5 |
| Entrada Vagas | `Entrada Vagas`, `gid 1665373019` |
| Entrada Middle | `Entrada Middle`, `gid 483942315` |
| Fuso horário | `America/Sao_Paulo` |
| Extração padrão | Vagas 5; Middle market 15; configurável no CRM |
| Janela de envio | 09:00–20:00 |
| Alerta diário | 20 abordagens; alerta sem bloqueio rígido |
| Agenda | 30 minutos; inícios `:00`, `:15`, `:30`, `:45`; janela 09:00–20:00 |

Nunca registrar aqui URLs privadas, tokens, chaves de API, IDs de sessão LinkedIn ou credenciais Google.

## 3. Critérios que todos os workflows aplicam

### Gate do perfil

Um contato só é aprovado automaticamente com:

```json
{
  "location_country": "Brasil",
  "connection_count": 100,
  "connect_available": true,
  "profile_gate_passed": true
}
```

`connection_count` pode ser maior que 500 se a fonte retornar `500+`. Sem Brasil, 100+ conexões, `Conectar` ou perfil utilizável, o registro deve ser descartado ou marcado para revisão; nunca entra no Kanban automaticamente.

### Score e contato

```text
score-base = porte (0–3) + urgência ou momento (0–3) + decisor (0–2)
score-comercial = min(10, score-base + economia real (0–2))
```

- `Vagas`: exige `urgency_score`; corte score-base `>= 3`.
- `Middle market`: exige `financial_moment_score`; corte score-base `>= 5`.
- Economia real: `+2` fora de Rio–SP, `+1` no eixo, `0` nos demais casos.
- O bônus não muda o corte técnico; toda nota precisa de justificativa curta e fonte se vier de dado externo.

| Origem / porte | Prioridade | Fallback |
|---|---|---|
| Vagas, grande | líder/gerente/head/coordenador líder/diretor da área da vaga | CEO/CFO/dono sem líder aderente validado |
| Vagas, média/pequena | CEO/CFO/VP/diretor financeiro | líder relacionado; recrutador por último |
| Middle, grande | líder/gerente/head/diretor ligado ao sinal | CEO/CFO/dono sem líder aderente validado |
| Middle, média/pequena | dono/CEO/CFO/head financeiro | liderança financeira relacionada |

Fontes/contexto devem ter no máximo seis meses e relação financeira, operacional ou estratégica. A saída Gemini precisa distinguir fato, fonte e interpretação. Giulio é o remetente padrão; outro sócio só aparece por fit excepcional e comprovado.

## 4. Workflow A — espelho Supabase → Google Sheets

### Objetivo

Quando `leads.current_stage` muda, refletir o rótulo legível em `Status CRM` na linha de origem da planilha, sem alterar outra célula.

O trigger PostgreSQL `queue_sheet_status_sync()` cria uma linha em `sheet_sync_logs` quando o lead possui `source_sheet_tab` e `source_sheet_row_key`.

Payload esperado no trigger/webhook:

```json
{
  "id": "uuid-do-log",
  "lead_id": "uuid-do-lead",
  "target_tab": "Vagas",
  "target_row_key": "V-042",
  "status_value": "Enviar mensagem"
}
```

### Nós mínimos

1. Trigger de banco/webhook para `INSERT` em `sheet_sync_logs` com `sync_status = pending`.
2. Validação de segredo do webhook ou credencial do banco.
3. `Edit Fields (Set)` com **Keep Only Set Fields**:

```json
{
  "ID": "={{ $json.body.record.target_row_key }}",
  "Status CRM": "={{ $json.body.record.status_value }}"
}
```

4. `Switch` por `target_tab`, atualizando por `ID` a aba Vagas ou Middle market.
5. Atualizar o log como `synced` após sucesso:

```sql
update public.sheet_sync_logs
set sync_status = 'synced', attempted_at = now(), error_message = null
where id = :log_id and sync_status = 'pending';
```

Em falha, gravar `failed`, `attempted_at` e resumo seguro. O workflow não pode criar linha nova, sobrescrever outras colunas ou repetir indefinidamente sem política explícita.

## 5. Workflow B — comando da aplicação: Extração extra

O botão **Extração extra** chama `POST /api/extractions`. O servidor web valida o JWT do Supabase, limita volumes e encaminha o comando para webhook privado do n8n.

```json
{
  "command": "extra_extraction",
  "requestedBy": "crm_operator",
  "vacancyCount": 5,
  "middleMarketCount": 15
}
```

O workflow deve validar um header secreto, `command` e volumes inteiros positivos. Deve criar uma `extraction_runs` por base, com ambiente `test` ou `production`.

Resposta sugerida:

```json
{
  "accepted": true,
  "runIds": ["uuid-vagas", "uuid-middle"],
  "message": "Execução iniciada. O resultado aparecerá no CRM quando a ingestão terminar."
}
```

O endpoint não aguarda scraping nem recebe resultados em linha; o estado final é gravado no Supabase.

## 6. Workflow C — extração programada

Usar `Schedule Trigger` em dias úteis, no fuso `America/Sao_Paulo`. O workflow lê `app_settings.lead_extraction` antes de executar.

```json
{
  "enabled": true,
  "time": "08:00",
  "timezone": "America/Sao_Paulo",
  "weekdays": [1, 2, 3, 4, 5],
  "vacancy_count": 5,
  "middle_market_count": 15
}
```

Se `enabled` for falso, encerrar sem chamar PhantomBuster. A programação deve poder ser alterada no painel do CRM sem edição manual do workflow. Caso o Schedule Trigger não aceite horário dinâmico, ele pode rodar em intervalos curtos e decidir no primeiro nó, com trava contra duplicidade diária.

## 7. Workflow D — ingestão de Vagas

1. Ler somente linhas não importadas em `Entrada Vagas` ou output do Phantom de vagas.
2. Normalizar empresa, URL/cargo da vaga, contato, LinkedIn, cidade/estado, conexões e origem.
3. Deduplicar por empresa normalizada e URL LinkedIn do contato no Supabase.
4. Validar gate de perfil e regra de contato por porte.
5. Calcular `company_size_score`, `urgency_score`, `decision_maker_score` e `real_economy_bonus`.
6. Exigir score-base `>= 3`.
7. Chamar Gemini para contexto, notícias/fontes e rascunho.
8. Fazer upsert de empresa, contato e lead; adicionar sinais, mensagem e atividade.
9. Marcar entrada como importada, descartada ou pendente de revisão.

Objeto lógico aprovado:

```json
{
  "source": "vacancy",
  "source_sheet_tab": "Vagas",
  "source_sheet_row_key": "V-042",
  "company": {
    "name": "Empresa Exemplo",
    "normalized_name": "empresa exemplo",
    "industry": "Logística",
    "company_size": "large",
    "real_economy": true,
    "real_economy_rationale": "Operação logística com ativos físicos fora do eixo Rio–SP"
  },
  "contact": {
    "full_name": "Nome Exemplo",
    "linkedin_url": "https://www.linkedin.com/in/exemplo/",
    "title": "Head de Controladoria",
    "location_country": "Brasil",
    "connection_count": 500,
    "connect_available": true,
    "profile_gate_passed": true
  },
  "scores": {
    "company_size_score": 3,
    "urgency_score": 2,
    "decision_maker_score": 2,
    "real_economy_bonus": 2
  },
  "signal_summary": "Vaga aberta para Controller Corporativo em contexto de expansão.",
  "evidence": []
}
```

## 8. Workflow E — ingestão de Middle market

Este workflow encontra/recebe a empresa antes de enriquecer o contato. A falta de vaga é esperada.

1. montar lista pelas saved searches/verticais e filtros de porte;
2. confirmar receita proxy R$ 50–500 milhões ou evidência operacional compatível;
3. encontrar sinal financeiro/operacional verificável dos últimos seis meses;
4. chamar PhantomBuster para contato e dados LinkedIn;
5. validar perfil e regra de contato por porte;
6. calcular `company_size_score`, `financial_moment_score`, `decision_maker_score` e bônus;
7. exigir score-base `>= 5`;
8. gerar contexto/fontes/mensagem Gemini e persistir com `source = middle_market`.

Em Middle market, `urgency_score` é `null` e `financial_moment_score` é obrigatório. Em Vagas, ocorre o inverso. O banco já contém a constraint correspondente.

## 9. Workflow F — enriquecimento Gemini

Gemini deve devolver JSON estruturado, nunca texto livre como única saída:

```json
{
  "company_overview": "string factual e concisa",
  "contact_context": "string factual ou indicação de evidência insuficiente",
  "recent_news": [
    {
      "title": "string",
      "published_at": "YYYY-MM-DD",
      "url": "https://...",
      "source": "nome da fonte",
      "financial_relevance": "string"
    }
  ],
  "signal_summary": "string",
  "score_rationale": {
    "company_size": "string",
    "urgency_or_financial_moment": "string",
    "decision_maker": "string",
    "real_economy": "string"
  },
  "message_draft": "string",
  "partner_fit_recommendation": null
}
```

Pós-validação: aceitar fontes nos últimos seis meses, recusar URL ausente/malformada, limitar notas às faixas definidas e manter nota conservadora ou revisão se a IA não confirmar o fato. O rascunho segue o modelo fixo do Giulio e não insere Moelis/R$ 30 milhões automaticamente.

## 10. Workflow G — convite, mensagem e InMail (desligado)

Quando o CRM solicitar ação externa, criar uma linha em `dispatches` com `status = queued`; nunca executar direto do navegador. Uma única dispatch ativa deve existir para `lead_id + action + hash de conteúdo`.

| Estágio | Ação |
|---|---|
| `Enviar convite` | `connection_invite` |
| `Enviar mensagem` | `linkedin_message` ou `inmail`, conforme disponibilidade e revisão |
| `Agendamento` | `booking_link` |

Regras de execução:

- executar somente entre 09:00 e 20:00 em São Paulo;
- alertar ao chegar a 20 abordagens no dia, sem bloqueio rígido;
- respeitar limites, pausas e política atual do PhantomBuster/LinkedIn;
- atualizar `sent` ou `failed` com horário, executor e resumo;
- nunca responder automaticamente a uma resposta recebida;
- primeiros testes: somente contas dos sócios autorizados e após revisão explícita.

É obrigatório confirmar quais Phantoms suportam convite, mensagem e InMail no plano contratado antes de ativar. Não presumir que o Phantom de scraping consegue fazer outbound.

## 11. Workflow H — agendamento Google Calendar (desligado)

### Ao entrar em Agendamento

1. criar `dispatches` com `action = booking_link`;
2. enviar ao lead, pelo canal já aprovado, a URL do appointment schedule nativo;
3. registrar link, horário de envio e resultado da dispatch.

### Ao confirmar reserva

O workflow recebe o evento pela integração/webhook Calendar e identifica o lead por e-mail, empresa/nome ou metadata do appointment schedule. Em seguida:

1. cria/atualiza `calendar_bookings` com início, fim, URL Meet e ID do evento;
2. altera `leads.current_stage` para `call_booked`;
3. cria `lead_activities` com data/hora;
4. atualiza card no CRM e, por consequência, `Status CRM` no Sheets.

Configuração: 30 minutos, janela 09:00–20:00, slots em `:00/:15/:30/:45`, título `AGF - Giulio / Empresa - Nome do lead`. A agenda de teste deve ser substituída pela agenda do Giulio antes de ativação externa.

## 12. Tratamento de erros e observabilidade

- `extraction_runs.status`: `running`, `completed`, `partial` ou `failed`.
- Extração parcial devolve leads aceitos e resumo do erro; nunca preenche quantidade com leads fracos.
- `sheet_sync_logs`: `pending`, `synced` ou `failed`, com `attempted_at` e erro seguro.
- `dispatches`: `queued`, `requested`, `sent`, `failed` ou `cancelled`.
- Logs guardam IDs internos, tipo de falha e timestamp; não guardam segredo, sessão LinkedIn ou chave de API.
- A aplicação deve informar falha/parcial sem bloquear os leads já importados.

## 13. Sequência de ativação e testes

1. testar credenciais Sheets, Supabase, Gemini e PhantomBuster sem mensagem externa;
2. testar espelho de status com um ID artificial de Vagas e outro de Middle;
3. testar ingestão com lead aprovado e reprovado por base;
4. testar deduplicação repetindo empresa e perfil;
5. testar extração parcial e gravação de erro;
6. validar agenda de teste e criação de evento/Meet sem lead externo;
7. testar convite, mensagem e agendamento apenas com sócios autorizados;
8. trocar agenda/sessão LinkedIn de teste pelas do Giulio, revisar configurações e então avaliar produção.

## 14. Estado de implementação

| Workflow | Estado |
|---|---|
| A — Supabase → Sheets | banco preparado; workflow precisa finalizar e ser testado |
| B — extração extra | endpoint web preparado; webhook n8n ainda precisa concluir execução/resposta |
| C — extração programada | especificado; não implementado |
| D — ingestão Vagas | especificado; não implementado |
| E — ingestão Middle market | especificado; não implementado |
| F — Gemini | credencial conectada; prompt, busca e JSON ainda precisam ser montados |
| G — outreach LinkedIn | desligado; depende de Phantoms e piloto interno |
| H — Google Calendar | regra definida; appointment schedule e webhook de booking ainda precisam de validação |

# AGF CRM — plano de construção

**Versão:** 1.0
**Data:** 23 de julho de 2026
**Base:** [AGF_DECISOES.md](./AGF_DECISOES.md) e [N8N_INTEGRATION_CONTRACT_v2.md](./N8N_INTEGRATION_CONTRACT_v2.md)

---

## Como este plano funciona

Nove fluxos em paralelo é o motivo de o projeto não ter fechado. Este plano constrói **uma fatia vertical de cada vez**, e cada etapa só começa quando a anterior tem critério de pronto satisfeito e demonstrável.

Regras que valem para todas as etapas:

- Nenhuma etapa é considerada pronta por "o código está escrito". Está pronta quando o teste descrito roda e o resultado é observável no CRM.
- Nada que envie ação externa sai do modo dry-run antes da Etapa 8.
- Toda migration é reversível e testada em ambiente de teste antes de produção.
- O escopo Vagas não é tocado até a Etapa 9.

---

## Etapa 0 — Limpeza e alinhamento do schema

**Objetivo.** Remover o acoplamento com Google Sheets e ajustar o modelo de dados ao novo pipeline.

### Antes de escrever qualquer migration

Ler o schema real no Supabase e produzir um diff contra o que está descrito abaixo. Os nomes vieram do contrato v1.0 e podem divergir. Onde divergir, o schema real vence e os documentos são corrigidos.

### Remover

| Objeto | Ação |
|---|---|
| `sheet_sync_logs` | drop da tabela |
| `queue_sheet_status_sync()` | drop da função e do trigger |
| `leads.source_sheet_tab`, `leads.source_sheet_row_key` | substituir por `leads.import_origin text null` |
| valor `inmail` em enums de ação | remover |
| fallback local de leads de demonstração | remover do código da aplicação |

### Alterar

`leads.current_stage` — novo conjunto de valores:

```text
qualificado, aprovado, convite_enviado, conexao_aceita, mensagem_enviada,
em_conversa, agendamento, call_marcada, concluido,
convite_expirado, descartado, revisao_manual
```

Migrar os valores antigos e falhar explicitamente em qualquer valor não mapeado, em vez de converter por aproximação.

`leads` — colunas novas:

```text
invited_at timestamptz null
accepted_at timestamptz null
message_copied_at timestamptz null
message_sent_at timestamptz null
message_sent_by uuid null
discard_reason text null
import_origin text null
```

Nota de transição: a constraint implantada na Etapa 0 ainda exige
`financial_moment_score` em `middle_market`. A nova premissa da Etapa 2
substitui esse campo pelo score estrutural descrito em
`ETAPA_2_SOURCE_VERIFICATION_PLAN.md`. A migration correspondente somente será
escrita depois da aprovação do plano revisado; até lá, o schema existente não
deve ser tratado como regra comercial definitiva.

### Criar

`lead_signals` — cada sinal verificado, um por linha:

```text
id, lead_id, summary, family, source_url, source_name,
published_at date, verified_at timestamptz, verification_method text
```

`invite_note_templates`:

```text
id, name, body text, variables jsonb, is_active boolean,
approved_by text, approved_at timestamptz, created_at
```

Constraint: no máximo um template com `is_active = true`.

`connection_sync_runs`:

```text
id, started_at, finished_at, status, accepted_count, error_summary
```

`outreach_metrics` — snapshot diário:

```text
date, invites_sent, invites_accepted, acceptance_rate_14d,
weekly_invite_count, daily_cap_applied
```

`calendar_bookings` — adicionar `match_status` e `matched_by`.

`dispatches` — adicionar `simulated` ao enum de status e `channel` (`automated` ou `manual`).

### Pronto quando

- Nenhuma referência a Sheets existe no código, nas migrations ou nos workflows.
- As migrations sobem e descem sem erro em ambiente de teste.
- O Kanban abre com os estágios novos, sem quebrar.
- RLS revisado nas tabelas novas.

---

## Etapa 1 — Importação única dos leads existentes

**Objetivo.** Trazer os leads da planilha para o banco, uma vez só, e nunca mais ler planilha.

**Escopo.** Script isolado, fora dos workflows. Lê a planilha atual, normaliza, deduplica, grava `import_origin` com aba e linha de origem como texto livre, e mapeia o estágio antigo para o novo.

Leads sem sinal verificado entram em `revisao_manual`, não em `qualificado`. Não fabricar verificação retroativa.

**Pronto quando** todos os leads aparecem no Kanban com origem rastreável, sem duplicata, e o script é arquivado com nota de execução única.

---

## Etapa 2 — Pipeline Middle market com entrada manual

**Objetivo.** Fechar o caminho completo de qualificação sem depender de descoberta automática.

**Escopo.** O corpus inicial são os 60 leads legados em `revisao_manual`.
O operador usa a ação **Re-qualificar** no card existente. O sistema cruza a
empresa com rankings setoriais e regionais importados, verifica faturamento e
complexidade operacional, mede a densidade do time financeiro no LinkedIn,
calcula o score estrutural e aplica o gate de perfil. Notícia é contexto
opcional. Em caso de aprovação, move o mesmo lead para `qualificado`; não cria
outro lead e não contorna `leads_one_active_company_idx`.

Esta é a etapa mais importante do projeto. A verificação de fonte é construída aqui e todas as etapas seguintes dependem dela.

### Teste obrigatório

Rodar primeiro com dez empresas, incluindo Nova Era, e depois com os 60 leads
legados:

| Caso | Resultado esperado |
|---|---|
| Empresa encontrada em ranking, com receita e operação verificadas | evidências estruturais persistidas com documento, página/linha e hash |
| Empresa relevante sem notícia recente | qualificação não é prejudicada; o contexto de notícia fica vazio |
| Empresa sem faturamento publicado verificável | permanece em `revisao_manual`, sem estimativa produzida pelo modelo |
| PDF ou página que retorna erro, muda de conteúdo ou falha na extração | edição não é liberada e o erro fica auditável |
| Contagem do LinkedIn incompleta, limitada ou bloqueada | `finance_thinness_score = null`; ausência nunca é convertida em zero |
| Empresa homônima no ranking ou LinkedIn | permanece em revisão até confirmação determinística ou humana |

**Pronto quando** os casos produzem o resultado esperado, a calibragem com os
60 leads é revisada e nenhum fato estrutural do card existe sem fonte
verificada. Notícia não faz parte do critério de pronto.

---

## Etapa 3 — Descoberta automática

**Objetivo.** Substituir a entrada manual pelo PhantomBuster, alimentando o mesmo pipeline da Etapa 2.

**Escopo.** Importar periodicamente edições aprovadas dos rankings, gerar
empresas candidatas e usar o PhantomBuster somente para enriquecer página,
contatos e densidade da função financeira no LinkedIn. Aplicar as buscas
financeiras e de contatos de `LINKEDIN_SAVED_SEARCHES.md`. Buscar o output do
Phantom via API em JSON, direto para o banco. Agendar a execução e ligar o
botão de extração extra.

**Dependência.** Confirmar a assinatura contratada e quais phantoms funcionam nela.

**Pronto quando** uma execução agendada produz leads qualificados sem intervenção, e uma execução parcial grava o erro sem contaminar os leads bons.

---

## Etapa 4 — Convite automático em dry-run

**Objetivo.** Construir todas as travas antes de qualquer envio real.

**Escopo.** Workflow D do contrato v2, com `dry_run = true`. Grava dispatch `simulated`, não chama o PhantomBuster.

**Dependência.** Template de nota aprovado por escrito pelo Giulio, gravado em `invite_note_templates`.

### Teste obrigatório

| Cenário simulado | Resultado esperado |
|---|---|
| 100 convites nos últimos 7 dias | bloqueio duro, nenhum dispatch criado |
| Fora da janela 09:00–20:00 | não executa |
| Sábado | não executa |
| Taxa de aceite em 15% | teto diário cai à metade e alerta aparece |
| Nenhum template ativo | não executa, com erro claro |
| Dois convites em menos de 4 minutos | segundo é adiado |
| Lead com dispatch ativo | não duplica |

**Pronto quando** os sete cenários se comportam como descrito e o CRM exibe os alertas da seção 13 do contrato.

---

## Etapa 5 — Fila de envio

**Objetivo.** A tela de trabalho diário do Giulio.

**Escopo.** Contrato v2, seção 11. Um card por vez, sinais com link, mensagem editável, botões de copiar, enviei, respondeu e descartar.

**Pronto quando** o Giulio consegue processar dez leads de teste sem abrir o Kanban e sem procurar informação em outro lugar, e cada ação grava horário e autor.

---

## Etapa 6 — Detecção de aceite

**Objetivo.** Fechar o laço entre convite e fila de envio.

**Escopo.** Workflow E do contrato v2, uma execução diária.

**Dependência.** Confirmar qual phantom faz export de conexões no plano contratado.

**Pronto quando** um aceite real move o lead para a fila de envio no dia seguinte, e o casamento é por URL exata — testado com dois contatos de nome idêntico.

---

## Etapa 7 — Calendly

**Objetivo.** A reunião marcada volta para o card sozinha.

**Escopo.** Formulário com campo obrigatório de empresa, webhook com validação de assinatura, casamento exato, estado `unmatched` para revisão.

**Dependência.** Plano do Calendly com webhook confirmado.

**Pronto quando** uma reserva de teste move o card para `call_marcada` com data e link, e uma reserva com empresa desconhecida cai em revisão sem quebrar nada.

---

## Etapa 8 — Piloto interno e liberação do envio

**Objetivo.** Primeira operação real, em volume mínimo.

**Escopo.** Desligar `dry_run`. Volume de 8 convites por dia, apenas na conta do Giulio. Duas semanas.

**Antes de ligar, verificar:** teto semanal funcionando, alerta de aceite funcionando, interruptor geral testado, template aprovado ativo, plano documentado para o caso de a conta ser restringida.

**Pronto quando** duas semanas se passam com taxa de aceite conhecida, nenhum bloqueio de conta e o Giulio operando pela fila de envio diariamente.

---

## Etapa 9 — Vagas

Só depois da Etapa 8. Reaproveita todo o pipeline, trocando a origem do sinal (a vaga é o sinal), o campo de score (`urgency_score`) e o corte (`>= 3`). A verificação de fonte se aplica igual: a URL da vaga precisa resolver e conter o nome da empresa.

---

## Fora de escopo até segunda ordem

- InMail, em definitivo.
- Envio automático de mensagem ou de resposta.
- Detecção automática de resposta recebida — reavaliar após 30 dias de operação.
- Qualquer leitura ou escrita em Google Sheets.
- M&A e startups.
- Publicação da aplicação antes da Etapa 8.

# AGF CRM — briefing completo do projeto

**Versão:** 1.0
**Atualizado em:** 22 de julho de 2026
**Público:** produto, engenharia, automações n8n e IA de apoio

Este briefing consolida as decisões atuais do projeto. Onde houver conflito com documentos mais antigos, prevalece este arquivo e a versão ativa de `criteria_versions` no Supabase.

## 1. Objetivo

Construir um CRM web compartilhado para a AGF descobrir, qualificar, enriquecer e conduzir leads de empresas que possam contratar projetos de implementação de IA em finanças corporativas.

O produto deve reduzir o trabalho operacional do Giulio, mas preservar a decisão comercial humana: o CRM recebe somente leads filtrados; os operadores revisam contexto e mensagem, movem os cards e assumem manualmente conversas que exijam resposta.

O fluxo conecta cinco partes:

1. PhantomBuster para descoberta no LinkedIn;
2. Google Sheets como entrada e espelho auditável;
3. n8n como orquestrador de integrações;
4. Supabase como autenticação, banco, auditoria e fonte de verdade;
5. aplicação web AGF como Kanban operacional.

## 2. Escopo comercial atual

| Base | Objetivo | Sinal de entrada | Corte técnico |
|---|---|---|---:|
| `Vagas — leads quentes` | empresas com demanda financeira explícita | vaga financeira/corporativa aberta | score-base `>= 3` |
| `Middle market — prospecção proativa` | empresas reais com potencial de eficiência financeira | momento financeiro ou operacional verificável | score-base `>= 5` |

M&A pré-captação e startups estão **pausados**. Não devem entrar na extração, no Kanban nem nos workflows ativos.

Há somente um card ativo por empresa. O contato é único por empresa enquanto o card está ativo; outro contato só pode entrar em um novo ciclo mediante um sinal novo e extremamente forte, mantendo todo o histórico anterior visível.

## 3. Cliente ideal e prioridade comercial

A proposta da AGF é implementar IA aplicável ao dia a dia financeiro, automatizando atividades operacionais e estratégicas sem transformar a entrega em um projeto longo e abstrato.

Empresas de economia real são prioridade comercial, sobretudo fora do eixo Rio–São Paulo. Exemplos: indústria, agronegócio, logística, varejo/atacado, saúde, construção, energia, franquias e infraestrutura. A classificação depende da operação predominante da empresa, não apenas da tecnologia usada.

Tech pura, plataformas digitais e serviços financeiros não são excluídos, mas não recebem o bônus de economia real e exigem sinal mais convincente.

## 4. Gate obrigatório do perfil LinkedIn

O contato só entra automaticamente no CRM se houver evidência de que:

- está localizado no Brasil;
- possui ao menos 100 conexões (`500+` é aprovação válida);
- a ação `Conectar` está disponível;
- possui perfil utilizável: nome, cargo e vínculo atual coerentes, sem sinais claros de conta incompleta, falsa ou inconsistente.

Sem uma dessas evidências, o registro vai para revisão ou descarte, nunca para o Kanban automaticamente.

## 5. Regra de contato por base e porte

| Base e porte | Contato preferencial | Fallback permitido |
|---|---|---|
| Vagas, grande | líder, gerente, head, coordenador líder ou diretor da área da vaga | CEO, CFO ou dono se não houver líder aderente validado |
| Vagas, média ou pequena | CEO, CFO, VP/diretor financeiro ou liderança financeira | líder da área; recrutador apenas em último caso |
| Middle market, grande | líder, gerente, head ou diretor da área financeira relacionada ao sinal | CEO, CFO ou dono se não houver líder aderente validado |
| Middle market, média ou pequena | dono, CEO, CFO ou head financeiro | liderança financeira diretamente relacionada ao sinal |
| M&A, quando voltar | maior decisor disponível | fora do escopo atual |

O Giulio é o remetente padrão. Recomendar Salomão, Dani ou André somente com evidência direta e excepcional de fit: tech/startup ou ecossistema de investimento (Salomão), IA como tema central (Dani), ou relação com Pátria ou Mubadala (André). Essa recomendação nunca muda automaticamente o remetente.

## 6. Pontuação comercial — máximo 10

```text
score-base = porte (0–3) + urgência/momento (0–3) + decisor (0–2)
score-comercial = min(10, score-base + bônus de economia real)
```

| Componente | Faixa | Uso |
|---|---:|---|
| Porte | 0–3 | receita proxy, funcionários, complexidade operacional e escala financeira |
| Urgência da vaga | 0–3 | somente Vagas; atualidade, senioridade e materialidade da contratação |
| Momento financeiro | 0–3 | somente Middle; expansão, capex, dívida, debênture, mudança financeira, eficiência, integração ou evento verificável |
| Decisor | 0–2 | aderência do contato às regras de porte e origem |
| Economia real | 0–2 | `+2` fora de Rio–SP, `+1` no eixo, `0` nos demais casos |

Os cortes usam apenas o score-base. O bônus comercial serve para ordenar a prioridade, sem aprovar um lead tecnicamente fraco. Cada ponto precisa de uma justificativa curta e, quando houver fato externo, de fonte registrada.

## 7. Descoberta e enriquecimento

### Vagas

As buscas no LinkedIn cobrem FP&A, planejamento financeiro, controladoria, tesouraria, crédito, caixa, corporate finance, RI, gestão financeira e finance business partner. Estágio e trainee são excluídos; júnior pode entrar.

A vaga fechada depois da extração continua válida como sinal de demanda recente. Registrar empresa, cargo, URL, data/publicação e área da vaga antes de buscar o contato.

### Middle market

Buscar empresas brasileiras com proxy de faturamento entre R$ 50 milhões e R$ 500 milhões. As faixas principais são 201–500 e 501–1.000 funcionários; a faixa 51–200 pode entrar com evidência de receita compatível ou operação física complexa.

Não há exigência de vaga. Deve existir fato verificável dos últimos seis meses, como expansão, nova unidade, capex, dívida/debênture, FIDC, financiamento, mudança de CFO/CEO, aquisição, integração, pressão de margem/caixa ou ganho de escala operacional.

### Contexto, notícias e mensagem

O agente Gemini deve retornar contexto factual e conciso da empresa e do contato, de uma a três fontes/notícias de até seis meses e a justificativa do gatilho comercial. Deve separar fato, fonte e interpretação. Ausência de evidência é preferível a suposição.

O rascunho parte do modelo abaixo. Apenas o gatilho é individualizado; a copy precisa ser humana, direta e verificável.

```text
{Nome}, tudo bem? Obrigado por aceitar o convite.

Vi {trigger da empresa}. Imagino que usar AI de verdade no financeiro, sem virar projeto eterno, esteja na pauta aí também.

Montei a AGF exatamente para isso. Contamos com profissionais das melhores consultorias do Brasil, que atuam no dia a dia da empresa, do operacional ao estratégico, criando automações no caminho.

Eu venho de 10+ anos entre banking e corporate development, e fundei uma empresa na qual levantei recursos com investidores institucionais.

Topa 15-30 minutos para eu me apresentar rapidamente?
```

Moelis e a captação de R$ 30 milhões não fazem parte do modelo-base atual. Podem ser testados posteriormente, mas não devem ser inseridos automaticamente.

## 8. Pipeline e operação no CRM

O Kanban é compartilhado por todos os usuários autenticados. Não há base individual por operador. Todos podem operar e alterar configurações; Giulio tende a ser o principal responsável comercial.

| Ordem | Estágio | Significado e ação |
|---:|---|---|
| 1 | `Prontos para enviar` | lead já passou pelos filtros e aguarda revisão comercial |
| 2 | `Aprovado` | revisão concluída; pode seguir para convite ou mensagem |
| 3 | `Enviar convite` | pedido de convite preparado para execução controlada |
| 4 | `Convite enviado` | convite registrado como enviado; aguarda aceite ou próximo passo |
| 5 | `Enviar mensagem` | mensagem revisada e autorizada; executor deve obedecer à janela de envio |
| 6 | `Em conversa` | Giulio conduz a resposta manualmente e decide o próximo movimento |
| 7 | `Agendamento` | lead demonstrou interesse; enviar automaticamente o link de agenda |
| 8 | `Call marcada` | evento e Meet confirmados; exibir data/hora diretamente no card |
| 9 | `Concluído` | oportunidade, recusa, sem resposta, sem fit ou contato inválido; manter histórico |

Ao clicar no card, a interface abre um drawer expandido com empresa, contato, LinkedIn, contexto, notícias, score, sinal, rascunho, histórico e horário de call quando existir. Arrastar ou usar o botão de avanço altera o estágio e registra atividade.

## 9. Agendamento

Quando o card é movido para `Agendamento`, o fluxo envia automaticamente ao lead o link do agendamento nativo do Google Calendar. O lead escolhe o horário; não há troca manual de slots.

- duração padrão: 30 minutos;
- disponibilidade: 09:00–20:00, respeitando eventos existentes da agenda do Giulio;
- início permitido: `:00`, `:15`, `:30` ou `:45`;
- o Calendar cria evento, Google Meet e confirmação;
- título: `AGF - Giulio / Empresa - Nome do lead`;
- o convite não deve permitir que o lead convide terceiros; se a conversa mencionar um terceiro, registrar aviso manual no card;
- o booking confirmado atualiza `calendar_bookings`, mostra horário no card e muda a etapa para `Call marcada`.

O calendário atual é apenas de teste. Antes de produção, a credencial e o appointment schedule precisam ser trocados para a conta do Giulio.

## 10. Arquitetura e responsabilidades

| Componente | Responsabilidade | Não deve fazer |
|---|---|---|
| Aplicação web AGF | login, Kanban, drawer, configurações, revisão e comandos protegidos | guardar segredos ou chamar APIs externas diretamente |
| Supabase | autenticação, dados, RLS, histórico, filas e fonte de verdade | executar scraping, IA ou ações LinkedIn |
| n8n | orquestrar fluxos, chamar PB/Gemini/Google, tratar tentativas e falhas | substituir o CRM ou expor credenciais |
| PhantomBuster | coletar dados LinkedIn e, se validado, executar ações LinkedIn | decidir qualidade de lead ou alterar CRM diretamente |
| Google Sheets | entrada/saída auditável e espelho de `Status CRM` | ser fonte de verdade do CRM |
| Gemini | contexto, notícias, justificativas e rascunho estruturado | inventar evidências ou executar ação comercial |
| Google Calendar | disponibilidade, booking, Meet e confirmação | controlar o pipeline comercial completo |

Fluxo de dados:

```text
PhantomBuster → Google Sheets (entrada bruta) → n8n (normaliza, filtra e enriquece)
→ Supabase (dados e auditoria) → Aplicação AGF (Kanban)
→ Supabase (mudança de etapa) → n8n → Google Sheets (somente Status CRM)
```

## 11. Dados no Supabase

| Entidade | Finalidade |
|---|---|
| `profiles` | operadores criados a partir de `auth.users` |
| `app_settings` | parâmetros de extração, outbound, agenda e score |
| `criteria_versions` | regras versionadas; somente uma pode estar ativa |
| `extraction_runs` | auditoria por execução de Vagas ou Middle market |
| `companies` | empresa normalizada, porte, receita proxy, setor e economia real |
| `contacts` | contato LinkedIn e resultado do gate de perfil |
| `leads` | card comercial, score, origem, estágio e referência da planilha |
| `lead_signals` | evidências de vaga, notícia e eventos |
| `message_drafts` | rascunhos e versão atual da mensagem |
| `dispatches` | fila idempotente de convite, mensagem, InMail e link de agenda |
| `calendar_bookings` | eventos, Meet e horários confirmados |
| `lead_activities` | histórico do card |
| `sheet_sync_logs` | fila e resultado do espelho para Sheets |

As migrations em `supabase/migrations/` contemplam o modelo inicial, a etapa `Aprovado`, a fila de espelho e score até 10. Mudança de regra deve criar nova migration e nova versão de critério, sem apagar justificativa de leads já existentes.

## 12. Google Sheets

O arquivo operacional contém abas de entrada e as abas auditáveis de Vagas e Middle market. O CRM mantém na linha de origem a coluna `Status CRM`; não cria uma segunda planilha-CRM.

| Aba | `gid` | Estrutura | Regra de escrita pelo CRM |
|---|---:|---|---|
| `Vagas` | `1949708938` | cabeçalho 4; dados a partir da linha 5 | atualizar somente `Status CRM` por `ID` |
| `Middle market` | `369711894` | cabeçalho 4; dados a partir da linha 5 | atualizar somente `Status CRM` por `ID` |
| `Entrada Vagas` | `1665373019` | entrada bruta | n8n marca importação após processamento |
| `Entrada Middle` | `483942315` | entrada bruta | n8n marca importação após processamento |

Alterações manuais no Sheets não podem substituir `current_stage` no Supabase sem uma automação de importação explicitamente aprovada.

## 13. Aplicação web atual

O código está em `prototype-agf-crm/`. A versão atual possui login por e-mail e senha do Supabase, Kanban de nove etapas, drawer expandido, páginas de agenda/histórico, painel de configurações, persistência remota quando configurada e a rota protegida `POST /api/extractions`.

O fallback local com leads de demonstração existe apenas para desenvolvimento. A aplicação ainda não executa convite, mensagem, agendamento, importação ou extração real; esses comportamentos devem ser conectados por workflows n8n e endpoints mínimos protegidos.

## 14. Workflows n8n necessários

1. **Sincronização de status:** recebe alteração de `sheet_sync_logs`, atualiza apenas `Status CRM` na aba correta e marca o log como `synced` ou `failed`.
2. **Extração manual:** recebe comando seguro da aplicação, cria `extraction_runs` e inicia as quantidades solicitadas.
3. **Extração programada:** lê `app_settings.lead_extraction`, roda em dias úteis no horário configurado e respeita os volumes definidos.
4. **Ingestão Vagas:** lê entradas, deduplica, valida perfil, aplica critérios, usa Gemini, faz upsert e marca a linha como importada, descartada ou revisão.
5. **Ingestão Middle market:** confirma empresa/sinal, procura contato, aplica os mesmos gates e persiste o resultado.
6. **Outreach controlado:** processa `dispatches` para convite, mensagem/InMail e link de agenda somente após revisão e dentro da janela operacional. Começa desligado.
7. **Agendamento:** envia o link de booking; quando o Calendar confirma, registra o booking e avança o card.
8. **Observabilidade:** registra tentativa, parcial, falha e resultado sem vazar tokens ou conteúdo sensível.

## 15. Segurança e limites de automação

- Chaves PhantomBuster, Gemini, Google e a chave privilegiada do Supabase ficam apenas no cofre de credenciais do n8n.
- A aplicação recebe apenas URL e chave publicável do Supabase; nunca a `service_role`.
- `N8N_COMMAND_WEBHOOK_URL` e `N8N_COMMAND_WEBHOOK_TOKEN` ficam apenas no ambiente privado do servidor web.
- Webhooks n8n validam segredo e formato de payload.
- Não registrar tokens, senhas ou mensagens privadas em logs, planilhas, commits ou documentos.
- O envio externo inicia desligado; os testes end-to-end usam somente perfis de sócios autorizados.
- Respostas no LinkedIn permanecem manuais nesta versão. Não existe bot respondendo em nome do Giulio.

## 16. Estado atual

### Preparado

- aplicação visual, login Supabase, Kanban compartilhado, drawer e painel de configurações;
- migrations aplicadas e usuários iniciais criados;
- credenciais de Supabase, Sheets, Calendar de teste, Gemini e PhantomBuster conectadas no n8n de teste;
- critérios, saved searches e copy-base documentados;
- chave PhantomBuster rotacionada e mantida fora do código;
- MCP da instância n8n configurado para apoiar a construção dos workflows.

### Ainda pendente

- importar ao Supabase os leads existentes do Sheets, preservando origem, aba e linha;
- concluir e testar o espelho de `Status CRM` para Vagas e Middle market;
- configurar Phantoms concretos, seus IDs e inputs;
- construir a cadeia de ingestão, validação, deduplicação, score, Gemini e upsert;
- usar efetivamente as configurações do CRM nos fluxos agendados;
- implementar `dispatches` e o piloto interno de convite/mensagem;
- criar/trocar o appointment schedule do Google Calendar para Giulio;
- implementar retorno do booking, erros, tentativas e auditoria visível;
- testar ponta a ponta e publicar no domínio da AGF.

## 17. Sequência recomendada de implementação

1. Validar migrations, usuários e leitura/escrita do Kanban contra Supabase.
2. Concluir o workflow Supabase → Sheets e testar um lead de cada aba.
3. Importar os registros existentes da planilha, mantendo origem e linha.
4. Configurar um Phantom de teste e validar extração sem outreach.
5. Construir ingestão de Vagas e Middle com uma linha aprovada e uma reprovada para cada base.
6. Validar contexto/notícias e rascunho Gemini com fontes reais.
7. Conectar extração programada e botão de extração extra às configurações.
8. Configurar booking nativo de teste e validar evento/Meet.
9. Executar piloto de convite, mensagem e agendamento só com sócios autorizados.
10. Trocar credenciais de teste pelas do Giulio, revisar segurança e preparar publicação.

## 18. Critérios de aceite da primeira versão funcional

A primeira versão estará pronta quando for possível demonstrar, sem alteração manual de banco:

1. uma extração aprovada chegando ao Supabase com contexto, score e rascunho;
2. o lead aparecendo no Kanban compartilhado e abrindo corretamente no drawer;
3. uma mudança de etapa atualizando somente a célula `Status CRM` correta no Sheets;
4. uma falha de extração devolvendo resultado parcial e erro compreensível;
5. uma mensagem de teste revisada antes de qualquer envio;
6. um lead em `Agendamento` recebendo link de agenda de teste;
7. uma reserva criando evento/Meet, preenchendo horário no card e mudando para `Call marcada`;
8. nenhum token, chave privilegiada ou credencial aparecendo no browser, Git ou Sheets.

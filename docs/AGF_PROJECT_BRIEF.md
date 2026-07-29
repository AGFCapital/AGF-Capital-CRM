# AGF CRM — briefing atual do projeto

**Versão:** 3.0
**Atualizado em:** 29 de julho de 2026

## 1. Objetivo

Centralizar a operação comercial da AGF desde a entrada de uma base pronta até
a conversão em projeto. O produto deve reduzir o trabalho administrativo sem
colocar a conta do LinkedIn do Giulio sob automação.

## 2. Limite do produto

O CRM não descobre nem qualifica empresas. A origem pode ser Apollo, Codex,
planilha ou processo humano, desde que entregue uma lista filtrada.

O CRM é responsável por:

- armazenar bases de leads;
- liberar leads gradualmente;
- conduzir o relacionamento;
- preparar textos;
- registrar ações;
- organizar follow-ups;
- reconhecer reuniões;
- criar e acompanhar projetos;
- exibir indicadores operacionais.

## 3. Entrada de leads

### Formato atual

CSV no formato exportado pelo Apollo. O parser:

- detecta delimitador e codificação;
- normaliza UTF-8, Windows-1252 e acentos corrompidos;
- mapeia empresa, contato, cargo, LinkedIn, setor, localidade, funcionários,
  receita e IDs Apollo;
- rejeita linhas sem empresa, contato ou LinkedIn utilizável;
- elimina duplicatas dentro do arquivo.

### Bases nomeadas

Todo upload recebe um nome humano, por exemplo `Base Middle-Market 1`.
Arquivos diferentes convivem no banco. Ao liberar leads, o operador escolhe:

- a base de origem;
- a quantidade entre 1 e 100.

A deduplicação continua global: outra base não autoriza criar novamente uma
empresa ou contato já presente no histórico do CRM.

### Cadastro manual

Qualquer operador pode criar um lead diretamente na Base de clientes.
Projetos também podem ser criados sem lead.

## 4. Pipeline de leads

| Interface | Banco | Resultado |
|---|---|---|
| Base de clientes | `revisao_manual` ou `qualificado` | Lead disponível para prospecção. |
| Enviar convite | `aprovado` | Nota de conexão pronta. |
| Convite pendente | `convite_enviado` | Convite registrado como enviado. |
| Conexão aceita | `conexao_aceita` | Mensagem longa pronta e editável. |
| Mensagem enviada | `mensagem_enviada` | Aguarda resposta. |
| Em conversa | `em_conversa` | Conversa ativa. |
| Agendamento | `agendamento` | Link público da agenda pronto para copiar. |
| Call marcada | `call_marcada` | Reserva reconhecida e horário visível. |
| Criar projeto | transição | Cria projeto em `pos_call`; o card deixa o Kanban de leads. |
| Descartado | `descartado` | Sem continuidade. |

O card pode voltar para uma etapa anterior. Arrastar para a etapa seguinte
executa a mesma confirmação do botão principal.

## 5. LinkedIn

Não existe automação ativa de convite, mensagem, InMail, aceite ou resposta.

O operador:

1. abre o LinkedIn pelo card;
2. copia o texto;
3. realiza a ação;
4. confirma no CRM ou arrasta o card.

Essa decisão mantém o controle humano e reduz o risco sobre a conta.

## 6. Agenda

- Google Appointment Schedule;
- link público configurável no CRM;
- reuniões de 30 minutos;
- slots permitidos em `:00`, `:15`, `:30` ou `:45`;
- evento e Meet criados pelo Google;
- empresa solicitada no formulário;
- n8n monitora criação, alteração e cancelamento;
- o CRM considera a reserva ativa criada mais recentemente.

Casamentos usam e-mail, empresa e nome com regras conservadoras. Reserva sem
correspondência única fica `unmatched` e não move nenhum lead.

## 7. Follow-ups e responsabilidades

Todos os usuários veem todos os leads, projetos e tarefas. Cada follow-up:

- pertence a quem o criou;
- pertence a exatamente um lead ou projeto;
- tem data, horário e descrição;
- aparece no sino do responsável;
- pode ser visto na visão da equipe;
- envia e-mail apenas ao responsável, se habilitado no perfil;
- possui entrega idempotente para evitar e-mails duplicados.

Um lead pode ter responsável e etiqueta organizacional sem restringir a
visibilidade.

## 8. Pipeline comercial

Etapas:

```text
Pos-call -> Proposta -> Negociação -> Projeto -> Ganho / Perdido
```

Campos mínimos:

- nome;
- empresa;
- responsável;
- etapa;
- descrição;
- próxima ação;
- data da próxima ação;
- valor estimado opcional;
- observações.

O dashboard soma o valor dos projetos por etapa; não é um forecast
probabilístico. O detalhe de cada projeto permite criar e concluir follow-ups;
essas tarefas participam do mesmo sino, da mesma página de follow-ups e da
mesma entrega de e-mail usada na prospecção.

## 9. Visões da aplicação

- Visão geral: métricas, funil, conversão e valor dos projetos;
- Base de clientes: Kanban operacional;
- Follow-ups: tarefas abertas e concluídas;
- Agendamentos: calls reconhecidas;
- Projetos: pipeline comercial;
- Base completa: histórico compartilhado;
- Banco de leads: bases nomeadas, saldos e liberação.

## 10. Arquitetura

| Componente | Responsabilidade |
|---|---|
| Aplicação web | Interface, parser CSV e chamadas autenticadas. |
| Supabase Auth | Login dos operadores. |
| Supabase Database | Fonte de verdade, RLS, RPCs e auditoria. |
| n8n | Calendar e entrega de e-mails. |
| Google Calendar | Página de agenda, evento, Meet e confirmação. |
| Gmail | Lembretes de follow-up. |
| LinkedIn | Operação manual fora da aplicação. |
| Apollo | Origem externa opcional do CSV. |

## 11. Segurança

- somente publishable key no navegador;
- `service_role` apenas no cofre do n8n/servidor;
- nenhum token em Markdown, código cliente ou log;
- operações críticas em RPCs atômicas;
- RLS mantém leitura compartilhada e escrita autenticada;
- exclusões exigem confirmação.

## 12. Fora do escopo atual

- scraping dentro do CRM;
- automação do LinkedIn;
- respostas automáticas;
- enriquecimento por Gemini;
- Google Sheets como espelho;
- score como controle operacional;
- descoberta automática de Vagas ou Middle market;
- M&A e startups.

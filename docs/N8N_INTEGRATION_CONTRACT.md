# AGF — contrato de integrações n8n

Este documento define os dados trocados entre a aplicação AGF, Supabase, Google
Sheets, PhantomBuster e Google Calendar. Ele é a referência para construir os
workflows no n8n; nenhuma automação de outreach deve ser ativada antes de
passar pelo piloto interno.

## Princípios

- **Supabase é a fonte de verdade** do CRM, do estágio e do histórico.
- **Google Sheets é entrada e espelho de status**, nunca uma segunda base de
  CRM. A única célula alterada automaticamente pelo CRM é `Status CRM`.
- **PhantomBuster extrai; n8n decide.** Dados extraídos não entram no CRM sem
  aplicar os critérios AGF.
- Credenciais privilegiadas ficam no cofre do n8n. A aplicação usa somente a
  chave publicável do Supabase e nunca chama PhantomBuster, Google ou Gemini
  diretamente.
- Mensagens, convites e InMail permanecem desligados até o piloto controlado.

## 1. Espelho de estágio: Supabase → Google Sheets

### Origem no Supabase

Quando `leads.current_stage` muda, o gatilho
`queue_sheet_status_sync()` cria uma linha em `sheet_sync_logs` com:

```json
{
  "id": "uuid-do-log",
  "lead_id": "uuid-do-lead",
  "target_tab": "Vagas",
  "target_row_key": "V-042",
  "status_value": "Enviar mensagem"
}
```

O workflow recebe esse registro por Database Webhook do Supabase (evento
`INSERT` em `sheet_sync_logs` filtrado para `sync_status = pending`). O webhook
do n8n é privado e validado por segredo mantido no Vault do Supabase e na
configuração do n8n.

### Transformação obrigatória antes do Google Sheets

Use um nó **Edit Fields (Set)**, com `Keep Only Set Fields` habilitado, para
produzir exatamente:

```json
{
  "ID": "={{ $json.body.record.target_row_key }}",
  "Status CRM": "={{ $json.body.record.status_value }}"
}
```

Isso impede que valores vazios de outros campos substituam dados existentes.

### Nó Google Sheets — Vagas

- Operação: `Update Row`
- Documento: `AGF Capital — Leads Outbound | Puxada 1`
- Aba: `Vagas` (`gid 1949708938`)
- Header row: `4`; primeira linha de dados: `5`
- Coluna de correspondência: `ID`
- Mapeamento: `Map Automatically` após o Edit Fields acima
- Único campo de escrita: `Status CRM`

### Nó Google Sheets — Middle market

Mesma configuração, trocando somente a aba para `Middle market`
(`gid 369711894`).

### Finalização e idempotência

Depois de uma atualização bem-sucedida, o workflow atualiza o log correspondente:

```sql
update public.sheet_sync_logs
set sync_status = 'synced', attempted_at = now(), error_message = null
where id = :id and sync_status = 'pending';
```

Em erro, registra `sync_status = 'failed'`, `attempted_at` e um resumo seguro
do erro. A execução não deve tentar editar outras colunas nem criar nova linha
na planilha.

## 2. Comando do CRM: extração extra

O botão **Extração extra** chama a rota protegida da aplicação, que por sua vez
envia ao Webhook privado do n8n:

```json
{
  "command": "extra_extraction",
  "requestedBy": "crm_operator",
  "vacancyCount": 5,
  "middleMarketCount": 15
}
```

O header `x-agf-internal-key` é conferido no n8n. O valor fica apenas em
`N8N_COMMAND_WEBHOOK_TOKEN` no servidor que hospeda o CRM e no workflow; ele
nunca vai ao navegador.

O workflow registra uma `extraction_runs` para cada base solicitada. Se uma
fonte falhar, devolve o que conseguiu e marca a execução como `partial` com
resumo do erro.

## 3. Entrada: PhantomBuster → Sheets → n8n → Supabase

1. PhantomBuster escreve resultados brutos nas abas de entrada correspondentes:
   `Entrada Vagas` ou `Entrada Middle`.
2. n8n lê somente linhas ainda não importadas e normaliza empresa, pessoa,
   LinkedIn, localização, conexões e sinal.
3. O filtro obrigatório aprova apenas perfis com Brasil, 100+ conexões e ação
   `Conectar` disponível. Dados ausentes ou perfil inadequado são descartados
   ou marcados para revisão; não entram no kanban.
4. Gemini pesquisa contexto e notícias dos últimos seis meses relacionadas a
   finanças, operação ou momento estratégico, aplica a regra de contato por
   porte e gera rascunho no modelo aprovado do Giulio.
5. n8n calcula score-base e bônus de economia real, valida os cortes e faz
   upsert em `companies`, `contacts`, `leads`, `lead_signals` e
   `message_drafts` no Supabase.
6. A linha de entrada é marcada como importada; a planilha de saída contém a
   versão auditável do lead, mas o CRM lê do Supabase.

## 4. Critérios executáveis

Todos os prompts, filtros e nós de decisão devem usar
`LEAD_EXTRACTION_RULES.md` e a versão ativa de `criteria_versions`:

- Base de score: porte `0–3` + urgência/momento `0–3` + decisor `0–2`.
- Corte sobre a base: Vagas `>=3`; Middle market `>=5`.
- Bônus de economia real: `+2` fora de Rio–SP, `+1` em Rio–SP, `0` nos demais
  casos; score comercial máximo `10`.
- Vagas de empresa grande: líder ou gerente da área/vaga; médias/pequenas:
  CEO, CFO ou liderança financeira. CEO/CFO/dono é fallback se não houver
  líder aderente.
- Middle market de empresa grande: líder/gerente da área; médias/pequenas:
  dono, CEO, CFO ou head. CEO/CFO/dono é fallback se não houver líder aderente.

## 5. Ações futuras, ainda desativadas

### Convite, mensagem e InMail

Ao mover para `Enviar convite` ou `Enviar mensagem`, a aplicação cria apenas
uma solicitação idempotente em `dispatches`. O n8n só deve executar o
PhantomBuster dentro da janela 09:00–20:00, com alerta ao chegar a 20 abordagens
no dia e revisão humana do Giulio. Respostas nunca recebem resposta automática.

### Agendamento

Ao mover para `Agendamento`, o n8n envia o link nativo de agendamento do Google
Calendar. O Calendar cria o evento de 30 minutos, Meet e confirmação. Horários
permitidos começam em `:00`, `:15`, `:30` ou `:45`, dentro de 09:00–20:00.
O retorno do Calendar atualiza `calendar_bookings` e move o lead para
`Call marcada`.

## Checklist para ativar cada workflow

- [x] Migration `20260722_004_score_to_ten.sql` aplicada no Supabase.
- [x] Credencial de serviço do Supabase conectada no n8n.
- [ ] Credenciais Sheets, Gemini e PhantomBuster testadas sem envio externo.
- [ ] Database Webhook do Supabase criado com segredo no Vault.
- [ ] Workflow de status testado com um ID de teste em cada aba.
- [ ] Workflow de importação testado com linha artificial aprovada e reprovada.
- [ ] Workflow de mensagem testado apenas com os sócios, após aprovação direta.

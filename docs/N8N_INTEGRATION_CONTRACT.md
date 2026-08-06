# AGF CRM — contrato atual de integrações n8n

**Versão:** 3.1
**Atualizado em:** 6 de agosto de 2026

## 1. Escopo ativo

O n8n executa somente:

1. sincronização do Google Calendar com o CRM;
2. entrega de lembretes de follow-up por Gmail;
3. leitura do e-mail de aceite de convite do LinkedIn.

Não participa do fluxo ativo:

- Apollo;
- upload CSV;
- Google Sheets;
- Gemini;
- PhantomBuster;
- envio de convite ou mensagem no LinkedIn.

O item 3 lê uma notificação que o LinkedIn manda; não automatiza nenhuma ação
dentro do LinkedIn. Convite, mensagem e resposta continuam manuais.

## 2. Princípios

- Supabase é a fonte de verdade;
- frontend nunca chama um webhook com credencial de servidor;
- credenciais ficam no cofre do n8n;
- workflows são idempotentes;
- falha externa não apaga dados;
- payload bruto só é guardado onde necessário para auditoria;
- logs não contêm token, cookie ou senha.

## 3. Workflow Calendar → Supabase

Objetivo: reconhecer reservas, remarcações e cancelamentos e refletir o estado
no card.

Entrada: Google Calendar Trigger da agenda conectada.

Saída: RPC de sincronização do Supabase.

Regras:

- `provider_event_id` é obrigatório e único;
- preservar `raw_payload`;
- converter a descrição HTML do Appointment Schedule em texto antes de ler
  respostas personalizadas;
- reconhecer `Nome da Empresa` tanto no formato `rótulo: valor` quanto no
  formato real do Google, com rótulo e resposta em linhas separadas;
- casar, nesta ordem, por e-mail exato, empresa normalizada com um único lead
  ativo e nome completo conservador;
- não escolher entre candidatos ambíguos;
- mover para `call_marcada` apenas com match único;
- considerar a reserva ativa criada mais recentemente;
- cancelar sem outra reserva ativa devolve o card a `agendamento`;
- não regredir projetos nem terminais.

Detalhes: [N8N_CALENDAR_CALLBACK_CONTRACT.md](./N8N_CALENDAR_CALLBACK_CONTRACT.md).

## 4. Workflow Follow-ups → Gmail

Objetivo: enviar uma notificação apenas ao responsável por um follow-up
vencido ou próximo, seja ele de lead ou de projeto.

O responsável é sempre o perfil atualmente atribuído ao card pai. O autor do
follow-up é mantido apenas para auditoria e nunca define o destinatário.

### Fonte

O workflow lê `follow_up_email_deliveries` pendentes. A fila já contém:

- `follow_up_id`;
- `entity_type`, `lead_id` ou `project_id`;
- usuário responsável;
- destinatário;
- assunto/contexto;
- chave de idempotência;
- estado.

### Regras

1. buscar lote pequeno de entregas pendentes;
2. reservar/atualizar a tentativa antes do envio;
3. enviar pelo Gmail AGF conectado;
4. marcar `sent` com horário;
5. em erro, marcar `failed` e guardar resumo seguro;
6. nunca enviar para o Giulio por cópia automática;
7. respeitar `profiles.follow_up_email_enabled`;
8. não enviar duas vezes a mesma entrega.
9. nunca substituir o `recipient_email` recebido da fila por um endereço fixo
   ou pelo e-mail do executor do workflow.

### Conteúdo mínimo

- empresa;
- contato do lead ou responsável do projeto;
- ação do follow-up;
- data e hora;
- link da aplicação quando disponível.

## 5. Workflow LinkedIn aceite → Supabase

Objetivo: mover o card de `convite_enviado` para `conexao_aceita` assim que o
aceite for notificado por e-mail, sem o operador reabrir o LinkedIn para
conferir.

Entrada: Gmail Trigger na conta `giulio@agfcapital.com.br`, filtrado por
`from:invitations@linkedin.com` com assunto de aceite.

Saída: RPC `sync_linkedin_connection_acceptance`.

Regras:

- só o remetente `invitations@linkedin.com` dispara; newsletter e resumo
  semanal do LinkedIn também citam nomes e são descartados;
- o nome completo vem do display do remetente (`Fulano via LinkedIn`), porque
  o assunto traz apenas o primeiro nome;
- o cargo com a empresa vem da linha logo abaixo da repetição do nome no
  corpo, e serve de desempate entre homônimos;
- `message_id` do Gmail é a chave de idempotência: reprocessar a mesma
  mensagem devolve `already_applied` e não move nada;
- só cards em `convite_enviado` avançam;
- casar, nesta ordem, por nome completo normalizado e por primeiro mais último
  nome com a empresa conferindo;
- não escolher entre candidatos ambíguos;
- toda execução grava uma linha em `connection_sync_runs`, com o motivo em
  `error_summary` quando não houve match.

O aceite registrado por e-mail grava a mesma atividade `connection_accepted`
do botão Confirmar aceite, para o histórico do card ler igual nos dois casos.
A diferença fica em `metadata.source = linkedin_email`.

## 6. Credenciais

No n8n:

- credencial de servidor do Supabase;
- Google Calendar OAuth da agenda monitorada;
- Gmail OAuth da conta remetente.

Na aplicação:

- URL pública do Supabase;
- publishable key.

Nunca documentar valores reais de secrets.

## 7. Erros e observabilidade

| Caso | Comportamento |
|---|---|
| Calendar sem match | `unmatched`, sem mover lead |
| Calendar ambíguo | `unmatched`, preservar payload |
| Evento repetido | atualizar a mesma reserva |
| Gmail falha | marcar entrega `failed`; follow-up continua aberto |
| Supabase indisponível | workflow falha com log; não inventar sucesso |
| Credencial expirada | interromper e notificar operador |
| Aceite sem match no LinkedIn | `unmatched`, card fica em Convite pendente |
| Aceite ambíguo no LinkedIn | `ambiguous`, nenhum card é escolhido |
| Mesmo e-mail de aceite reentregue | `already_applied`, nada muda |

## 8. Workflows inativos preservados

O JSON de Apollo pode permanecer arquivado como protótipo. Não deve ser
ativado enquanto a entrada oficial for CSV. Workflows antigos de Sheets,
extração, Gemini ou LinkedIn estão obsoletos.

## 9. Checklist de produção

- trocar Calendar de teste pela conta do Giulio;
- confirmar pergunta obrigatória `Empresa`;
- validar timezone `America/Sao_Paulo`;
- testar criar, remarcar e cancelar;
- testar follow-up com e-mail habilitado e desabilitado;
- repetir eventos para validar idempotência;
- revisar credenciais e limitar acesso ao projeto n8n;
- confirmar que o LinkedIn está com giulio@agfcapital.com.br como e-mail
  primário, senão o aceite nunca chega na caixa monitorada;
- reenviar um aceite antigo pelo webhook de teste e conferir que a segunda
  execução devolve `already_applied`.

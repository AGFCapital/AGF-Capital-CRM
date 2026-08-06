# AGF CRM — contrato atual de integrações n8n

**Versão:** 3.1
**Atualizado em:** 5 de agosto de 2026

## 1. Escopo ativo

O n8n executa somente:

1. sincronização do Google Calendar com o CRM;
2. entrega de lembretes de follow-up por Gmail.

Não participa do fluxo ativo:

- Apollo;
- upload CSV;
- Google Sheets;
- Gemini;
- PhantomBuster;
- convite ou mensagem no LinkedIn.

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

Entrada: Google Calendar Trigger de cada agenda habilitada. Um único usuário
técnico do Google pode monitorar agendas compartilhadas; sem compartilhamento,
cada sócio precisa autorizar sua própria credencial OAuth no n8n.

Saída: RPC de sincronização do Supabase.

Regras:

- `provider_event_id` é obrigatório e único;
- enviar `host_profile_id` ou `source_calendar_id` em todo evento;
- `source_calendar_id` precisa corresponder a `profiles.calendar_id`;
- a agenda do evento precisa coincidir com `leads.scheduling_profile_id`;
- divergência de agenda aborta a sincronização em vez de atualizar outro card;
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

## 5. Credenciais

No n8n:

- credencial de servidor do Supabase;
- Google Calendar OAuth da conta técnica ou credenciais individuais;
- Gmail OAuth da conta remetente.

Na aplicação:

- URL pública do Supabase;
- publishable key.

Nunca documentar valores reais de secrets.

## 6. Erros e observabilidade

| Caso | Comportamento |
|---|---|
| Calendar sem match | `unmatched`, sem mover lead |
| Calendar ambíguo | `unmatched`, preservar payload |
| Agenda sem perfil | falhar e registrar `source_calendar_id` no erro |
| Agenda diferente da enviada ao lead | abortar toda a transação |
| Evento repetido | atualizar a mesma reserva |
| Gmail falha | marcar entrega `failed`; follow-up continua aberto |
| Supabase indisponível | workflow falha com log; não inventar sucesso |
| Credencial expirada | interromper e notificar operador |

## 7. Workflows inativos preservados

O JSON de Apollo pode permanecer arquivado como protótipo. Não deve ser
ativado enquanto a entrada oficial for CSV. Workflows antigos de Sheets,
extração, Gemini ou LinkedIn estão obsoletos.

## 8. Checklist de produção

- cadastrar em cada perfil `booking_url` e `calendar_id`;
- compartilhar cada agenda com a conta técnica ou conectar OAuth individual;
- fazer cada trigger enviar `host_profile_id` ou `source_calendar_id`;
- confirmar pergunta obrigatória `Empresa`;
- validar timezone `America/Sao_Paulo`;
- testar criar, remarcar e cancelar;
- testar follow-up com e-mail habilitado e desabilitado;
- repetir eventos para validar idempotência;
- revisar credenciais e limitar acesso ao projeto n8n.

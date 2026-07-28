# Operacao manual do CRM AGF

## Limite de escopo

O CRM nao descobre, qualifica ou envia leads automaticamente. Ele recebe uma
lista ja filtrada, atualmente em CSV, e a guarda no Supabase sem criar todos
os cards de uma vez. A origem futura pode mudar sem alterar as regras da
operacao comercial.

## Banco de leads

Uma lista longa e importada uma unica vez para `lead_pool`. A importacao:

- aceita ate 5.000 linhas por lote;
- nao cria cards automaticamente;
- remove duplicidades internas do CSV;
- confere todo o historico do CRM e todos os lotes anteriores;
- usa empresa, contato, URL normalizada do LinkedIn e IDs do Apollo no dedupe;
- detecta CSV em UTF-8 ou Windows-1252, repara mojibake como `JoÃ£o` e
  padroniza acentos Unicode antes de comparar ou armazenar nomes;
- nao armazena e-mail, telefone ou tecnologias do export.

No painel **Banco de leads**, o operador escolhe entre 1 e 100 registros e
clica em **Liberar leads**. A quantidade fica salva como novo padrao. A RPC
reserva os registros com lock, cria empresa, contato e lead na mesma transacao
e envia o card para `revisao_manual`, exibido como **Base de clientes**.

Importar 1.000 linhas nao produz 1.000 cards nem milhares de requisicoes no
browser: o upload e uma unica chamada e cada liberacao tambem e uma unica
operacao atomica.

## Fluxo do lead

| Etapa exibida | Estado no banco | Acao do operador |
|---|---|---|
| Base de clientes | `revisao_manual` ou `qualificado` | Decide se o lead deve entrar na fila de convite. |
| Enviar convite | `aprovado` | Abre o LinkedIn, copia a nota, envia o convite e clica em **Enviei o convite**. |
| Convite pendente | `convite_enviado` | Aguarda; ao ver o aceite, clica em **Confirmar aceite**. |
| Conexao aceita | `conexao_aceita` | Edita/copia a mensagem longa, envia no LinkedIn e registra o envio. |
| Mensagem enviada | `mensagem_enviada` | Ao receber resposta, registra **Recebi uma resposta**. |
| Em conversa | `em_conversa` | Conduz a conversa e move para agendamento quando houver abertura. |
| Agendamento | `agendamento` | Copia e envia manualmente o link da agenda. |
| Call marcada | `call_marcada` | Vem do Calendar/n8n; mostra horario no card. |
| Criar projeto | transicao para `concluido` | Ao arrastar uma call com interesse para esta coluna, cria um projeto em `Pos-call` e abre a aba Projetos. |
| Descartado | `descartado` | Lead sem continuidade ou fora do foco. |

Os estados historicos `concluido` e `convite_expirado` permanecem preservados
no banco e aparecem no Historico, mas nao sao mais etapas operacionais do
Kanban. Um lead com interesse segue para **Projetos**; um lead sem interesse ou
fit segue para **Descartado**. A coluna **Criar projeto** e uma transicao: o
card nao permanece nela; ele e transformado em um projeto do pipeline.

O Kanban so aceita arrastar o card para a proxima etapa permitida. As acoes que
dependem de uma atividade humana no LinkedIn permanecem em botoes explicitos,
para gravar data e historico corretamente.

## Texto de convite e agendamento

O texto aprovado para copiar e:

```text
Perfeito, {Nome}. Para facilitar, deixei alguns horarios livres na minha
agenda aqui: {link}. Se nenhum fizer sentido, me avise que buscamos outro.
```

O `{link}` vem de `app_settings.calendar_booking.booking_url`. Se ele nao
estiver configurado, o CRM avisa antes da copia; nao inventa um link.

## Follow-ups

Um follow-up e um lembrete compartilhado, associado a um lead, com:

- data e hora (`due_at`);
- descricao da proxima acao;
- estado aberto, concluido ou cancelado;
- autor e horario de conclusao quando aplicavel.

Ele aparece tanto no detalhe do card quanto na pagina **Follow-ups**. Nenhuma
automacao externa e necessaria para essa primeira versao.

## Pipeline comercial

Projetos podem ser criados a partir de um lead com call marcada ou manualmente
por qualquer operador. Campos:

- nome;
- empresa;
- responsavel;
- etapa;
- descricao;
- proxima acao e data;
- valor estimado opcional;
- observacoes.

Etapas: `Pos-call`, `Proposta`, `Negociacao`, `Projeto`, `Ganho` e `Perdido`.
Os projetos nao dependem de uma origem de lead.

## Agenda e n8n

O n8n nao recebe credenciais do frontend. O workflow de agenda usa uma
credencial de servidor e atualiza `calendar_bookings` no Supabase. Ao encontrar
o lead correspondente, move-o para `call_marcada`; reservas sem correspondencia
permanecem `unmatched` para revisao.

O workflow nao foi automatizado por esta interface. Antes de ativar, testar uma
reserva interna com os socios da AGF e confirmar no CRM: empresa, contato,
horario e link do Meet.

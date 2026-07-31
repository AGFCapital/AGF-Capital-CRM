# Operação manual do CRM AGF

Atualizado em 29 de julho de 2026.

## 1. Entrar e localizar um lead

Todos os operadores acessam a mesma base. Use a busca no topo para localizar
empresa, contato, cargo ou LinkedIn. O sino mostra primeiro as tarefas do
usuário atual e permite alternar para a equipe.

Na **Base de clientes** e em **Projetos**, use o seletor compacto ao lado da
busca para mostrar `Todos` ou somente os cards de um responsável específico.
O filtro não altera os dados compartilhados.

Ao recarregar o navegador, o CRM retorna à seção em que você estava. Abrir um
card por **Follow-ups**, **Agendamentos** ou **Base completa** mostra o detalhe
sobre a própria tela, sem redirecionar para a Base de clientes.

## 2. Importar uma base

1. Abra **Banco de leads**.
2. Preencha **Nome da nova base**.
3. Selecione o CSV Apollo já filtrado.
4. Aguarde o relatório de válidos, inválidos e duplicados.

O upload não cria cards. A lista fica no banco de espera.

Regras:

- até 5.000 linhas por arquivo;
- empresa, contato e LinkedIn são obrigatórios;
- duplicatas internas são descartadas;
- duplicatas contra qualquer base ou histórico são bloqueadas;
- acentos e codificações comuns são normalizados;
- cada arquivo é uma base independente, mas a deduplicação é global.

## 3. Liberar leads

No mesmo painel:

1. escolha a base;
2. informe de 1 a 100;
3. clique em **Liberar leads**.

Somente registros daquela base viram cards na Base de clientes. Liberações
simultâneas usam lock no banco para não duplicar registros.

## 4. Operar o Kanban

| Etapa | Ação |
|---|---|
| Base de clientes | Revisar e mover para Enviar convite. |
| Enviar convite | Copiar nota, abrir LinkedIn e enviar manualmente. |
| Convite pendente | Aguardar e confirmar o aceite manualmente. |
| Conexão aceita | Revisar/copiar a mensagem longa e enviar. |
| Mensagem enviada | Marcar quando houver resposta. |
| Em conversa | Conduzir a conversa. |
| Agendamento | Copiar o texto com o link da agenda. |
| Call marcada | Conferir horário e Meet; copiar agradecimento. |
| Criar projeto | Transformar o lead em projeto `Pos-call`. |
| Descartado | Encerrar a prospecção. |

Arrastar para a próxima etapa confirma a ação. O card também pode voltar para
etapas anteriores. Um projeto criado deixa o Kanban de leads e aparece no
pipeline comercial.

## 5. Card expandido

Use o detalhe para:

- editar mensagem;
- visualizar LinkedIn;
- escolher responsável;
- adicionar etiqueta;
- criar ou concluir follow-up;
- consultar histórico da empresa;
- apagar o card com confirmação.

Score e blocos de enriquecimento antigo não orientam mais a operação.

## 6. Follow-ups

Todo follow-up é atribuído ao responsável atual do card. Quem criou a tarefa
continua registrado apenas no histórico.

- pode estar vinculado a um lead ou a um projeto;
- todos podem vê-lo;
- somente o responsável recebe o e-mail;
- trocar o responsável do card transfere os lembretes ainda não enviados;
- a preferência de e-mail fica em **Configurações**;
- tarefas vencidas aparecem no sino;
- a visão `Equipe` mostra tarefas compartilhadas;
- concluir a tarefa interrompe novos lembretes.

## 7. Agendamento

Na etapa **Agendamento**, copie o texto e envie pelo LinkedIn. O lead escolhe
um slot no Google Appointment Schedule. O Google cria evento, Meet e
confirmação.

O n8n atualiza o Supabase. Quando há casamento único, o card vai para
**Call marcada** e exibe `DD/MM/AAAA HH:mm`.

Se a call for remarcada, o novo horário substitui o anterior. Se for cancelada
e não existir outra reserva ativa, o card volta para **Agendamento**.

## 8. Projetos

Projetos podem vir de uma call ou ser criados manualmente.

Campos:

- nome e empresa;
- responsável;
- etapa;
- descrição;
- próxima ação e data;
- valor estimado;
- observações.

Etapas:

```text
Pos-call -> Proposta -> Negociação -> Projeto -> Ganho / Perdido
```

O valor pode ser editado no card expandido. O dashboard soma os valores por
etapa.

O responsável selecionado é a pessoa que recebe os follow-ups e conduz a
próxima ação do projeto.

No mesmo detalhe do projeto, use **Adicionar** em **Follow-ups** para criar um
lembrete com data, horário e próxima ação. O card compacto exibe o próximo
follow-up aberto. A tarefa também aparece na página **Follow-ups**, no sino e
na fila de e-mail do responsável.

## 9. Exclusões

Leads e projetos possuem botão de exclusão no detalhe. A aplicação sempre pede
confirmação. Excluir um projeto vinculado restaura o lead conforme a RPC
transacional definida no banco.

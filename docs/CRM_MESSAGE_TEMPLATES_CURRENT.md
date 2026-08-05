# Modelos de mensagem atuais do CRM

Versão do código em 2 de agosto de 2026.

Os quatro modelos são configurações compartilhadas, armazenadas em
`app_settings.message_templates`. Qualquer operador autenticado pode editá-los
em **Configurações > Modelos de mensagens**. O CRM bloqueia o salvamento caso
uma variável obrigatória seja removida.

## Nota do convite

```text
{Nome}, tudo bem? Tenho conversado com empresas como a {Empresa} sobre como aplicar IA no financeiro de forma prática. Achei que faria sentido nos conectarmos por aqui.
```

## Mensagem após o aceite

```text
{Nome}, tudo bem? Obrigado por aceitar o convite.

Tenho conversado com empresas como a {Empresa} sobre como aplicar inteligência artificial no financeiro de forma prática, sem transformar a iniciativa em um projeto longo, complexo e distante da operação.

Montei a AGF exatamente com esse propósito. Contamos com profissionais vindos das principais consultorias do Brasil, que atuam diretamente no dia a dia das empresas, do operacional ao estratégico, identificando oportunidades e desenvolvendo automações ao longo do processo.

Eu venho de mais de 10 anos entre banking e corporate development e também fundei uma empresa na qual captei recursos com investidores institucionais.

Topa uma conversa de 15 a 30 minutos para eu me apresentar e entender melhor o momento da {Empresa}?
```

## Mensagem de agendamento

```text
Perfeito, {Nome}. Para facilitar, deixei alguns horarios livres na minha agenda aqui: {link}. Se nenhum fizer sentido, me avise que buscamos outro.
```

## Agradecimento após a reserva

```text
Perfeito, {Nome}. Obrigado por agendar. Nossa conversa ficou marcada para {data_hora}. Até lá!
```

## Variáveis

| Variável | Origem |
|---|---|
| `{Nome}` | primeiro nome do contato |
| `{Empresa}` | empresa do lead |
| `{link}` | `app_settings.calendar_booking.booking_url` |
| `{data_hora}` | reserva ativa mais recente |

Leads legados e mensagens editadas individualmente podem conservar o rascunho
histórico. Novos leads e textos ainda não personalizados usam o modelo
compartilhado vigente.

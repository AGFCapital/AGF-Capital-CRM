# Interface do CRM AGF

Esta pasta contem a aplicacao web do CRM. Ela usa apenas Supabase no browser e
nao possui seed, fallback de leads ou credencial sensivel no frontend.

## Rodar localmente

```powershell
node .\prototype-agf-crm\server.mjs
```

Abra `http://localhost:4173`.

Crie `prototype-agf-crm/.env.local` a partir de `.env.example` com a URL e a
chave publicavel do Supabase. Nunca use `service_role` neste arquivo.

## O que a interface faz

- opera o Kanban de leads ja existentes;
- guia convite, aceite, mensagem e agendamento manuais no LinkedIn;
- registra follow-ups de leads e projetos comerciais;
- exibe chamadas devolvidas pelo Google Calendar/n8n;
- permite configurar o link publico da agenda.
- importa listas CSV ja filtradas para um banco de espera;
- libera gradualmente uma quantidade configuravel de leads para o Kanban.

## O que ela nao faz

- nao descobre nem filtra leads;
- nao chama Apollo, PhantomBuster, Gemini, LinkedIn ou planilhas;
- nao envia convite nem mensagem automaticamente;
- nao contem credencial do n8n.

As migrations de operacao manual e banco de leads em `../supabase/migrations/`
precisam estar aplicadas no banco remoto.

# Protótipo visual — CRM AGF

Pergunta que este protótipo responde: **qual visualização deixa mais claro para o Giulio o que fazer com os leads já qualificados?**

Há três alternativas na mesma rota, trocáveis pela barra flutuante inferior ou pelas setas do teclado:

- `?variant=A` — Kanban operacional
- `?variant=B` — Foco diário
- `?variant=C` — Mesa de inteligência

## Rodar

```powershell
node .\prototype-agf-crm\server.mjs
```

Depois abra `http://localhost:4173`.

Este é um protótipo visual com dados em memória. Não conecta Linear, LinkedIn, PhantomBuster, Claude ou Google Calendar e não envia mensagens.

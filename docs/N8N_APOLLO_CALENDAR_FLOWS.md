# Fluxos n8n — referência de Apollo e Calendar

Atualizado em 29 de julho de 2026.

> Documento de transição. Calendar está no fluxo ativo. Apollo via webhook
> está inativo porque a entrada atual é CSV.

## Apollo — inativo

Arquivo arquivado:

```text
n8n/workflows/agf-apollo-to-supabase.json
```

O protótipo recebe registros por webhook e chama `ingest_apollo_lead()`, mas
não consulta o Apollo sozinho. Não ativar junto do importador CSV.

Para reativar no futuro será necessário decidir:

- origem do evento;
- paginação;
- limite e custo da API;
- contrato final de colunas;
- reconciliação com bases nomeadas;
- política de erro parcial.

Enquanto isso, o caminho oficial é:

```text
Apollo -> exportação CSV -> base nomeada -> liberação gradual
```

## Calendar — ativo em teste

Arquivo:

```text
n8n/workflows/agf-calendar-to-supabase.json
```

Responsabilidades:

- monitorar criar, alterar e cancelar;
- normalizar os dados;
- chamar a RPC do Supabase;
- preservar payload;
- não decidir match ambíguo.

Contrato detalhado:
[N8N_CALENDAR_CALLBACK_CONTRACT.md](./N8N_CALENDAR_CALLBACK_CONTRACT.md).

## Produção

Antes da troca:

1. conectar a agenda do Giulio;
2. conferir a pergunta `Empresa`;
3. testar com lead interno;
4. repetir o mesmo evento;
5. remarcar;
6. cancelar;
7. conferir o card e o banco.

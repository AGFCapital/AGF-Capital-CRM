# Status da plataforma AGF

Atualizado em 23 de julho de 2026.

## Marco atual

**Etapa 0 implementada no repositório.**

Nenhuma atividade da Etapa 1 foi iniciada.

## Arquitetura vigente

```text
PhantomBuster → n8n → Supabase → aplicação AGF
                    ↘ Gemini

Calendly/Cal.com → webhook n8n → Supabase
```

O Supabase é a fonte de verdade. Google Sheets não participa mais do fluxo
operacional. A planilha legada será lida uma única vez na Etapa 1.

## Entregue na Etapa 0

- pipeline v2 com 12 estados;
- remoção da infraestrutura ativa de sincronização com Sheets;
- `import_origin` desacoplado da planilha;
- sinais verificados normalizados em `lead_signals`;
- remoção de `signal_summary`, `recent_news` e `strength`;
- configurações `outreach.enabled` e `outreach.dry_run`;
- dry-run ativo por padrão;
- idempotência de dispatch por conteúdo nos status ativos;
- suporte a reservas unmatched com `raw_payload`;
- templates de convite com corpo imutável após aprovação e RLS administrativa;
- tabelas `connection_sync_runs` e `outreach_metrics`;
- frontend sem seeds ou fallback de leads em `localStorage`;
- Kanban atualizado para os estágios v2.

## Estado das integrações

| Integração | Estado |
|---|---|
| Supabase | schema da Etapa 0 preparado |
| PhantomBuster | credencial conectada; automação pertence às etapas posteriores |
| n8n | ambiente conectado; Workflow A ainda não implementado |
| Gemini | credencial conectada; enriquecimento ainda não implementado |
| Calendly/Cal.com | modelo de dados preparado; provedor/plano ainda pendente |
| LinkedIn | nenhum convite ou mensagem real habilitado |

## Travas vigentes

- InMail está fora do produto.
- A primeira mensagem é manual.
- `dry_run = true` permanece o padrão.
- O teto de 100 convites usa `dispatches` na janela rolante de sete dias.
- `outreach_metrics` nunca é usado para autorizar envio.
- Um fato sem `source_url` e `verified_at` não aparece como evidência verificada.
- Importação com estágio ausente ou inválido falha explicitamente.

## Próxima etapa — não iniciada

Etapa 1: importação única dos leads legados.

Antes de executá-la, o importador deverá:

- mapear apenas valores exatos de estágio;
- falhar em valores ausentes ou desconhecidos;
- registrar `import_origin`;
- verificar todos os leads da empresa e do contato para deduplicação;
- aplicar uma regra explícita de reabertura.

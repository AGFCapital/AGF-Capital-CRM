# Status da plataforma AGF

Atualizado em 23 de julho de 2026.

## Marco atual

**Etapa 0 aplicada. Etapa 1 concluída. Etapa 2 redesenhada e aguardando
aprovação antes da implementação.**

O importador isolado gravou 60 leads em uma transação. Todos estão em
`revisao_manual`, nenhum `lead_signals` foi criado e o importador foi
arquivado.

A descoberta Middle market não usará Brave nem outra API paga de busca. O
plano atual começa em rankings setoriais e regionais publicados, mede porte,
complexidade operacional, geografia e densidade da função financeira no
LinkedIn. Notícia passa a ser contexto opcional.

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
- configurações `outreach.enabled = false` e `outreach.dry_run = true`;
- dry-run ativo por padrão;
- idempotência por conteúdo para mensagem/booking e por lead para convite;
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

## Etapa 2 — plano revisado

- descoberta por documentos de ranking e associações, não por notícia;
- faturamento publicado é evidência obrigatória;
- score estrutural proposto de 0 a 10;
- densidade do time financeiro medida por buscas determinísticas no LinkedIn;
- ausência só pontua quando a cobertura da busca estiver completa;
- ação `Re-qualificar` reaproveita os 60 cards existentes;
- notícia não qualifica nem desqualifica;
- Gemini recebe apenas fatos previamente verificados e não propõe URLs;
- nenhum workflow, parser ou migration dessa etapa foi implementado.

O plano completo está em `docs/ETAPA_2_SOURCE_VERIFICATION_PLAN.md`.

## Travas vigentes

- InMail está fora do produto.
- A primeira mensagem é manual.
- `dry_run = true` permanece o padrão.
- O teto de 100 convites usa `dispatches` na janela rolante de sete dias.
- `outreach_metrics` nunca é usado para autorizar envio.
- Um fato sem `source_url` e `verified_at` não aparece como evidência verificada.
- Importação com estágio ausente ou inválido falha explicitamente.

## Etapa 1 — concluída

Resultado verificado diretamente no Supabase:

- empresas: 60;
- contatos: 60;
- leads: 60;
- em `revisao_manual`: 60;
- duplicatas por empresa normalizada: 0;
- duplicatas por LinkedIn normalizado: 0;
- sobreposição de empresa entre `vacancy` e `middle_market`: 0;
- `lead_signals` criados: 0.

O relatório e a evidência da carga estão em
`outputs/legacy-leads-import/`. O importador arquivado recusa nova execução.

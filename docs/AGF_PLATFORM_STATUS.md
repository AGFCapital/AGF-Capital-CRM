# AGF CRM — estado atual da plataforma

**Atualizado em:** 22 de julho de 2026
**Objetivo:** concluir o CRM web e as automações que descobrem, qualificam, enriquecem e conduzem leads para implementação de IA em finanças corporativas.

O briefing comercial e técnico completo está em [AGF_PROJECT_BRIEF.md](./AGF_PROJECT_BRIEF.md). Este documento é um retrato objetivo do que existe, do que está conectado e do que ainda não foi ativado.

## Arquitetura vigente

```text
PhantomBuster → Google Sheets (entrada) → n8n (qualificação/enriquecimento)
→ Supabase (fonte de verdade) → aplicação AGF (Kanban)
→ Supabase → n8n → Google Sheets (somente Status CRM)
```

- **Supabase:** fonte de verdade para autenticação, empresas, contatos, leads, estágios, configurações, filas e histórico.
- **Google Sheets:** entrada e espelho auditável da coluna `Status CRM`; não é um segundo CRM.
- **n8n:** único lugar para credenciais privilegiadas e automações externas.
- **Aplicação AGF:** interface compartilhada de operação, revisão e avanço dos cards.
- **PhantomBuster:** coleta no LinkedIn; não existe Phantom de outbound ativo em produção.

As bases ativas são `Vagas — leads quentes` e `Middle market — prospecção proativa`. M&A e startups permanecem fora do fluxo ativo.

## Estado por componente

| Componente | Estado atual | Próximo passo necessário |
|---|---|---|
| Regras comerciais | Definidas | manter versão ativa no banco e refletir mudanças no n8n |
| Saved searches LinkedIn | Documentadas | configurar Phantoms concretos e seus IDs/inputs |
| Aplicação web | Parcialmente funcional | conectar comandos, importação, agenda e auditoria real; publicar depois |
| Login Supabase | Funcional | revisão final de RLS e ambiente de produção |
| Banco Supabase | Estrutura e migrations aplicadas | importar os leads existentes e validar dados reais |
| n8n | Credenciais de teste conectadas | construir e testar workflows AGF sem outreach externo |
| PhantomBuster | Conta/credencial de teste preparada | testar extração por API e validar limites/IDs dos Phantoms |
| Google Sheets | Abas existentes | concluir ingestão e espelho seguro de status |
| Google Calendar | Regras definidas | validar appointment schedule de teste e trocar para Giulio antes de produção |
| Gemini | Credencial conectada no n8n | montar prompt, fontes, validação e saída JSON |

## Aplicação web implementada

O código está em `prototype-agf-crm/`. A interface atual possui:

- login por e-mail e senha do Supabase;
- Kanban compartilhado com os nove estágios;
- card expandido com empresa, contato, perfil, contexto, notícias, score, mensagem e histórico;
- páginas de agenda e histórico;
- painel de configurações de extração e operação;
- leitura/escrita de leads e configurações no Supabase quando o ambiente está configurado;
- rota de servidor protegida para solicitar `Extração extra` ao n8n.

O fallback local com leads de demonstração permanece apenas para desenvolvimento. Não deve ser usado como validação de integração ou produção.

## Banco, critérios e pipeline

As migrations disponíveis já criam o modelo de dados, adicionam `Aprovado`, geram a fila de espelho do Sheets e aplicam a escala comercial de 0 a 10.

```text
score-base = porte (0–3) + urgência ou momento (0–3) + decisor (0–2)
score-comercial = score-base + economia real (0–2), limitado a 10
```

Os cortes continuam sobre a base: `Vagas >= 3` e `Middle market >= 5`.

Pipeline atual:

`Prontos para enviar → Aprovado → Enviar convite → Convite enviado → Enviar mensagem → Em conversa → Agendamento → Call marcada → Concluído`

Hoje, a alteração do card persiste em `leads.current_stage` e gera histórico. A fila de espelho existe no banco, mas o workflow n8n ainda precisa ser concluído e testado.

## Regras comerciais que a automação deve respeitar

- Perfil: Brasil, 100+ conexões, `Conectar` disponível e perfil utilizável.
- Economia real: `+2` fora de Rio–SP, `+1` no eixo, `0` para tech pura/sem evidência.
- Vagas grande: líder/gerente/head da área da vaga; CEO/CFO/dono como fallback permitido.
- Vagas média/pequena: CEO/CFO/liderança financeira; recrutador é último recurso.
- Middle grande: líder/gerente/head da área ligada ao sinal; CEO/CFO/dono como fallback permitido.
- Middle média/pequena: dono/CEO/CFO/head financeiro.
- Um contato ativo por empresa; sinal extremamente forte pode reabrir histórico com justificativa explícita.
- Notícias e contexto: somente fatos dos últimos seis meses ligados a finanças, operação ou momento estratégico.

## Automação externa

Nenhum convite, mensagem, InMail ou agendamento automático está ativo em produção.

Quando forem habilitados:

- Giulio revisa antes de qualquer envio;
- execução fica entre 09:00 e 20:00;
- 20 abordagens/dia é alerta, não bloqueio rígido;
- respostas LinkedIn são conduzidas manualmente;
- `Agendamento` envia o link do Google Calendar;
- o booking cria Meet, preenche horário no card e move para `Call marcada`;
- o primeiro piloto usa apenas sócios autorizados.

## Próxima sequência de trabalho

1. concluir o espelho `Supabase → Sheets` e testar Vagas/Middle;
2. importar os leads existentes, preservando origem, aba e linha;
3. configurar/testar Phantoms de extração sem outbound;
4. implementar ingestão, filtros, deduplicação, score, Gemini e upsert;
5. conectar extração agendada/manual às configurações do CRM;
6. validar agenda nativa de teste e retorno de booking;
7. testar ponta a ponta com os sócios antes de qualquer outreach externo.

O contrato de dados e os payloads de workflows estão em [N8N_INTEGRATION_CONTRACT.md](./N8N_INTEGRATION_CONTRACT.md).

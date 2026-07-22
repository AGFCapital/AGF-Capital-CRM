# AGF — filtros e saved searches do LinkedIn

**Atualizado em:** 21 de julho de 2026  
**Escopo:** prospecção de implementação de IA em finanças corporativas. As buscas abaixo alimentam apenas as bases `Vagas — leads quentes` e `Middle market — prospecção proativa`.

## 1. Regras que valem para qualquer busca

1. **Localização inicial:** Brasil. Empresas fora de Rio–São Paulo são priorizadas pelo bônus de entrada, mas não são obrigatórias.
2. **Um contato por empresa:** em `Vagas` de empresa grande, priorizar o líder direto da área da vaga; em `Vagas` de empresa média ou menor, CEO/CFO. Em `Middle market`, priorizar dono/CEO, CFO ou head da área financeira relevante. Não usar C-level como atalho para empresa grande com vaga aberta.
3. **Sem duplicidade ativa:** procurar empresa e pessoa nas bases antes de criar nova linha. Lead já abordado só volta mediante sinal extremamente forte novo, com histórico visível.
4. **Checagem de perfil antes de listar:** Brasil + 100 ou mais conexões + ação `Conectar` disponível. Sem evidência clara, marcar `Revisar manualmente` e não incluir automaticamente.
5. **Notícias e gatilhos:** apenas fatos dos últimos seis meses, ligados a finanças ou ao momento financeiro/operacional da empresa.
6. **Economia real:** é prioridade comercial. Aplicar bônus de entrada após o score-base: `+2` fora do eixo Rio–SP, `+1` no eixo e `0` para tech pura/serviços financeiros/sem evidência suficiente.

> Não usar filtro que descarte `Júnior`. Excluir apenas `Estágio` e `Trainee`.

## 2. Base Vagas — leads quentes

### 2.1 Configuração padrão de Jobs

| Campo do LinkedIn | Configuração |
|---|---|
| Localização | `Brasil` |
| Data de publicação | Padrão recorrente: última semana. Para recuperação pontual: últimos 30 dias. |
| Tipo de vaga | Todos; não restringir por remoto/híbrido/presencial. |
| Experiência | Não usar filtro que exclua `Júnior`. |
| Exclusões no texto | `NOT (estágio OR trainee OR intern OR internship)` |
| Empresa | Sem filtro inicial; validar porte e setor após encontrar o sinal. |
| Rotina | Rodar diariamente na puxada matinal. Não reprocessar vagas antigas já registradas. |

Vaga fechada depois da extração **não invalida** o lead: ela registra uma demanda recente. O MVP não precisa voltar aos leads antigos em cada puxada.

### 2.2 Saved searches de Vagas

Salvar as buscas abaixo no LinkedIn Jobs. Se a interface não aceitar toda a expressão Boolean, rodar as variações da mesma linha separadamente e manter o mesmo nome operacional.

| Nome da saved search | Termos de busca | O que captura | Observações |
|---|---|---|---|
| `VAG-01 — FP&A e Planejamento` | `("FP&A" OR "planejamento financeiro" OR "financial planning" OR "planejamento e análise financeira") NOT (estágio OR trainee)` | Especialista, analista, coordenador ou gerente de FP&A/planejamento. | Busca principal. Júnior entra. |
| `VAG-02 — Controladoria e Controles` | `(controller OR controladoria OR "contabilidade gerencial" OR "controle financeiro" OR "financial controller") NOT (estágio OR trainee)` | Controller, coordenação de controladoria, controles, fechamento e gestão. | Priorizar escopo corporativo, não rotinas puramente fiscais. |
| `VAG-03 — Tesouraria, Crédito e Caixa` | `(tesouraria OR treasury OR crédito OR "cash management" OR "gestão de caixa") NOT (estágio OR trainee)` | Tesouraria, crédito, caixa, capital de giro e risco financeiro. | Vagas de coordenação/gestão recebem maior urgência. |
| `VAG-04 — Finanças Corporativas, RI e Avaliação` | `("finanças corporativas" OR "corporate finance" OR "avaliação econômico-financeira" OR "relações com investidores" OR RI) NOT (estágio OR trainee)` | Corporate finance, valuation, RI, análise econômica e projetos estratégicos. | Confirmar que é posição interna da empresa, não consultoria/recrutamento. |
| `VAG-05 — Gestão Financeira e Finance Business Partner` | `("gerente financeiro" OR "finance manager" OR "coordenador financeiro" OR "business finance" OR "commercial finance" OR RGM) NOT (estágio OR trainee)` | Gestão financeira, commercial finance, RGM e finance business partnering. | Bom para empresas de consumo, indústria, varejo e distribuição. |

### 2.3 Qualificação depois de achar a vaga

1. Abrir a vaga e registrar empresa, cargo, data/publicação e URL.
2. Classificar o porte: se for grande (`Porte 3`), buscar primeiro o gerente/head/coordenador líder/diretor da área indicada na vaga. Se for média ou menor (`Porte 1–2`), buscar primeiro CFO ou CEO.
3. Fazer a validação de perfil obrigatória.
4. Verificar porte e um contexto/notícia recente de até seis meses.
5. Aplicar: Porte (0–3), Urgência (0–3), Decisor (0–2). A entrada exige total-base `≥3`.
6. Aplicar bônus de economia real e calcular score comercial.

### 2.4 Saved search de Pessoas — contato de Vagas

Após escolher a empresa, usar a busca de pessoas com **Empresa atual = empresa selecionada**. A ordem depende do porte:

**Empresa grande (`Porte 3`)**

1. Combinar o domínio da vaga com: `gerente OR manager OR head OR líder OR coordenador OR diretor`. Exemplos: `FP&A gerente`, `tesouraria head`, `RGM manager`, `controladoria coordenador`.
2. Escolher somente o líder que seja diretamente responsável pela área da vaga e passe a validação de perfil.
3. Se não houver perfil aderente validado, marcar `Revisar manualmente`; não substituir por CEO/CFO.

**Empresa média ou menor (`Porte 1–2`)**

1. `CFO OR "Chief Financial Officer" OR "Diretor Financeiro" OR "VP Financeiro"`
2. `CEO OR "Chief Executive Officer" OR Presidente`
3. `"Head de Finanças" OR "Diretor de Planejamento" OR "Head de FP&A" OR Controller`
4. Apenas como último fallback: `recrutador OR recruiter OR "talent acquisition"` ou o gestor indicado na vaga.

O contato escolhido precisa passar pela validação de perfil antes de ser registrado.

## 3. Base Middle market — prospecção proativa

### 3.1 Configuração padrão de Empresas

| Campo do LinkedIn | Configuração |
|---|---|
| Localização | Brasil. Priorizar sede/operação fora de Rio–São Paulo; não excluir o eixo. |
| Tamanho de empresa — faixa principal | `201–500` e `501–1.000` funcionários. |
| Faixa de exceção | `51–200` apenas quando houver boa evidência de receita entre R$ 50 mi e R$ 500 mi ou operação física complexa. |
| Setor | Priorizar economia real. Tech não é excluída, mas não recebe bônus de entrada. |
| Vaga aberta | Não é requisito. |
| Corte técnico | Total-base `≥5` antes do bônus comercial. |

O porte no LinkedIn é proxy. Validar também receita publicada, porte operacional, presença regional, empresas controladas, escala de capex ou outra evidência pública quando disponível.

### 3.2 Saved searches de Empresas — economia real

Salvar uma busca por vertical para facilitar o recorte e evitar lista genérica de empresas.

| Nome da saved search | Filtros de setor / palavras-chave | Prioridade de região | O que validar em seguida |
|---|---|---|---|
| `MM-01 — Logística e Distribuição` | `logística`, `transportes`, `armazenagem`, `distribuição`, `supply chain`, `terminal` | Centro-Oeste, Sul, Nordeste e interior de SP/MG/PR/RS | Capex, expansão de capacidade, nova filial, dívida e eficiência de caixa. |
| `MM-02 — Indústria e Bens de Consumo` | `indústria`, `manufatura`, `alimentos`, `bebidas`, `ingredientes`, `cosméticos`, `química`, `móveis` | Nacional, com prioridade fora do eixo | Receita, novas linhas/unidades, margens, aquisição e profissionalização financeira. |
| `MM-03 — Agro e Insumos` | `agronegócio`, `insumos agrícolas`, `fertilizantes`, `sementes`, `proteção de cultivos`, `cooperativa` | Centro-Oeste, Sul e interior de SP/MG | Safra, resultado, investimento, crédito, estoque, expansão regional e RI. |
| `MM-04 — Varejo, Atacado e Franquias` | `varejo`, `atacado`, `franquias`, `supermercados`, `distribuidora`, `consumer goods` | Capitais regionais e cidades-polo fora do eixo | Abertura de lojas/unidades, crescimento de rede, margem, expansão de canais e eficiência. |
| `MM-05 — Saúde e Serviços Operacionais` | `saúde`, `hospitais`, `clínicas`, `laboratórios`, `odontologia`, `distribuição hospitalar` | Nacional, com prioridade fora do eixo | Expansão de unidades, integração, mudança de CFO, caixa, custo e escala operacional. |
| `MM-06 — Infraestrutura, Energia e Construção` | `infraestrutura`, `energia`, `construção`, `engenharia`, `saneamento`, `concessão` | Nacional, com prioridade fora do eixo | Capex, concessões, obras, dívida/debênture, resultado, turnaround e M&A. |
| `MM-07 — Imobiliário e Serviços Imobiliários` | `incorporadora`, `imobiliário`, `corretagem`, `real estate`, `loteamento` | Nacional, com prioridade fora do eixo | Lançamentos, VGV, novas lojas, captação, dívida e vendas. |

### 3.3 Saved searches de sinais financeiros e operacionais

Rodar em conteúdo, posts, notícias da empresa e busca web direcionada. Salvar as consultas por família de sinal; juntar o nome da empresa quando estiver na etapa de confirmação.

| Nome da saved search | Termos de sinal |
|---|---|
| `SIG-01 — Resultados e eficiência` | `resultados`, `receita`, `EBITDA`, `lucro`, `margem`, `eficiência`, `recuperação`, `turnaround` |
| `SIG-02 — Expansão e capacidade` | `expansão`, `nova unidade`, `novo centro de distribuição`, `capex`, `investimento`, `ampliação`, `nova fábrica` |
| `SIG-03 — Capital e dívida` | `debêntures`, `dívida`, `financiamento`, `FIDC`, `captação`, `crédito`, `capital de giro` |
| `SIG-04 — M&A e integração` | `aquisição`, `M&A`, `integração`, `joint venture`, `compra`, `consolidação` |
| `SIG-05 — Liderança financeira` | `CFO`, `diretor financeiro`, `VP financeiro`, `RI`, `relações com investidores`, `novo CEO` |

Usar somente fatos de até seis meses. A fonte precisa ser registrada na planilha: RI, site da empresa, release, imprensa setorial, jornal regional ou LinkedIn oficial da empresa/executivo quando não houver fonte melhor.

### 3.4 Saved search de Pessoas — contato de Middle market

Depois de confirmar empresa e sinal, aplicar **Empresa atual = empresa selecionada** e buscar nesta ordem:

1. `CEO OR dono OR fundador OR sócio OR Presidente OR "Diretor Presidente"`
2. `CFO OR "Chief Financial Officer" OR "Diretor Financeiro" OR "VP Financeiro"`
3. `"Head de Finanças" OR "Head de FP&A" OR "Head de Planejamento" OR "Head de Controladoria" OR Controller`
4. `"Diretor de RI" OR "Relações com Investidores" OR "Diretor de Planejamento"`

Gestor/recrutador não é o fallback padrão em Middle market; gerente, diretor ou RI sem decisão direta só entram se não for possível identificar dono/CEO, CFO ou head de área e houver sinal muito forte.

## 4. Checklist final antes de criar a linha

- [ ] Empresa não está duplicada na base ativa.
- [ ] Existe um sinal de vaga ou de momento financeiro/operacional verificável.
- [ ] Sinal/notícia tem no máximo seis meses.
- [ ] Contato segue a regra de porte: líder da área em Vagas grandes; CEO/CFO em Vagas médias/menores; dono, CFO ou head de área em Middle market.
- [ ] Perfil mostra Brasil, 100+ conexões e `Conectar` disponível.
- [ ] Score-base alcança o corte da base.
- [ ] Bônus de economia real foi classificado e justificado.
- [ ] Fonte e URL foram registradas.
- [ ] Rascunho segue o modelo fixo do Giulio.

## 5. Volumes e rotina inicial

- Puxada matinal configurável: **5 leads por Vagas** e **15 por Middle market**.
- O volume é teto operacional, não meta cega. Não incluir empresas fracas para completar quantidade.
- Deve existir controle para pausar/ativar a puxada automática, alterar horário e solicitar puxada extra.
- O aviso aparece ao atingir 20 abordagens úteis em um dia, sem bloqueio rígido de envio.

## 6. Fora de escopo por enquanto

Não usar essas buscas para startups ou M&A pré-captação neste momento. Essa frente exigirá fontes, critérios e validação próprios antes de voltar à operação.

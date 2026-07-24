# AGF — filtros e saved searches do LinkedIn

**Atualizado em:** 23 de julho de 2026
**Escopo:** prospecção de implementação de IA em finanças corporativas. As buscas abaixo alimentam apenas as bases `Vagas — leads quentes` e `Middle market — prospecção proativa`.

## 1. Regras que valem para qualquer busca

1. **Localização inicial:** Brasil. Empresas fora de Rio–São Paulo são priorizadas pelo bônus de entrada, mas não são obrigatórias.
2. **Um contato por empresa:** em `Vagas` de empresa grande, priorizar o líder direto da área da vaga; em `Vagas` de empresa média ou menor, CEO/CFO. Em `Middle market`, priorizar dono/CEO, CFO ou head da área financeira relevante. Não usar C-level como atalho para empresa grande com vaga aberta.
3. **Sem duplicidade ativa:** procurar empresa e pessoa nas bases antes de criar nova linha. Lead já abordado só volta mediante sinal extremamente forte novo, com histórico visível.
4. **Checagem de perfil antes de listar:** Brasil + 100 ou mais conexões + ação `Conectar` disponível. Sem evidência clara, marcar `Revisar manualmente` e não incluir automaticamente.
5. **Evidência estrutural em Middle market:** faturamento publicado,
complexidade operacional, sede e contagem da função financeira precisam ser
rastreáveis. Notícia é contexto opcional, nunca requisito de qualificação.
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
4. Verificar porte. Contexto/notícia recente é opcional para Vagas e não
substitui a evidência da própria vaga.
5. Aplicar: Porte (0–3), Urgência (0–3), Decisor (0–2). A entrada exige total-base `≥3`.
6. Aplicar bônus de economia real e calcular score comercial.

### 2.4 Saved search de Pessoas — contato de Vagas

Após escolher a empresa, usar a busca de pessoas com **Empresa atual = empresa selecionada**. A ordem depende do porte:

**Empresa grande (`Porte 3`)**

1. Combinar o domínio da vaga com: `gerente OR manager OR head OR líder OR coordenador OR diretor`. Exemplos: `FP&A gerente`, `tesouraria head`, `RGM manager`, `controladoria coordenador`.
2. Escolher somente o líder que seja diretamente responsável pela área da vaga e passe a validação de perfil.
3. Se não houver perfil aderente validado, buscar CEO, CFO ou dono como fallback e registrar a justificativa no lead.

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
| Corte técnico | Score estrutural proposto `≥7`, sujeito à calibração com os 60 leads legados. |

O LinkedIn não é a fonte de descoberta dessas empresas. A lista nasce em
rankings setoriais e regionais aprovados. O LinkedIn é usado depois para
confirmar a empresa, contar funcionários, medir a função financeira e localizar
o contato.

### 3.2 Verticais originadas nos rankings

Os nomes abaixo deixam de ser saved searches de descoberta no LinkedIn e
passam a ser classificações operacionais das empresas importadas dos rankings.

| Nome operacional | Classificação / palavras-chave | Prioridade de região | O que validar em seguida |
|---|---|---|---|
| `MM-01 — Logística e Distribuição` | `logística`, `transportes`, `armazenagem`, `distribuição`, `supply chain`, `terminal` | Centro-Oeste, Sul, Nordeste e interior | receita, filiais, armazéns, CDs, frota e presença territorial |
| `MM-02 — Indústria e Bens de Consumo` | `indústria`, `manufatura`, `alimentos`, `bebidas`, `ingredientes`, `cosméticos`, `química`, `móveis` | Nacional, com prioridade fora do eixo | receita, fábricas, unidades e presença regional |
| `MM-03 — Agro e Insumos` | `agronegócio`, `insumos agrícolas`, `fertilizantes`, `sementes`, `proteção de cultivos`, `cooperativa` | Centro-Oeste, Sul e interior | receita, unidades, CDs, cooperados e abrangência |
| `MM-04 — Varejo e Atacado` | `varejo`, `atacado`, `supermercados`, `distribuidora`, `consumer goods` | Capitais regionais e cidades-polo fora do eixo | receita, lojas, CDs, funcionários e estados atendidos |
| `MM-05 — Saúde` | `saúde`, `hospitais`, `clínicas`, `laboratórios`, `distribuição hospitalar` | Nacional, com prioridade fora do eixo | receita, hospitais, unidades e leitos |
| `MM-06 — Infraestrutura e Construção` | `infraestrutura`, `construção`, `engenharia`, `saneamento`, `concessão` | Nacional, com prioridade fora do eixo | receita, obras, área construída e unidades |
| `MM-07 — Imobiliário` | `incorporadora`, `imobiliário`, `real estate`, `loteamento` | Nacional, com prioridade fora do eixo | receita, lançamentos, unidades e presença regional |

### 3.3 Saved searches de Pessoas — densidade financeira

Depois de vincular a página correta da companhia, rodar quatro buscas com
**Empresa atual = empresa selecionada**:

| Nome | Termos |
|---|---|
| `FIN-ALL — Função financeira` | `finance OR financeiro OR finanças OR controladoria OR controllership OR contabilidade OR accounting OR tesouraria OR treasury OR FP&A OR "financial planning" OR "corporate finance"` |
| `FIN-CFO — Liderança financeira` | `CFO OR "chief financial officer" OR "diretor financeiro" OR "VP financeiro" OR "head de finanças"` |
| `FIN-FPA — Planejamento financeiro` | `FP&A OR "planejamento financeiro" OR "financial planning"` |
| `FIN-RI — Relações com investidores` | `"relações com investidores" OR "investor relations" OR RI` |

Registrar a URL da busca, total exibido, perfis extraídos, execução do Phantom,
data/hora da coleta e eventual limite. Deduplicar pela URL do perfil e manter
apenas vínculo atual. Se qualquer busca falhar ou atingir limite, a densidade
fica desconhecida; ausência não pode ser presumida.

### 3.4 Saved search de Pessoas — contato de Middle market

Depois de confirmar a empresa estruturalmente, aplicar **Empresa atual =
empresa selecionada**. A ordem depende do porte:

**Empresa grande (`Porte 3`)**

1. Buscar `gerente OR manager OR head OR líder OR coordenador OR diretor`
com termos de finanças, controladoria, FP&A ou tesouraria.
2. Escolher o líder da função financeira mais aderente e que passe na
validação de perfil.
3. Se não houver líder aderente validado, buscar `CEO OR dono OR fundador OR sócio OR Presidente` e depois `CFO OR "Chief Financial Officer" OR "Diretor Financeiro" OR "VP Financeiro"` como fallback, com justificativa registrada.

**Empresa média ou menor (`Porte 1–2`)**

1. `CEO OR dono OR fundador OR sócio OR Presidente OR "Diretor Presidente"`
2. `CFO OR "Chief Financial Officer" OR "Diretor Financeiro" OR "VP Financeiro"`
3. `"Head de Finanças" OR "Head de FP&A" OR "Head de Planejamento" OR "Head de Controladoria" OR Controller`
4. `"Diretor de RI" OR "Relações com Investidores" OR "Diretor de Planejamento"`

Gestor/recrutador não é o fallback padrão em Middle market; gerente, diretor
ou RI sem decisão direta só entram se não for possível identificar dono/CEO,
CFO ou head de área e o score estrutural for muito alto.

## 4. Checklist final antes de criar a linha

- [ ] Empresa não está duplicada na base ativa.
- [ ] Em Vagas, a vaga está registrada; em Middle market, o faturamento
publicado está verificado em ranking ou fonte aceita.
- [ ] Complexidade operacional, geografia e coleta do LinkedIn têm fonte e
data.
- [ ] A cobertura da busca financeira está completa ou o lead foi enviado
explicitamente para revisão manual.
- [ ] Contato segue a regra de porte: líder da área em Vagas grandes; CEO/CFO em Vagas médias/menores; dono, CFO ou head de área em Middle market.
- [ ] Perfil mostra Brasil, 100+ conexões e `Conectar` disponível.
- [ ] Score de Vagas ou score estrutural de Middle market alcança o corte da
base.
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

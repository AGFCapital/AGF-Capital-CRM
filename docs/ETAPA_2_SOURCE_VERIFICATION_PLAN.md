# Etapa 2 — descoberta estrutural por rankings

**Estado:** plano revisado; nenhuma migration, workflow ou alteração de banco
foi implementada.

## 1. Tese de prospecção

O ICP prioritário da AGF é uma empresa de economia real que:

- movimenta receita relevante;
- possui operação física complexa;
- está no interior ou fora do eixo Rio–São Paulo;
- tem função financeira pequena em relação ao porte da operação;
- pode ser pouco coberta por imprensa e consultorias.

Notícia recente não é requisito nem proxy de oportunidade. A descoberta começa
em rankings setoriais e regionais publicados. Notícias, quando existirem,
servem apenas como contexto adicional.

```text
documentos de ranking e associações
→ download e extração determinística
→ normalização e deduplicação
→ enriquecimento estrutural
→ medição do time financeiro no LinkedIn
→ score estrutural
→ contato e gate de perfil
→ card qualificado
→ notícia opcional
→ redação Gemini somente com fatos verificados
```

## 2. Fontes concretas propostas

Nenhuma fonte entra automaticamente. Cada fonte e edição é cadastrada por um
operador, com URL oficial, vertical, data, periodicidade e regra de extração.

### 2.1 Fontes nacionais e regionais transversais

| Cobertura | Fonte | Formato e campos úteis | Uso |
|---|---|---|---|
| Brasil | [EXAME Melhores e Maiores — 1.000 empresas](https://exame.com/revista-exame/quase-o-dobro-do-pib/) | HTML e edição PDF; empresa, setor, receita, cidade e UF | base transversal e confirmação de faturamento |
| Sul | [AMANHÃ + PwC — 500 Maiores do Sul](https://amanha.com.br/categoria/500-maiores-do-sul/500-maiores-do-sul-2025-as-portas-do-trilhao) e [metodologia](https://amanha.com.br/categoria/gestao/como-e-feito-o-ranking-500-maiores-do-sul-1) | página e revista PDF; receita e indicadores de balanço | descoberta regional PR/SC/RS |
| Minas Gerais | [Ranking MercadoComum de Empresas de MG](https://mercadocomum.com/temp/upload/revista/350/MC_Ed350_Out2025.pdf) | revista PDF; receita operacional líquida, setor e classificação | descoberta regional e interior de MG |
| Espírito Santo | [Anuário IEL 200 Maiores e Melhores](https://ielespiritosanto.com.br/category/anuario-iel-200-maiores-e-melhores/) | PDF; receita operacional líquida, setor e classificação | descoberta regional ES |

Essas fontes cobrem empresas que não aparecem em rankings verticais e permitem
validar faturamento declarado sem buscar notícia.

### 2.2 Fontes por vertical

| Vertical | Fonte primária | Complemento estrutural | Situação |
|---|---|---|---|
| Supermercados e varejo alimentar | [Ranking ABRAS anual](https://hotsite.abras.com.br/eventos/ranking-abras/2026) e [PDF da SuperHiper](https://static.abras.com.br/pdf/ranking/ranking-abras-2026.pdf?v=2) | faturamento, posição, UF e número de lojas quando publicado | habilitar primeiro |
| Atacado distribuidor | [Ranking ABAD/NielsenIQ](https://abad.com.br/ranking-abad/) e [tabelas da Revista Distribuição](https://distribuicao.abad.com.br/article-categories/ranking-abad/?jet_blog_ajax=1&nocache=1778672351) | faturamento, UF, armazém, funcionários, frota e abrangência | habilitar primeiro |
| Agro e cooperativas | [Forbes Agro100](https://forbes.com.br/forbes-agro/2025/12/agro100-2025-conheca-as-empresas-que-faturaram-r-19-tri-do-campo-a-mesa/) | [Globo Rural 500 Maiores do Agronegócio](https://sitenet05.serasa.com.br/Rankings/Agro/inicio.aspx) | habilitar após validar acesso da edição |
| Transporte e logística | [Maiores do Transporte & Melhores do Transporte, OTM Editora](https://transportemoderno.com.br/2025/11/26/premiacao-maiores-do-transporte-melhores-do-transporte-destaca-lideres-que-movem-a-economia-nacional/) | balanços, receita e segmento logístico | habilitar após validar tabela completa |
| Construção e engenharia | [O Empreiteiro — 500 Grandes da Construção](https://www.odebrecht.com/pt-br/noticias/odebrecht-lidera-ranking-da-engenharia-brasileira-2025) | [Ranking INTEC por área construída](https://100maioresconstrutoras.com.br/ranking-intec-2025/) | habilitar após validar edição completa |
| Indústria e bens de consumo | EXAME Melhores e Maiores por setor | rankings regionais AMANHÃ, MercadoComum e IEL | habilitar primeiro |
| Farmacêutico | [Anuário Estatístico do Mercado Farmacêutico, CMED/Anvisa](https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/medicamentos/cmed/anuario-estatistico-do-mercado-farmaceutico-2024.pdf/%40%40download/file) | faixas de faturamento por grupo | habilitar quando a faixa bastar para o gate |
| Hospitais privados | [lista de associados](https://www.anahp.com.br/associados/page/23/) e [Observatório Anahp](https://www.anahp.com.br/wp-content/uploads/2026/05/Observatorio2026.pdf) | arquivos periódicos do CNES para unidades e leitos | descoberta permitida; receita continua obrigatória em outra fonte |

### 2.3 Verticais sem fonte suficiente

Hotelaria, franquias gerais, serviços operacionais e energia não serão
habilitados apenas com listas comerciais ou diretórios genéricos. Entram
somente depois que houver fonte pública, reproduzível e com porte ou
complexidade mensurável.

## 3. Ingestão periódica dos documentos

O processo não é uma busca na web. É uma biblioteca controlada de edições:

```text
ranking_sources
id, publisher, name, vertical, canonical_url, format, cadence, active

ranking_editions
id, source_id, edition, published_at, reference_year, downloaded_at,
content_hash, storage_path, parser_version, status

ranking_entries
id, edition_id, rank, company_name_raw, normalized_name, cnpj, state,
declared_revenue, revenue_unit, stores, units, branches, distribution_centers,
employees, evidence_page, evidence_text, review_status
```

Regras:

1. download por `GET` real da URL cadastrada;
2. registrar status, URL final, tipo, tamanho, data e SHA-256;
3. guardar o arquivo original em storage privado;
4. extrair tabela HTML ou PDF com parser versionado;
5. OCR somente quando necessário, sempre com revisão humana antes de liberar;
6. números, unidades e separadores são validados por código;
7. Gemini não extrai tabela, não corrige número e não identifica fonte;
8. nova edição não apaga a anterior.

Como rankings são anuais, sua validade estrutural é de até 18 meses ou até a
publicação da edição seguinte, o que ocorrer primeiro. O ano-base da receita
fica explícito.

## 4. Verificação determinística

Mudou o fato verificado, não o rigor.

Cada observação estrutural guarda:

- URL final da fonte;
- publicador e edição;
- `published_at`, ano-base e `verified_at`;
- hash do documento;
- página, linha ou trecho exato;
- valor extraído e unidade;
- parser e método de verificação.

### Faturamento

Qualificação automática exige faturamento ou receita declarada em ranking,
RI, demonstração financeira ou publicação setorial verificável. Estimativa,
capital social, faixa inferida ou texto do Gemini não satisfazem o gate.

### Complexidade operacional

Pode vir do próprio ranking ou de página oficial verificável da empresa:

- lojas;
- fábricas;
- filiais;
- centros de distribuição;
- hospitais, leitos ou unidades;
- área construída;
- armazéns, frota ou abrangência territorial.

Toda contagem registra fonte, data de referência e data da coleta.

## 5. Score estrutural da empresa

`financial_moment_score` deixa de existir no desenho da Etapa 2. Em seu lugar:

| Dimensão | Pontos | Regra inicial |
|---|---:|---|
| Faturamento declarado | 0–3 | `< R$ 200 mi = 0`; `R$ 200–500 mi = 1`; `R$ 500 mi–1 bi = 2`; `≥ R$ 1 bi = 3` |
| Complexidade operacional | 0–2 | `0` sem evidência; `1` operação física relevante; `2` rede multiunidade, multifilial ou multiestadual |
| Geografia | 0–2 | `0` capital/metrópole RJ-SP; `1` interior de RJ/SP; `2` sede fora de RJ/SP |
| Finanças enxutas | 0–3 | calculado somente com cobertura válida do LinkedIn |

```text
structural_opportunity_score =
  revenue_score
  + operational_complexity_score
  + geography_score
  + finance_thinness_score
```

Recomendação de corte inicial:

- receita verificada obrigatória;
- economia real obrigatória;
- `structural_opportunity_score >= 7`;
- contato válido e gate de perfil continuam obrigatórios, mas não alteram o
  score da empresa.

O corte será calibrado com os 60 leads legados antes de automatizar novas
entradas.

## 6. Contagem do time financeiro no LinkedIn

Ausência só conta como evidência positiva quando a busca teve cobertura
completa. Falha, limite ou bloqueio significa `desconhecido`, nunca zero.

### 6.1 Denominador

Usar o total de pessoas associadas à página correta da empresa no LinkedIn,
registrando:

- URL e URN da empresa;
- total exibido;
- data e hora da coleta;
- Phantom e execução;
- indicador de valor exato, aproximado ou censurado.

Esse total é preferível ao número informado no ranking porque numerador e
denominador vêm do mesmo universo de perfis do LinkedIn.

### 6.2 Numerador

Rodar buscas de pessoas com `Empresa atual = empresa selecionada`:

1. `FIN-ALL`: `finance OR financeiro OR finanças OR controladoria OR
   controllership OR contabilidade OR accounting OR tesouraria OR treasury OR
   FP&A OR "financial planning" OR "corporate finance"`;
2. `FIN-CFO`: `CFO OR "chief financial officer" OR "diretor financeiro" OR
   "VP financeiro" OR "head de finanças"`;
3. `FIN-FPA`: `FP&A OR "planejamento financeiro" OR "financial planning"`;
4. `FIN-RI`: `"relações com investidores" OR "investor relations" OR RI`.

O PhantomBuster exporta os resultados. O n8n:

- exige vínculo atual com a empresa;
- normaliza e deduplica pela URL do perfil;
- classifica o título com vocabulário versionado, não com Gemini;
- exclui consultores externos, recrutadores, empregos anteriores e homônimos;
- registra query, URL da busca, total exibido, perfis extraídos,
  `captured_at`, execução e eventual limite.

### 6.3 Gate de cobertura

`finance_thinness_score` só é calculado se:

- as quatro buscas concluíram sem challenge ou erro;
- o filtro de empresa atual foi confirmado;
- o total de funcionários está disponível;
- nenhuma busca atingiu limite de paginação;
- os perfis foram deduplicados.

Caso contrário, o valor fica `null` e o lead vai para revisão.

### 6.4 Métrica e score inicial

```text
finance_density =
  unique_current_finance_profiles / linkedin_company_people_count
```

| Finanças enxutas | Regra inicial |
|---:|---|
| 3 | densidade `<= 0,50%` e ausência confirmada de ao menos dois entre CFO, FP&A e RI |
| 2 | densidade `<= 1,00%` e ao menos duas lacunas estratégicas |
| 1 | densidade `<= 1,50%` ou uma lacuna estratégica |
| 0 | densidade maior, ou presença clara de estrutura financeira completa |

Para empresa privada, ausência de RI ajuda a caracterizar estrutura enxuta,
mas nunca basta sozinha. Ausência de CFO ou FP&A só pontua depois do gate de
cobertura.

O snapshot proposto:

```text
linkedin_finance_snapshots
id, company_id, company_urn, people_count, finance_profile_count,
finance_density, has_cfo, has_fpa, has_ir, coverage_status,
captured_at, phantom_run_ids, query_version
```

## 7. Requalificação dos 60 leads legados

A ação **Re-qualificar** continua no card de `revisao_manual`, agora com o novo
pipeline:

1. procurar a empresa nas edições importadas;
2. confirmar faturamento e operação;
3. coletar o snapshot financeiro no LinkedIn;
4. calcular o score estrutural;
5. atualizar o mesmo lead, sem criar novo card;
6. mover para `qualificado` se passar;
7. manter em `revisao_manual` com motivos objetivos se não passar.

O índice `leads_one_active_company_idx` não é contornado.

## 8. Notícias opcionais

Notícia:

- não é requisito;
- não compõe o score estrutural;
- não resgata empresa sem faturamento verificado;
- entra no card apenas após `GET` e validação determinística;
- aparece como “contexto adicional”, separado da evidência estrutural.

Sem notícia, a mensagem usa ranking, porte, presença regional e complexidade
operacional como gancho.

## 9. Gemini e grounding

### Estado verificado em 23 de julho de 2026

Na conta aberta no AI Studio (`contatocaiomota@gmail.com`):

- a página de projetos não mostra projetos importados;
- a página de rate limit mostra `No Cloud Projects Available`;
- nenhuma quota específica do projeto usado no n8n pode ser lida;
- billing não foi ativado nem alterado.

A documentação atual suporta Grounding with Google Search, mas disponibilidade
e quota dependem do modelo e do tier. Para vários modelos Gemini 3, a tabela
atual marca grounding como indisponível no Free Tier e disponível no Paid Tier
com franquia mensal. Portanto, o plano **não depende de grounding**.

Para verificar o projeto real depois, o responsável deve abrir o AI Studio com
a conta dona da chave do n8n ou importar esse Cloud Project. A checagem será
somente leitura em `Projetos` e `Limite de taxa`. Ativar billing exige nova
autorização explícita.

Mesmo se grounding estiver disponível:

- Gemini não descobre empresas;
- Gemini não decide se uma fonte é válida;
- o schema de saída do modelo não contém URL;
- citações estruturadas do Google, se um dia forem testadas, seriam apenas
  candidatos externos e ainda passariam pelo `GET` e pelos validadores;
- a redação recebe somente fatos já persistidos e verificados.

## 10. Ordem de implementação proposta

1. aprovar fontes e limiares deste plano;
2. cadastrar manualmente as primeiras edições ABRAS, ABAD, EXAME, AMANHÃ,
   MercadoComum e IEL;
3. testar os parsers e conferir amostra de 20 linhas por fonte;
4. cruzar os 60 leads legados com os rankings;
5. testar a medição financeira em dez empresas, incluindo Nova Era;
6. calibrar o corte `>= 7`;
7. só então escrever migrations e workflows da Etapa 2.

Nenhuma dessas etapas foi implementada ainda.

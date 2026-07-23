# Regras operacionais — extração de leads AGF

Estas regras são obrigatórias antes de um lead ser listado em `Vagas — Leads quentes` ou `Middle market — Prospecção proativa`.

## 1. Validação do perfil no LinkedIn

O perfil só pode entrar na lista quando cumprir todos os requisitos abaixo:

- Localização declarada no Brasil.
- Pelo menos 100 conexões. A indicação `mais de 500 conexões` é válida como aprovação.
- A ação `Conectar` está disponível no LinkedIn.

Se a contagem de conexões, a localização ou a possibilidade de conexão não estiverem visíveis, o status é `Revisar manualmente`; o perfil não entra automaticamente na puxada. Perfis com descrição vazia, sinal de conta incompleta ou informações conflitantes também devem ser revisados antes de serem usados.

## 2. Bônus comercial — economia real

O score técnico continua independente e não muda:

- `Vagas`: Porte (0–3) + Urgência (0–3) + Decisor (0–2) = total base de 0–8.
- `Middle market`: Porte (0–3) + Momento financeiro (0–3) + Decisor (0–2) = total base de 0–8.

Após a qualificação técnica, aplicar o bônus de entrada comercial:

| Bônus | Regra |
|---:|---|
| 2 | Empresa de economia real com operação relevante fora do eixo Rio–São Paulo. |
| 1 | Empresa de economia real no eixo Rio–São Paulo. |
| 0 | Tech pura, serviços financeiros/plataforma digital ou evidência insuficiente de economia real. |

`Score comercial = total base + bônus de entrada`, com máximo de 10. Esse score ordena a abordagem, mas não substitui os cortes de entrada: `Vagas ≥3` e `Middle market ≥5` no total base.

São exemplos de economia real: indústria, agronegócio, logística, varejo/atacado, saúde, construção, energia, franquias e infraestrutura. A classificação deve refletir a operação predominante da empresa, e não apenas a tecnologia que ela usa.

## 3. Contato prioritário por porte e base

O campo `Decisor` continua valendo de 0 a 2; a definição de quem recebe 2 pontos muda conforme a base e o porte da empresa:

| Base / porte | Contato prioritário | Regra de exceção |
|---|---|---|
| `Vagas` — porte grande (`3`) | Gerente, head, coordenador líder ou diretor que responda diretamente pela área indicada na vaga (FP&A, tesouraria, RGM, controladoria, crédito etc.). | Se nenhum líder aderente passar na validação de perfil, usar CEO, CFO ou dono como fallback e registrar a justificativa. |
| `Vagas` — porte médio ou menor (`1–2`) | CEO, CFO, VP/Diretor Financeiro ou equivalente. | Se não identificável, usar líder financeiro diretamente relacionado à vaga; recrutador é último recurso. |
| `Middle market` — porte grande (`3`) | Gerente, head, coordenador líder ou diretor diretamente responsável pela área financeira ligada ao sinal. | Se nenhum líder aderente passar na validação de perfil, usar CEO, CFO ou dono como fallback e registrar a justificativa. |
| `Middle market` — porte médio ou menor (`1–2`) | Dono/CEO, CFO, VP/Diretor Financeiro ou head diretamente responsável pela área financeira relevante. | Diretor, gerente ou RI apenas quando não for possível identificar uma dessas lideranças e houver sinal muito forte. |

Para `Vagas` de empresa grande, um líder direto da área da vaga recebe `2` no componente `Decisor`; CEO/CFO/dono usado como fallback também recebe `2`, com justificativa explícita. Em `Middle market` grande, o líder direto da área financeira recebe `2` e CEO/CFO/dono só recebe `2` quando usado como fallback documentado. Em Middle market médio ou menor, dono/CEO, CFO ou head da área financeira diretamente relevante recebem `2`. O perfil escolhido ainda precisa cumprir a validação obrigatória desta documentação.

# AGF CRM — roadmap atual

Atualizado em 29 de julho de 2026.

## Baseline concluída

- CRM web autenticado;
- Supabase remoto e migrations aplicadas;
- Kanban compartilhado;
- bases CSV nomeadas;
- liberação gradual;
- LinkedIn manual;
- agenda sincronizada;
- follow-ups individuais de leads e projetos, com e-mail;
- projetos e dashboard;
- testes locais de regressão.

## Marco 1 — endurecimento do ambiente de teste

- testar importação de uma segunda base com nome diferente;
- liberar leads alternadamente das duas bases;
- confirmar dedupe entre bases;
- testar dois operadores simultâneos;
- testar exclusão e retorno de card;
- testar e-mail de follow-up uma única vez.

**Pronto quando:** todos os cenários deixam resultado observável no CRM e no
Supabase sem duplicidade.

## Marco 2 — produção de agenda

- conectar Calendar do Giulio no n8n;
- criar Appointment Schedule definitivo;
- manter `Empresa` obrigatória;
- atualizar o link no CRM;
- testar criação, remarcação, nova reserva e cancelamento;
- validar timezone e Meet.

**Pronto quando:** um lead interno percorre o fluxo e o card sempre mostra a
reserva ativa correta.

## Marco 3 — publicação

- definir hospedagem no domínio AGF;
- configurar variáveis de produção;
- revisar RLS;
- restringir acesso aos workflows;
- criar procedimento de backup e restauração;
- publicar;
- executar smoke test autenticado.

**Pronto quando:** usuários autorizados acessam o domínio, sem segredos no
cliente e sem dependência do servidor local.

## Marco 4 — operação assistida

- importar primeira base real;
- definir volume diário de liberação;
- acompanhar convites, respostas, calls e projetos;
- revisar conversão por origem, setor e região;
- medir uso do Supabase;
- registrar problemas de usabilidade.

**Pronto quando:** a equipe opera uma semana usando somente o CRM para
organização comercial.

## Marco 5 — decisão sobre extração

Somente após operação estável:

- comparar Apollo, processo manual e outras fontes;
- definir contrato definitivo de entrada;
- decidir API, CSV ou integração;
- manter o CRM independente da origem;
- nunca reintroduzir automação de LinkedIn sem nova decisão explícita.

## Fora do roadmap atual

- PhantomBuster;
- scraping no CRM;
- Gemini;
- Google Sheets;
- convite/mensagem automáticos;
- detecção automática de resposta;
- M&A e startups.

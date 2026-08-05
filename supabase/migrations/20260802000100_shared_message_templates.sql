-- Modelos operacionais editáveis pelo painel de Configurações.
-- A linha é criada por migration porque o cliente autenticado pode atualizar,
-- mas não inserir, app_settings após o endurecimento de RLS da Etapa 0.
insert into public.app_settings (setting_key, description, value)
values (
  'message_templates',
  'Modelos compartilhados usados pelo CRM para convite, mensagem, agenda e agradecimento.',
  jsonb_build_object(
    'invite_note', '{Nome}, tudo bem? Tenho conversado com empresas como a {Empresa} sobre como aplicar IA no financeiro de forma prática. Achei que faria sentido nos conectarmos por aqui.',
    'linkedin_message', E'{Nome}, tudo bem? Obrigado por aceitar o convite.\n\nTenho conversado com empresas como a {Empresa} sobre como aplicar inteligência artificial no financeiro de forma prática, sem transformar a iniciativa em um projeto longo, complexo e distante da operação.\n\nMontei a AGF exatamente com esse propósito. Contamos com profissionais vindos das principais consultorias do Brasil, que atuam diretamente no dia a dia das empresas, do operacional ao estratégico, identificando oportunidades e desenvolvendo automações ao longo do processo.\n\nEu venho de mais de 10 anos entre banking e corporate development e também fundei uma empresa na qual captei recursos com investidores institucionais.\n\nTopa uma conversa de 15 a 30 minutos para eu me apresentar e entender melhor o momento da {Empresa}?',
    'scheduling', 'Perfeito, {Nome}. Para facilitar, deixei alguns horários livres na minha agenda aqui: {link}. Se nenhum fizer sentido, me avise que buscamos outro.',
    'booking_thanks', 'Perfeito, {Nome}. Obrigado por agendar. Nossa conversa ficou marcada para {data_hora}. Até lá!'
  )
)
on conflict (setting_key) do nothing;

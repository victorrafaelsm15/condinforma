export const problems = [
  {
    title: 'Tarefas importantes podem ser esquecidas',
    text: 'Sem uma rotina clara por ambiente, etapas importantes da limpeza e zeladoria podem ficar para trás.',
  },
  {
    title: 'Você não sabe exatamente o que foi feito',
    text: 'Checklists em papel se perdem, ficam incompletos e não geram um histórico confiável da execução.',
  },
  {
    title: 'A fiscalização depende de estar presente',
    text: 'O síndico, gestor ou administrador precisa conferir manualmente se o ambiente foi limpo ou mantido em conformidade.',
  },
  {
    title: 'Reclamações viram discussão, não evidência',
    text: 'Sem registros digitais, fotos, horários e histórico, fica difícil comprovar a execução e responder com transparência.',
  },
];

export const steps = [
  {
    title: 'Cadastre os ambientes',
    text: 'Cadastre halls, banheiros, elevadores, academias e áreas comuns que precisam de rotina de limpeza ou zeladoria.',
  },
  {
    title: 'Crie checklists personalizados',
    text: 'Defina as tarefas que devem ser executadas em cada ambiente, com padrão claro para a equipe.',
  },
  {
    title: 'Fixe o QR Code no ambiente',
    text: 'Cada ambiente recebe seu próprio QR Code. O colaborador escaneia no local e acessa o checklist pelo celular — sem precisar de login.',
  },
  {
    title: 'Acompanhe tudo pelo painel',
    text: 'Veja execuções concluídas, pendências, fotos, ocorrências e relatórios em um painel organizado.',
  },
];

export const features = [
  { title: 'Checklists por ambiente', text: 'Cada ambiente tem um checklist claro, reduzindo esquecimentos e falhas.' },
  { title: 'Evidências da execução', text: 'Fotos, data, hora e responsável registrados em cada execução.' },
  { title: 'Transparência para moradores', text: 'O morador consulta o status da limpeza direto pelo QR Code do ambiente, sem precisar de login.' },
  { title: 'Ocorrências centralizadas', text: 'Problemas encontrados ficam registrados com foto e histórico organizado.' },
  { title: 'Relatórios para decisão', text: 'Indicadores da operação em relatórios simples e claros.' },
  { title: 'Sem equipamento extra', text: 'Basta imprimir os QR Codes e usar pelo celular ou computador — nada para instalar.' },
];

export const useCases = [
  { title: 'Limpeza de áreas comuns', text: 'Banheiros, halls, elevadores e corredores com checklists por ambiente.' },
  { title: 'Vistorias de ambientes compartilhados', text: 'Academias, salões de festa, brinquedotecas e áreas de lazer com registro digital.' },
  { title: 'Rondas de zeladoria', text: 'Conferência de iluminação, portas, equipamentos e condições gerais.' },
  { title: 'Registro de ocorrências', text: 'Problemas identificados durante a rotina, com descrição, fotos e histórico.' },
];

export const plans = [
  {
    name: 'Start',
    tagline: 'Para começar com 1 condomínio',
    price: 97,
    highlight: false,
    features: ['1 condomínio', 'QR Codes por ambiente', 'Checklists digitais', 'Registro fotográfico', 'Ocorrências e relatórios', 'Página pública via QR Code'],
  },
  {
    name: 'Pro',
    tagline: 'Para síndicos e administradoras profissionais',
    price: 297,
    highlight: true,
    features: ['Até 5 condomínios', 'Tudo do Start', 'Gestão multi-condomínios', 'Relatórios por condomínio', 'Melhor custo-benefício'],
  },
  {
    name: 'Business',
    tagline: 'Para operações maiores',
    price: 597,
    highlight: false,
    features: ['Até 10 condomínios', 'Tudo do Pro', 'Mais condomínios na mesma conta', 'Operação mais escalável'],
  },
];

export const faqItems = [
  { q: 'Preciso instalar algum equipamento?', a: 'Não. Basta imprimir os QR Codes dos ambientes e usar o COND-INFORMA pelo celular ou computador.' },
  { q: 'O colaborador precisa ter conhecimento técnico?', a: 'Não. Basta escanear o QR Code e marcar as tarefas concluídas — a interface é simples e direta.' },
  { q: 'O morador precisa criar conta para consultar o status?', a: 'Não. A página de status é pública e acessível diretamente pelo QR Code do ambiente.' },
  { q: 'Serve apenas para condomínios?', a: 'É ideal para condomínios, administradoras e equipes de limpeza ou zeladoria em geral.' },
  { q: 'Posso usar em mais de um condomínio?', a: 'Sim, os planos Pro e Business permitem gerenciar múltiplos condomínios na mesma conta.' },
  { q: 'Posso mudar de plano depois?', a: 'Sim, você pode fazer upgrade ou downgrade a qualquer momento.' },
];

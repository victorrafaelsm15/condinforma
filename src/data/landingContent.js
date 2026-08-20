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
    text: 'Cada ambiente recebe seu próprio QR Code. O colaborador escaneia no local e acessa o checklist pelo celular, sem precisar de login.',
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
  { title: 'Sem equipamento extra', text: 'Basta imprimir os QR Codes e usar pelo celular ou computador, sem nada para instalar.' },
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
    price: 49,
    highlight: false,
    features: [
      '1 condomínio',
      'QR Codes por ambiente',
      'Checklists digitais',
      'Registro fotográfico',
      'Ocorrências e relatórios',
      'Página pública via QR Code',
      '2 sub-usuários com permissões configuráveis',
      'Suporte 24 horas',
    ],
  },
  {
    name: 'Pro',
    tagline: 'Para síndicos e administradoras profissionais',
    price: 149,
    highlight: true,
    features: [
      'Até 5 condomínios',
      'Tudo do Start',
      'Gestão multi-condomínios',
      'Relatórios por condomínio',
      'Melhor custo-benefício',
      '10 sub-usuários com permissões configuráveis',
      'Suporte 24 horas',
    ],
  },
  {
    name: 'Business',
    tagline: 'Para operações maiores',
    price: 299,
    highlight: false,
    features: [
      'Até 10 condomínios',
      'Tudo do Pro',
      'Mais condomínios na mesma conta',
      'Operação mais escalável',
      '30 sub-usuários com permissões configuráveis',
      'Suporte 24 horas',
    ],
  },
];

// Dados jurídicos da empresa, usados nos Termos de Uso — num lugar só,
// que atualiza em todo o texto dos Termos de uma vez (ver
// src/pages/TermosPage.jsx).
export const legalInfo = {
  razaoSocial: 'Victor Rafael',
  cnpj: '68.304.031/0001-70',
  endereco: 'Rua Luís Pires de Lima, Teresina/PI, CEP 64047-020',
  cidadeUf: 'Teresina/PI',
  emailContato: 'condinforma@gmail.com',
  dataPublicacao: '16/08/2026',
};

// Conteúdo completo dos Termos de Uso e Condições Gerais de Contratação,
// em seções numeradas (algumas com lista) pra renderizar com hierarquia
// clara em TermosPage.jsx. Números com sufixo (ex: '5.1') são subseções
// da seção anterior, renderizadas com o mesmo componente.
export const termosSections = [
  {
    number: '1',
    title: 'Aceitação dos Termos',
    paragraphs: [
      `Estes Termos de Uso e Condições Gerais de Contratação ("Termos") regem o acesso e uso da plataforma Cond Informa ("Plataforma", "Serviço"), de titularidade de ${legalInfo.razaoSocial}, inscrito no CNPJ sob o nº ${legalInfo.cnpj}, com sede na ${legalInfo.endereco} ("Cond Informa", "nós").`,
      'Ao criar uma conta, contratar um plano ou de qualquer forma utilizar a Plataforma, o usuário ("Cliente", "Usuário", "você") declara ter lido, compreendido e aceitado integralmente estes Termos, bem como a Política de Privacidade, que é parte integrante deste documento.',
      'Caso não concorde com qualquer disposição destes Termos, o Cliente não deverá utilizar a Plataforma.',
    ],
  },
  {
    number: '2',
    title: 'Definições',
    list: [
      'Plataforma: o sistema Cond Informa, incluindo site, painel administrativo, páginas públicas de execução de checklist e status, acessíveis via navegador ou aplicativo (PWA instalável).',
      'Conta: cadastro único vinculado a um e-mail e senha, pertencente ao Cliente que contrata um plano.',
      'Sub-usuário: acesso adicional criado pelo Cliente dentro de sua Conta, com permissões limitadas a condomínios específicos, conforme os limites do plano contratado.',
      'Condomínio: unidade cadastrada pelo Cliente na Plataforma, à qual se vinculam Ambientes, Checklists, Execuções e Ocorrências.',
      'Período de Execução: janela de tempo dentro da qual os itens de um checklist são acompanhados; ao ser encerrado, um novo período é iniciado e o anterior passa a integrar o histórico, preservando o estado de cada item no momento do fechamento.',
      'Colaborador: pessoa que executa checklists através de QR Code, sem necessidade de login.',
      'Morador: pessoa que consulta o status público de um Ambiente através de QR Code, sem necessidade de login, podendo também registrar ocorrências.',
      'Cupom: código promocional que, quando aplicado e validado, concede desconto sobre o valor do plano contratado, respeitadas as condições de validade, limite de uso e restrição de plano definidas pelo Cond Informa.',
    ],
  },
  {
    number: '3',
    title: 'Objeto',
    paragraphs: [
      'O Cond Informa oferece uma plataforma para criação e gerenciamento de checklists digitais vinculados a QR Codes, permitindo o controle de rotinas de limpeza, manutenção e zeladoria em condomínios, com registro fotográfico, histórico de execuções, gestão de ocorrências e emissão de relatórios e comunicados.',
      'A Plataforma é disponibilizada mediante contratação de plano de assinatura mensal, nas modalidades descritas no site, podendo o Cond Informa alterar, incluir ou descontinuar funcionalidades a qualquer tempo, mediante aviso prévio razoável, quando a alteração impactar substancialmente o uso já contratado.',
    ],
  },
  {
    number: '4',
    title: 'Cadastro e conta',
    paragraphs: [
      'Para utilizar a Plataforma, o Cliente deve realizar cadastro fornecendo informações verdadeiras, completas e atualizadas. O Cliente é integralmente responsável pela veracidade dos dados informados e pela guarda de sua senha de acesso.',
      'É vedado o compartilhamento de credenciais de acesso da Conta principal com terceiros não autorizados. Para conceder acesso a outras pessoas, o Cliente deve utilizar a funcionalidade de Sub-usuários, respeitados os limites de seu plano.',
      'O Cliente é responsável por toda e qualquer atividade realizada em sua Conta e nas contas de Sub-usuários por ele criadas, inclusive por eventuais danos decorrentes de uso indevido.',
    ],
  },
  {
    number: '5',
    title: 'Planos, preços e forma de pagamento',
    paragraphs: ['A Plataforma é oferecida nas seguintes modalidades de plano:'],
    list: [
      'Start — R$ 49,00/mês: até 1 (um) condomínio e 2 (dois) sub-usuários;',
      'Pro — R$ 149,00/mês: até 5 (cinco) condomínios e 10 (dez) sub-usuários;',
      'Business — R$ 299,00/mês: até 10 (dez) condomínios e 30 (trinta) sub-usuários.',
    ],
    trailingParagraphs: [
      'Todos os planos incluem suporte contínuo. Os valores são cobrados de forma recorrente (mensal), por meio de gateway de pagamento parceiro, aceitando-se Pix, boleto bancário e cartão de crédito, com processamento realizado diretamente na Plataforma (checkout transparente), sem redirecionamento a ambiente externo.',
      'O Cond Informa poderá reajustar os valores dos planos, mediante comunicação prévia ao Cliente com antecedência mínima de 30 (trinta) dias. O não pagamento na data de vencimento poderá acarretar a suspensão do acesso às funcionalidades administrativas da Plataforma até a regularização.',
    ],
  },
  {
    number: '5.1',
    title: 'Cupons de desconto',
    paragraphs: [
      'O Cond Informa poderá disponibilizar cupons de desconto promocionais, aplicáveis no momento da contratação ou renovação do plano, com condições próprias de validade, quantidade máxima de usos e, quando aplicável, restrição a planos específicos. Cupons não são cumulativos entre si, salvo disposição expressa em contrário.',
    ],
  },
  {
    number: '6',
    title: 'Alteração, cancelamento e renovação',
    paragraphs: [
      'O Cliente poderá solicitar upgrade ou downgrade de plano a qualquer momento pelo painel administrativo. Caso reduza de plano e possua quantidade de condomínios ou sub-usuários acima do novo limite, os cadastros excedentes permanecem ativos, sendo vedada apenas a criação de novos registros até se enquadrar no novo limite.',
      'A assinatura é renovada automaticamente a cada ciclo mensal, salvo cancelamento antes da renovação. O cancelamento não gera direito a reembolso de valores já pagos, ressalvadas as hipóteses legais do Código de Defesa do Consumidor.',
      'O acesso às funcionalidades administrativas é bloqueado imediatamente após o cancelamento ou confirmação de inadimplência. As páginas públicas (execução de checklist e status) permanecem funcionando normalmente.',
    ],
  },
  {
    number: '6.1',
    title: 'Retenção e exclusão de dados após cancelamento',
    paragraphs: [
      'O Cond Informa enviará avisos ao Cliente 15 (quinze) e 3 (três) dias antes do prazo final de retenção. Persistindo a inadimplência por 90 (noventa) dias consecutivos, o Cond Informa poderá excluir definitivamente os dados vinculados à Conta, sem necessidade de notificação adicional. O Cliente poderá, antes desse prazo, solicitar a exportação de seus dados.',
    ],
  },
  {
    number: '7',
    title: 'Uso permitido e obrigações do Cliente',
    paragraphs: ['É vedado:'],
    list: [
      'Utilizar a Plataforma para fins ilícitos;',
      'Acessar áreas ou dados de outros Clientes sem autorização;',
      'Realizar engenharia reversa ou exploração comercial não autorizada;',
      'Inserir conteúdo ofensivo, discriminatório ou que viole direitos de imagem de terceiros;',
      'Utilizar meios automatizados para sobrecarregar a Plataforma.',
    ],
  },
  {
    number: '8',
    title: 'Propriedade intelectual',
    paragraphs: [
      'Todos os direitos sobre a Plataforma (código-fonte, layout, marca, funcionalidades) pertencem exclusivamente ao Cond Informa. Os dados inseridos pelo Cliente permanecem de sua titularidade, com licença não exclusiva concedida ao Cond Informa para processá-los na prestação do Serviço.',
    ],
  },
  {
    number: '9',
    title: 'Proteção de dados pessoais',
    paragraphs: [
      'O Cond Informa trata dados pessoais em conformidade com a LGPD (Lei nº 13.709/2018).',
      `Os dados coletados (nome, e-mail, telefone, CPF/CNPJ, dados de inscrição para notificações push, entre outros) são usados exclusivamente para a prestação do Serviço, comunicação, pagamentos e cumprimento de obrigações legais. O Cliente possui os direitos do art. 18 da LGPD, incluindo acesso, correção, portabilidade e eliminação, mediante solicitação a ${legalInfo.emailContato}.`,
      'Fotos de execuções e ocorrências são armazenadas para comprovação operacional, podendo ter exclusão solicitada.',
    ],
  },
  {
    number: '10',
    title: 'Disponibilidade do Serviço',
    paragraphs: [
      'O Cond Informa não garante disponibilidade ininterrupta, podendo ocorrer interrupções por manutenção, força maior ou falhas de terceiros (nuvem, gateway de pagamento, conectividade).',
    ],
  },
  {
    number: '11',
    title: 'Limitação de responsabilidade',
    paragraphs: [
      'A Plataforma é ferramenta de apoio à gestão operacional, não substituindo a responsabilidade do síndico/administradora pela efetiva execução das tarefas. A responsabilidade do Cond Informa por danos fica limitada ao valor pago pelo Cliente nos 3 meses anteriores ao evento danoso.',
    ],
  },
  {
    number: '12',
    title: 'Rescisão',
    paragraphs: [
      'O Cond Informa pode suspender o acesso em caso de descumprimento destes Termos ou inadimplência não regularizada. O Cliente pode encerrar sua Conta a qualquer momento.',
    ],
  },
  {
    number: '13',
    title: 'Alterações destes Termos',
    paragraphs: [
      'Alterações relevantes serão comunicadas com antecedência razoável. A continuidade do uso após a vigência caracteriza aceitação tácita.',
    ],
  },
  {
    number: '14',
    title: 'Disposições gerais',
    paragraphs: [
      'A nulidade de qualquer disposição não afeta as demais. A tolerância quanto ao descumprimento não constitui renúncia ao direito de exigi-lo.',
    ],
  },
  {
    number: '15',
    title: 'Legislação aplicável e foro',
    paragraphs: [
      `Regidos pelas leis brasileiras. Fica eleito o foro da Comarca de ${legalInfo.cidadeUf}, ressalvado o direito do Cliente-consumidor de optar pelo foro de seu domicílio.`,
    ],
  },
  {
    number: '16',
    title: 'Contato',
    paragraphs: [
      `Dúvidas ou solicitações: ${legalInfo.emailContato}.`,
    ],
  },
];

export const faqItems = [
  { q: 'Preciso instalar algum equipamento?', a: 'Não. Basta imprimir os QR Codes dos ambientes e usar o COND INFORMA pelo celular ou computador.' },
  { q: 'O colaborador precisa ter conhecimento técnico?', a: 'Não. Basta escanear o QR Code e marcar as tarefas concluídas. A interface é simples e direta.' },
  { q: 'O morador precisa criar conta para consultar o status?', a: 'Não. A página de status é pública e acessível diretamente pelo QR Code do ambiente.' },
  { q: 'Serve apenas para condomínios?', a: 'É ideal para condomínios, administradoras e equipes de limpeza ou zeladoria em geral.' },
  { q: 'Posso usar em mais de um condomínio?', a: 'Sim, os planos Pro e Business permitem gerenciar múltiplos condomínios na mesma conta.' },
  { q: 'Posso mudar de plano depois?', a: 'Sim, você pode fazer upgrade ou downgrade a qualquer momento.' },
];

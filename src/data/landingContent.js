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

// Dados jurídicos da empresa, usados nos Termos de Uso. Ainda não
// definidos — quando forem, é só editar aqui, num lugar só, que atualiza
// em todo o texto dos Termos de uma vez (ver src/pages/TermosPage.jsx).
export const legalInfo = {
  razaoSocial: '[A DEFINIR]',
  cnpj: '[A DEFINIR]',
  endereco: '[A DEFINIR]',
  cidadeUf: '[A DEFINIR]',
  emailContato: '[A DEFINIR]',
};

// Conteúdo completo dos Termos de Uso e Condições Gerais de Contratação,
// em seções numeradas (algumas com lista) pra renderizar com hierarquia
// clara em TermosPage.jsx.
export const termosSections = [
  {
    number: '1',
    title: 'Aceitação dos Termos',
    paragraphs: [
      `Estes Termos de Uso e Condições Gerais de Contratação ("Termos") regem o acesso e uso da plataforma Cond-Informa ("Plataforma", "Serviço"), de titularidade de ${legalInfo.razaoSocial}, inscrita no CNPJ sob o nº ${legalInfo.cnpj}, com sede em ${legalInfo.endereco} ("Cond-Informa", "nós").`,
      'Ao criar uma conta, contratar um plano ou de qualquer forma utilizar a Plataforma, o usuário ("Cliente", "Usuário", "você") declara ter lido, compreendido e aceitado integralmente estes Termos, bem como a Política de Privacidade, que é parte integrante deste documento.',
      'Caso não concorde com qualquer disposição destes Termos, o Cliente não deverá utilizar a Plataforma.',
    ],
  },
  {
    number: '2',
    title: 'Definições',
    list: [
      'Plataforma: o sistema Cond-Informa, incluindo site, painel administrativo, páginas públicas de execução de checklist e status, acessíveis via navegador ou aplicativo.',
      'Conta: cadastro único vinculado a um e-mail e senha, pertencente ao Cliente que contrata um plano.',
      'Sub-usuário: acesso adicional criado pelo Cliente dentro de sua Conta, com permissões limitadas a condomínios específicos, conforme os limites do plano contratado.',
      'Condomínio: unidade cadastrada pelo Cliente na Plataforma, à qual se vinculam Ambientes, Checklists, Execuções e Ocorrências.',
      'Colaborador: pessoa que executa checklists através de QR Code, sem necessidade de login.',
      'Morador: pessoa que consulta o status público de um Ambiente através de QR Code, sem necessidade de login, podendo também registrar ocorrências.',
    ],
  },
  {
    number: '3',
    title: 'Objeto',
    paragraphs: [
      'O Cond-Informa oferece uma plataforma para criação e gerenciamento de checklists digitais vinculados a QR Codes, permitindo o controle de rotinas de limpeza, manutenção e zeladoria em condomínios, com registro fotográfico, histórico de execuções, gestão de ocorrências e emissão de relatórios e comunicados.',
      'A Plataforma é disponibilizada mediante contratação de plano de assinatura mensal, nas modalidades descritas no site, podendo o Cond-Informa alterar, incluir ou descontinuar funcionalidades a qualquer tempo, mediante aviso prévio razoável, quando a alteração impactar substancialmente o uso já contratado.',
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
    paragraphs: [
      'A Plataforma é oferecida nas modalidades de plano descritas no site no momento da contratação, cada qual com limites específicos de quantidade de condomínios cadastráveis e de sub-usuários, além de outras características descritas na página de planos.',
      'Os valores são cobrados de forma recorrente (mensal), por meio de gateway de pagamento parceiro, aceitando-se Pix, boleto bancário e cartão de crédito, conforme disponibilidade.',
      'O Cond-Informa poderá reajustar os valores dos planos, mediante comunicação prévia ao Cliente com antecedência mínima de 30 (trinta) dias, aplicando-se o novo valor a partir do ciclo de cobrança subsequente.',
      'O não pagamento na data de vencimento poderá acarretar a suspensão do acesso às funcionalidades administrativas da Plataforma até a regularização, sem prejuízo da manutenção, a critério do Cond-Informa, do funcionamento dos QR Codes já publicados.',
    ],
  },
  {
    number: '6',
    title: 'Alteração, cancelamento e renovação',
    paragraphs: [
      'O Cliente poderá solicitar upgrade ou downgrade de plano a qualquer momento pelo painel administrativo, passando a vigorar as novas condições e limites a partir da confirmação do pagamento correspondente.',
      'Caso o Cliente reduza de plano e possua, no momento da alteração, quantidade de condomínios ou sub-usuários acima do novo limite contratado, os cadastros excedentes existentes permanecerão ativos e visíveis, sendo vedada apenas a criação de novos registros até que a quantidade se enquadre no novo limite.',
      'A assinatura é renovada automaticamente a cada ciclo mensal, salvo cancelamento realizado pelo Cliente antes da data de renovação. O cancelamento não gera direito a reembolso de valores já pagos referentes ao ciclo em curso, ressalvadas as hipóteses legais de arrependimento previstas no Código de Defesa do Consumidor.',
    ],
  },
  {
    number: '7',
    title: 'Uso permitido e obrigações do Cliente',
    paragraphs: ['O Cliente compromete-se a utilizar a Plataforma exclusivamente para as finalidades a que se destina, sendo vedado:'],
    list: [
      'Utilizar a Plataforma para fins ilícitos ou que violem direitos de terceiros;',
      'Tentar acessar áreas, contas ou dados de outros Clientes sem autorização;',
      'Realizar engenharia reversa, cópia, distribuição ou exploração comercial não autorizada do código ou da estrutura da Plataforma;',
      'Inserir conteúdo ofensivo, discriminatório, ilegal ou que viole direitos de imagem de terceiros nos registros de execução, ocorrências ou comunicados gerados pela Plataforma;',
      'Utilizar meios automatizados para sobrecarregar ou comprometer a disponibilidade da Plataforma.',
    ],
  },
  {
    number: '8',
    title: 'Propriedade intelectual',
    paragraphs: [
      'Todos os direitos de propriedade intelectual sobre a Plataforma, incluindo mas não se limitando a código-fonte, layout, marca, logotipo e funcionalidades, pertencem exclusivamente ao Cond-Informa, sendo vedada sua reprodução, distribuição ou uso não autorizado.',
      'Os dados inseridos pelo Cliente (fotos, textos de checklist, informações de condomínios e ambientes) permanecem de titularidade do Cliente, concedendo este ao Cond-Informa licença não exclusiva para processá-los estritamente para a prestação do Serviço.',
    ],
  },
  {
    number: '9',
    title: 'Proteção de dados pessoais',
    paragraphs: [
      'O Cond-Informa realiza o tratamento de dados pessoais em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais, LGPD).',
      'Os dados pessoais coletados (nome, e-mail, telefone, CPF/CNPJ e demais informações fornecidas no cadastro, na execução de checklists ou no registro de ocorrências) são utilizados exclusivamente para viabilizar a prestação do Serviço, comunicação com o Cliente, processamento de pagamentos e cumprimento de obrigações legais.',
      'O Cliente, seus Colaboradores e Moradores que interagem com a Plataforma possuem os direitos previstos no artigo 18 da LGPD, incluindo confirmação de tratamento, acesso, correção, anonimização, portabilidade e eliminação de dados pessoais, mediante solicitação ao canal de contato indicado no site.',
      'Fotos registradas nas execuções de checklist e ocorrências são armazenadas para fins de comprovação operacional e histórico, podendo o Cliente solicitar sua exclusão nos termos da legislação aplicável, ressalvadas hipóteses de guarda obrigatória por prazo legal.',
    ],
  },
  {
    number: '10',
    title: 'Disponibilidade do Serviço',
    paragraphs: [
      'O Cond-Informa empenha-se em manter a Plataforma disponível de forma contínua, porém não garante disponibilidade ininterrupta, podendo ocorrer interrupções para manutenção programada, atualizações, ou por motivos de força maior, caso fortuito, falhas de terceiros (incluindo provedores de nuvem, gateway de pagamento e conectividade) alheios à sua vontade.',
      'O Cond-Informa não se responsabiliza por indisponibilidades decorrentes de falhas na conexão à internet do Cliente, Colaborador ou Morador.',
    ],
  },
  {
    number: '11',
    title: 'Limitação de responsabilidade',
    paragraphs: [
      'A Plataforma é uma ferramenta de apoio à gestão operacional de condomínios, não substituindo a responsabilidade do síndico, administradora ou empresa de zeladoria pela efetiva realização das tarefas de limpeza e manutenção, nem constituindo garantia de qualidade dos serviços executados pelos Colaboradores.',
      'O Cond-Informa não se responsabiliza por decisões tomadas pelo Cliente com base nos dados, relatórios ou comunicados gerados pela Plataforma, nem por eventuais divergências entre o registrado na Plataforma e a realidade fática, cuja veracidade é de responsabilidade de quem realiza o registro (Colaborador ou Cliente).',
      'Em qualquer hipótese, a responsabilidade do Cond-Informa por danos comprovadamente causados ao Cliente em razão de falha direta e exclusiva da Plataforma fica limitada ao valor total pago pelo Cliente nos 3 (três) meses anteriores ao evento danoso.',
    ],
  },
  {
    number: '12',
    title: 'Rescisão',
    paragraphs: [
      'O Cond-Informa poderá suspender ou encerrar o acesso do Cliente à Plataforma, mediante notificação prévia, em caso de descumprimento destes Termos, inadimplência não regularizada, ou uso indevido conforme descrito na Cláusula 7.',
      'O Cliente poderá encerrar sua Conta a qualquer momento, mediante solicitação pelos canais disponibilizados, observado o disposto na Cláusula 6 quanto a valores já pagos.',
    ],
  },
  {
    number: '13',
    title: 'Retenção e exclusão de dados após cancelamento ou inadimplência',
    paragraphs: [
      'Conforme a Cláusula 5, o não pagamento na data de vencimento ou o cancelamento da assinatura suspendem imediatamente o acesso às funcionalidades administrativas da Conta (cadastro e gestão de condomínios, ambientes, checklists e sub-usuários), sem apagar nenhum dado já registrado e sem interromper o funcionamento dos QR Codes já publicados (execução de checklist pelo Colaborador e registro de status/ocorrências pelo Morador continuam disponíveis normalmente).',
      'Caso a pendência não seja regularizada, o Cond-Informa enviará avisos ao Cliente aos 15 (quinze) e aos 3 (três) dias que antecedem o prazo final abaixo, para que a situação seja regularizada e nenhum dado seja perdido.',
      'Decorridos 90 (noventa) dias consecutivos de inadimplência ou cancelamento não regularizado, todos os dados vinculados à Conta — condomínios, ambientes, checklists, execuções, ocorrências, fotos e sub-usuários — serão excluídos de forma permanente e irreversível dos sistemas do Cond-Informa, não sendo possível sua recuperação após esse prazo.',
      'A regularização do pagamento a qualquer momento antes do prazo final descrito acima restabelece integralmente o acesso e mantém todos os dados intactos, sem necessidade de novo cadastro.',
    ],
  },
  {
    number: '14',
    title: 'Alterações destes Termos',
    paragraphs: [
      'O Cond-Informa poderá alterar estes Termos a qualquer tempo, visando adequação legal, regulatória ou evolução da Plataforma. Alterações relevantes serão comunicadas ao Cliente com antecedência razoável, por e-mail ou aviso na própria Plataforma. A continuidade do uso após a vigência das alterações caracteriza aceitação tácita das novas condições.',
    ],
  },
  {
    number: '15',
    title: 'Disposições gerais',
    paragraphs: [
      'Caso qualquer disposição destes Termos seja considerada nula ou inaplicável, as demais disposições permanecerão em pleno vigor e efeito.',
      'A tolerância de qualquer das partes quanto ao descumprimento de qualquer obrigação prevista nestes Termos não constituirá novação ou renúncia ao direito de exigi-la a qualquer tempo.',
    ],
  },
  {
    number: '16',
    title: 'Legislação aplicável e foro',
    paragraphs: [
      `Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca de ${legalInfo.cidadeUf}, com renúncia expressa a qualquer outro, por mais privilegiado que seja, para dirimir eventuais controvérsias oriundas destes Termos, ressalvado o direito do Cliente, quando enquadrado como consumidor, de optar pelo foro de seu domicílio, nos termos do Código de Defesa do Consumidor.`,
    ],
  },
  {
    number: '17',
    title: 'Contato',
    paragraphs: [
      `Dúvidas, solicitações ou exercício de direitos previstos na LGPD podem ser encaminhados para: ${legalInfo.emailContato} ou através do canal de suporte disponível na própria Plataforma.`,
    ],
  },
];

export const faqItems = [
  { q: 'Preciso instalar algum equipamento?', a: 'Não. Basta imprimir os QR Codes dos ambientes e usar o COND-INFORMA pelo celular ou computador.' },
  { q: 'O colaborador precisa ter conhecimento técnico?', a: 'Não. Basta escanear o QR Code e marcar as tarefas concluídas. A interface é simples e direta.' },
  { q: 'O morador precisa criar conta para consultar o status?', a: 'Não. A página de status é pública e acessível diretamente pelo QR Code do ambiente.' },
  { q: 'Serve apenas para condomínios?', a: 'É ideal para condomínios, administradoras e equipes de limpeza ou zeladoria em geral.' },
  { q: 'Posso usar em mais de um condomínio?', a: 'Sim, os planos Pro e Business permitem gerenciar múltiplos condomínios na mesma conta.' },
  { q: 'Posso mudar de plano depois?', a: 'Sim, você pode fazer upgrade ou downgrade a qualquer momento.' },
];

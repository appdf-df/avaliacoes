/**
 * Config.gs — Conteúdo fixo dos formulários da APPDF.
 *
 * Aqui ficam as perguntas, escalas e critérios. Eles reproduzem exatamente
 * o modelo aprovado (formularios_appdf.gs). Os dados de cada ação (nome,
 * datas, disciplinas, instrutores, unidades) NÃO ficam aqui: são cadastrados
 * na planilha "APPDF – Avaliações".
 *
 * Base normativa: Portaria SEAPE nº 80/2025, arts. 35 a 37 e art. 48, § 2º.
 */

const NOME_PLANILHA = 'APPDF – Avaliações';
// Endereço do site dos formulários (GitHub Pages). Pode ser trocado pelo menu APPDF.
const URL_SITE_PADRAO = 'https://appdf-df.github.io/avaliacoes/';
const LIMITE_TEXTO = 2000;          // máximo de caracteres nos campos abertos
const FUSO = 'America/Sao_Paulo';
const NA = 'NA';                     // código interno de "Não se aplica"
const ROTULO_NA_PLANILHA = 'Não se aplica';

const ABAS = {
  ACOES: 'Acoes',
  DISCIPLINAS: 'Disciplinas',
  UNIDADES: 'Unidades',
  REACAO: 'Respostas_Reacao',
  R360: 'Respostas_360',
  CONSOLIDADO: 'Consolidado',
  TURMA: 'Turma',
  PARTICIPACAO: 'Participacao',
};

// ------------------------------- Escalas padronizadas -------------------------------
// "rotulo" é o texto oficial (não alterar). "exibir" é só a quebra visual no botão
// (o caractere ­ é um hífen opcional, invisível quando não há quebra).
const ESCALAS = {
  concordancia: {
    numerica: false,
    opcoes: [
      { valor: 1, rotulo: 'Discordo totalmente', exibir: 'Discordo total\u00ADmente' },
      { valor: 2, rotulo: 'Discordo' },
      { valor: 3, rotulo: 'Neutro' },
      { valor: 4, rotulo: 'Concordo' },
      { valor: 5, rotulo: 'Concordo totalmente', exibir: 'Concordo total\u00ADmente' },
      { valor: NA, rotulo: 'Não se aplica' },
    ],
  },
  desempenho: {
    numerica: true,
    opcoes: [
      { valor: 1, rotulo: '1 – Insuficiente', exibir: 'Insufi­ciente' },
      { valor: 2, rotulo: '2 – Regular', exibir: 'Regular' },
      { valor: 3, rotulo: '3 – Bom', exibir: 'Bom' },
      { valor: 4, rotulo: '4 – Muito bom', exibir: 'Muito bom' },
      { valor: 5, rotulo: '5 – Excelente', exibir: 'Exce­lente' },
      { valor: NA, rotulo: 'Não se aplica / não observei' },
    ],
  },
  dominio: {
    numerica: true,
    opcoes: [
      { valor: 1, rotulo: '1 – Nenhum', exibir: 'Nenhum' },
      { valor: 2, rotulo: '2 – Básico', exibir: 'Básico' },
      { valor: 3, rotulo: '3 – Intermediário', exibir: 'Interme­diário' },
      { valor: 4, rotulo: '4 – Avançado', exibir: 'Avançado' },
      { valor: 5, rotulo: '5 – Pleno', exibir: 'Pleno' },
    ],
  },
};

// ------------------------- Critérios e itens (texto oficial) -------------------------
// Critérios centrais do docente: idênticos nas quatro perspectivas do 360°.
const CRITERIOS_DOCENTE = [
  'Domínio do conteúdo',
  'Clareza e objetividade na comunicação',
  'Metodologia adequada aos objetivos (casos, práticas, discussões)',
  'Relação do conteúdo com a prática profissional',
  'Valorização da experiência e estímulo à participação dos alunos',
  'Tratamento respeitoso e postura ética',
  'Cumprimento do planejamento (conteúdo e horário)',
  'Uso de recursos e materiais didáticos',
];
const CRITERIO_COLABORACAO = 'Colaboração e alinhamento com a equipe docente';

const TEMPOS_SERVICO = ['Até 2 anos', 'De 2 a 5 anos', 'De 5 a 10 anos', 'Mais de 10 anos'];

const ITENS_ACAO = [
  'Os objetivos da ação foram apresentados com clareza.',
  'O conteúdo é aplicável às minhas atividades profissionais.',
  'As atividades práticas (casos, simulações, discussões) contribuíram para minha aprendizagem.',
  'Minha experiência profissional foi considerada e aproveitada nas discussões.',
  'A carga horária foi adequada ao conteúdo proposto.',
  'O material didático e os recursos utilizados foram adequados.',
  'As instalações (espaço, som, projeção, climatização) foram adequadas.',
  'A organização e o apoio da coordenação foram eficientes.',
  'A ação cumpriu a programação divulgada (conteúdos e horários).',
];

const ITENS_APLICACAO = [
  'Sinto-me preparado(a) para aplicar o que aprendi.',
  'Pretendo aplicar o conteúdo nos próximos 30 dias.',
  'Minha unidade oferece condições para aplicar o que aprendi.',
];

const DIFICULDADES = [
  'Demanda operacional / falta de tempo',
  'Falta de recursos ou equipamentos',
  'Fluxos ou normas não definidos na unidade',
  'Falta de apoio da chefia',
  'Necessidade de aprofundamento no tema',
  'Não prevejo dificuldades',
];
const VALOR_OUTRA = '__outra';

// Compromissos avaliados pela coordenação. A Ficha de Registro de Aula saiu da lista
// porque é preenchida pela própria coordenação.
const COMPROMISSOS = [
  'Pontualidade e cumprimento dos horários',
  'Entrega do plano de aula antes do início da ação',
  'Comunicação e alinhamento com a coordenação',
  'Observância das normas da APPDF e do Código de Ética',
];

// Avaliação do curso pelo docente (item 12 do Plano de Capacitação)
const ITENS_CURSO = [
  'Adequação dos conteúdos às competências previstas',
  'Adequação da carga horária',
  'Compatibilidade entre metodologia, avaliação e resultados esperados',
  'Recursos didáticos e instalações',
];
// O antigo item "Apoio da coordenação" virou o bloco ITENS_COORDENACAO, abaixo.

// Avaliação da turma, feita pelo(a) instrutor(a) para o turno em que deu aula.
// (Proposta inicial: ajuste os textos à vontade.)
const ITENS_TURMA = [
  'Participação dos alunos nas atividades',
  'Interesse e engajamento da turma',
  'Pontualidade e assiduidade da turma',
  'Conhecimentos prévios da turma sobre o tema',
];

// Avaliação da coordenação, feita pelos instrutores. (Proposta inicial: ajuste à vontade.)
const ITENS_COORDENACAO = [
  'Comunicação e orientações antes da ação',
  'Apoio durante a ação (logística, materiais e equipamentos)',
  'Organização e cumprimento da programação',
  'Disponibilidade e receptividade às demandas',
  'Retorno e encaminhamento das questões apresentadas',
];

// Perfis de quem responde o 360°. O(a) instrutor(a) responde um formulário único,
// que gera a autoavaliação e a avaliação de cada colega (pares).
const PERFIS = [
  { valor: 'aluno', rotulo: 'Aluno(a)' },
  { valor: 'coordenacao', rotulo: 'Coordenação' },
  { valor: 'instrutor', rotulo: 'Instrutor(a) desta ação' },
];
// Perspectivas do consolidado (ordem das colunas).
const PERSPECTIVAS = ['Aluno', 'Coordenação', 'Autoavaliação', 'Pares'];

const TEXTOS = {
  instituicao: 'Academia da Polícia Penal do Distrito Federal – APPDF',
  descricaoReacao:
    'Sua avaliação é anônima e leva cerca de 5 minutos. As respostas orientam o ' +
    'aperfeiçoamento das próximas ações educacionais (Portaria SEAPE nº 80/2025, arts. 35 a 37). ' +
    'Responda com sinceridade e de forma respeitosa.',
  descricao360:
    'Avaliação do desempenho docente sob quatro perspectivas: alunos, coordenação, ' +
    'autoavaliação e pares (Portaria SEAPE nº 80/2025, arts. 35 a 37). ' +
    'Os resultados são consolidados pela coordenação em relatório próprio (art. 48, § 2º). ' +
    'As respostas dos alunos são anônimas.',
  privacidadeReacao:
    'As informações coletadas destinam-se exclusivamente ao aperfeiçoamento das ações ' +
    'educacionais da APPDF (Lei nº 13.709/2018 – LGPD). Não são coletados nome, e-mail, ' +
    'matrícula, CPF ou endereço IP.',
  privacidade360:
    'As informações coletadas destinam-se exclusivamente ao aperfeiçoamento das ações ' +
    'educacionais da APPDF (Lei nº 13.709/2018 – LGPD). As avaliações da coordenação e dos ' +
    'instrutores são identificadas. Os alunos respondem por um link próprio, de forma anônima.',
  privacidadeAluno:
    'As informações destinam-se exclusivamente ao aperfeiçoamento das ações educacionais da APPDF ' +
    '(Lei nº 13.709/2018 – LGPD). A matrícula é usada só para registrar que você concluiu as avaliações ' +
    'e fica guardada separada das respostas, apenas com a data, sem horário. As respostas são anônimas: ' +
    'não ficam ligadas à sua matrícula, nome, e-mail, CPF ou endereço IP.',
  confirmacao:
    'Obrigado! Sua avaliação foi registrada e contribuirá para o aperfeiçoamento das ' +
    'ações educacionais da APPDF.',
  convite360: 'Avalie também os instrutores desta ação (Avaliação 360°).',
};

/**
 * Aluno.gs — Avaliação obrigatória do aluno: Reação + 360° num único envio,
 * com registro de participação pela matrícula.
 *
 * Anonimato: a matrícula vai só para a aba Participacao (ID da ação, matrícula, data),
 * que fica ordenada por matrícula e guarda apenas a data, sem hora. As respostas
 * vão para Respostas_Reacao e Respostas_360 sem nenhuma identificação.
 */

const CAB_TURMA = ['ID da ação', 'Matrícula', 'Nome'];
const CAB_PARTICIPACAO = ['ID da ação', 'Matrícula', 'Data'];

/** Só letras e números, em maiúsculas (ex.: "123.456-7" vira "1234567"). */
function normalizarMatricula_(m) {
  return texto_(m).toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 20);
}

function matriculaValida_(m) { return /^(?=.*\d)[0-9A-Z]{3,20}$/.test(m); }

/** Turma cadastrada para a ação: [{ matricula, nome }]. */
function turmaDaAcao_(acaoId) {
  const t = lerTabela_(planilha_().getSheetByName(ABAS.TURMA), true);
  if (t.idx['ID da ação'] === undefined) return [];
  return t.linhas.map((l, i) => ({ id: l[t.idx['ID da ação']], matricula: normalizarMatricula_(t.exibir[i][t.idx['Matrícula']]), nome: texto_(t.exibir[i][t.idx['Nome']]) }))
    .filter(r => mesmoId_(r.id, acaoId) && r.matricula)
    .map(r => ({ matricula: r.matricula, nome: r.nome }));
}

/** Matrículas que já concluíram a avaliação da ação. */
function participantesDaAcao_(acaoId) {
  const t = lerTabela_(planilha_().getSheetByName(ABAS.PARTICIPACAO), true);
  if (t.idx['ID da ação'] === undefined) return [];
  return t.linhas.map((l, i) => ({ id: l[t.idx['ID da ação']], matricula: normalizarMatricula_(t.exibir[i][t.idx['Matrícula']]), data: texto_(t.exibir[i][t.idx['Data']]) }))
    .filter(r => mesmoId_(r.id, acaoId) && r.matricula);
}

/** Confere a matrícula antes de o aluno começar (e de novo no envio). */
function conferirMatricula_(acao, bruta) {
  const m = normalizarMatricula_(bruta);
  if (!matriculaValida_(m)) return falha_('Informe sua matrícula (somente números e letras).', 'matricula', [{ id: 'matricula', mensagem: 'Matrícula inválida.' }]);
  const turma = turmaDaAcao_(acao.id);
  if (turma.length && !turma.some(a => a.matricula === m)) {
    return falha_('Esta matrícula não está na turma desta ação. Confira o número ou procure a coordenação.', 'fora_da_turma',
      [{ id: 'matricula', mensagem: 'Matrícula não encontrada na turma.' }]);
  }
  if (participantesDaAcao_(acao.id).some(p => p.matricula === m)) {
    return falha_('Esta matrícula já concluiu as avaliações desta ação. Obrigado!', 'ja_respondeu',
      [{ id: 'matricula', mensagem: 'Esta matrícula já respondeu.' }]);
  }
  return { ok: true, matricula: m };
}

function verificarMatricula(p) {
  const acao = carregarAcao_(p && p.acao);
  if (!acao) return falha_('Ação educacional não encontrada.');
  if (acao.encerrada) return falha_('Esta avaliação está encerrada e não recebe mais respostas.', 'encerrada');
  return conferirMatricula_(acao, p.matricula);
}

// ============================ Definição do formulário ============================
function defAluno_(acao) {
  const reac = defReacao_(acao);
  const d360 = def360_(acao, true);
  const n = acao.instrutores.length;
  return {
    tipo: 'aluno',
    titulo: 'Avaliação da ação educacional',
    descricao: 'São duas avaliações obrigatórias, respondidas em sequência: a Avaliação de Reação, sobre a ação, ' +
      'e a Avaliação 360° de ' + (n === 1 ? 'seu(sua) instrutor(a)' : 'todos os ' + n + ' instrutores') + '. ' +
      'As respostas são anônimas e orientam o aperfeiçoamento das próximas ações educacionais ' +
      '(Portaria SEAPE nº 80/2025, arts. 35 a 37). Responda com sinceridade e de forma respeitosa.',
    privacidade: TEXTOS.privacidadeAluno,
    tempo: 'cerca de ' + (5 + 2 * n) + ' minutos',
    anonimo: true,
    etapas: [
      { id: 'matricula', titulo: 'Identificação', verificar: 'matricula',
        ajuda: 'A matrícula serve só para registrar que você concluiu. Ela é guardada separada das respostas, ' +
               'e ninguém consegue ligar uma coisa à outra.',
        perguntas: [{ id: 'matricula', tipo: 'matricula', titulo: 'Sua matrícula', obrigatorio: true }] },
    ].concat(reac.etapas.map(et => Object.assign({}, et, { parte: 'Avaliação de Reação' })),
      d360.ramos.aluno.map(et => Object.assign({}, et, { parte: 'Avaliação 360° dos instrutores' }))),
  };
}

// ==================================== Gravação ====================================
function gravarAluno_(acao, resp) {
  if (!acao.instrutores.length) return falha_('Esta ação ainda não tem instrutores cadastrados.');
  const conf = conferirMatricula_(acao, resp.matricula);
  if (!conf.ok) return conf;

  const def = defAluno_(acao);
  const etapas = def.etapas.filter(et => et.id !== 'matricula');
  const v = validar_(etapas, resp);
  if (v.erros.length) return falha_('Há respostas pendentes ou inválidas. Revise o formulário.', 'validacao', v.erros);
  const val = v.val;

  // 1) Reação
  const numeros = acao.disciplinas.map(d => idSeguro_(d.numero));
  gravarLinhas_(ABAS.REACAO, colunasReacao_(numeros), [Object.assign({ _carimbo: new Date(), _acao: acao.id }, val)]);

  // 2) 360° (uma linha por instrutor)
  const base = { _carimbo: new Date(), _envio: Utilities.getUuid().slice(0, 8), _acao: acao.id };
  const linhas = def360_(acao, true).ramos.aluno.map(et => {
    const l = Object.assign({}, base, { _perspectiva: 'Aluno', _avaliador: 'Anônimo', _instrutor: et.cabecalho.nome,
      coment_aluno: val[et.id + '_coment'] });
    for (let i = 1; i <= CRITERIOS_DOCENTE.length; i++) l['c' + i] = val[et.id + '_c' + i];
    return l;
  });
  gravarLinhas_(ABAS.R360, colunas360_(), linhas);

  // 3) Participação: só matrícula e data, e a aba é reordenada por matrícula
  registrarParticipacao_(acao.id, conf.matricula);
  return { ok: true };
}

function registrarParticipacao_(acaoId, matricula) {
  const ss = planilha_();
  const sh = ss.getSheetByName(ABAS.PARTICIPACAO) || prepararAba_(ss, ABAS.PARTICIPACAO, CAB_PARTICIPACAO, [120, 160, 120]);
  const data = Utilities.formatDate(new Date(), FUSO, 'dd/MM/yyyy');
  const linha = Math.max(sh.getLastRow(), 1) + 1;
  if (linha > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 100);
  sh.getRange(linha, 1, 1, 3).setValues([[celula_(acaoId), celula_(matricula), celula_(data)]]);
  const total = sh.getLastRow() - 1;
  if (total > 1) sh.getRange(2, 1, total, 3).sort([{ column: 1, ascending: true }, { column: 2, ascending: true }]);
}

/** Lê "matrícula nome" (uma pessoa por linha) colado no painel. */
function lerListaTurma_(texto) {
  const alunos = [], erros = [], vistos = {};
  String(texto || '').split(/\r?\n/).slice(0, 500).forEach((linha, i) => {
    const l = linha.trim();
    if (!l) return;
    // separa por espaço, ponto e vírgula, vírgula, tabulação, barra ou travessão entre espaços
    // (o hífen colado, como em 123.456-7, continua fazendo parte da matrícula)
    const partes = l.split(/\s*[;,\t|]\s*|\s+[–-]\s+|\s+/).filter(String);
    // a matrícula é o trecho com mais dígitos (nomes podem ter números, como "Turma 2")
    let iMat = -1, mais = 0;
    partes.forEach((p, k) => { const n = (p.match(/\d/g) || []).length; if (n > mais) { mais = n; iMat = k; } });
    if (iMat === -1) { erros.push('Linha ' + (i + 1) + ': sem matrícula ("' + l.slice(0, 40) + '").'); return; }
    const m = normalizarMatricula_(partes[iMat]);
    if (!matriculaValida_(m)) { erros.push('Linha ' + (i + 1) + ': matrícula inválida.'); return; }
    if (vistos[m]) return;
    vistos[m] = true;
    const nome = partes.filter((_, k) => k !== iMat).join(' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    alunos.push({ matricula: m, nome: nome });
  });
  return { alunos: alunos, erros: erros };
}

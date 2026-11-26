/**
 * Painel.gs — Serviço do painel da coordenação (site/painel.html).
 *
 * Tudo passa por doPost com { api: 'painel', op: ..., token: ... }.
 * O acesso é por um código; depois de entrar, o painel recebe um token válido por 6 horas.
 */

const DURACAO_SESSAO = 6 * 3600;         // segundos (limite do CacheService)
const MAX_TENTATIVAS = 8;                // erros de código antes do bloqueio
const BLOQUEIO_TENTATIVAS = 15 * 60;     // segundos

function painel_(p) {
  const op = texto_(p.op);
  if (op === 'entrar') return painelEntrar_(texto_(p.codigo));
  if (!sessaoValida_(texto_(p.token))) {
    return { ok: false, codigo: 'sessao', mensagem: 'Sua sessão expirou. Entre novamente com o código de acesso.' };
  }
  switch (op) {
    case 'listar': return painelListar_();
    case 'salvar': return comTrava_(() => painelSalvar_(p.acao || {}));
    case 'status': return comTrava_(() => painelStatus_(texto_(p.id), texto_(p.status)));
    case 'excluir': return comTrava_(() => painelExcluir_(texto_(p.id)));
    case 'resultados': return painelResultados_(texto_(p.id));
    case 'turma': return painelTurma_(texto_(p.id));
    case 'trocar_codigo': return painelTrocarCodigo_(String(p.novo || ''));
    case 'sair': CacheService.getScriptCache().remove('sessao:' + texto_(p.token)); return { ok: true };
    default: return falha_('Operação inválida.');
  }
}

function comTrava_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return falha_('O sistema está ocupado. Tente de novo em alguns segundos.');
  try { return fn(); } finally { lock.releaseLock(); }
}

// ================================== Acesso ==================================
/**
 * O código vale a partir da propriedade do script CODIGO_PAINEL (definida pelo botão
 * "Trocar código" do painel). Segredo.gs é só o valor inicial de uma instalação nova
 * e não vai para o GitHub.
 */
function codigoPainel_() {
  const props = PropertiesService.getScriptProperties();
  let c = props.getProperty('CODIGO_PAINEL');
  if (!c && typeof CODIGO_PAINEL_INICIAL !== 'undefined' && CODIGO_PAINEL_INICIAL) {
    c = CODIGO_PAINEL_INICIAL;
    props.setProperty('CODIGO_PAINEL', c);   // fixa o código; o Segredo.gs deixa de ser necessário
  }
  return c || '';
}

function painelEntrar_(codigo) {
  const cache = CacheService.getScriptCache();
  const falhas = Number(cache.get('painel_falhas') || 0);
  if (falhas >= MAX_TENTATIVAS) return falha_('Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.', 'bloqueado');
  const certo = codigoPainel_();
  if (!certo) return falha_('O painel ainda não tem código de acesso. Veja o README (seção do desenvolvedor).', 'sem_codigo');
  if (!codigo || codigo.toLowerCase() !== certo.toLowerCase()) {
    cache.put('painel_falhas', String(falhas + 1), BLOQUEIO_TENTATIVAS);
    return falha_('Código de acesso incorreto.', 'codigo');
  }
  cache.remove('painel_falhas');
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  cache.put('sessao:' + token, '1', DURACAO_SESSAO);
  return { ok: true, token: token };
}

function sessaoValida_(token) {
  if (!/^[0-9a-f]{32,80}$/i.test(token)) return false;
  return !!CacheService.getScriptCache().get('sessao:' + token);
}

function painelTrocarCodigo_(novo) {
  novo = novo.trim();
  if (novo.length < 8 || novo.length > 60) return falha_('O novo código precisa ter entre 8 e 60 caracteres.');
  PropertiesService.getScriptProperties().setProperty('CODIGO_PAINEL', novo);
  return { ok: true };
}

// ================================== Listar ==================================
/** Lê todas as ações com disciplinas de uma vez (sem reler a planilha por ação). */
function lerTodasAcoes_() {
  const ss = planilha_();
  const t = lerTabela_(ss.getSheetByName(ABAS.ACOES), true);
  const d = lerTabela_(ss.getSheetByName(ABAS.DISCIPLINAS), true);
  const acoes = [];
  const porId = {};
  t.linhas.forEach((ln, i) => {
    if (!texto_(ln[t.idx['ID']])) return;
    const a = montarAcao_(t, i);
    if (!a.turnos.length) a.turnos = TURNOS_PADRAO.slice();
    const enc = interpretarData_(ln[t.idx['Data de encerramento']]);
    a.encerramento = enc ? Utilities.formatDate(enc, FUSO, 'yyyy-MM-dd') : '';
    a.disciplinas = [];
    acoes.push(a);
    porId[a.id.toUpperCase()] = { acao: a, porNumero: {} };
  });
  d.linhas.forEach((ln, i) => {
    const alvo = porId[texto_(ln[d.idx['ID da ação']]).toUpperCase()];
    if (!alvo) return;
    const numero = texto_(d.exibir[i][d.idx['Nº']]);
    const nome = texto_(d.exibir[i][d.idx['Disciplina']]);
    const inst = texto_(d.exibir[i][d.idx['Instrutor(a)']]);
    if (!numero || !nome) return;
    let di = alvo.porNumero[numero];
    if (!di) { di = alvo.porNumero[numero] = { numero: numero, nome: nome, instrutores: [] }; alvo.acao.disciplinas.push(di); }
    if (inst && di.instrutores.indexOf(inst) === -1) di.instrutores.push(inst);
  });
  acoes.forEach(a => a.disciplinas.sort((x, y) => (Number(x.numero) - Number(y.numero)) || x.numero.localeCompare(y.numero)));
  return acoes;
}

function painelListar_() {
  const ss = planilha_();
  const acoes = lerTodasAcoes_();
  const contar = (nomeAba, perspectiva) => {
    const t = lerTabela_(ss.getSheetByName(nomeAba));
    const iA = t.idx['ID da ação'], iP = t.idx['Perspectiva'];
    const c = {};
    t.linhas.forEach(l => {
      const id = texto_(l[iA]).toUpperCase();
      if (!id) return;
      c[id] = c[id] || {};
      const chave = perspectiva && iP !== undefined ? texto_(l[iP]) : 'total';
      c[id][chave] = (c[id][chave] || 0) + 1;
    });
    return c;
  };
  const cR = contar(ABAS.REACAO, false);
  const c3 = contar(ABAS.R360, true);
  const cT = contar(ABAS.TURMA, false);
  const turmas = {};
  (function () {
    const t = lerTabela_(ss.getSheetByName(ABAS.TURMA), true);
    if (t.idx['ID da ação'] === undefined) return;
    t.linhas.forEach((l, i) => {
      const id = texto_(l[t.idx['ID da ação']]).toUpperCase();
      if (!id) return;
      (turmas[id] = turmas[id] || []).push((texto_(t.exibir[i][t.idx['Matrícula']]) + ' ' + texto_(t.exibir[i][t.idx['Nome']])).trim());
    });
  })();
  const cP = contar(ABAS.PARTICIPACAO, false);
  const props = PropertiesService.getScriptProperties();
  return {
    ok: true,
    planilha: ss.getUrl(),
    tecnico: { estilo: props.getProperty('ESTILO') || '', estiloErro: props.getProperty('ESTILO_ERRO') || '' },
    acoes: acoes.reverse().map(a => {
      const k = a.id.toUpperCase();
      const r3 = c3[k] || {};
      return {
        id: a.id, nome: a.nome, datas: a.datas, local: a.local, coordenacao: a.coordenacao,
        turnos: a.turnos, status: a.encerrada ? 'encerrada' : 'aberta', encerramento: a.encerramento,
        disciplinas: a.disciplinas.map(d => ({ nome: d.nome, instrutores: d.instrutores })),
        turmaTexto: (turmas[k] || []).join('\n'),
        respostas: {
          reacao: (cR[k] || {}).total || 0,
          alunos360: r3['Aluno'] || 0,                  // linhas: uma por instrutor avaliado
          instrutores: r3['Autoavaliação'] || 0,        // uma por instrutor que respondeu
          coordenacao: r3['Coordenação'] || 0,          // uma por instrutor avaliado
          turma: (cT[k] || {}).total || 0,              // alunos cadastrados
          concluiram: (cP[k] || {}).total || 0,         // alunos que concluíram Reação + 360°
          totalInstrutores: a.disciplinas.reduce((s, d) => s.concat(d.instrutores), []).filter((n, i, l) => l.indexOf(n) === i).length,
        },
      };
    }),
  };
}

// ================================== Salvar ==================================
function painelSalvar_(a) {
  const limpa = (v, max) => texto_(v).replace(/\s+/g, ' ').slice(0, max);
  const nome = limpa(a.nome, 200);
  const datas = limpa(a.datas, 100);
  const local = limpa(a.local, 200);
  const coordenacao = limpa(a.coordenacao, 120);
  const turnos = (Array.isArray(a.turnos) ? a.turnos : []).map(t => limpa(t, 40)).filter(String)
    .filter((t, i, l) => l.indexOf(t) === i).slice(0, 8);
  const disciplinas = (Array.isArray(a.disciplinas) ? a.disciplinas : []).map(d => ({
    nome: limpa(d && d.nome, 200),
    instrutores: (Array.isArray(d && d.instrutores) ? d.instrutores : []).map(n => limpa(n, 120)).filter(String)
      .filter((n, i, l) => l.indexOf(n) === i).slice(0, 8),
  })).filter(d => d.nome || d.instrutores.length).slice(0, 40);
  const encerramento = texto_(a.encerramento);
  const listaTurma = a.turma === undefined || a.turma === null ? null : lerListaTurma_(String(a.turma).slice(0, 60000));

  const erros = [];
  if (!nome) erros.push({ id: 'nome', mensagem: 'Informe o nome da ação.' });
  if (!datas) erros.push({ id: 'datas', mensagem: 'Informe a data ou as datas.' });
  if (!turnos.length) erros.push({ id: 'turnos', mensagem: 'Informe ao menos um turno.' });
  if (!disciplinas.length) erros.push({ id: 'disciplinas', mensagem: 'Cadastre ao menos uma disciplina.' });
  disciplinas.forEach((d, i) => {
    if (!d.nome) erros.push({ id: 'disc' + i, mensagem: 'Informe o nome da disciplina ' + (i + 1) + '.' });
    if (!d.instrutores.length) erros.push({ id: 'disc' + i, mensagem: 'Informe ao menos um(a) instrutor(a) na disciplina ' + (i + 1) + '.' });
  });
  let dataEnc = '';
  if (encerramento) {
    const m = encerramento.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) erros.push({ id: 'encerramento', mensagem: 'Data de encerramento inválida.' });
    else dataEnc = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  if (listaTurma && listaTurma.erros.length) {
    erros.push({ id: 'turma', mensagem: listaTurma.erros.slice(0, 5).join(' ') + (listaTurma.erros.length > 5 ? ' (e mais ' + (listaTurma.erros.length - 5) + ')' : '') });
  }
  if (erros.length) return falha_('Revise os campos destacados.', 'validacao', erros);

  const ss = planilha_();
  const shA = ss.getSheetByName(ABAS.ACOES);
  const cabA = garantirColunas_(shA, CAB_ACOES);
  const tA = lerTabela_(shA);
  let id = texto_(a.id);
  let linha = -1;
  if (id) {
    tA.linhas.forEach((l, i) => { if (linha === -1 && mesmoId_(l[tA.idx['ID']], id)) linha = i + 2; });
    if (linha === -1) return falha_('Ação não encontrada. Recarregue o painel.');
  } else {
    id = novoIdAcao_(tA);
  }

  const valores = {
    'ID': id, 'Nome da ação': nome, 'Data(s)': datas, 'Local': local, 'Coordenação': coordenacao,
    'Turnos': turnos.join('; '), 'Data de encerramento': dataEnc,
  };
  if (linha === -1) {
    valores['Status'] = 'aberta';
    linha = Math.max(shA.getLastRow(), 1) + 1;
  }
  Object.keys(valores).forEach(c => {
    const col = cabA.indexOf(c);
    if (col !== -1) shA.getRange(linha, col + 1).setValue(celula_(valores[c]));
  });

  // Disciplinas: troca as linhas desta ação, mantendo as das outras.
  const shD = ss.getSheetByName(ABAS.DISCIPLINAS);
  const cabD = garantirColunas_(shD, CAB_DISCIPLINAS);
  const tD = lerTabela_(shD);
  const outras = tD.linhas.filter(l => !mesmoId_(l[tD.idx['ID da ação']], id));
  const novas = [];
  disciplinas.forEach((d, i) => d.instrutores.forEach(n => {
    const r = new Array(cabD.length).fill('');
    r[cabD.indexOf('ID da ação')] = id;
    r[cabD.indexOf('Nº')] = i + 1;
    r[cabD.indexOf('Disciplina')] = d.nome;
    r[cabD.indexOf('Instrutor(a)')] = n;
    novas.push(r);
  }));
  const todas = outras.map(r => r.map(v => (typeof v === 'string' ? celula_(v) : v))).concat(novas.map(r => r.map(celula_)));
  if (tD.linhas.length) shD.getRange(2, 1, tD.linhas.length, cabD.length).clearContent();
  if (todas.length) shD.getRange(2, 1, todas.length, cabD.length).setValues(todas);

  if (listaTurma) substituirLinhasDaAcao_(ABAS.TURMA, CAB_TURMA, id, listaTurma.alunos.map(x => [id, x.matricula, x.nome]));

  limparCacheDados_();
  return { ok: true, id: id, turma: listaTurma ? listaTurma.alunos.length : undefined };
}

/** Troca, numa aba, as linhas de uma ação pelas novas (mantendo as das outras ações). */
function substituirLinhasDaAcao_(nomeAba, cabecalhos, id, novas) {
  const ss = planilha_();
  const sh = ss.getSheetByName(nomeAba) || prepararAba_(ss, nomeAba, cabecalhos, null);
  const cab = garantirColunas_(sh, cabecalhos);
  const t = lerTabela_(sh);
  const iId = cab.indexOf(cabecalhos[0]);
  const outras = t.linhas.filter(l => !mesmoId_(l[iId], id)).map(r => r.map(v => (typeof v === 'string' ? celula_(v) : v)));
  const novasLinhas = novas.map(n => { const r = new Array(cab.length).fill(''); n.forEach((v, i) => { r[cab.indexOf(cabecalhos[i])] = celula_(v); }); return r; });
  const todas = outras.concat(novasLinhas);
  if (t.linhas.length) sh.getRange(2, 1, t.linhas.length, cab.length).clearContent();
  if (todas.length > sh.getMaxRows() - 1) sh.insertRowsAfter(sh.getMaxRows(), todas.length - sh.getMaxRows() + 101);
  if (todas.length) sh.getRange(2, 1, todas.length, cab.length).setValues(todas);
}

/** Quem da turma já concluiu e quem falta. */
function painelTurma_(id) {
  const acao = carregarAcao_(id);
  if (!acao) return falha_('Ação não encontrada.');
  const turma = turmaDaAcao_(id);
  const part = participantesDaAcao_(id);
  const porMat = {};
  part.forEach(p => { porMat[p.matricula] = p.data; });
  const naTurma = {};
  const alunos = turma.map(a => { naTurma[a.matricula] = true; return { matricula: a.matricula, nome: a.nome, concluiu: !!porMat[a.matricula], data: porMat[a.matricula] || '' }; });
  const foraDaLista = part.filter(p => !naTurma[p.matricula]).map(p => ({ matricula: p.matricula, nome: '', concluiu: true, data: p.data }));
  return { ok: true, alunos: alunos, foraDaLista: foraDaLista, total: turma.length, concluiram: alunos.filter(a => a.concluiu).length + foraDaLista.length };
}

/** Próximo ID no formato AE-2026-001. */
function novoIdAcao_(tA) {
  const ano = Utilities.formatDate(new Date(), FUSO, 'yyyy');
  const prefixo = 'AE-' + ano + '-';
  let maior = 0;
  tA.linhas.forEach(l => {
    const m = texto_(l[tA.idx['ID']]).toUpperCase().match(/^AE-(\d{4})-(\d+)$/);
    if (m && m[1] === ano) maior = Math.max(maior, Number(m[2]));
  });
  return prefixo + ('00' + (maior + 1)).slice(-3);
}

function painelStatus_(id, status) {
  if (status !== 'aberta' && status !== 'encerrada') return falha_('Situação inválida.');
  const sh = planilha_().getSheetByName(ABAS.ACOES);
  const t = lerTabela_(sh);
  let linha = -1;
  t.linhas.forEach((l, i) => { if (linha === -1 && mesmoId_(l[t.idx['ID']], id)) linha = i + 2; });
  if (linha === -1) return falha_('Ação não encontrada.');
  sh.getRange(linha, t.idx['Status'] + 1).setValue(status);
  const celEnc = sh.getRange(linha, t.idx['Data de encerramento'] + 1);
  if (status === 'aberta') {
    const enc = interpretarData_(celEnc.getValue());
    if (enc && new Date() > fimDoDia_(enc)) celEnc.setValue('');
  }
  limparCacheDados_();
  return { ok: true };
}

/** Exclui uma ação só se ela ainda não tiver nenhuma resposta. */
function painelExcluir_(id) {
  if (!id) return falha_('Ação não informada.');
  const ss = planilha_();
  const temResposta = [ABAS.REACAO, ABAS.R360].some(nome => linhasDaAcao_(lerTabela_(ss.getSheetByName(nome)), id).length > 0);
  if (temResposta) return falha_('Esta ação já tem respostas e não pode ser excluída. Se não for mais usada, encerre-a.', 'tem_respostas');
  let achou = false;
  [[ABAS.ACOES, 'ID'], [ABAS.DISCIPLINAS, 'ID da ação'], [ABAS.TURMA, 'ID da ação']].forEach(par => {
    const sh = ss.getSheetByName(par[0]);
    if (!sh) return;
    const t = lerTabela_(sh);
    const ficam = t.linhas.filter(l => !mesmoId_(l[t.idx[par[1]]], id));
    if (ficam.length === t.linhas.length) return;
    if (par[0] === ABAS.ACOES) achou = true;
    sh.getRange(2, 1, t.linhas.length, t.cab.length).clearContent();
    if (ficam.length) sh.getRange(2, 1, ficam.length, t.cab.length)
      .setValues(ficam.map(r => r.map(v => (typeof v === 'string' ? celula_(v) : v))));
  });
  if (!achou) return falha_('Ação não encontrada.');
  limparCacheDados_();
  return { ok: true };
}

// ================================ Resultados ================================
function painelResultados_(id) {
  const acao = lerAcao_(id);
  if (!acao) return falha_('Ação não encontrada.');
  const ss = planilha_();
  const tR = lerTabela_(ss.getSheetByName(ABAS.REACAO));
  const t3 = lerTabela_(ss.getSheetByName(ABAS.R360));
  const num = a => (typeof a === 'number' ? a : null);
  const med = a => num(media_(a));
  const textos = (t, linhas, cab) => coluna_(t, linhas, cab).map(texto_).filter(String);

  // ---------- Reação ----------
  const lR = linhasDaAcao_(tR, id);
  const cabR = {};
  colunasReacao_(acao.disciplinas.map(d => idSeguro_(d.numero))).forEach(c => { cabR[c[0]] = c[1]; });
  const itensR = ITENS_ACAO.map((txt, i) => ['acao_' + (i + 1), txt, 'Ação'])
    .concat(ITENS_APLICACAO.map((txt, i) => ['aplic_' + (i + 1), txt, 'Aplicação no trabalho']))
    .map(it => {
      const vals = coluna_(tR, lR, cabR[it[0]]);
      const n = numeros_(vals);
      return { texto: it[1], grupo: it[2], media: med(n), n: n.length,
        na: vals.filter(v => texto_(v) === ROTULO_NA_PLANILHA).length,
        concordam: n.length ? arred_(100 * n.filter(v => v >= 4).length / n.length, 0) : null };
    });
  const rec = numeros_(coluna_(tR, lR, cabR.recomendacao));
  const pct = f => (rec.length ? arred_(100 * rec.filter(f).length / rec.length, 0) : null);
  const nps = rec.length ? { n: rec.length, media: med(rec), promotores: pct(v => v >= 9), neutros: pct(v => v >= 7 && v <= 8),
    detratores: pct(v => v <= 6) } : { n: 0 };
  if (rec.length) nps.nps = nps.promotores - nps.detratores;
  const ganho = acao.disciplinas.map(d => {
    const n = idSeguro_(d.numero);
    const iA = tR.idx[cabAntes_(n)], iD = tR.idx[cabDepois_(n)];
    const pares = lR.map(l => [iA === undefined ? '' : l[iA], iD === undefined ? '' : l[iD]])
      .filter(p => typeof p[0] === 'number' && typeof p[1] === 'number');
    const antes = med(pares.map(p => p[0])), depois = med(pares.map(p => p[1]));
    return { disciplina: d.numero + ' – ' + d.nome, antes: antes, depois: depois,
      ganho: antes !== null && depois !== null ? arred_(depois - antes, 2) : null, n: pares.length };
  });
  const marcadas = coluna_(tR, lR, cabR.dificuldades).map(v => texto_(v).split('; ').filter(String));
  const dificuldades = DIFICULDADES.concat(['Outra']).map(op => {
    const c = marcadas.filter(m => m.indexOf(op) !== -1).length;
    return { opcao: op, n: c, pct: lR.length ? arred_(100 * c / lR.length, 0) : 0 };
  });

  // ---------- 360° ----------
  const l3 = linhasDaAcao_(t3, id);
  const cab3 = {};
  colunas360_().forEach(c => { cab3[c[0]] = c[1]; });
  const iP = t3.idx[cab3._perspectiva], iI = t3.idx[cab3._instrutor], iAv = t3.idx[cab3._avaliador];
  const daPersp = (ls, p) => ls.filter(l => texto_(l[iP]) === p);
  const autos = daPersp(l3, 'Autoavaliação');
  const nomes = acao.instrutores.slice();
  l3.forEach(l => { const n = texto_(l[iI]); if (n && nomes.indexOf(n) === -1 && texto_(l[iP]) !== 'Autoavaliação') nomes.push(n); });

  const instrutores = nomes.map(nome => {
    const doInst = l3.filter(l => texto_(l[iI]) === nome);
    const porP = PERSPECTIVAS.map(p => daPersp(doInst, p));
    const todos = PERSPECTIVAS.map(() => []);
    const criterios = CRITERIOS_DOCENTE.map((txt, i) => {
      const valores = porP.map((ls, k) => { const n = numeros_(coluna_(t3, ls, cab3['c' + (i + 1)])); Array.prototype.push.apply(todos[k], n); return med(n); });
      return { texto: txt, valores: valores, geral: med(valores.filter(v => v !== null)) };
    });
    const geral = todos.map(med);
    const outras = med([geral[0], geral[1], geral[3]].filter(v => v !== null));
    return {
      nome: nome, disciplinas: disciplinasDoInstrutor_(acao, nome),
      avaliacoes: porP.map(ls => ls.length),
      criterios: criterios,
      geral: geral,
      mediaPerspectivas: med(geral.filter(v => v !== null)),
      diferencaAuto: geral[2] !== null && outras !== null ? arred_(geral[2] - outras, 2) : null,
      colaboracao: med(numeros_(coluna_(t3, porP[3], cab3.c9))),
      compromissos: COMPROMISSOS.map((txt, i) => ({ texto: txt, media: med(numeros_(coluna_(t3, porP[1], cab3['comp' + (i + 1)]))) })),
      comentarios: {
        alunos: textos(t3, porP[0], cab3.coment_aluno),
        coordenacao: textos(t3, porP[1], cab3.obs_coord),
        pares: textos(t3, porP[3], cab3.pa_coment),
      },
    };
  });

  const iTurno = t3.idx[cab3.turno];
  const turnos = acao.turnos.slice();
  autos.forEach(l => { const x = iTurno === undefined ? '' : texto_(l[iTurno]); if (x && turnos.indexOf(x) === -1) turnos.push(x); });

  return {
    ok: true,
    acao: { id: acao.id, nome: acao.nome, datas: acao.datas, local: acao.local, status: acao.encerrada ? 'encerrada' : 'aberta' },
    reacao: {
      n: lR.length, itens: itensR, nps: nps, ganho: ganho, dificuldades: dificuldades,
      comentarios: {
        contribuiu: textos(tR, lR, cabR.aberta_contribuiu),
        melhorar: textos(tR, lR, cabR.aberta_melhorar),
        temas: textos(tR, lR, cabR.aberta_temas),
        outraDificuldade: textos(tR, lR, cabR.dificuldades_outra),
      },
    },
    r360: {
      perspectivas: PERSPECTIVAS,
      envios: {
        alunos: Object.keys(daPersp(l3, 'Aluno').reduce((o, l) => { o[texto_(l[t3.idx[cab3._envio]])] = 1; return o; }, {})).length,
        instrutores: autos.length, totalInstrutores: acao.instrutores.length,
        coordenacao: daPersp(l3, 'Coordenação').length,
      },
      instrutores: instrutores,
      curso: ITENS_CURSO.map((txt, i) => ({ texto: txt, media: med(numeros_(coluna_(t3, autos, cab3['curso' + (i + 1)]))) })),
      coordenacao: ITENS_COORDENACAO.map((txt, i) => ({ texto: txt, media: med(numeros_(coluna_(t3, autos, cab3['coord' + (i + 1)]))) })),
      turma: {
        turnos: turnos,
        itens: ITENS_TURMA.map((txt, i) => ({
          texto: txt,
          porTurno: turnos.map(tn => med(numeros_(coluna_(t3, autos.filter(l => texto_(l[iTurno]) === tn), cab3['turma' + (i + 1)])))),
          geral: med(numeros_(coluna_(t3, autos, cab3['turma' + (i + 1)]))),
        })),
      },
      relatos: autos.filter(l => texto_(l[t3.idx[cab3.relato]])).map(l => ({
        texto: texto_(l[t3.idx[cab3.relato]]), instrutor: texto_(l[iAv]), turno: iTurno === undefined ? '' : texto_(l[iTurno]) })),
      comentariosCoordenacao: textos(t3, autos, cab3.coment_coord),
      participacao: textos(t3, autos, cab3.au_participacao),
      sugestoes: textos(t3, autos, cab3.au_sugestoes),
    },
  };
}

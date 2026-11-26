/**
 * Consolidado.gs — Consolidação das avaliações para o relatório da coordenação
 * (Portaria SEAPE nº 80/2025, art. 48, § 2º).
 *
 * Regras:
 *  - "Não se aplica" não entra em nenhuma média (só valores numéricos contam).
 *  - 360°: médias por instrutor e por perspectiva (aluno, coordenação, autoavaliação, pares).
 *  - "Média das perspectivas" = média simples das perspectivas que têm dados,
 *    para que o grande número de alunos não apague as demais visões.
 */

const LARGURA_CONSOLIDADO = 6;
const SEM_DADO = '—';

function atualizarConsolidado() {
  const ss = planilha_();
  const sh = ss.getSheetByName(ABAS.CONSOLIDADO) || ss.insertSheet(ABAS.CONSOLIDADO);
  const reac = lerTabela_(ss.getSheetByName(ABAS.REACAO));
  const r360 = lerTabela_(ss.getSheetByName(ABAS.R360));
  const out = novaSaida_();

  out.linha(['CONSOLIDADO DAS AVALIAÇÕES – APPDF'], 'titulo');
  out.linha(['Atualizado em ' + Utilities.formatDate(new Date(), FUSO, "dd/MM/yyyy 'às' HH:mm") +
    '. Escalas de 1 a 5 (recomendação de 0 a 10). Respostas "Não se aplica" não entram nas médias.'], 'nota');
  out.vazia();

  const acoes = listarAcoes_();
  if (!acoes.length) out.linha(['Nenhuma ação cadastrada na aba "' + ABAS.ACOES + '".'], 'nota');
  acoes.forEach(a => {
    const acao = carregarAcao_(a.id);
    if (acao) blocoAcao_(out, acao, reac, r360);
  });

  escreverSaida_(sh, out);
  avisar_('Consolidado atualizado.');
  return out.linhas.length;
}

// ================================ Blocos ================================
function blocoAcao_(out, acao, reac, r360) {
  out.linha([acao.id + ' – ' + acao.nome], 'acao');
  out.linha([[
    acao.datas ? 'Data(s): ' + acao.datas : '',
    acao.local ? 'Local: ' + acao.local : '',
    acao.coordenacao ? 'Coordenação: ' + acao.coordenacao : '',
    'Status: ' + (acao.encerrada ? 'encerrada' : 'aberta'),
  ].filter(String).join('  |  ')], 'nota');
  out.vazia();
  blocoReacao_(out, acao, reac);
  out.vazia();
  bloco360_(out, acao, r360);
  out.vazia();
  out.vazia();
}

function blocoReacao_(out, acao, t) {
  const linhas = linhasDaAcao_(t, acao.id);
  out.linha(['AVALIAÇÃO DE REAÇÃO', 'Respostas: ' + linhas.length], 'secao');
  if (!linhas.length) { out.linha(['Ainda não há respostas para esta ação.'], 'nota'); return; }
  const cab = {};
  colunasReacao_(acao.disciplinas.map(d => idSeguro_(d.numero))).forEach(c => { cab[c[0]] = c[1]; });

  out.linha(['Afirmação', 'Média (1 a 5)', 'Respostas válidas', 'Não se aplica', '% Concordo ou Concordo totalmente'], 'cab');
  const itens = ITENS_ACAO.map((txt, i) => ['acao_' + (i + 1), 'A' + (i + 1) + '. ' + txt])
    .concat(ITENS_APLICACAO.map((txt, i) => ['aplic_' + (i + 1), 'Aplicação ' + (i + 1) + '. ' + txt]));
  itens.forEach(it => {
    const vals = coluna_(t, linhas, cab[it[0]]);
    const n = numeros_(vals);
    const na = vals.filter(v => texto_(v) === ROTULO_NA_PLANILHA).length;
    const conc = n.filter(v => v >= 4).length;
    out.linha([it[1], media_(n), n.length, na, n.length ? arred_(100 * conc / n.length, 1) : SEM_DADO]);
  });

  // Recomendação (NPS)
  out.vazia();
  const rec = numeros_(coluna_(t, linhas, cab.recomendacao));
  out.linha(['Recomendação (0 a 10)', 'Média', '% Promotores (9–10)', '% Neutros (7–8)', '% Detratores (0–6)', 'NPS'], 'cab');
  if (rec.length) {
    const pct = f => arred_(100 * rec.filter(f).length / rec.length, 1);
    const prom = pct(v => v >= 9), neut = pct(v => v >= 7 && v <= 8), detr = pct(v => v <= 6);
    out.linha(['Respostas: ' + rec.length, media_(rec), prom, neut, detr, arred_(prom - detr, 0)]);
  } else {
    out.linha(['Respostas: 0', SEM_DADO, SEM_DADO, SEM_DADO, SEM_DADO, SEM_DADO]);
  }

  // Ganho de competência (autoavaliação retrospectiva)
  out.vazia();
  out.linha(['Ganho de competência por disciplina', 'Média ANTES', 'Média DEPOIS', 'Ganho (depois − antes)', 'Respostas'], 'cab');
  if (!acao.disciplinas.length) out.linha(['Nenhuma disciplina cadastrada.'], 'nota');
  acao.disciplinas.forEach(d => {
    const n = idSeguro_(d.numero);
    const iA = t.idx[cabAntes_(n)], iD = t.idx[cabDepois_(n)];
    const pares = linhas
      .map(l => [iA === undefined ? '' : l[iA], iD === undefined ? '' : l[iD]])
      .filter(p => typeof p[0] === 'number' && typeof p[1] === 'number');
    const antes = pares.map(p => p[0]), depois = pares.map(p => p[1]);
    const ganho = pares.length ? arred_(somar_(depois) / pares.length - somar_(antes) / pares.length, 2) : SEM_DADO;
    out.linha([d.numero + ' – ' + d.nome, media_(antes), media_(depois), ganho, pares.length]);
  });

  // Dificuldades
  out.vazia();
  out.linha(['O que pode dificultar a aplicação do conteúdo', 'Respostas', '% dos respondentes'], 'cab');
  const marcadas = coluna_(t, linhas, cab.dificuldades).map(v => texto_(v).split('; ').filter(String));
  DIFICULDADES.concat(['Outra']).forEach(op => {
    const c = marcadas.filter(m => m.indexOf(op) !== -1).length;
    out.linha([op, c, arred_(100 * c / linhas.length, 1)]);
  });
}

function bloco360_(out, acao, t) {
  const linhas = linhasDaAcao_(t, acao.id);
  out.linha(['AVALIAÇÃO 360° DO CORPO DOCENTE', 'Avaliações: ' + linhas.length], 'secao');
  if (!linhas.length) { out.linha(['Ainda não há respostas para esta ação.'], 'nota'); return; }

  const cab = {};
  colunas360_().forEach(c => { cab[c[0]] = c[1]; });
  const iPersp = t.idx[cab._perspectiva], iInst = t.idx[cab._instrutor];
  const perspectivas = PERSPECTIVAS;                          // Aluno, Coordenação, Autoavaliação, Pares
  const rotulosPersp = ['Alunos', 'Coordenação', 'Autoavaliação', 'Pares'];

  out.linha(['Avaliações recebidas'].concat(rotulosPersp), 'cab');
  out.linha(['Total'].concat(perspectivas.map(p => linhas.filter(l => texto_(l[iPersp]) === p).length)));

  const nomes = acao.instrutores.slice();
  linhas.forEach(l => { const n = texto_(l[iInst]); if (n && nomes.indexOf(n) === -1) nomes.push(n); });

  nomes.forEach(nome => {
    const doInst = linhas.filter(l => texto_(l[iInst]) === nome);
    const porPersp = perspectivas.map(p => doInst.filter(l => texto_(l[iPersp]) === p));
    const disc = disciplinasDoInstrutor_(acao, nome);
    out.vazia();
    out.linha(['Instrutor(a): ' + nome + (disc ? '  |  Disciplina(s): ' + disc : '')], 'sub');
    out.linha(['Critério'].concat(rotulosPersp, ['Média das perspectivas']), 'cab');

    const todasCrit = perspectivas.map(() => []);
    CRITERIOS_DOCENTE.forEach((txt, i) => {
      const h = cab['c' + (i + 1)];
      const medias = porPersp.map((ls, k) => {
        const n = numeros_(coluna_(t, ls, h));
        Array.prototype.push.apply(todasCrit[k], n);
        return media_(n);
      });
      out.linha(['C' + (i + 1) + '. ' + txt].concat(medias, [mediaDasMedias_(medias)]));
    });
    const geral = todasCrit.map(media_);
    out.linha(['Média dos 8 critérios'].concat(geral, [mediaDasMedias_(geral)]), 'total');
    out.linha(['Nº de avaliações'].concat(porPersp.map(ls => ls.length), ['']));
    const colab = media_(numeros_(coluna_(t, porPersp[3], cab.c9)));
    out.linha(['C9. ' + CRITERIO_COLABORACAO + ' (somente pares)', SEM_DADO, SEM_DADO, SEM_DADO, colab, '']);
    const auto = geral[2];
    const outras = mediaDasMedias_([geral[0], geral[1], geral[3]]);
    out.linha(['Diferença: autoavaliação − média das demais perspectivas',
      '', '', '', '', (typeof auto === 'number' && typeof outras === 'number') ? arred_(auto - outras, 2) : SEM_DADO]);

    out.linha(['Compromissos institucionais (coordenação)', 'Média', 'Respostas válidas'], 'cab');
    COMPROMISSOS.forEach((txt, i) => {
      const n = numeros_(coluna_(t, porPersp[1], cab['comp' + (i + 1)]));
      out.linha([txt, media_(n), n.length]);
    });
  });

  // Avaliação do curso pelos docentes (item 12 do Plano de Capacitação)
  out.vazia();
  const autos = linhas.filter(l => texto_(l[iPersp]) === 'Autoavaliação');
  out.linha(['Avaliação do curso pelos docentes', 'Média', 'Respostas válidas'], 'cab');
  ITENS_CURSO.forEach((txt, i) => {
    const n = numeros_(coluna_(t, autos, cab['curso' + (i + 1)]));
    out.linha([txt, media_(n), n.length]);
  });

  // Avaliação da coordenação pelos instrutores
  out.vazia();
  out.linha(['Avaliação da coordenação pelos instrutores', 'Média', 'Respostas válidas'], 'cab');
  ITENS_COORDENACAO.forEach((txt, i) => {
    const n = numeros_(coluna_(t, autos, cab['coord' + (i + 1)]));
    out.linha([txt, media_(n), n.length]);
  });

  // Avaliação da turma, por turno
  out.vazia();
  const iTurno = t.idx[cab.turno];
  const turnos = acao.turnos.slice();
  autos.forEach(l => { const x = iTurno === undefined ? '' : texto_(l[iTurno]); if (x && turnos.indexOf(x) === -1) turnos.push(x); });
  const colTurnos = turnos.slice(0, LARGURA_CONSOLIDADO - 2);
  out.linha(['Avaliação da turma pelos instrutores (por turno)'].concat(colTurnos, ['Geral']), 'cab');
  ITENS_TURMA.forEach((txt, i) => {
    const h = cab['turma' + (i + 1)];
    const porTurno = colTurnos.map(tn => media_(numeros_(coluna_(t, autos.filter(l => texto_(l[iTurno]) === tn), h))));
    out.linha([txt].concat(porTurno, [media_(numeros_(coluna_(t, autos, h)))]));
  });

  // Relatos de situações em sala
  out.vazia();
  const iRel = t.idx[cab.relato], iAv = t.idx[cab._avaliador];
  const relatos = autos.filter(l => iRel !== undefined && texto_(l[iRel]));
  out.linha(['Relatos de situação ocorrida em sala', 'Instrutor(a)', 'Turno'], 'cab');
  if (!relatos.length) out.linha(['Nenhum relato registrado.'], 'nota');
  relatos.forEach(l => out.linha([texto_(l[iRel]), texto_(l[iAv]), iTurno === undefined ? '' : texto_(l[iTurno])]));
}

// =============================== Cálculos ===============================
function linhasDaAcao_(t, id) {
  const i = t.idx['ID da ação'];
  if (i === undefined) return [];
  return t.linhas.filter(l => mesmoId_(l[i], id));
}
function coluna_(t, linhas, cabecalho) {
  const i = t.idx[cabecalho];
  return i === undefined ? [] : linhas.map(l => l[i]);
}
/** Apenas números: "Não se aplica" e células vazias ficam de fora. */
function numeros_(vals) { return vals.filter(v => typeof v === 'number' && isFinite(v)); }
function somar_(a) { return a.reduce((s, v) => s + v, 0); }
function arred_(v, casas) { const f = Math.pow(10, casas); return Math.round(v * f) / f; }
function media_(a) { return a.length ? arred_(somar_(a) / a.length, 2) : SEM_DADO; }
function mediaDasMedias_(a) { return media_(a.filter(v => typeof v === 'number')); }

// =============================== Escrita ===============================
function novaSaida_() {
  return {
    linhas: [],
    tipos: [],
    linha(valores, tipo) { this.linhas.push(valores); this.tipos.push(tipo || 'dado'); },
    vazia() { this.linha([''], 'vazia'); },
  };
}

function escreverSaida_(sh, out) {
  sh.clear();
  const W = LARGURA_CONSOLIDADO;
  const dados = out.linhas.map(l => {
    const r = l.slice(0, W).map(v => (typeof v === 'string' ? celula_(v) : v));
    while (r.length < W) r.push('');
    return r;
  });
  sh.getRange(1, 1, dados.length, W).setValues(dados)
    .setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle').setFontColor(COR.texto);
  sh.getRange(1, 2, dados.length, W - 1).setHorizontalAlignment('center');
  sh.setColumnWidth(1, 460);
  sh.setColumnWidths(2, W - 1, 135);
  sh.getRange(1, 1, dados.length, 1).setWrap(true);

  const faixas = tipo => out.tipos
    .map((t, i) => (t === tipo ? 'A' + (i + 1) + ':' + String.fromCharCode(64 + W) + (i + 1) : null))
    .filter(Boolean);
  const aplicar = (tipo, fn) => { const a = faixas(tipo); if (a.length) fn(sh.getRangeList(a)); };

  aplicar('titulo', r => r.setFontSize(16).setFontWeight('bold').setFontColor(COR.primaria));
  aplicar('nota', r => r.setFontStyle('italic').setFontColor(COR.suave));
  aplicar('acao', r => r.setBackground(COR.primaria).setFontColor(COR.ouroVivo).setFontWeight('bold').setFontSize(12)
    .setBorder(null, null, true, null, null, null, COR.ouro, SpreadsheetApp.BorderStyle.SOLID_MEDIUM));
  aplicar('secao', r => r.setBackground(COR.ouroClaro).setFontColor(COR.ouroTexto).setFontWeight('bold'));
  aplicar('sub', r => r.setFontWeight('bold').setFontColor(COR.texto).setBackground(COR.superficie));
  aplicar('cab', r => r.setFontWeight('bold').setBackground('#ECE8DF').setFontColor(COR.texto).setWrap(true)
    .setBorder(null, null, true, null, null, null, COR.ouro, SpreadsheetApp.BorderStyle.SOLID));
  aplicar('total', r => r.setFontWeight('bold'));
  sh.setFrozenRows(2);
  try { sh.setHiddenGridlines(true); } catch (e) { /* versão antiga */ }
  sh.setTabColor('#7A5A1E');
}

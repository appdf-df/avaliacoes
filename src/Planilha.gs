/**
 * Planilha.gs — Criação da planilha (setup), leitura dos cadastros e menu.
 */

// Paleta da Polícia Penal do DF (a mesma do site e do painel)
const COR = {
  primaria: '#0F0F0F',     // preto do distintivo
  ouro: '#C9A55C',
  ouroVivo: '#DDBE78',
  ouroTexto: '#6B4E16',    // dourado escuro, legível sobre fundo claro
  ouroClaro: '#F4EBD4',
  superficie: '#F4F2ED',
  faixa: '#FAF7F0',        // linhas alternadas
  texto: '#18181B',
  suave: '#57534E',
  borda: '#E3DED3',
  branco: '#FFFFFF',
};

const CAB_ACOES = ['ID', 'Nome da ação', 'Data(s)', 'Local', 'Coordenação', 'Turnos', 'Status',
                   'Data de encerramento', 'Link – Reação', 'Link – 360°'];
const CAB_DISCIPLINAS = ['ID da ação', 'Nº', 'Disciplina', 'Instrutor(a)'];
const CAB_UNIDADES = ['Unidade'];

const UNIDADES_PADRAO = ['SEAPE (sede)', 'PDF I', 'PDF II', 'PDF IV', 'PFDF', 'CPP', 'CDP', 'CIR',
                         'DPOE', 'CIME', 'GCO', 'APPDF', 'Outra'];
const TURNOS_PADRAO = ['Matutino', 'Vespertino', 'Ambos os turnos'];

// ===================================== SETUP =====================================
/**
 * Cria (ou completa) a planilha "APPDF – Avaliações" com todas as abas.
 * Pode ser executada mais de uma vez: não apaga dados já cadastrados.
 */
function setup() {
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  if (!ss) {
    const id = PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');
    if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  }
  if (!ss) ss = SpreadsheetApp.create(NOME_PLANILHA);
  if (/^(Planilha sem título|Untitled spreadsheet)/i.test(ss.getName())) ss.rename(NOME_PLANILHA);

  const acoes = prepararAba_(ss, ABAS.ACOES, CAB_ACOES, [110, 320, 120, 220, 180, 230, 100, 150, 320, 320]);
  const disc = prepararAba_(ss, ABAS.DISCIPLINAS, CAB_DISCIPLINAS, [110, 50, 380, 240]);
  const unid = prepararAba_(ss, ABAS.UNIDADES, CAB_UNIDADES, [240]);
  const reac = prepararAba_(ss, ABAS.REACAO, cabecalhosReacao_(3), null);
  const r360 = prepararAba_(ss, ABAS.R360, colunas360_().map(c => c[1]), null);
  const turma = prepararAba_(ss, ABAS.TURMA, CAB_TURMA, [120, 160, 320]);
  const part = prepararAba_(ss, ABAS.PARTICIPACAO, CAB_PARTICIPACAO, [120, 160, 120]);
  const cons = ss.getSheetByName(ABAS.CONSOLIDADO) || ss.insertSheet(ABAS.CONSOLIDADO);

  // Validações de preenchimento na aba Acoes
  const regraStatus = SpreadsheetApp.newDataValidation()
      .requireValueInList(['aberta', 'encerrada'], true).setAllowInvalid(false).build();
  acoes.getRange(2, CAB_ACOES.indexOf('Status') + 1, 999, 1).setDataValidation(regraStatus);
  const regraData = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false)
      .setHelpText('Informe uma data (dd/mm/aaaa). Após essa data a avaliação fica encerrada.').build();
  acoes.getRange(2, CAB_ACOES.indexOf('Data de encerramento') + 1, 999, 1)
      .setDataValidation(regraData).setNumberFormat('dd/mm/yyyy');
  acoes.getRange(2, CAB_ACOES.indexOf('Data(s)') + 1, 999, 1).setNumberFormat('@');
  acoes.getRange(2, 1, 999, 1).setNumberFormat('@');
  disc.getRange(2, 1, 999, 1).setNumberFormat('@');

  // Unidades padrão
  if (unid.getLastRow() < 2) {
    unid.getRange(2, 1, UNIDADES_PADRAO.length, 1).setValues(UNIDADES_PADRAO.map(u => [u]));
  }

  // Ação de exemplo (somente nomes genéricos)
  if (acoes.getLastRow() < 2) {
    acoes.getRange(2, 1, 1, 8).setValues([[
      'EXEMPLO-01', 'Ação Educacional de Exemplo', '01/12/2026', 'Auditório da Academia da Polícia Penal',
      'Coordenador(a) 1', TURNOS_PADRAO.join('; '), 'aberta', '',
    ]]);
  }
  if (disc.getLastRow() < 2) {
    disc.getRange(2, 1, 3, 4).setValues([
      ['EXEMPLO-01', 1, 'Disciplina 1', 'Instrutor(a) 1'],
      ['EXEMPLO-01', 2, 'Disciplina 2', 'Instrutor(a) 2'],
      ['EXEMPLO-01', 2, 'Disciplina 2', 'Instrutor(a) 3'],
    ]);
  }

  // Remove a aba vazia criada por padrão
  ['Página1', 'Sheet1', 'Planilha1'].forEach(nome => {
    const sh = ss.getSheetByName(nome);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  // Ordem das abas
  try {
    [acoes, disc, unid, turma, reac, r360, part, cons].forEach((sh, i) => {
      ss.setActiveSheet(sh);
      ss.moveActiveSheet(i + 1);
    });
  } catch (e) { /* ordem das abas é só estética */ }
  try { ss.setActiveSheet(acoes); } catch (e) { /* sem interface (primeiro acesso pelo app) */ }

  PropertiesService.getScriptProperties().setProperty('ESQUEMA', VERSAO_ESQUEMA);
  // Gravado por último: indica que a instalação terminou.
  PropertiesService.getScriptProperties().setProperty('PLANILHA_ID', ss.getId());
  aplicarEstilo_(ss);
  limparCacheDados_();
  Logger.log('Planilha pronta: ' + ss.getUrl());
  avisar_('Planilha "' + ss.getName() + '" pronta. Cadastre as ações na aba "Acoes".');
  return ss.getUrl();
}

/** Cria a aba se não existir, grava/completa o cabeçalho e aplica o estilo. */
function prepararAba_(ss, nome, cabecalhos, larguras) {
  const sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
  garantirColunas_(sh, cabecalhos);
  const n = sh.getLastColumn();
  estilizarCabecalho_(sh.getRange(1, 1, 1, n));
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 42);
  if (larguras) larguras.forEach((w, i) => sh.setColumnWidth(i + 1, w));
  else sh.setColumnWidths(1, n, 170);
  return sh;
}

/** Acrescenta ao final do cabeçalho as colunas que ainda não existem. */
function garantirColunas_(sh, cabecalhos) {
  const ultima = sh.getLastColumn();
  const atuais = ultima ? sh.getRange(1, 1, 1, ultima).getValues()[0].map(String) : [];
  const faltando = cabecalhos.filter(c => atuais.indexOf(c) === -1);
  if (faltando.length) {
    const inicio = atuais.filter(String).length ? ultima + 1 : 1;
    sh.getRange(1, inicio, 1, faltando.length).setValues([faltando]);
    estilizarCabecalho_(sh.getRange(1, inicio, 1, faltando.length));
  }
  const total = sh.getLastColumn();
  return sh.getRange(1, 1, 1, total).getValues()[0].map(String);
}

/**
 * Atualiza a aba Respostas_360 quando a estrutura do formulário muda.
 * Se ela só tiver respostas de teste (ação EXEMPLO-01), é recriada limpa;
 * se tiver respostas reais, só ganha as colunas novas no final.
 */
const VERSAO_ESQUEMA = '4';
function migrarEsquema_() {
  const props = PropertiesService.getScriptProperties();
  const atual = Number(props.getProperty('ESQUEMA') || 0);
  if (atual >= Number(VERSAO_ESQUEMA)) return;
  const ss = planilha_();
  // v3: novas colunas do 360° (aba recriada só se tiver apenas respostas de teste)
  if (atual < 3) {
    const sh = ss.getSheetByName(ABAS.R360);
    const cabs = colunas360_().map(c => c[1]);
    if (sh) {
      const t = lerTabela_(sh);
      const iA = t.idx['ID da ação'];
      const soTeste = t.linhas.every(l => iA === undefined || !texto_(l[iA]) || mesmoId_(l[iA], 'EXEMPLO-01'));
      if (soTeste) { sh.clear(); prepararAba_(ss, ABAS.R360, cabs, null); }
      else garantirColunas_(sh, cabs);
    }
  }
  // v4: abas da turma e da participação (avaliação obrigatória do aluno)
  if (atual < 4) {
    if (!ss.getSheetByName(ABAS.TURMA)) prepararAba_(ss, ABAS.TURMA, CAB_TURMA, [120, 160, 320]);
    if (!ss.getSheetByName(ABAS.PARTICIPACAO)) prepararAba_(ss, ABAS.PARTICIPACAO, CAB_PARTICIPACAO, [120, 160, 120]);
    props.deleteProperty('ESTILO');   // reaplica o visual incluindo as abas novas
  }
  props.setProperty('ESQUEMA', VERSAO_ESQUEMA);
  limparCacheDados_();
}

// ================================ ACESSO AOS DADOS ================================
function planilha_() {
  const id = PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Planilha não configurada. Execute a função setup() no editor.');
  return ss;
}

/** Lê uma aba inteira: { cab: [...], idx: {cabecalho: coluna}, linhas: [[...]], exibir: [[...]] } */
function lerTabela_(sh, comExibicao) {
  if (!sh || sh.getLastRow() < 1 || sh.getLastColumn() < 1) return { cab: [], idx: {}, linhas: [], exibir: [] };
  const rng = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn());
  const valores = rng.getValues();
  const exibir = comExibicao ? rng.getDisplayValues() : [];
  const cab = valores.shift().map(c => String(c).trim());
  if (comExibicao) exibir.shift();
  const idx = {};
  cab.forEach((c, i) => { if (c && !(c in idx)) idx[c] = i; });
  return { cab: cab, idx: idx, linhas: valores, exibir: exibir };
}

function texto_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function mesmoId_(a, b) { return texto_(a).toUpperCase() === texto_(b).toUpperCase(); }

/** Lista todas as ações cadastradas (para o consolidado). */
function listarAcoes_() {
  const t = lerTabela_(planilha_().getSheetByName(ABAS.ACOES), true);
  return t.linhas.map((_, i) => i)
    .filter(i => texto_(t.linhas[i][t.idx['ID']]))
    .map(i => montarAcao_(t, i));
}

function montarAcao_(t, i) {
  const v = (c) => t.linhas[i][t.idx[c]];
  const ex = (c) => texto_(t.exibir[i][t.idx[c]]);
  const status = texto_(v('Status')).toLowerCase();
  const enc = interpretarData_(v('Data de encerramento'));
  const encerradaPorData = enc ? (new Date() > fimDoDia_(enc)) : false;
  return {
    id: texto_(v('ID')),
    nome: ex('Nome da ação'),
    datas: ex('Data(s)'),
    local: ex('Local'),
    coordenacao: ex('Coordenação'),
    turnos: ex('Turnos').split(/[;\n]/).map(s => s.trim()).filter(String),
    status: status || 'aberta',
    encTs: enc ? fimDoDia_(enc).getTime() : 0,
    encerrada: status.indexOf('encerr') === 0 || encerradaPorData,
    linha: i + 2,
  };
}

/**
 * Carrega a ação pelo ID com disciplinas, instrutores e unidades.
 * Retorna null se a ação não existir.
 */
function carregarAcao_(id) {
  id = texto_(id);
  if (!id || id.length > 60) return null;
  // Cache do cadastro (limpo a cada edição); "encerrada" é recalculada na hora.
  let cache = null, chave = '';
  try {
    cache = CacheService.getScriptCache();
    chave = 'acao:' + (cache.get('dados_ver') || '0') + ':' + id.toUpperCase();
    const salvo = cache.get(chave);
    if (salvo) {
      const a = JSON.parse(salvo);
      a.encerrada = a.status.indexOf('encerr') === 0 || (a.encTs ? Date.now() > a.encTs : false);
      return a;
    }
  } catch (e) { cache = null; }
  const acao = lerAcao_(id);
  if (acao && cache) { try { cache.put(chave, JSON.stringify(acao), 600); } catch (e) { /* grande demais */ } }
  return acao;
}

function lerAcao_(id) {
  if (!id || id.length > 60) return null;
  const ss = planilha_();
  const t = lerTabela_(ss.getSheetByName(ABAS.ACOES), true);
  let acao = null;
  for (let i = 0; i < t.linhas.length; i++) {
    if (mesmoId_(t.linhas[i][t.idx['ID']], id)) { acao = montarAcao_(t, i); break; }
  }
  if (!acao) return null;
  if (!acao.turnos.length) acao.turnos = TURNOS_PADRAO.slice();

  // Disciplinas e instrutores (um instrutor por linha)
  const d = lerTabela_(ss.getSheetByName(ABAS.DISCIPLINAS), true);
  const porNumero = {};
  const ordem = [];
  d.linhas.forEach((ln, i) => {
    if (!mesmoId_(ln[d.idx['ID da ação']], acao.id)) return;
    const numero = texto_(d.exibir[i][d.idx['Nº']]);
    const nome = texto_(d.exibir[i][d.idx['Disciplina']]);
    const instrutor = texto_(d.exibir[i][d.idx['Instrutor(a)']]);
    if (!numero || !nome) return;
    if (!porNumero[numero]) { porNumero[numero] = { numero: numero, nome: nome, instrutores: [] }; ordem.push(numero); }
    if (instrutor && porNumero[numero].instrutores.indexOf(instrutor) === -1) porNumero[numero].instrutores.push(instrutor);
  });
  ordem.sort((a, b) => (Number(a) - Number(b)) || a.localeCompare(b));
  acao.disciplinas = ordem.map(n => porNumero[n]);
  acao.instrutores = [];
  acao.disciplinas.forEach(di => di.instrutores.forEach(n => {
    if (acao.instrutores.indexOf(n) === -1) acao.instrutores.push(n);
  }));

  const u = lerTabela_(ss.getSheetByName(ABAS.UNIDADES), true);
  acao.unidades = u.exibir.map(r => texto_(r[0])).filter(String);
  if (!acao.unidades.length) acao.unidades = UNIDADES_PADRAO.slice();
  return acao;
}

function disciplinasDoInstrutor_(acao, nome) {
  return acao.disciplinas.filter(d => d.instrutores.indexOf(nome) !== -1)
    .map(d => d.numero + ' – ' + d.nome).join('; ');
}

function interpretarData_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const m = texto_(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}
function fimDoDia_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59); }

// ===================================== MENU =====================================
function onOpen() {
  SpreadsheetApp.getUi().createMenu('APPDF')
    .addItem('Gerar links da ação selecionada', 'menuGerarLinks')
    .addItem('Atualizar consolidado', 'atualizarConsolidado')
    .addSeparator()
    .addItem('Encerrar avaliação da ação selecionada', 'menuEncerrarAcao')
    .addItem('Reabrir avaliação da ação selecionada', 'menuReabrirAcao')
    .addSeparator()
    .addItem('Configurar endereço do site', 'menuConfigurarUrl')
    .addToUi();
}

/** Ação da linha selecionada na aba Acoes (ou null, com aviso). */
function acaoSelecionada_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  if (sh.getName() !== ABAS.ACOES || sh.getActiveRange().getRow() < 2) {
    ui.alert('Selecione uma célula na linha da ação desejada, na aba "' + ABAS.ACOES + '".');
    return null;
  }
  const t = lerTabela_(sh, true);
  const i = sh.getActiveRange().getRow() - 2;
  if (i >= t.linhas.length || !texto_(t.linhas[i][t.idx['ID']])) {
    ui.alert('A linha selecionada não tem ID de ação.');
    return null;
  }
  const acao = montarAcao_(t, i);
  acao.sheet = sh;
  acao.idx = t.idx;
  return acao;
}

function menuGerarLinks() {
  const acao = acaoSelecionada_();
  if (!acao) return;
  const url = obterUrlSite_(true);
  if (!url) return;
  const links = linksDaAcao_(url, acao.id);
  acao.sheet.getRange(acao.linha, acao.idx['Link – Reação'] + 1).setValue(links.reacao);
  acao.sheet.getRange(acao.linha, acao.idx['Link – 360°'] + 1).setValue(links.p360);

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#18181B;font-size:14px">' +
    '<p style="margin:0 0 12px"><b>' + esc_(acao.id) + '</b> – ' + esc_(acao.nome) + '</p>' +
    blocoLink_('Avaliação de Reação (alunos)', links.reacao) +
    blocoLink_('Avaliação 360° do Corpo Docente', links.p360) +
    blocoLink_('Página de escolha (os dois formulários)', links.escolha) +
    '<p style="color:#57534E;font-size:12px;margin-top:12px">Os links também foram gravados ' +
    'nas colunas "Link – Reação" e "Link – 360°" da aba Acoes.</p></div>';
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(560).setHeight(380), 'Links da ação');
}

function blocoLink_(titulo, url) {
  return '<p style="margin:0 0 4px;font-weight:bold;color:#6B4E16">' + esc_(titulo) + '</p>' +
    '<input readonly value="' + esc_(url) + '" onclick="this.select()" ' +
    'style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #C9A55C;border-radius:8px;margin-bottom:12px;font-size:13px;background:#FAF7F0">';
}

function linksDaAcao_(url, id) {
  const base = url.replace(/[?#].*$/, '') + '?acao=' + encodeURIComponent(id);
  return { reacao: base + '&form=reacao', p360: base + '&form=360', escolha: base };
}

function menuEncerrarAcao() { alterarStatus_('encerrada'); }
function menuReabrirAcao() { alterarStatus_('aberta'); }

function alterarStatus_(status) {
  const acao = acaoSelecionada_();
  if (!acao) return;
  acao.sheet.getRange(acao.linha, acao.idx['Status'] + 1).setValue(status);
  const celEnc = acao.sheet.getRange(acao.linha, acao.idx['Data de encerramento'] + 1);
  if (status === 'encerrada' && !celEnc.getValue()) celEnc.setValue(new Date());
  if (status === 'aberta') {
    const enc = interpretarData_(celEnc.getValue());
    if (enc && new Date() > fimDoDia_(enc)) celEnc.clearContent();
  }
  limparCacheDados_();
  avisar_('Ação ' + acao.id + ': avaliação ' + (status === 'aberta' ? 'reaberta' : 'encerrada') + '.');
}

function menuConfigurarUrl() { obterUrlSite_(true, true); }

/**
 * Endereço do site dos formulários (GitHub Pages).
 * Guardado nas propriedades do script; se faltar, pede ao usuário.
 */
function obterUrlSite_(interativo, forcarPergunta) {
  const props = PropertiesService.getScriptProperties();
  let url = props.getProperty('URL_SITE') || URL_SITE_PADRAO || '';
  if ((!url || forcarPergunta) && interativo) {
    const ui = SpreadsheetApp.getUi();
    const r = ui.prompt('Endereço do site',
      'Cole o endereço do site dos formulários (por exemplo, https://usuario.github.io/appdf-avaliacoes/).',
      ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return '';
    const novo = texto_(r.getResponseText());
    if (!/^https:\/\/[^\s?#]+$/.test(novo)) {
      ui.alert('Endereço inválido. Ele deve começar com https:// e não pode ter espaços.');
      return '';
    }
    props.setProperty('URL_SITE', novo);
    url = novo;
    if (forcarPergunta) ui.alert('Endereço salvo.');
  }
  return url;
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function avisar_(msg) {
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'APPDF', 6); } catch (e) { /* fora da planilha */ }
}

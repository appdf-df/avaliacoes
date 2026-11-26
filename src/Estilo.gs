/**
 * Estilo.gs — Visual da planilha no padrão da Polícia Penal do DF (preto e dourado),
 * o mesmo do site e do painel. Só mexe na aparência: nenhum dado é alterado.
 *
 * Roda sozinho uma vez, no primeiro acesso depois de uma atualização
 * (garantirInstalacao_), e também ao final do setup().
 */

const VERSAO_ESTILO = '2';

const ESTILO_ABAS = {
  Acoes: { aba: '#C9A55C', larguras: [120, 340, 140, 240, 190, 230, 110, 150, 330, 330], quebra: true },
  Disciplinas: { aba: '#C9A55C', larguras: [120, 60, 380, 260], quebra: true },
  Unidades: { aba: '#8E877A', larguras: [260], quebra: true },
  Turma: { aba: '#C9A55C', larguras: [120, 160, 320], quebra: true },
  Participacao: { aba: '#8E877A', larguras: [120, 160, 120], quebra: true },
  Respostas_Reacao: { aba: '#0F0F0F', larguraPadrao: 180, quebra: false },
  Respostas_360: { aba: '#0F0F0F', larguraPadrao: 180, quebra: false },
};

function aplicarEstilo_(ss) {
  ss = ss || planilha_();
  Object.keys(ESTILO_ABAS).forEach(nome => {
    const sh = ss.getSheetByName(nome);
    if (sh) estilizarTabela_(sh, ESTILO_ABAS[nome]);
  });

  // Situação da ação em destaque (aberta = dourado, encerrada = cinza)
  const acoes = ss.getSheetByName(ABAS.ACOES);
  if (acoes) {
    const cab = acoes.getRange(1, 1, 1, Math.max(acoes.getLastColumn(), 1)).getValues()[0].map(String);
    const col = cab.indexOf('Status') + 1;
    if (col > 0) {
      const faixa = acoes.getRange(2, col, Math.max(acoes.getMaxRows() - 1, 1), 1);
      acoes.setConditionalFormatRules([
        SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('aberta')
          .setBackground('#F4EBD4').setFontColor('#6B4E16').setBold(true).setRanges([faixa]).build(),
        SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('encerrada')
          .setBackground('#ECEAE5').setFontColor('#57534E').setRanges([faixa]).build(),
      ]);
      faixa.setHorizontalAlignment('center');
    }
  }

  const cons = ss.getSheetByName(ABAS.CONSOLIDADO);
  if (cons) {
    cons.setTabColor('#7A5A1E');
    try { cons.setHiddenGridlines(true); } catch (e) { /* versão antiga */ }
    if (cons.getLastRow() > 0) atualizarConsolidado();   // redesenha no estilo novo
  }
  PropertiesService.getScriptProperties().setProperty('ESTILO', VERSAO_ESTILO);
}

function estilizarTabela_(sh, cfg) {
  const ultimaCol = Math.max(sh.getLastColumn(), 1);
  const linhas = Math.max(sh.getMaxRows(), 2);

  // Faixas alternadas suaves no corpo; cabeçalho preto com texto dourado
  sh.getBandings().forEach(b => b.remove());
  sh.getRange(1, 1, linhas, ultimaCol)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
    .setHeaderRowColor(COR.primaria).setFirstRowColor(COR.branco).setSecondRowColor(COR.faixa);

  sh.getRange(2, 1, linhas - 1, ultimaCol)
    .setFontFamily('Arial').setFontSize(10).setFontColor(COR.texto).setVerticalAlignment('middle')
    .setWrapStrategy(cfg.quebra ? SpreadsheetApp.WrapStrategy.WRAP : SpreadsheetApp.WrapStrategy.CLIP);
  estilizarCabecalho_(sh.getRange(1, 1, 1, ultimaCol));
  sh.setRowHeight(1, 46);
  sh.setFrozenRows(1);
  sh.setTabColor(cfg.aba);
  if (cfg.larguras) cfg.larguras.forEach((w, i) => { if (i < ultimaCol) sh.setColumnWidth(i + 1, w); });
  else sh.setColumnWidths(1, ultimaCol, cfg.larguraPadrao || 170);
}

function estilizarCabecalho_(rng) {
  rng.setBackground(COR.primaria).setFontColor(COR.ouroVivo).setFontWeight('bold').setFontFamily('Arial')
    .setFontSize(10).setVerticalAlignment('middle').setWrap(true)
    .setBorder(null, null, true, null, null, null, COR.ouro, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

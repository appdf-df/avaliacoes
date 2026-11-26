/**
 * Code.gs — Serviço (API) das avaliações da APPDF.
 *
 * A página dos formulários fica hospedada à parte (GitHub Pages, pasta site/).
 * Este script só entrega os dados de cada ação e grava as respostas na planilha.
 *
 *   GET  .../exec?api=dados&acao=<ID>&form=reacao|360   dados para montar a tela
 *   POST .../exec  (corpo JSON)                          grava uma resposta
 */

function doGet(e) {
  const p = (e && e.parameter) || {};
  garantirInstalacao_();
  if (p.api === 'dados') {
    let dados;
    try {
      dados = dadosComCache_(p.acao, p.form);
    } catch (err) {
      console.error(err && err.stack ? err.stack : err);
      dados = { tela: 'erro' };
    }
    return json_(dados);
  }
  // Acesso direto ao endereço do serviço: aponta para o site.
  const site = obterUrlSite_(false);
  const html = '<p style="font-family:Arial,sans-serif;padding:24px">Serviço de avaliações da APPDF em funcionamento.' +
    (site ? ' Os formulários ficam em <a href="' + esc_(site) + '" target="_top">' + esc_(site) + '</a>.' : '') + '</p>';
  return HtmlService.createHtmlOutput(html).setTitle('Avaliações – APPDF');
}

function doPost(e) {
  let payload = null;
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_(falha_('Dados inválidos.'));
  }
  garantirInstalacao_();
  if (payload && payload.api === 'verificar_matricula') return json_(verificarMatricula(payload));
  if (payload && payload.api === 'painel') {
    try { return json_(painel_(payload)); }
    catch (err) { console.error(err && err.stack ? err.stack : err); return json_(falha_('Erro inesperado no painel. Tente novamente.')); }
  }
  return json_(salvarResposta(payload));
}

/**
 * Os dados de cada ação ficam em cache por 10 minutos (ler a planilha é a parte lenta).
 * Qualquer edição nas abas de cadastro, o menu e os envios da coordenação limpam o cache.
 */
function dadosComCache_(acao, form) {
  const cache = CacheService.getScriptCache();
  const ver = cache.get('dados_ver') || '0';
  const chave = 'dados:' + ver + ':' + texto_(acao).toUpperCase().slice(0, 60) + ':' + (form === 'reacao' || form === '360' ? form : '');
  const salvo = cache.get(chave);
  if (salvo) return JSON.parse(salvo);
  const dados = montarDadosPagina_(acao, form);
  const txt = JSON.stringify(dados);
  if (txt.length < 90000) cache.put(chave, txt, 600);
  return dados;
}

function limparCacheDados_() {
  try { CacheService.getScriptCache().put('dados_ver', Date.now() + '-' + Math.floor(Math.random() * 1e6), 21600); } catch (e) { /* sem cache */ }
}

/** Gatilho simples: editar Acoes, Disciplinas ou Unidades limpa o cache. */
function onEdit(e) {
  const nome = e && e.range ? e.range.getSheet().getName() : '';
  if ([ABAS.ACOES, ABAS.DISCIPLINAS, ABAS.UNIDADES].indexOf(nome) !== -1) limparCacheDados_();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** No primeiro acesso, cria as abas da planilha (equivale a rodar setup()). */
function garantirInstalacao_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('PLANILHA_ID') && props.getProperty('ESQUEMA') === VERSAO_ESQUEMA &&
      props.getProperty('ESTILO') === VERSAO_ESTILO) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    if (!props.getProperty('PLANILHA_ID')) setup();
    migrarEsquema_();
    if (props.getProperty('ESTILO') !== VERSAO_ESTILO) {
      try { aplicarEstilo_(); props.deleteProperty('ESTILO_ERRO'); }
      catch (e) {   // o visual nunca pode travar o serviço: registra e não tenta de novo
        props.setProperty('ESTILO', VERSAO_ESTILO);
        props.setProperty('ESTILO_ERRO', String(e && e.message || e).slice(0, 500));
      }
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
  } finally {
    lock.releaseLock();
  }
}

/** Monta tudo o que a página precisa para desenhar a tela pedida. */
function montarDadosPagina_(acaoId, form) {
  const versao = 'v4';
  if (!texto_(acaoId)) return { tela: 'sem_acao', versao: versao };
  const acao = carregarAcao_(acaoId);
  if (!acao) return { tela: 'inexistente', versao: versao };

  const publico = { id: acao.id, nome: acao.nome, datas: acao.datas, local: acao.local };
  if (acao.encerrada) return { tela: 'encerrada', versao: versao, acao: publico };

  // "reacao" e "aluno" abrem o fluxo único e obrigatório do aluno (Reação + 360°)
  const tipo = (form === 'reacao' || form === 'aluno') ? 'aluno' : (form === '360' ? '360' : '');
  if (!tipo) return { tela: 'escolha', versao: versao, acao: publico };

  return {
    tela: 'formulario',
    versao: versao,
    acao: publico,
    escalas: ESCALAS,
    na: NA,
    limiteTexto: LIMITE_TEXTO,
    textos: { confirmacao: TEXTOS.confirmacao, convite360: TEXTOS.convite360, instituicao: TEXTOS.instituicao },
    definicao: tipo === 'aluno' ? defAluno_(acao) : def360_(acao),
  };
}

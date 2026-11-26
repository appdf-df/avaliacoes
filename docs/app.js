/**
 * app.js — Formulários de avaliação da APPDF (Reação e 360°).
 * Busca a definição da ação no serviço (Apps Script) e envia as respostas para ele.
 * Todo texto é inserido com textContent: nada do usuário vira HTML.
 */
(function () {
  'use strict';

  var CFG = window.APPDF_CONFIG || {};
  var params = new URLSearchParams(window.location.search);
  var ACAO = (params.get('acao') || '').trim();
  var FORM = (params.get('form') || '').trim();

  var hero = document.getElementById('hero');
  var app = document.getElementById('app');
  var nav = document.getElementById('nav');
  var btnVoltar = document.getElementById('btn-voltar');
  var btnAvancar = document.getElementById('btn-avancar');

  var D = null, DEF = null, NA = 'NA', LIMITE = 2000, CHAVE = null;
  var S = { etapa: -1, resp: {}, enviando: false, envioId: novoId(), restaurado: false, avaliadosCoord: [] };

  // ============================== Utilidades ==============================
  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
        else if (v === true) e.setAttribute(k, '');
        else e.setAttribute(k, String(v));
      });
    }
    for (var i = 2; i < arguments.length; i++) anexar(e, arguments[i]);
    return e;
  }
  function anexar(pai, f) {
    if (f === null || f === undefined || f === false) return;
    if (Array.isArray(f)) { f.forEach(function (x) { anexar(pai, x); }); return; }
    pai.appendChild(typeof f === 'string' ? document.createTextNode(f) : f);
  }
  function limpar(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function vazio(v) { return v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length); }
  function novoId() {
    var s = '';
    try {
      var a = new Uint8Array(12); window.crypto.getRandomValues(a);
      for (var i = 0; i < a.length; i++) s += ('0' + a[i].toString(16)).slice(-2);
    } catch (e) { s = Date.now().toString(36) + Math.random().toString(36).slice(2); }
    return s;
  }
  function seguroId(s) { return String(s).replace(/[^0-9A-Za-z_-]/g, '_'); }
  function marcaObrig() {
    return [el('span', { class: 'obrig', 'aria-hidden': 'true', text: '*' }), el('span', { class: 'sr', text: ' (obrigatória)' })];
  }
  function msgErro(id) { return el('p', { class: 'msg-erro', id: 'err-' + seguroId(id) }); }
  function mil(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function iniciais(nome) {
    var p = String(nome).replace(/\(.*?\)/g, ' ').split(/\s+/).filter(function (x) { return x && x.length > 2 || /\d/.test(x); });
    if (!p.length) p = String(nome).split(/\s+/);
    return ((p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
  }
  function link(form) {
    var u = window.location.pathname + '?acao=' + encodeURIComponent(D.acao.id);
    return form ? u + '&form=' + form : u;
  }
  function comTempo(promessa, ms) {
    return Promise.race([promessa, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('tempo')); }, ms); })]);
  }

  // ============================== Ícones ==============================
  function svg(caminhos, opc) {
    opc = opc || {};
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    var t = opc.tamanho || 28;
    s.setAttribute('width', t); s.setAttribute('height', t); s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', opc.cor || '#0F0F0F'); s.setAttribute('stroke-width', opc.espessura || '2.4');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    if (opc.classe) s.setAttribute('class', opc.classe);
    caminhos.forEach(function (d) { var p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); s.appendChild(p); });
    return s;
  }
  var ICONES = {
    check: ['M5 12.5l4.5 4.5L19 7.5'],
    info: ['M12 7.5v.01', 'M12 11v6'],
    escudo: ['M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z', 'M9 12l2 2 4-4'],
    lista: ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'],
    pessoas: ['M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1', 'M9.5 10a3 3 0 100-6 3 3 0 000 6z', 'M21 19v-1a4 4 0 00-3-3.9', 'M15.5 4.1a3 3 0 010 5.8'],
    seta: ['M5 12h14', 'M13 6l6 6-6 6'],
  };

  // ========================== Rascunho (localStorage) ==========================
  var armaz = {
    ler: function () {
      if (!CHAVE) return null;
      try { var s = window.localStorage.getItem(CHAVE); return s ? JSON.parse(s) : null; } catch (e) { return null; }
    },
    gravar: function () {
      if (!CHAVE) return;
      try { window.localStorage.setItem(CHAVE, JSON.stringify({ resp: S.resp, etapa: S.etapa, envioId: S.envioId, t: Date.now() })); }
      catch (e) { /* sem armazenamento: segue sem rascunho */ }
    },
    apagar: function () {
      if (!CHAVE) return;
      try { window.localStorage.removeItem(CHAVE); } catch (e) { /* ignora */ }
    },
  };
  var temporizador = null;
  function salvarDepois() { clearTimeout(temporizador); temporizador = setTimeout(armaz.gravar, 400); }
  function restaurar() {
    var r = armaz.ler();
    if (!r || !r.resp || typeof r.resp !== 'object') return;
    if (Date.now() - (r.t || 0) > 14 * 24 * 3600 * 1000) { armaz.apagar(); return; }
    if (!Object.keys(r.resp).some(function (k) { return !vazio(r.resp[k]); })) return;
    S.resp = r.resp;
    S.etapaSalva = typeof r.etapa === 'number' ? r.etapa : 0;
    if (r.envioId) S.envioId = String(r.envioId);
    S.restaurado = true;
  }
  function definir(id, valor) {
    if (vazio(valor)) delete S.resp[id]; else S.resp[id] = valor;
    salvarDepois();
  }

  // ============================== Estrutura ==============================
  function etapasAtivas() {
    if (!DEF) return [];
    if (DEF.tipo !== '360') return DEF.etapas;   // aluno (Reação + 360°) e reação: sequência fixa
    // Some a etapa de pares do próprio instrutor e os instrutores que a coordenação já avaliou.
    var nome = S.resp.in_nome || '';
    var ramo = (DEF.ramos[S.resp.perfil] || []).filter(function (et) {
      return !et.jaAvaliado && !(et.paraColega && et.paraColega === nome);
    });
    return [DEF.etapaPerfil].concat(ramo);
  }
  function idsDaPergunta(q) {
    if (q.tipo === 'likert') return q.itens.map(function (it) { return it.id; });
    if (q.tipo === 'antes_depois') {
      var ids = [];
      q.itens.forEach(function (it) { ids.push(it.idAntes, it.idDepois); });
      return ids;
    }
    if (q.tipo === 'checkbox' && q.outro) return [q.id, q.outro.id];
    return [q.id];
  }

  // ============================== Topo (hero) ==============================
  function heroAcao(sobretitulo, titulo, extra) {
    limpar(hero);
    var meta = D && D.acao ? [D.acao.datas, D.acao.local].filter(Boolean).join(' · ') : '';
    anexar(hero, [
      sobretitulo ? el('p', { class: 'sobretitulo', text: sobretitulo }) : null,
      el('h1', { id: 'titulo-tela', tabindex: '-1', text: titulo }),
      D && D.acao && D.acao.nome ? el('p', { class: 'acao-nome', text: D.acao.nome }) : null,
      meta ? el('p', { class: 'acao-meta', text: meta }) : null,
      extra || null,
    ]);
  }
  function heroCarregando() {
    limpar(hero);
    anexar(hero, [el('div', { class: 'esq l1' }), el('div', { class: 'esq l2' }), el('div', { class: 'esq l3' })]);
  }

  function mostrarNav(v) { nav.hidden = !v; document.body.classList.toggle('sem-nav', !v); }
  function focarTitulo(id) {
    window.scrollTo(0, 0);
    var h = document.getElementById(id);
    if (h) { try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
  }

  // ============================== Telas simples ==============================
  function telaCarregando() {
    mostrarNav(false);
    heroCarregando();
    limpar(app);
    app.appendChild(el('div', { class: 'cartao', 'aria-busy': 'true' },
      el('p', { class: 'sr', text: 'Carregando a avaliação…' }),
      el('div', { class: 'esq l2', style: 'width:90%;height:14px' }),
      el('div', { class: 'esq l2', style: 'width:80%;height:14px' }),
      el('div', { class: 'esq l2', style: 'width:60%;height:14px' })));
  }

  function telaMensagem(sobretitulo, titulo, texto, acao) {
    mostrarNav(false);
    heroAcao(sobretitulo, titulo);
    limpar(app);
    app.appendChild(el('div', { class: 'cartao final' },
      el('div', { class: 'selo neutro' }, svg(ICONES.info, { cor: '#DDBE78' })),
      el('p', { text: texto }),
      acao || null));
    focarTitulo('titulo-tela');
  }

  function telaEncerrada() {
    telaMensagem('Avaliação da ação educacional', 'Avaliação encerrada',
      'O período de respostas desta avaliação foi encerrado. Agradecemos a sua participação nas ações educacionais da APPDF.');
  }

  function telaEscolha() {
    mostrarNav(false);
    heroAcao('Avaliação da ação educacional', 'Escolha o formulário');
    limpar(app);
    var cartao = function (href, icone, titulo, texto) {
      return el('a', { class: 'cartao escolha', href: href },
        el('span', { class: 'escolha-ico' }, svg(icone, { cor: '#DDBE78', tamanho: 22, espessura: '2' })),
        el('span', null, el('h2', { text: titulo }), el('p', { text: texto }), el('p', { class: 'ir', text: 'Responder →' })));
    };
    app.appendChild(el('div', { class: 'escolhas' },
      cartao(link('aluno'), ICONES.lista, 'Sou aluno(a)', 'Avaliação de Reação e Avaliação 360° dos instrutores, em sequência. Obrigatória e anônima.'),
      cartao(link('360'), ICONES.pessoas, 'Sou instrutor(a) ou da coordenação', 'Avaliação 360° do Corpo Docente: autoavaliação, colegas, turma, curso e coordenação.')));
    focarTitulo('titulo-tela');
  }

  // ============================== Tela inicial ==============================
  function telaInicio() {
    mostrarNav(false);
    S.etapa = -1;
    heroAcao(DEF.tipo === '360' ? 'Avaliação do corpo docente' : (DEF.tipo === 'aluno' ? 'Avaliação obrigatória do aluno' : 'Avaliação da ação educacional'), DEF.titulo);
    limpar(app);
    var fatos = [
      ['Tempo', DEF.tempo.replace('cerca de ', '~ ')],
      ['Etapas', DEF.tipo === '360' ? 'Conforme o perfil' : String(DEF.etapas.length)],
      [DEF.tipo === 'aluno' ? 'Respostas' : 'Alunos', DEF.tipo === 'aluno' ? 'Anônimas' : 'Anônimo'],
    ];
    app.appendChild(el('div', { class: 'cartao intro' },
      S.restaurado ? el('div', { class: 'aviso', role: 'status' },
        el('p', { text: 'Encontramos respostas não enviadas neste aparelho. Você pode continuar de onde parou.' }),
        el('button', { type: 'button', class: 'btn-link', text: 'Descartar e começar do zero', onclick: descartarRascunho })) : null,
      el('p', { text: DEF.descricao }),
      el('dl', { class: 'fatos' }, fatos.map(function (f) { return el('div', null, el('dt', { text: f[0] }), el('dd', { text: f[1] })); })),
      el('div', { class: 'privacidade' }, svg(ICONES.escudo, { cor: '#7A5A1E', tamanho: 20, espessura: '2' }),
        el('div', null, el('strong', { text: 'Aviso de privacidade' }), el('p', { text: DEF.privacidade }))),
      el('button', {
        type: 'button', class: 'btn btn-primario btn-bloco',
        onclick: function () {
          var total = etapasAtivas().length;
          S.etapa = S.restaurado ? Math.min(Math.max(S.etapaSalva || 0, 0), total - 1) : 0;
          telaEtapa();
        },
      }, S.restaurado ? 'Continuar avaliação' : 'Iniciar avaliação', svg(ICONES.seta, { cor: '#DDBE78', tamanho: 18, classe: 'seta' }))));
    focarTitulo('titulo-tela');
  }

  function descartarRascunho() {
    armaz.apagar();
    S.resp = {}; S.restaurado = false; S.envioId = novoId();
    telaInicio();
  }

  // ============================== Etapas ==============================
  function telaEtapa(opcoes) {
    opcoes = opcoes || {};
    var etapas = etapasAtivas();
    var et = etapas[S.etapa];
    if (!et) { S.etapa = 0; et = etapas[0]; }
    mostrarNav(true);

    limpar(hero);
    hero.appendChild(blocoProgresso(etapas));
    hero.appendChild(el('h1', { id: 'titulo-etapa', tabindex: '-1', text: et.titulo }));
    if (et.ajuda) hero.appendChild(el('p', { class: 'etapa-ajuda', text: et.ajuda }));

    limpar(app);
    var cab = et.cabecalho || null;
    if (!cab && et.cabecalhoDe && S.resp[et.cabecalhoDe]) {
      var nome = S.resp[et.cabecalhoDe];
      var det = DEF.disciplinasPorInstrutor && DEF.disciplinasPorInstrutor[nome];
      cab = { nome: nome, detalhe: det ? 'Disciplina(s): ' + det : '' };
    }
    if (cab) {
      // "Instrutor(a) 2 de 3": posição entre as etapas do mesmo tipo
      var mesmas = etapas.filter(function (e) { return e.cabecalho && e.cabecalho.rotulo === cab.rotulo; });
      var rotulo = (cab.rotulo || 'Instrutor(a) avaliado(a)') + (et.cabecalho && mesmas.length > 1 ? ' ' + (mesmas.indexOf(et) + 1) + ' de ' + mesmas.length : '');
      app.appendChild(el('div', { class: 'instrutor' },
        el('span', { class: 'avatar', 'aria-hidden': 'true', text: iniciais(cab.nome) }),
        el('div', null,
          el('p', { class: 'instrutor-rotulo', text: rotulo }),
          el('p', { class: 'instrutor-nome', text: cab.nome }),
          cab.detalhe ? el('p', { class: 'instrutor-detalhe', text: cab.detalhe }) : null)));
    }
    if (et.marcarNA) {
      app.appendChild(el('button', {
        type: 'button', class: 'btn-link',
        text: et.textoNA || 'Não assisti a esta aula: marcar todos como "Não se aplica / não observei"',
        onclick: function () { marcarTodosNA(et); },
      }));
    }
    if (et.perguntas.some(function (q) { return q.obrigatorio; })) {
      app.appendChild(el('p', { class: 'nota-obrig' }, 'Respostas marcadas com', el('span', { class: 'obrig', text: ' * ' }), 'são obrigatórias.'));
    }
    app.appendChild(el('div', { id: 'resumo-erro', class: 'resumo-erro', role: 'alert', hidden: true }));
    et.perguntas.forEach(function (q) { app.appendChild(renderPergunta(q)); });

    atualizarNav();
    if (!opcoes.manterRolagem) focarTitulo('titulo-etapa');
    S.etapaSalva = S.etapa;
    armaz.gravar();
  }

  function blocoProgresso(etapas) {
    var semTotal = DEF.tipo === '360' && !S.resp.perfil;
    var total = etapas.length, atual = S.etapa + 1;
    var pct = semTotal ? 12 : Math.round((atual / total) * 100);
    return el('div', { class: 'progresso', id: 'progresso' },
      el('div', { class: 'progresso-txt' },
        el('strong', { text: semTotal ? 'Etapa ' + atual : 'Etapa ' + atual + ' de ' + total }),
        el('span', { text: (etapas[S.etapa] && etapas[S.etapa].parte) || DEF.titulo })),
      el('div', {
        class: 'barra', role: 'progressbar', 'aria-label': 'Progresso da avaliação',
        'aria-valuemin': '1', 'aria-valuemax': semTotal ? null : String(total), 'aria-valuenow': String(atual),
        'aria-valuetext': semTotal ? 'Etapa ' + atual : 'Etapa ' + atual + ' de ' + total,
      }, el('span', { style: 'width:' + pct + '%' })));
  }
  function atualizarProgresso() {
    var antigo = document.getElementById('progresso');
    if (antigo) antigo.parentNode.replaceChild(blocoProgresso(etapasAtivas()), antigo);
    atualizarNav();
  }
  function atualizarNav() {
    var etapas = etapasAtivas();
    var ultima = S.etapa === etapas.length - 1 && etapas.length > 1 && !(DEF.tipo === '360' && !S.resp.perfil);
    limpar(btnAvancar);
    btnAvancar.appendChild(document.createTextNode(ultima ? 'Enviar avaliação' : 'Avançar'));
    if (!ultima) btnAvancar.appendChild(svg(ICONES.seta, { cor: '#DDBE78', tamanho: 18, classe: 'seta' }));
    btnAvancar.disabled = false;
    btnVoltar.disabled = false;
    btnAvancar.removeAttribute('aria-busy');
  }

  btnVoltar.addEventListener('click', function () {
    if (S.enviando) return;
    if (S.etapa <= 0) { telaInicio(); return; }
    S.etapa -= 1;
    telaEtapa();
  });
  btnAvancar.addEventListener('click', function () {
    if (S.enviando) return;
    var pend = pendencias(etapasAtivas()[S.etapa]);
    if (pend.length) { mostrarErros(pend); return; }
    var etapas = etapasAtivas();
    var atual = etapas[S.etapa];
    if (atual && atual.verificar === 'matricula' && S.matriculaOk !== S.resp.matricula) { verificarMatricula(); return; }
    if (S.etapa < etapas.length - 1) { S.etapa += 1; telaEtapa(); return; }
    if (etapas.length === 1) {   // perfil sem nada pendente (ex.: coordenação já avaliou todos)
      mostrarErros([], 'A coordenação já avaliou todos os instrutores desta ação. Não há avaliações pendentes para este perfil.');
      return;
    }
    enviar();
  });

  /** Confere a matrícula no servidor antes de o aluno começar a responder. */
  function verificarMatricula() {
    S.enviando = true;
    btnAvancar.disabled = true; btnVoltar.disabled = true;
    limpar(btnAvancar);
    btnAvancar.appendChild(el('span', { class: 'giro', 'aria-hidden': 'true' }));
    btnAvancar.appendChild(document.createTextNode('Conferindo…'));
    comTempo(fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ api: 'verificar_matricula', acao: D.acao.id, matricula: S.resp.matricula || '' }) })
      .then(function (r) { return r.json(); }), 30000)
      .then(function (r) {
        S.enviando = false; atualizarNav();
        if (r && r.ok) { S.matriculaOk = S.resp.matricula; S.etapa += 1; telaEtapa(); return; }
        if (r && r.codigo === 'encerrada') { telaEncerrada(); return; }
        if (r && r.codigo === 'ja_respondeu') { armaz.apagar(); }
        mostrarErros([{ id: 'matricula', mensagem: (r && r.erros && r.erros[0] && r.erros[0].mensagem) || 'Matrícula não aceita.' }],
          (r && r.mensagem) || 'Não foi possível conferir a matrícula.');
      })
      .catch(function () {
        S.enviando = false; atualizarNav();
        mostrarErros([{ id: 'matricula', mensagem: 'Sem conexão.' }], 'Não foi possível conferir a matrícula. Verifique a internet e tente de novo.');
      });
  }

  function marcarTodosNA(et) {
    et.perguntas.forEach(function (q) {
      if (q.tipo === 'likert') q.itens.forEach(function (it) { S.resp[it.id] = NA; });
    });
    armaz.gravar();
    telaEtapa({ manterRolagem: true });
  }

  // ============================== Perguntas ==============================
  function renderPergunta(q) {
    switch (q.tipo) {
      case 'select': return pSelect(q);
      case 'radio': return pRadio(q);
      case 'likert': return pLikert(q);
      case 'antes_depois': return pAntesDepois(q);
      case 'checkbox': return pCheckbox(q);
      case 'nps': return pNps(q);
      case 'texto': return pTexto(q);
      case 'matricula': return pMatricula(q);
      default: return el('div');
    }
  }

  function opcaoDesabilitada(q, o) {
    if (o.desabilitada) return true;
    if (q.id === 'co_instrutor' && S.avaliadosCoord.indexOf(String(o.valor)) !== -1) return true;
    if (q.excluirValorDe && S.resp[q.excluirValorDe] === String(o.valor)) return true;
    return false;
  }

  function pSelect(q) {
    var id = seguroId(q.id);
    var sel = el('select', {
      id: 'in-' + id, name: q.id, class: 'entrada',
      'aria-required': q.obrigatorio ? 'true' : null, 'aria-describedby': 'err-' + id,
      'data-excluir': q.excluirValorDe || null,
    });
    sel._q = q;
    preencherSelect(sel, q);
    sel.addEventListener('change', function () {
      definir(q.id, sel.value); limparErro(q.id); atualizarDependentes(q.id);
      if (q.id === 'in_nome') atualizarProgresso();   // o número de colegas a avaliar muda
    });
    return el('div', { class: 'cartao campo', id: 'q-' + id },
      el('label', { class: 'pergunta', for: 'in-' + id }, q.titulo, q.obrigatorio ? marcaObrig() : null),
      q.ajuda ? el('p', { class: 'pergunta-ajuda', text: q.ajuda }) : null,
      sel, msgErro(q.id));
  }
  function preencherSelect(sel, q) {
    limpar(sel);
    sel.appendChild(el('option', { value: '', text: 'Selecione…' }));
    var atual = S.resp[q.id] || '';
    q.opcoes.forEach(function (o) {
      var desab = opcaoDesabilitada(q, o), nota = '';
      if (desab && q.excluirValorDe && S.resp[q.excluirValorDe] === String(o.valor)) nota = ' (você)';
      else if (desab && q.notaDesabilitada) nota = ' (' + q.notaDesabilitada + ')';
      sel.appendChild(el('option', { value: String(o.valor), disabled: desab, text: o.rotulo + nota }));
      if (desab && atual === String(o.valor)) { atual = ''; delete S.resp[q.id]; }
    });
    sel.value = atual;
  }
  function atualizarDependentes(idOrigem) {
    var deps = app.querySelectorAll('select[data-excluir="' + idOrigem + '"]');
    Array.prototype.forEach.call(deps, function (s) { preencherSelect(s, s._q); });
    if (deps.length) armaz.gravar();
  }

  function linhaOpcao(tipo, nome, valor, rotulo, marcado, aoMudar) {
    var inp = el('input', { type: tipo, name: nome, value: valor });
    inp.checked = !!marcado;
    inp.addEventListener('change', aoMudar);
    return el('label', { class: 'opc-linha' + (tipo === 'checkbox' ? ' is-check' : '') },
      inp, el('span', { class: 'marca', 'aria-hidden': 'true' }), el('span', { text: rotulo }));
  }

  function pRadio(q) {
    var id = seguroId(q.id);
    var curtas = q.opcoes.every(function (o) { return String(o.rotulo).length <= 18; });
    var lista = el('div', { class: 'lista-opcoes' + (curtas && q.opcoes.length > 2 ? ' duas' : '') });
    q.opcoes.forEach(function (o) {
      lista.appendChild(linhaOpcao('radio', 'r-' + id, String(o.valor), o.rotulo, S.resp[q.id] === String(o.valor), function () {
        definir(q.id, String(o.valor)); limparErro(q.id);
        if (q.id === 'perfil') atualizarProgresso();
      }));
    });
    return el('fieldset', { class: 'cartao campo', id: 'q-' + id, 'aria-describedby': 'err-' + id, 'aria-required': q.obrigatorio ? 'true' : null },
      el('legend', { class: 'pergunta' }, q.titulo, q.obrigatorio ? marcaObrig() : null),
      q.ajuda ? el('p', { class: 'pergunta-ajuda', text: q.ajuda }) : null,
      lista, msgErro(q.id));
  }

  function opcaoEscala(nome, o, numerica, aoMudar) {
    var inp = el('input', { type: 'radio', name: 'e-' + seguroId(nome), value: String(o.valor), 'aria-label': o.rotulo });
    inp.checked = !vazio(S.resp[nome]) && String(S.resp[nome]) === String(o.valor);
    inp.addEventListener('change', aoMudar);
    var cx = el('span', { class: 'opc-cx', 'aria-hidden': 'true' });
    if (o.valor === NA) cx.appendChild(el('span', { class: 'opc-txt', text: o.rotulo }));
    else if (numerica) {
      cx.appendChild(el('span', { class: 'opc-num', text: String(o.valor) }));
      cx.appendChild(el('span', { class: 'opc-txt', text: o.exibir || o.rotulo }));
    } else cx.appendChild(el('span', { class: 'opc-txt', text: o.exibir || o.rotulo }));
    return el('label', { class: 'opc' + (o.valor === NA ? ' opc-na' : '') }, inp, cx);
  }
  function grupoEscala(idResp, nomeEscala) {
    var esc = D.escalas[nomeEscala];
    var linha = el('div', { class: 'escala' }), na = el('div', { class: 'escala-na' });
    esc.opcoes.forEach(function (o) {
      (o.valor === NA ? na : linha).appendChild(opcaoEscala(idResp, o, esc.numerica, function () {
        definir(idResp, o.valor); limparErro(idResp);
      }));
    });
    return el('div', { class: 'escala-grupo' }, linha, na.childNodes.length ? na : null);
  }
  function itemEscala(idResp, texto, nomeEscala, obrig) {
    var id = seguroId(idResp);
    return el('fieldset', { class: 'item', id: 'q-' + id, 'aria-describedby': 'err-' + id, 'aria-required': obrig ? 'true' : null },
      el('legend', { class: 'item-txt' }, texto, obrig ? marcaObrig() : null),
      grupoEscala(idResp, nomeEscala), msgErro(idResp));
  }
  function pLikert(q) {
    var gid = 'g-' + seguroId(q.id);
    return el('section', { class: 'grupo', 'aria-labelledby': gid },
      el('h2', { class: 'grupo-titulo', id: gid, text: q.titulo }),
      q.ajuda ? el('p', { class: 'grupo-ajuda', text: q.ajuda }) : null,
      el('div', { class: 'lista-itens' }, q.itens.map(function (it) { return itemEscala(it.id, it.texto, q.escala, q.obrigatorio); })));
  }
  function pAntesDepois(q) {
    var gid = 'g-' + seguroId(q.id);
    var bloco = function (idResp, rotulo) {
      var id = seguroId(idResp);
      return el('fieldset', { class: 'ad-bloco', id: 'q-' + id, 'aria-describedby': 'err-' + id, 'aria-required': q.obrigatorio ? 'true' : null },
        el('legend', null, rotulo, q.obrigatorio ? marcaObrig() : null),
        grupoEscala(idResp, q.escala), msgErro(idResp));
    };
    return el('section', { class: 'grupo', 'aria-labelledby': gid },
      el('h2', { class: 'grupo-titulo', id: gid, text: q.titulo }),
      el('div', { class: 'lista-itens' }, q.itens.map(function (it) {
        return el('div', { class: 'item item-ad', role: 'group', 'aria-label': it.texto },
          el('p', { class: 'pergunta', text: it.texto }),
          bloco(it.idAntes, q.rotuloAntes), bloco(it.idDepois, q.rotuloDepois));
      })));
  }
  function pCheckbox(q) {
    var id = seguroId(q.id);
    var marcadas = Array.isArray(S.resp[q.id]) ? S.resp[q.id].slice() : [];
    var outroId = q.outro ? seguroId(q.outro.id) : '';
    var campoOutro = null;
    var atualizar = function (valor, marcado) {
      var l = (Array.isArray(S.resp[q.id]) ? S.resp[q.id] : []).filter(function (v) { return v !== valor; });
      if (marcado) l.push(valor);
      definir(q.id, l); limparErro(q.id);
      if (q.outro && valor === q.outro.valor) {
        campoOutro.hidden = !marcado;
        if (marcado) document.getElementById('in-' + outroId).focus();
      }
    };
    var lista = el('div', { class: 'lista-opcoes' });
    q.opcoes.forEach(function (o) {
      var v = String(o.valor);
      lista.appendChild(linhaOpcao('checkbox', 'c-' + id, v, o.rotulo, marcadas.indexOf(v) !== -1, function (ev) { atualizar(v, ev.target.checked); }));
    });
    if (q.outro) {
      var ativo = marcadas.indexOf(q.outro.valor) !== -1;
      lista.appendChild(linhaOpcao('checkbox', 'c-' + id, q.outro.valor, q.outro.rotulo, ativo, function (ev) { atualizar(q.outro.valor, ev.target.checked); }));
      var inp = el('input', { type: 'text', id: 'in-' + outroId, class: 'entrada', maxlength: String(LIMITE), autocomplete: 'off',
        'aria-label': 'Descreva a outra dificuldade', placeholder: 'Descreva a outra dificuldade' });
      inp.value = S.resp[q.outro.id] || '';
      inp.addEventListener('input', function () { definir(q.outro.id, inp.value); limparErro(q.id); });
      campoOutro = el('div', { class: 'outro-campo', hidden: !ativo }, inp);
      lista.appendChild(campoOutro);
    }
    return el('fieldset', { class: 'cartao campo', id: 'q-' + id, 'aria-describedby': 'err-' + id },
      el('legend', { class: 'pergunta' }, q.titulo, q.obrigatorio ? marcaObrig() : null),
      q.ajuda ? el('p', { class: 'pergunta-ajuda', text: q.ajuda }) : null,
      lista, msgErro(q.id));
  }
  function pNps(q) {
    var id = seguroId(q.id);
    var grade = el('div', { class: 'nps' });
    for (var n = q.min; n <= q.max; n++) {
      (function (n) {
        var rot = String(n);
        if (n === q.min) rot += ' – ' + q.extremos[0];
        if (n === q.max) rot += ' – ' + q.extremos[1];
        var inp = el('input', { type: 'radio', name: 'n-' + id, value: String(n), 'aria-label': rot });
        inp.checked = S.resp[q.id] === n;
        inp.addEventListener('change', function () { definir(q.id, n); limparErro(q.id); });
        grade.appendChild(el('label', { class: 'opc' }, inp, el('span', { class: 'opc-cx', 'aria-hidden': 'true' }, el('span', { text: String(n) }))));
      })(n);
    }
    return el('fieldset', { class: 'cartao campo', id: 'q-' + id, 'aria-describedby': 'err-' + id, 'aria-required': q.obrigatorio ? 'true' : null },
      el('legend', { class: 'pergunta' }, q.titulo, q.obrigatorio ? marcaObrig() : null),
      grade,
      el('div', { class: 'nps-extremos', 'aria-hidden': 'true' },
        el('span', { text: q.min + ' – ' + q.extremos[0] }), el('span', { text: q.max + ' – ' + q.extremos[1] })),
      msgErro(q.id));
  }
  function pMatricula(q) {
    var id = seguroId(q.id);
    var inp = el('input', { id: 'in-' + id, type: 'text', class: 'entrada', autocomplete: 'off', autocapitalize: 'characters',
      spellcheck: 'false', maxlength: '30', inputmode: 'text', 'aria-required': 'true', 'aria-describedby': 'err-' + id,
      placeholder: 'Ex.: 1234567', style: 'font-size:20px;letter-spacing:.06em' });
    inp.value = S.resp[q.id] || '';
    inp.addEventListener('input', function () { definir(q.id, inp.value.trim()); limparErro(q.id); });
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); btnAvancar.click(); } });
    return el('div', { class: 'cartao campo', id: 'q-' + id },
      el('label', { class: 'pergunta', for: 'in-' + id }, q.titulo, q.obrigatorio ? marcaObrig() : null),
      inp, msgErro(q.id));
  }

  function pTexto(q) {
    var id = seguroId(q.id);
    var cont = el('p', { class: 'contador', id: 'cont-' + id });
    var ta = el('textarea', { id: 'in-' + id, class: 'entrada', rows: '4', maxlength: String(LIMITE), 'aria-describedby': 'cont-' + id + ' err-' + id });
    ta.value = S.resp[q.id] || '';
    var contar = function () { cont.textContent = mil(ta.value.length) + ' de ' + mil(LIMITE) + ' caracteres'; };
    contar();
    ta.addEventListener('input', function () { definir(q.id, ta.value); contar(); limparErro(q.id); });
    return el('div', { class: 'cartao campo', id: 'q-' + id },
      el('label', { class: 'pergunta', for: 'in-' + id }, q.titulo, q.obrigatorio ? marcaObrig() : null),
      ta, cont, msgErro(q.id));
  }

  // ============================== Validação ==============================
  function pendencias(et) {
    var l = [], r = S.resp;
    et.perguntas.forEach(function (q) {
      switch (q.tipo) {
        case 'select': case 'radio': case 'nps':
          if (q.obrigatorio && vazio(r[q.id])) l.push({ id: q.id, mensagem: 'Selecione uma opção.' });
          else if (q.excluirValorDe && !vazio(r[q.id]) && r[q.id] === r[q.excluirValorDe])
            l.push({ id: q.id, mensagem: 'Não é permitido avaliar a si mesmo(a). Selecione outro(a) colega.' });
          break;
        case 'likert':
          q.itens.forEach(function (it) { if (q.obrigatorio && vazio(r[it.id])) l.push({ id: it.id, mensagem: 'Selecione uma opção.' }); });
          break;
        case 'antes_depois':
          q.itens.forEach(function (it) {
            if (q.obrigatorio && vazio(r[it.idAntes])) l.push({ id: it.idAntes, mensagem: 'Indique seu nível antes da ação.' });
            if (q.obrigatorio && vazio(r[it.idDepois])) l.push({ id: it.idDepois, mensagem: 'Indique seu nível depois da ação.' });
          });
          break;
        case 'checkbox':
          if (q.outro && Array.isArray(r[q.id]) && r[q.id].indexOf(q.outro.valor) !== -1 && vazio(String(r[q.outro.id] || '').trim()))
            l.push({ id: q.id, mensagem: 'Descreva a opção "Outra".' });
          else if (q.obrigatorio && vazio(r[q.id])) l.push({ id: q.id, mensagem: 'Selecione ao menos uma opção.' });
          break;
        case 'matricula':
          if (!/\d/.test(String(r[q.id] || ''))) l.push({ id: q.id, mensagem: 'Informe sua matrícula.' });
          break;
        case 'texto':
          if (String(r[q.id] || '').length > LIMITE) l.push({ id: q.id, mensagem: 'Use no máximo ' + mil(LIMITE) + ' caracteres.' });
          else if (q.obrigatorio && vazio(String(r[q.id] || '').trim())) l.push({ id: q.id, mensagem: 'Resposta obrigatória.' });
          break;
      }
    });
    return l;
  }
  function mostrarErros(lista, mensagemGeral) {
    var primeiro = null;
    lista.forEach(function (p) {
      var box = document.getElementById('q-' + seguroId(p.id));
      if (!box) return;
      box.classList.add('is-invalido');
      var m = document.getElementById('err-' + seguroId(p.id));
      if (m) m.textContent = p.mensagem;
      if (!primeiro) primeiro = box;
    });
    var resumo = document.getElementById('resumo-erro');
    if (resumo) {
      var n = lista.length;
      resumo.textContent = mensagemGeral || (n === 1 ? 'Há 1 resposta pendente nesta etapa.' : 'Há ' + n + ' respostas pendentes nesta etapa.');
      resumo.hidden = false;
    }
    if (primeiro) {
      primeiro.scrollIntoView({ behavior: movimento() ? 'smooth' : 'auto', block: 'center' });
      var alvo = primeiro.querySelector('input, select, textarea');
      if (alvo) { try { alvo.focus({ preventScroll: true }); } catch (e) { alvo.focus(); } }
    }
  }
  function limparErro(id) {
    var box = document.getElementById('q-' + seguroId(id));
    if (box) box.classList.remove('is-invalido');
    var resumo = document.getElementById('resumo-erro');
    if (resumo && !app.querySelector('.is-invalido')) resumo.hidden = true;
  }
  function movimento() {
    try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  // =============================== Envio ===============================
  function coletar() {
    var r = {};
    etapasAtivas().forEach(function (et) {
      et.perguntas.forEach(function (q) {
        idsDaPergunta(q).forEach(function (id) { if (!vazio(S.resp[id])) r[id] = S.resp[id]; });
      });
    });
    return r;
  }
  function estadoEnvio(ativo) {
    S.enviando = ativo;
    btnAvancar.disabled = ativo;
    btnVoltar.disabled = ativo;
    limpar(btnAvancar);
    if (ativo) {
      btnAvancar.setAttribute('aria-busy', 'true');
      btnAvancar.appendChild(el('span', { class: 'giro', 'aria-hidden': 'true' }));
      btnAvancar.appendChild(document.createTextNode('Enviando…'));
    } else {
      btnAvancar.removeAttribute('aria-busy');
      btnAvancar.textContent = 'Enviar avaliação';
    }
  }
  function enviar() {
    if (S.enviando) return;
    var payload = { acao: D.acao.id, form: DEF.tipo, perfil: S.resp.perfil || '', envioId: S.envioId, respostas: coletar() };
    estadoEnvio(true);
    comTempo(fetch(CFG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // evita a checagem prévia (CORS) do navegador
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json(); }), 45000)
      .then(function (r) {
        estadoEnvio(false);
        if (r && r.ok) concluir(r); else falhaEnvio(r || {});
      })
      .catch(function () {
        estadoEnvio(false);
        falhaEnvio({ mensagem: 'Não foi possível enviar. Verifique sua conexão e tente novamente. Suas respostas continuam salvas neste aparelho.' });
      });
  }
  function falhaEnvio(r) {
    if (r.codigo === 'encerrada') { armaz.apagar(); telaEncerrada(); return; }
    if (r.codigo === 'ja_respondeu') { armaz.apagar(); telaMensagem('Avaliação obrigatória do aluno', 'Avaliação já concluída', r.mensagem); return; }
    if (r.codigo === 'desatualizado') {
      armaz.apagar();
      telaMensagem('Avaliações da APPDF', 'Página atualizada', r.mensagem,
        el('button', { type: 'button', class: 'btn btn-primario', text: 'Recarregar', onclick: function () { window.location.reload(); } }));
      return;
    }
    btnVoltar.disabled = false;
    if (r.erros && r.erros.length) {
      var etapas = etapasAtivas(), alvo = -1;
      for (var i = 0; i < etapas.length && alvo === -1; i++) {
        var ids = [];
        etapas[i].perguntas.forEach(function (q) { ids = ids.concat(idsDaPergunta(q)); });
        if (r.erros.some(function (e) { return ids.indexOf(e.id) !== -1; })) alvo = i;
      }
      if (alvo !== -1) { S.etapa = alvo; telaEtapa({ manterRolagem: true }); mostrarErros(r.erros, r.mensagem); return; }
    }
    var resumo = document.getElementById('resumo-erro');
    if (resumo) { resumo.textContent = r.mensagem || 'Não foi possível enviar. Tente novamente.'; resumo.hidden = false; resumo.scrollIntoView({ block: 'center' }); }
  }
  function concluir(r) {
    armaz.apagar();
    if (DEF.tipo === '360' && S.resp.perfil === 'coordenacao') {
      var nome = r.instrutor || S.resp.co_instrutor;
      if (nome && S.avaliadosCoord.indexOf(nome) === -1) S.avaliadosCoord.push(nome);
    }
    telaConcluida();
  }
  function telaConcluida() {
    mostrarNav(false);
    heroAcao(DEF.titulo, 'Obrigado pela sua participação');
    limpar(app);
    var acoes = el('div', { class: 'acoes' });
    app.appendChild(el('div', { class: 'cartao final' },
      el('div', { class: 'selo' }, svg(ICONES.check, { cor: '#0F0F0F' })),
      el('h2', { text: 'Sua avaliação foi registrada' }),
      el('p', { text: D.textos.confirmacao }),
      acoes.childNodes.length ? acoes : null));
    if (DEF.tipo === 'aluno') {
      app.appendChild(el('div', { class: 'cartao' }, el('p', { style: 'margin:0', text:
        'Você concluiu as duas avaliações obrigatórias desta ação: a Avaliação de Reação e a Avaliação 360° dos instrutores. Sua participação já foi registrada.' })));
    }
    if (DEF.tipo === 'reacao') {
      app.appendChild(el('div', { class: 'cartao convite' },
        el('h2', { text: 'Avaliação 360° do Corpo Docente' }),
        el('p', { text: D.textos.convite360 }),
        el('a', { class: 'btn btn-bloco', href: link('360') }, 'Avaliar os instrutores', svg(ICONES.seta, { cor: '#0F0F0F', tamanho: 18, classe: 'seta' }))));
    }
    focarTitulo('titulo-tela');
  }
  // =============================== Início ===============================
  function iniciar() {
    switch (D.tela) {
      case 'formulario':
        DEF = D.definicao; NA = D.na || 'NA'; LIMITE = D.limiteTexto || 2000;
        CHAVE = 'appdf:' + (D.versao || 'v2') + ':' + D.acao.id + ':' + DEF.tipo;
        document.title = DEF.titulo + ' – APPDF';
        restaurar();
        telaInicio();
        break;
      case 'escolha': telaEscolha(); break;
      case 'encerrada': telaEncerrada(); break;
      case 'inexistente':
        telaMensagem('Avaliações da APPDF', 'Ação não encontrada', 'O link utilizado não corresponde a uma ação educacional cadastrada. Confira o endereço recebido ou procure a coordenação.');
        break;
      case 'sem_acao':
        telaMensagem('Avaliações da APPDF', 'Link incompleto', 'Este endereço não indica a ação educacional a ser avaliada. Utilize o link fornecido pela coordenação.');
        break;
      default:
        telaMensagem('Avaliações da APPDF', 'Não foi possível carregar', 'Verifique sua conexão com a internet e tente novamente. Se o problema persistir, procure a coordenação.',
          el('button', { type: 'button', class: 'btn btn-primario', text: 'Tentar novamente', onclick: carregar }));
    }
  }

  /**
   * Carrega os dados da ação. Se o aparelho já tiver uma cópia recente, mostra-a na hora
   * e atualiza por trás; a versão nova só substitui a tela se a pessoa ainda não começou.
   */
  function carregar() {
    if (!ACAO) { D = { tela: 'sem_acao' }; iniciar(); return; }
    var chaveCache = 'appdf:dados4:' + ACAO.toUpperCase() + ':' + FORM;
    var copia = null;
    try { copia = JSON.parse(window.localStorage.getItem(chaveCache) || 'null'); } catch (e) { copia = null; }
    var usouCopia = !!(copia && copia.d && copia.d.tela && Date.now() - copia.t < 7 * 24 * 3600 * 1000);
    if (usouCopia) { D = copia.d; iniciar(); } else telaCarregando();

    var url = CFG.API_URL + '?api=dados&acao=' + encodeURIComponent(ACAO) + (FORM ? '&form=' + encodeURIComponent(FORM) : '');
    comTempo(fetch(url).then(function (r) { return r.json(); }), 30000)
      .then(function (d) {
        if (!d || !d.tela) throw new Error('resposta inválida');
        try { window.localStorage.setItem(chaveCache, JSON.stringify({ t: Date.now(), d: d })); } catch (e) { /* sem armazenamento */ }
        if (!usouCopia) { D = d; iniciar(); return; }
        var mudou = JSON.stringify(d) !== JSON.stringify(copia.d);
        var naoComecou = D.tela !== 'formulario' || S.etapa === -1;
        if (mudou && naoComecou) { D = d; S = { etapa: -1, resp: {}, enviando: false, envioId: novoId(), restaurado: false, avaliadosCoord: [] }; iniciar(); }
      })
      .catch(function () { if (!usouCopia) { D = { tela: 'erro' }; iniciar(); } });
  }
  carregar();
})();

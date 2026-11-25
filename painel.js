/**
 * painel.js — Painel da coordenação (criar ações, links/QR, encerrar, resultados).
 * Fala com o serviço Apps Script por POST { api: 'painel', op, token }.
 * Todo texto vindo da planilha é inserido com textContent.
 */
(function () {
  'use strict';

  var API = (window.APPDF_CONFIG || {}).API_URL;
  var BASE = window.location.origin + window.location.pathname.replace(/painel\.html$/, '');
  var hero = document.getElementById('hero');
  var app = document.getElementById('app');
  var aviso = document.getElementById('aviso');
  var projecao = document.getElementById('projecao');
  var CHAVE_TOKEN = 'appdf:painel:token';

  var S = { token: lerToken(), acoes: null, planilha: '', resultados: {} };

  // ============================== Utilidades ==============================
  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, String(v));
    });
    for (var i = 2; i < arguments.length; i++) anexar(e, arguments[i]);
    return e;
  }
  function anexar(p, f) {
    if (f === null || f === undefined || f === false) return;
    if (Array.isArray(f)) { f.forEach(function (x) { anexar(p, x); }); return; }
    p.appendChild(typeof f === 'string' ? document.createTextNode(f) : f);
  }
  function limpar(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function num(v, casas) {
    if (v === null || v === undefined || v === '') return '—';
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas || 0, maximumFractionDigits: casas === undefined ? 2 : casas });
  }
  function iniciais(nome) {
    var p = String(nome).replace(/\(.*?\)/g, ' ').split(/\s+/).filter(function (x) { return x && (x.length > 2 || /\d/.test(x)); });
    if (!p.length) p = String(nome).split(/\s+/);
    return ((p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
  }
  function lerToken() {
    try {
      var t = JSON.parse(window.localStorage.getItem(CHAVE_TOKEN) || 'null');
      return t && t.v && Date.now() - t.t < 5.5 * 3600 * 1000 ? t.v : '';
    } catch (e) { return ''; }
  }
  function gravarToken(v) {
    try { if (v) window.localStorage.setItem(CHAVE_TOKEN, JSON.stringify({ v: v, t: Date.now() })); else window.localStorage.removeItem(CHAVE_TOKEN); }
    catch (e) { /* sem armazenamento */ }
  }
  var tAviso = null;
  function avisar(msg) {
    aviso.textContent = msg; aviso.hidden = false;
    clearTimeout(tAviso); tAviso = setTimeout(function () { aviso.hidden = true; }, 3200);
  }
  function topo(sobre, titulo, lead, acoes, voltar) {
    limpar(hero);
    anexar(hero, [
      voltar ? el('button', { type: 'button', class: 'voltar', onclick: voltar.acao }, '← ', voltar.texto) : null,
      el('p', { class: 'sobretitulo', text: sobre }),
      el('h1', { id: 'titulo-tela', tabindex: '-1', text: titulo }),
      lead ? el('p', { class: 'lead', text: lead }) : null,
      acoes && acoes.length ? el('div', { class: 'hero-acoes' }, acoes) : null,
    ]);
    window.scrollTo(0, 0);
    var h = document.getElementById('titulo-tela');
    try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
  }
  function carregando(texto) {
    limpar(app);
    app.appendChild(el('div', { class: 'cartao', 'aria-busy': 'true' },
      el('p', { class: 'sr', text: texto || 'Carregando…' }),
      el('div', { class: 'esq l2', style: 'width:70%;height:16px' }),
      el('div', { class: 'esq l2', style: 'width:90%;height:14px' }),
      el('div', { class: 'esq l2', style: 'width:50%;height:14px' })));
  }
  function erroCartao(msg, tentar) {
    limpar(app);
    app.appendChild(el('div', { class: 'cartao vazio' }, el('p', { text: msg }),
      tentar ? el('button', { type: 'button', class: 'btn btn-primario', text: 'Tentar novamente', onclick: tentar }) : null));
  }
  function copiar(texto, rotulo) {
    var ok = function () { avisar((rotulo || 'Link') + ' copiado.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(ok, function () { copiarAntigo(texto); ok(); });
    } else { copiarAntigo(texto); ok(); }
  }
  function copiarAntigo(texto) {
    var t = el('textarea', { style: 'position:fixed;opacity:0' }); t.value = texto;
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) { /* ignora */ }
    document.body.removeChild(t);
  }
  function links(id) {
    var b = BASE + '?acao=' + encodeURIComponent(id);
    return { reacao: b + '&form=reacao', p360: b + '&form=360', escolha: b };
  }

  // ================================= API =================================
  function api(op, dados) {
    var corpo = Object.assign({ api: 'painel', op: op, token: S.token }, dados || {});
    return Promise.race([
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo) })
        .then(function (r) { return r.json(); }),
      new Promise(function (_, rej) { setTimeout(function () { rej(new Error('tempo')); }, 45000); }),
    ]).then(function (r) {
      if (r && r.codigo === 'sessao') { S.token = ''; gravarToken(''); telaEntrar(r.mensagem); throw new Error('sessao'); }
      return r;
    });
  }

  // ================================ Rotas ================================
  // #lista · #nova · #editar=ID · #links=ID · #resultados=ID
  function ir(hash) { if (window.location.hash === '#' + hash) rotear(); else window.location.hash = hash; }
  function rotear() {
    if (!S.token) { telaEntrar(); return; }
    var h = decodeURIComponent(window.location.hash.slice(1));
    var m = h.match(/^(editar|links|resultados)=(.+)$/);
    if (h === 'nova') { garantirLista(function () { telaForm(null); }); return; }
    if (m) {
      garantirLista(function () {
        var a = (S.acoes || []).filter(function (x) { return x.id === m[2]; })[0];
        if (!a) { ir('lista'); return; }
        if (m[1] === 'editar') telaForm(a);
        else if (m[1] === 'links') telaLinks(a);
        else telaResultados(a);
      });
      return;
    }
    telaLista();
  }
  window.addEventListener('hashchange', rotear);
  function garantirLista(fn) { if (S.acoes) fn(); else carregarLista(fn); }
  function carregarLista(depois) {
    carregando('Carregando as ações…');
    api('listar').then(function (r) {
      if (!r.ok) { erroCartao(r.mensagem || 'Não foi possível carregar as ações.', function () { carregarLista(depois); }); return; }
      S.acoes = r.acoes; S.planilha = r.planilha;
      depois();
    }).catch(function (e) { if (e.message !== 'sessao') erroCartao('Não foi possível falar com o servidor. Verifique a internet.', function () { carregarLista(depois); }); });
  }

  // ================================ Entrar ================================
  function telaEntrar(msg) {
    topo('Coordenação', 'Painel das avaliações', 'Crie ações educacionais, divulgue os formulários e acompanhe os resultados.');
    limpar(app);
    var inp = el('input', { id: 'codigo', type: 'password', class: 'entrada', autocomplete: 'current-password', placeholder: 'Código de acesso', 'aria-label': 'Código de acesso' });
    var erro = el('p', { class: 'erro-campo', role: 'alert', hidden: !msg, text: msg || '' });
    var btn = el('button', { type: 'submit', class: 'btn btn-primario', text: 'Entrar' });
    var form = el('form', { class: 'cartao entrar' },
      el('label', { class: 'pergunta', for: 'codigo', text: 'Código de acesso' }),
      el('div', { class: 'campo-linha' }, inp, btn), erro,
      el('p', { class: 'dica', style: 'margin-top:12px;font-size:13.5px;color:var(--suave)', text: 'O código é o mesmo para toda a coordenação. Depois de entrar, o painel fica aberto neste aparelho por algumas horas.' }));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!inp.value.trim()) { erro.textContent = 'Digite o código de acesso.'; erro.hidden = false; return; }
      btn.disabled = true; btn.textContent = 'Entrando…';
      api('entrar', { codigo: inp.value.trim() }).then(function (r) {
        btn.disabled = false; btn.textContent = 'Entrar';
        if (!r.ok) { erro.textContent = r.mensagem; erro.hidden = false; inp.select(); return; }
        S.token = r.token; gravarToken(r.token); S.acoes = null;
        if (!window.location.hash || window.location.hash === '#lista') rotear(); else rotear();
      }).catch(function () { btn.disabled = false; btn.textContent = 'Entrar'; erro.textContent = 'Sem conexão com o servidor. Tente de novo.'; erro.hidden = false; });
    });
    app.appendChild(form);
    setTimeout(function () { inp.focus(); }, 50);
  }

  // ================================ Lista ================================
  function telaLista() {
    topo('Coordenação', 'Painel das avaliações', 'Crie ações educacionais, divulgue os formulários e acompanhe os resultados.', [
      el('button', { type: 'button', class: 'btn btn-ouro', text: '+ Nova ação', onclick: function () { ir('nova'); } }),
      el('button', { type: 'button', class: 'btn btn-escuro-borda btn-peq', text: 'Atualizar', onclick: function () { S.acoes = null; carregarLista(telaLista); } }),
      S.planilha ? el('a', { class: 'btn btn-escuro-borda btn-peq', href: S.planilha, target: '_blank', rel: 'noopener', text: 'Abrir planilha' }) : null,
      el('button', { type: 'button', class: 'btn btn-escuro-borda btn-peq', text: 'Trocar código', onclick: trocarCodigo }),
      el('button', { type: 'button', class: 'btn btn-escuro-borda btn-peq', text: 'Sair', onclick: sair }),
    ]);
    if (!S.acoes) { carregarLista(telaLista); return; }
    limpar(app);
    if (!S.acoes.length) {
      app.appendChild(el('div', { class: 'cartao vazio' },
        el('h2', { text: 'Nenhuma ação cadastrada ainda' }),
        el('p', { text: 'Comece criando a primeira ação educacional. Depois é só copiar os links ou mostrar o QR code para a turma.' }),
        el('button', { type: 'button', class: 'btn btn-primario', text: '+ Criar a primeira ação', onclick: function () { ir('nova'); } })));
      return;
    }
    app.appendChild(el('div', { class: 'lista-acoes' }, S.acoes.map(cartaoAcao)));
  }

  function cartaoAcao(a) {
    var r = a.respostas;
    var aberta = a.status === 'aberta';
    var porInstrutor = r.totalInstrutores || 0;
    return el('article', { class: 'cartao acao-card' },
      el('div', { class: 'acao-topo' },
        el('span', { class: 'pill ' + a.status, text: aberta ? 'Aberta' : 'Encerrada' }),
        el('span', { class: 'acao-id', text: a.id })),
      el('h2', { text: a.nome || '(sem nome)' }),
      el('p', { class: 'acao-meta', text: [a.datas, a.local].filter(Boolean).join(' · ') }),
      el('div', { class: 'numeros' },
        el('div', { class: 'numero' }, el('b', { text: String(r.reacao) }), el('span', { text: 'respostas na Reação' })),
        el('div', { class: 'numero' }, el('b', { text: r.instrutores + '/' + porInstrutor }), el('span', { text: 'instrutores responderam' })),
        el('div', { class: 'numero' }, el('b', { text: r.coordenacao + '/' + porInstrutor }), el('span', { text: 'avaliados pela coordenação' }))),
      el('div', { class: 'acoes-card' },
        el('button', { type: 'button', class: 'btn btn-primario btn-peq', text: 'Links e QR code', onclick: function () { ir('links=' + a.id); } }),
        el('button', { type: 'button', class: 'btn btn-secundario btn-peq', text: 'Resultados', onclick: function () { ir('resultados=' + a.id); } }),
        el('button', { type: 'button', class: 'btn btn-secundario btn-peq', text: 'Editar', onclick: function () { ir('editar=' + a.id); } }),
        el('button', { type: 'button', class: 'btn btn-secundario btn-peq', text: aberta ? 'Encerrar' : 'Reabrir',
          onclick: function (ev) { mudarStatus(a, aberta ? 'encerrada' : 'aberta', ev.currentTarget); } })));
  }

  function mudarStatus(a, status, botao) {
    botao.disabled = true; botao.textContent = status === 'encerrada' ? 'Encerrando…' : 'Reabrindo…';
    api('status', { id: a.id, status: status }).then(function (r) {
      if (!r.ok) { avisar(r.mensagem); botao.disabled = false; botao.textContent = status === 'encerrada' ? 'Encerrar' : 'Reabrir'; return; }
      a.status = status;
      avisar(status === 'encerrada' ? 'Avaliação encerrada. Os links deixam de aceitar respostas.' : 'Avaliação reaberta.');
      telaLista();
    }).catch(function (e) { if (e.message !== 'sessao') { avisar('Sem conexão. Tente de novo.'); botao.disabled = false; } });
  }

  function sair() {
    api('sair').catch(function () {});
    S.token = ''; gravarToken(''); S.acoes = null;
    window.location.hash = '';
    telaEntrar();
  }

  function trocarCodigo() {
    topo('Coordenação', 'Trocar código de acesso', 'O código novo passa a valer na hora para toda a coordenação.', null,
      { texto: 'Voltar às ações', acao: function () { ir('lista'); } });
    limpar(app);
    var inp = el('input', { id: 'novo-codigo', type: 'text', class: 'entrada', autocomplete: 'new-password', minlength: '8', maxlength: '60' });
    var erro = el('p', { class: 'erro-campo', role: 'alert', hidden: true });
    var form = el('form', { class: 'cartao entrar form-acao' },
      el('label', { class: 'rotulo', for: 'novo-codigo', text: 'Novo código (mínimo de 8 caracteres)' }), inp, erro,
      el('div', { class: 'barra-salvar' }, el('button', { type: 'submit', class: 'btn btn-primario', text: 'Salvar código' })));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      api('trocar_codigo', { novo: inp.value }).then(function (r) {
        if (!r.ok) { erro.textContent = r.mensagem; erro.hidden = false; return; }
        avisar('Código trocado. Use o novo da próxima vez que entrar.'); ir('lista');
      }).catch(function () { erro.textContent = 'Sem conexão. Tente de novo.'; erro.hidden = false; });
    });
    app.appendChild(form);
  }

  // ============================== Formulário ==============================
  var TURNOS_SUGERIDOS = ['Matutino', 'Vespertino', 'Noturno', 'Ambos os turnos'];

  function telaForm(a) {
    var editando = !!a;
    topo(editando ? 'Editar ação' : 'Nova ação', editando ? a.nome : 'Cadastrar ação educacional',
      editando ? 'Altere os dados e salve. Os links continuam os mesmos.' : 'Preencha os dados abaixo. Os links ficam prontos assim que você salvar.',
      null, { texto: 'Voltar às ações', acao: function () { ir('lista'); } });
    limpar(app);

    var dados = editando ? JSON.parse(JSON.stringify(a)) : {
      nome: '', datas: '', local: 'Auditório da Academia da Polícia Penal', coordenacao: ultimaCoordenacao(),
      turnos: ['Matutino', 'Vespertino', 'Ambos os turnos'], encerramento: '', disciplinas: [{ nome: '', instrutores: [] }],
    };
    if (!dados.disciplinas.length) dados.disciplinas = [{ nome: '', instrutores: [] }];
    var sugestoesInstrutores = todosInstrutores();

    var campo = function (id, rotulo, valor, extra) {
      var inp = el('input', Object.assign({ id: 'f-' + id, type: 'text', class: 'entrada' }, extra || {}));
      inp.value = valor || '';
      inp.addEventListener('input', function () { dados[id] = inp.value; inp.classList.remove('is-invalido'); });
      return el('div', { id: 'c-' + id }, el('label', { class: 'rotulo', for: 'f-' + id, text: rotulo }), inp,
        el('p', { class: 'erro-campo', id: 'e-' + id, hidden: true }));
    };

    // Turnos
    var boxTurnos = el('div', { id: 'c-turnos' });
    function desenharTurnos() {
      limpar(boxTurnos);
      var opcoes = TURNOS_SUGERIDOS.concat(dados.turnos.filter(function (t) { return TURNOS_SUGERIDOS.indexOf(t) === -1; }));
      var addInp = el('input', { type: 'text', class: 'entrada', placeholder: 'Outro turno', 'aria-label': 'Outro turno', maxlength: '40' });
      var add = function () { var v = addInp.value.trim(); if (v && dados.turnos.indexOf(v) === -1) dados.turnos.push(v); desenharTurnos(); };
      addInp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); add(); } });
      anexar(boxTurnos, [
        el('span', { class: 'rotulo', id: 'rot-turnos', text: 'Turnos que o aluno pode escolher' }),
        el('div', { class: 'chips', role: 'group', 'aria-labelledby': 'rot-turnos' }, opcoes.map(function (t) {
          var ligado = dados.turnos.indexOf(t) !== -1;
          return el('button', { type: 'button', class: 'chip alternavel', 'aria-pressed': ligado ? 'true' : 'false', text: t,
            onclick: function () {
              if (ligado) dados.turnos = dados.turnos.filter(function (x) { return x !== t; }); else dados.turnos.push(t);
              desenharTurnos();
            } });
        })),
        el('div', { class: 'add-linha' }, addInp, el('button', { type: 'button', class: 'btn btn-secundario', text: 'Adicionar', onclick: add })),
        el('p', { class: 'erro-campo', id: 'e-turnos', hidden: true }),
      ]);
    }
    desenharTurnos();

    // Disciplinas e instrutores
    var boxDisc = el('div', { id: 'c-disciplinas' });
    var listaSug = el('datalist', { id: 'sug-instrutores' }, sugestoesInstrutores.map(function (n) { return el('option', { value: n }); }));
    function desenharDisciplinas(focar) {
      limpar(boxDisc);
      dados.disciplinas.forEach(function (d, i) {
        var nomeInp = el('input', { id: 'f-disc' + i, type: 'text', class: 'entrada', placeholder: 'Nome da disciplina', maxlength: '200', 'aria-label': 'Nome da disciplina ' + (i + 1) });
        nomeInp.value = d.nome;
        nomeInp.addEventListener('input', function () { d.nome = nomeInp.value; nomeInp.classList.remove('is-invalido'); });
        var instInp = el('input', { type: 'text', class: 'entrada', placeholder: 'Nome do(a) instrutor(a)', list: 'sug-instrutores', maxlength: '120', 'aria-label': 'Instrutor(a) da disciplina ' + (i + 1) });
        var addInst = function () {
          var v = instInp.value.trim().replace(/\s+/g, ' ');
          if (v && d.instrutores.indexOf(v) === -1) d.instrutores.push(v);
          desenharDisciplinas(i);
        };
        instInp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); addInst(); } });
        boxDisc.appendChild(el('div', { class: 'disc', id: 'c-disc' + i },
          el('div', { class: 'disc-topo' }, el('b', { text: 'Disciplina ' + (i + 1) }),
            dados.disciplinas.length > 1 ? el('button', { type: 'button', class: 'btn-remover', text: 'Remover',
              onclick: function () { dados.disciplinas.splice(i, 1); desenharDisciplinas(); } }) : null),
          nomeInp,
          el('div', { class: 'chips', style: 'margin-top:10px' }, d.instrutores.length ? d.instrutores.map(function (n, j) {
            return el('span', { class: 'chip' }, n, el('button', { type: 'button', 'aria-label': 'Remover ' + n, text: '×',
              onclick: function () { d.instrutores.splice(j, 1); desenharDisciplinas(); } }));
          }) : el('span', { class: 'dica', text: 'Nenhum(a) instrutor(a) ainda.' })),
          el('div', { class: 'add-linha' }, instInp, el('button', { type: 'button', class: 'btn btn-secundario', text: 'Adicionar', onclick: addInst })),
          el('p', { class: 'erro-campo', id: 'e-disc' + i, hidden: true })));
        if (focar === i) setTimeout(function () { instInp.focus(); }, 0);
      });
      boxDisc.appendChild(el('button', { type: 'button', class: 'btn btn-secundario', style: 'margin-top:10px', text: '+ Adicionar disciplina',
        onclick: function () { dados.disciplinas.push({ nome: '', instrutores: [] }); desenharDisciplinas(); document.getElementById('f-disc' + (dados.disciplinas.length - 1)).focus(); } }));
      boxDisc.appendChild(el('p', { class: 'erro-campo', id: 'e-disciplinas', hidden: true }));
    }
    desenharDisciplinas();

    var enc = el('input', { id: 'f-encerramento', type: 'date', class: 'entrada' });
    enc.value = dados.encerramento || '';
    enc.addEventListener('input', function () { dados.encerramento = enc.value; });

    var temRespostas = editando && (a.respostas.reacao + a.respostas.instrutores + a.respostas.coordenacao + a.respostas.alunos360) > 0;
    var erroGeral = el('div', { class: 'resumo-erro', role: 'alert', hidden: true });
    var salvar = el('button', { type: 'submit', class: 'btn btn-primario', text: editando ? 'Salvar alterações' : 'Salvar e gerar links' });

    var form = el('form', { class: 'form-acao', novalidate: true },
      erroGeral,
      temRespostas ? el('div', { class: 'aviso' }, el('p', { text: 'Esta ação já tem respostas. Se mudar o nome de um(a) instrutor(a), as avaliações antigas ficam separadas das novas no resultado.' })) : null,
      el('div', { class: 'cartao' },
        el('h2', { class: 'grupo-titulo', style: 'margin-top:0', text: 'Dados da ação' }),
        el('div', { class: 'form-acao' },
          campo('nome', 'Nome da ação', dados.nome, { maxlength: '200', placeholder: 'Ex.: Seminário sobre …' }),
          el('div', { class: 'grade-2' },
            campo('datas', 'Data(s)', dados.datas, { maxlength: '100', placeholder: 'Ex.: 25/11/2026 ou 25 e 26/11/2026' }),
            campo('local', 'Local', dados.local, { maxlength: '200' })),
          campo('coordenacao', 'Coordenação', dados.coordenacao, { maxlength: '120' }),
          boxTurnos)),
      el('div', { class: 'cartao' },
        el('h2', { class: 'grupo-titulo', style: 'margin-top:0', text: 'Disciplinas e instrutores' }),
        el('p', { class: 'dica', style: 'margin:0 0 12px', text: 'Escreva o nome de cada instrutor(a) sempre igual: é por ele que as avaliações se juntam. Uma disciplina pode ter mais de um(a) instrutor(a).' }),
        boxDisc, listaSug),
      el('div', { class: 'cartao' },
        el('h2', { class: 'grupo-titulo', style: 'margin-top:0', text: 'Encerramento automático' }),
        el('label', { class: 'rotulo', for: 'f-encerramento', text: 'Fechar os formulários depois de (opcional)' }), enc,
        el('p', { class: 'dica', text: 'Depois desse dia, quem abrir o link vê "Avaliação encerrada". Você também pode encerrar a qualquer momento pelo painel.' })),
      el('div', { class: 'barra-salvar' },
        el('button', { type: 'button', class: 'btn btn-secundario', text: 'Cancelar', onclick: function () { ir('lista'); } }), salvar),
      editando ? blocoExcluir(a, temRespostas) : null);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      Array.prototype.forEach.call(form.querySelectorAll('.erro-campo'), function (p) { p.hidden = true; });
      Array.prototype.forEach.call(form.querySelectorAll('.is-invalido'), function (x) { x.classList.remove('is-invalido'); });
      erroGeral.hidden = true;
      // instrutor digitado e não adicionado entra também
      Array.prototype.forEach.call(boxDisc.querySelectorAll('input[list]'), function (inp, i) {
        var v = inp.value.trim(); if (v && dados.disciplinas[i].instrutores.indexOf(v) === -1) dados.disciplinas[i].instrutores.push(v);
      });
      salvar.disabled = true; salvar.textContent = 'Salvando…';
      api('salvar', { acao: { id: editando ? a.id : '', nome: dados.nome, datas: dados.datas, local: dados.local, coordenacao: dados.coordenacao,
        turnos: dados.turnos, encerramento: dados.encerramento, disciplinas: dados.disciplinas } }).then(function (r) {
        salvar.disabled = false; salvar.textContent = editando ? 'Salvar alterações' : 'Salvar e gerar links';
        if (!r.ok) {
          erroGeral.textContent = r.mensagem; erroGeral.hidden = false;
          var primeiro = null;
          (r.erros || []).forEach(function (e) {
            var p = document.getElementById('e-' + e.id); if (p) { p.textContent = e.mensagem; p.hidden = false; }
            var c = document.getElementById('f-' + e.id) || document.getElementById('c-' + e.id); if (c) { c.classList.add('is-invalido'); primeiro = primeiro || c; }
          });
          (primeiro || erroGeral).scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        S.acoes = null;
        avisar(editando ? 'Alterações salvas.' : 'Ação criada. Os links já estão prontos.');
        carregarLista(function () { ir('links=' + r.id); });
      }).catch(function (e) {
        salvar.disabled = false; salvar.textContent = editando ? 'Salvar alterações' : 'Salvar e gerar links';
        if (e.message !== 'sessao') { erroGeral.textContent = 'Não foi possível salvar. Verifique a internet e tente de novo.'; erroGeral.hidden = false; }
      });
    });
    app.appendChild(form);
  }
  function blocoExcluir(a, temRespostas) {
    var box = el('div', { class: 'cartao zona-excluir' });
    var desenhar = function (confirmando) {
      limpar(box);
      if (temRespostas) {
        anexar(box, [el('h2', { class: 'grupo-titulo', style: 'margin-top:0', text: 'Excluir ação' }),
          el('p', { class: 'dica', style: 'margin:0', text: 'Esta ação já tem respostas e não pode ser excluída. Se não for mais usada, encerre-a pela lista de ações.' })]);
        return;
      }
      anexar(box, [el('h2', { class: 'grupo-titulo', style: 'margin-top:0', text: 'Excluir ação' }),
        el('p', { class: 'dica', style: 'margin:0 0 10px', text: confirmando ? 'Tem certeza? A ação e suas disciplinas serão apagadas da planilha. Isso não pode ser desfeito.' : 'Disponível só enquanto a ação não tiver nenhuma resposta.' }),
        el('div', { class: 'barra-salvar', style: 'justify-content:flex-start' }, confirmando ? [
          el('button', { type: 'button', class: 'btn btn-perigo btn-peq', text: 'Sim, excluir', onclick: function (ev) {
            ev.currentTarget.disabled = true; ev.currentTarget.textContent = 'Excluindo…';
            api('excluir', { id: a.id }).then(function (r) {
              if (!r.ok) { avisar(r.mensagem); desenhar(false); return; }
              S.acoes = null; avisar('Ação excluída.'); ir('lista');
            }).catch(function (e) { if (e.message !== 'sessao') { avisar('Sem conexão. Tente de novo.'); desenhar(false); } });
          } }),
          el('button', { type: 'button', class: 'btn btn-secundario btn-peq', text: 'Não, manter', onclick: function () { desenhar(false); } }),
        ] : el('button', { type: 'button', class: 'btn btn-secundario btn-peq', text: 'Excluir esta ação', onclick: function () { desenhar(true); } }))]);
    };
    desenhar(false);
    return box;
  }
  function ultimaCoordenacao() { var a = (S.acoes || []).filter(function (x) { return x.coordenacao; })[0]; return a ? a.coordenacao : ''; }
  function todosInstrutores() {
    var l = [];
    (S.acoes || []).forEach(function (a) { a.disciplinas.forEach(function (d) { d.instrutores.forEach(function (n) { if (l.indexOf(n) === -1) l.push(n); }); }); });
    return l.sort(function (x, y) { return x.localeCompare(y, 'pt-BR'); });
  }

  // ================================ Links ================================
  function desenharQR(alvo, texto, tamanho) {
    limpar(alvo);
    if (window.QRCode) {
      new window.QRCode(alvo, { text: texto, width: tamanho, height: tamanho, colorDark: '#0F0F0F', colorLight: '#FFFFFF', correctLevel: window.QRCode.CorrectLevel.M });
      Array.prototype.forEach.call(alvo.querySelectorAll('img'), function (i) { i.alt = 'QR code: ' + texto; });
    } else {
      alvo.appendChild(el('p', { class: 'nada', text: 'Não foi possível gerar o QR code (sem conexão).' }));
    }
  }
  function baixarQR(alvo, nome) {
    var c = alvo.querySelector('canvas');
    if (!c) return;
    var a = el('a', { href: c.toDataURL('image/png'), download: nome + '.png' });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  function projetar(titulo, url) {
    limpar(projecao);
    var box = el('div', { class: 'qr-grande' });
    anexar(projecao, [
      el('button', { type: 'button', class: 'btn btn-escuro-borda btn-peq fechar', text: 'Fechar', onclick: fecharProjecao }),
      el('h2', { text: titulo }), box, el('p', { text: 'Aponte a câmera do celular para o código' }),
    ]);
    projecao.hidden = false;
    desenharQR(box, url, 720);
    document.addEventListener('keydown', escFechar);
  }
  function escFechar(ev) { if (ev.key === 'Escape') fecharProjecao(); }
  function fecharProjecao() { projecao.hidden = true; limpar(projecao); document.removeEventListener('keydown', escFechar); }

  function telaLinks(a) {
    var L = links(a.id);
    topo('Links e QR code', a.nome, [a.datas, a.local].filter(Boolean).join(' · '), [
      el('button', { type: 'button', class: 'btn btn-escuro-borda btn-peq', text: 'Editar ação', onclick: function () { ir('editar=' + a.id); } }),
      el('button', { type: 'button', class: 'btn btn-escuro-borda btn-peq', text: 'Ver resultados', onclick: function () { ir('resultados=' + a.id); } }),
    ], { texto: 'Voltar às ações', acao: function () { ir('lista'); } });
    limpar(app);
    if (a.status === 'encerrada') {
      app.appendChild(el('div', { class: 'aviso' }, el('p', { text: 'Esta ação está encerrada: os links abrem a tela "Avaliação encerrada". Reabra pela lista de ações para voltar a receber respostas.' })));
    }
    var cartao = function (titulo, texto, url, arquivo) {
      var qr = el('div', { class: 'qr' });
      var c = el('div', { class: 'cartao link-card' },
        el('div', null,
          el('h2', { text: titulo }), el('p', { text: texto }),
          el('div', { class: 'url', text: url }),
          el('div', { class: 'link-botoes' },
            el('button', { type: 'button', class: 'btn btn-primario btn-peq', text: 'Copiar link', onclick: function () { copiar(url); } }),
            el('button', { type: 'button', class: 'btn btn-secundario btn-peq', text: 'Mostrar no projetor', onclick: function () { projetar(titulo, url); } }),
            el('button', { type: 'button', class: 'btn btn-secundario btn-peq', text: 'Baixar QR code', onclick: function () { baixarQR(qr, arquivo); } }),
            el('a', { class: 'btn btn-secundario btn-peq', href: url, target: '_blank', rel: 'noopener', text: 'Abrir' }))),
        qr);
      setTimeout(function () { desenharQR(qr, url, 300); }, 0);
      return c;
    };
    var msg = 'Avaliação da ação "' + a.nome + '"' + (a.datas ? ' (' + a.datas + ')' : '') + '\n\n' +
      'Avaliação de Reação (alunos, anônima):\n' + L.reacao + '\n\n' +
      'Avaliação 360° do Corpo Docente (alunos, instrutores e coordenação):\n' + L.p360;
    var txt = el('textarea', { class: 'entrada', readonly: true, 'aria-label': 'Mensagem pronta' }); txt.value = msg;
    app.appendChild(el('div', { class: 'links' },
      cartao('Avaliação de Reação', 'Para os alunos, no fim da aula. Anônima.', L.reacao, 'qr-reacao-' + a.id),
      cartao('Avaliação 360° do Corpo Docente', 'Para alunos, instrutores e coordenação. Cada perfil avalia todos de uma vez.', L.p360, 'qr-360-' + a.id),
      cartao('Página com os dois formulários', 'Um único link que leva às duas avaliações.', L.escolha, 'qr-avaliacoes-' + a.id),
      el('div', { class: 'cartao mensagem-pronta' },
        el('h2', { class: 'grupo-titulo', style: 'margin-top:0', text: 'Mensagem pronta para o WhatsApp' }), txt,
        el('div', { class: 'barra-salvar', style: 'margin-top:10px' },
          el('button', { type: 'button', class: 'btn btn-primario btn-peq', text: 'Copiar mensagem', onclick: function () { copiar(msg, 'Mensagem'); } })))));
  }

  // ============================== Resultados ==============================
  function telaResultados(a, aba) {
    topo('Resultados', a.nome, [a.datas, a.local].filter(Boolean).join(' · '), [
      el('button', { type: 'button', class: 'btn btn-escuro-borda btn-peq', text: 'Atualizar', onclick: function () { delete S.resultados[a.id]; telaResultados(a, S.aba); } }),
      S.planilha ? el('a', { class: 'btn btn-escuro-borda btn-peq', href: S.planilha, target: '_blank', rel: 'noopener', text: 'Abrir planilha' }) : null,
    ], { texto: 'Voltar às ações', acao: function () { ir('lista'); } });
    var r = S.resultados[a.id];
    if (!r) {
      carregando('Calculando os resultados…');
      api('resultados', { id: a.id }).then(function (res) {
        if (!res.ok) { erroCartao(res.mensagem || 'Não foi possível calcular.', function () { telaResultados(a, aba); }); return; }
        S.resultados[a.id] = res; telaResultados(a, aba);
      }).catch(function (e) { if (e.message !== 'sessao') erroCartao('Sem conexão com o servidor.', function () { telaResultados(a, aba); }); });
      return;
    }
    S.aba = aba || S.aba || 'reacao';
    limpar(app);
    var abas = [['reacao', 'Reação'], ['docentes', 'Corpo docente'], ['turma', 'Turma e coordenação'], ['comentarios', 'Comentários']];
    app.appendChild(el('div', { class: 'abas', role: 'tablist' }, abas.map(function (x) {
      return el('button', { type: 'button', role: 'tab', 'aria-selected': S.aba === x[0] ? 'true' : 'false', text: x[1],
        onclick: function () { telaResultados(a, x[0]); } });
    })));
    var corpo = el('div', { role: 'tabpanel' });
    app.appendChild(corpo);
    if (S.aba === 'reacao') resReacao(corpo, r.reacao);
    else if (S.aba === 'docentes') resDocentes(corpo, r.r360);
    else if (S.aba === 'turma') resTurma(corpo, r.r360);
    else resComentarios(corpo, r);
  }

  function tile(valor, rotulo, destaque) { return el('div', { class: 'tile' + (destaque ? ' destaque' : '') }, el('b', { text: valor }), el('span', { text: rotulo })); }
  function secao(titulo, sub, conteudo) { return el('section', { class: 'cartao secao-res' }, el('h2', { text: titulo }), sub ? el('p', { class: 'sub', text: sub }) : null, conteudo); }
  function barra(rot, valor, max, extra, ouro, sufixo) {
    var pct = valor === null || valor === undefined ? 0 : Math.max(0, Math.min(100, 100 * valor / max));
    return el('div', { class: 'barra-item' }, el('span', { class: 'rot', text: rot }), el('span', { class: 'val', text: num(valor, sufixo === '%' ? 0 : 2) + (valor !== null && sufixo ? sufixo : '') }),
      el('div', { class: 'trilho', 'aria-hidden': 'true' }, el('span', { class: ouro ? 'ouro' : '', style: 'width:' + pct + '%' })),
      extra ? el('span', { class: 'extra', text: extra }) : null);
  }
  function mediaDe(l) { var v = l.filter(function (x) { return x !== null && x !== undefined; }); return v.length ? v.reduce(function (s, x) { return s + x; }, 0) / v.length : null; }

  function resReacao(c, R) {
    if (!R.n) { c.appendChild(el('div', { class: 'cartao vazio' }, el('p', { text: 'Ainda não há respostas na Avaliação de Reação desta ação.' }))); return; }
    var acao = R.itens.filter(function (i) { return i.grupo === 'Ação'; });
    var aplic = R.itens.filter(function (i) { return i.grupo !== 'Ação'; });
    var conc = mediaDe(acao.map(function (i) { return i.concordam; }));
    c.appendChild(el('div', { class: 'tiles' },
      tile(String(R.n), 'respostas recebidas', true),
      tile(num(mediaDe(acao.map(function (i) { return i.media; }))), 'média geral (1 a 5)'),
      tile(conc === null ? '—' : num(conc, 0) + '%', 'concordam ou concordam totalmente'),
      tile(R.nps.n ? (R.nps.nps > 0 ? '+' : '') + num(R.nps.nps, 0) : '—', 'NPS (de −100 a +100)')));
    var it = function (i) { return barra(i.texto, i.media, 5, i.n + ' respostas válidas' + (i.na ? ' · ' + i.na + ' "Não se aplica"' : '') + (i.concordam !== null ? ' · ' + i.concordam + '% concordam' : '')); };
    c.appendChild(secao('Avaliação da ação', 'Média de 1 (discordo totalmente) a 5 (concordo totalmente). "Não se aplica" não entra na média.', el('div', { class: 'barras' }, acao.map(it))));
    c.appendChild(secao('Aplicação no trabalho', null, el('div', { class: 'barras' }, aplic.map(it))));
    if (R.nps.n) {
      c.appendChild(secao('Recomendação', 'Notas de 0 a 10. Média ' + num(R.nps.media) + '.', el('div', { class: 'barras' },
        barra('Promotores (9 e 10)', R.nps.promotores, 100, null, true, '%'),
        barra('Neutros (7 e 8)', R.nps.neutros, 100, null, false, '%'),
        barra('Detratores (0 a 6)', R.nps.detratores, 100, null, false, '%'))));
    }
    c.appendChild(secao('Ganho de competência', 'Como os alunos avaliaram o próprio domínio do tema antes e depois da ação (1 = nenhum, 5 = pleno).',
      el('div', { class: 'ganho' }, R.ganho.map(function (g) {
        return el('div', { class: 'ganho-item' },
          el('p', { class: 'rot' }, g.disciplina, g.ganho !== null ? el('span', { class: 'delta', text: (g.ganho > 0 ? '+' : '') + num(g.ganho) }) : null),
          el('div', { class: 'ganho-linhas' },
            el('span', { text: 'Antes' }), el('div', { class: 'trilho' }, el('span', { style: 'width:' + (g.antes ? 20 * g.antes : 0) + '%' })), el('b', { text: num(g.antes) }),
            el('span', { text: 'Depois' }), el('div', { class: 'trilho' }, el('span', { class: 'depois', style: 'width:' + (g.depois ? 20 * g.depois : 0) + '%' })), el('b', { text: num(g.depois) })));
      }))));
    c.appendChild(secao('O que pode dificultar a aplicação', '% dos alunos que marcaram cada opção.',
      el('div', { class: 'barras' }, R.dificuldades.slice().sort(function (x, y) { return y.n - x.n; }).map(function (d) {
        return barra(d.opcao, d.pct, 100, d.n + ' aluno(s)', false, '%');
      }))));
  }

  function notaCel(v) {
    if (v === null || v === undefined) return el('span', { class: 'cel-nota', text: '—' });
    return el('span', { class: 'cel-nota n' + Math.round(v), text: num(v) });
  }

  function resDocentes(c, R) {
    var E = R.envios;
    c.appendChild(el('div', { class: 'tiles' },
      tile(String(E.alunos), 'alunos responderam o 360°', true),
      tile(E.instrutores + '/' + E.totalInstrutores, 'instrutores responderam'),
      tile(E.coordenacao + '/' + E.totalInstrutores, 'avaliados pela coordenação'),
      tile(num(mediaDe(R.instrutores.map(function (i) { return i.mediaPerspectivas; }))), 'média geral do corpo docente')));
    var rot = ['Alunos', 'Coordenação', 'Autoavaliação', 'Pares'];
    R.instrutores.forEach(function (i) {
      var tabela = el('div', { class: 'tabela-rolagem' }, el('table', null,
        el('thead', null, el('tr', null, el('th', { text: 'Critério' }), rot.map(function (r) { return el('th', { text: r }); }), el('th', { text: 'Média' }))),
        el('tbody', null, i.criterios.map(function (cr) {
          return el('tr', null, el('td', { text: cr.texto }), cr.valores.map(function (v) { return el('td', null, notaCel(v)); }), el('td', { class: 'forte' }, notaCel(cr.geral)));
        }))));
      c.appendChild(el('section', { class: 'cartao secao-res inst-res' },
        el('div', { class: 'inst-cab' }, el('span', { class: 'avatar', 'aria-hidden': 'true', text: iniciais(i.nome) }),
          el('div', null, el('h3', { text: i.nome }), i.disciplinas ? el('p', { text: i.disciplinas }) : null)),
        el('div', { class: 'persp' }, rot.map(function (r, k) {
          return el('div', null, el('b', { text: num(i.geral[k]) }), el('span', { text: r + ' (' + i.avaliacoes[k] + ')' }));
        })),
        el('div', { class: 'info-linha' },
          el('span', null, 'Média das perspectivas: ', el('b', { text: num(i.mediaPerspectivas) })),
          i.diferencaAuto !== null ? el('span', null, 'Autoavaliação × demais: ', el('b', { text: (i.diferencaAuto > 0 ? '+' : '') + num(i.diferencaAuto) })) : null,
          i.colaboracao !== null ? el('span', null, 'Colaboração (pares): ', el('b', { text: num(i.colaboracao) })) : null),
        tabela,
        el('details', { class: 'grupo-com' }, el('summary', { text: 'Compromissos institucionais (coordenação)' }),
          el('div', { class: 'barras', style: 'margin-top:12px' }, i.compromissos.map(function (x) { return barra(x.texto, x.media, 5); })))));
    });
    c.appendChild(secao('Avaliação do curso pelos instrutores', 'Item 12 do Plano de Capacitação. Escala de 1 a 5.',
      el('div', { class: 'barras' }, R.curso.map(function (x) { return barra(x.texto, x.media, 5, null, true); }))));
  }

  function resTurma(c, R) {
    c.appendChild(secao('Avaliação da coordenação pelos instrutores', 'Escala de 1 a 5.',
      el('div', { class: 'barras' }, R.coordenacao.map(function (x) { return barra(x.texto, x.media, 5, null, true); }))));
    c.appendChild(secao('Avaliação da turma por turno', 'Feita pelos instrutores, de 1 a 5.', el('div', { class: 'tabela-rolagem' }, el('table', null,
      el('thead', null, el('tr', null, el('th', { text: 'Item' }), R.turma.turnos.map(function (t) { return el('th', { text: t }); }), el('th', { text: 'Geral' }))),
      el('tbody', null, R.turma.itens.map(function (it) {
        return el('tr', null, el('td', { text: it.texto }), it.porTurno.map(function (v) { return el('td', null, notaCel(v)); }), el('td', { class: 'forte' }, notaCel(it.geral)));
      }))))));
    c.appendChild(secao('Relatos de situações em sala', 'Registrados pelos instrutores no formulário do 360°.',
      R.relatos.length ? el('ul', { class: 'relatos' }, R.relatos.map(function (r) {
        return el('li', null, r.texto, el('small', { text: r.instrutor + (r.turno ? ' · ' + r.turno : '') }));
      })) : el('p', { class: 'nada', text: 'Nenhum relato registrado.' })));
  }

  function resComentarios(c, res) {
    var grupo = function (titulo, lista, aberto) {
      return el('details', { class: 'grupo-com', open: aberto }, el('summary', { text: titulo + ' (' + lista.length + ')' }),
        lista.length ? el('ul', { class: 'comentarios' }, lista.map(function (t) {
          return typeof t === 'string' ? el('li', { text: t }) : el('li', null, t.texto, el('small', { text: t.de }));
        })) : el('p', { class: 'nada', style: 'margin-top:10px', text: 'Nenhum comentário.' }));
    };
    var R = res.reacao.comentarios, D = res.r360;
    var porInst = function (campo) {
      var l = []; D.instrutores.forEach(function (i) { i.comentarios[campo].forEach(function (t) { l.push({ texto: t, de: 'Sobre ' + i.nome }); }); }); return l;
    };
    c.appendChild(el('div', null,
      grupo('O que mais contribuiu para a aprendizagem', R.contribuiu, true),
      grupo('O que deveria ser melhorado', R.melhorar),
      grupo('Temas sugeridos para futuras ações', R.temas),
      grupo('Outras dificuldades citadas', R.outraDificuldade),
      grupo('Alunos sobre os instrutores', porInst('alunos')),
      grupo('Coordenação sobre os instrutores', porInst('coordenacao')),
      grupo('Instrutores sobre os colegas', porInst('pares')),
      grupo('Instrutores sobre a coordenação', D.comentariosCoordenacao),
      grupo('Participação e dificuldades das turmas', D.participacao),
      grupo('Sugestões dos instrutores para futuras edições', D.sugestoes)));
  }

  rotear();
})();

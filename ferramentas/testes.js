// Testes automatizados do servidor (executados por ferramentas/testar.sh).
/* eslint-disable */
var __res = [];
function ok(nome, cond, det) { __res.push((cond ? 'OK     ' : 'FALHOU ') + nome + (cond || det === undefined ? '' : '  → ' + JSON.stringify(det))); }
function aba(n) { return __ss.getSheetByName(n); }
function tabela(n) { return lerTabela_(aba(n)); }
function linhasDe(n) { return tabela(n).linhas; }
function valor(t, linha, cab) { return linha[t.idx[cab]]; }

// ---------------------------------- setup ----------------------------------
setup();
ok('setup cria as 8 abas', __ss.getSheets().map(function (s) { return s.getName(); }).sort().join(',') ===
   'Acoes,Consolidado,Disciplinas,Participacao,Respostas_360,Respostas_Reacao,Turma,Unidades',
   __ss.getSheets().map(function (s) { return s.getName(); }));
ok('setup renomeia a planilha', __ss.getName() === NOME_PLANILHA);
setup(); // idempotente
ok('setup pode rodar de novo sem duplicar o exemplo', linhasDe('Acoes').length === 1 && linhasDe('Disciplinas').length === 3);
ok('exemplo usa somente nomes genéricos', JSON.stringify(aba('Disciplinas').dados).indexOf('Instrutor(a) 1') > 0);

var acao = carregarAcao_('exemplo-01');
ok('ação de exemplo carregada (ID sem diferenciar maiúsculas)', acao && acao.instrutores.length === 3, acao);
ok('disciplina com 2 instrutores agrupada', acao.disciplinas.length === 2 && acao.disciplinas[1].instrutores.length === 2);

// --------------------------------- páginas ---------------------------------
var pR = montarDadosPagina_('EXEMPLO-01', 'aluno');
var p3 = montarDadosPagina_('EXEMPLO-01', '360');
var etA = pR.definicao.etapas.filter(function (e) { return e.id !== 'matricula'; });
ok('aluno: fluxo único (matrícula + 4 etapas da Reação + 3 instrutores)', pR.tela === 'formulario' && pR.definicao.tipo === 'aluno' && pR.definicao.etapas.length === 8 && pR.definicao.etapas[0].id === 'matricula', pR.definicao && pR.definicao.etapas.map(function (e) { return e.id; }));
ok('link antigo de Reação abre o fluxo do aluno', montarDadosPagina_('EXEMPLO-01', 'reacao').definicao.tipo === 'aluno');
ok('360° não oferece mais o perfil de aluno', p3.definicao.etapaPerfil.perguntas[0].opcoes.map(function (o) { return o.valor; }).join() === 'coordenacao,instrutor');
ok('Reação: 9 afirmações', etA[1].perguntas[0].itens.length === 9);
ok('Reação: antes/depois por disciplina', etA[2].perguntas[0].itens.length === 2);
function enviarAluno(extra, mat, envio) {
  var r = respostasDeExemplo_(etA); r.matricula = mat;
  Object.keys(extra || {}).forEach(function (k) { r[k] = extra[k]; });
  return salvarResposta({ acao: 'EXEMPLO-01', form: 'aluno', envioId: envio, respostas: r });
}
ok('links do site gerados para a ação', linksDaAcao_('https://exemplo.github.io/appdf/', 'EXEMPLO-01').p360 === 'https://exemplo.github.io/appdf/?acao=EXEMPLO-01&form=360');
ok('API: doGet devolve JSON com os dados', JSON.parse(doGet({ parameter: { api: 'dados', acao: 'EXEMPLO-01', form: '360' } }).__texto).tela === 'formulario');
ok('cache: segunda leitura usa o cache', (function () { dadosComCache_('EXEMPLO-01', 'reacao'); var n = Object.keys(__cache).filter(function (k) { return k.indexOf('dados:') === 0; }).length; dadosComCache_('EXEMPLO-01', 'reacao'); return n >= 1 && Object.keys(__cache).filter(function (k) { return k.indexOf('dados:') === 0; }).length === n; })());
ok('cache: edição na aba Acoes invalida', (function () { var v = __cache.dados_ver; onEdit({ range: { getSheet: function () { return { getName: function () { return 'Acoes'; } }; } } }); return __cache.dados_ver !== v; })());
ok('API: doPost recusa corpo inválido', JSON.parse(doPost({ postData: { contents: '{x' } }).__texto).ok === false);
ok('página 360°: três perfis', p3.tela === 'formulario' && Object.keys(p3.definicao.ramos).join() === 'aluno,coordenacao,instrutor');
ok('360° aluno: uma etapa por instrutor, todas no mesmo envio', p3.definicao.ramos.aluno.length === 3);
ok('360° coordenação: uma etapa por instrutor', p3.definicao.ramos.coordenacao.length === 3);
ok('360° instrutor: formulário único (turma, auto, 3 colegas, curso, coordenação, final)', p3.definicao.ramos.instrutor.length === 8);
ok('instrutor não vê a própria etapa de pares', etapasDoRamo_(p3.definicao.ramos.instrutor, { in_nome: 'Instrutor(a) 2' }).filter(function (e) { return e.paraColega; }).map(function (e) { return e.paraColega; }).join() === 'Instrutor(a) 1,Instrutor(a) 3');
ok('coordenação não avalia mais a Ficha de Registro de Aula', COMPROMISSOS.join('|').indexOf('Ficha de Registro') === -1);
ok('360° critérios idênticos nas 4 perspectivas', (function () {
  var d = p3.definicao.ramos;
  var t = function (q) { return q.itens.slice(0, 8).map(function (i) { return i.texto; }).join('|'); };
  var ref = CRITERIOS_DOCENTE.join('|');
  return t(d.aluno[0].perguntas[0]) === ref && t(d.coordenacao[0].perguntas[0]) === ref &&
         t(d.instrutor[1].perguntas[0]) === ref && t(d.instrutor[2].perguntas[0]) === ref;
})());
ok('página de escolha sem form', montarDadosPagina_('EXEMPLO-01').tela === 'escolha');
ok('ação inexistente', montarDadosPagina_('NAO-EXISTE', 'reacao').tela === 'inexistente');
ok('link sem ação', montarDadosPagina_('', 'reacao').tela === 'sem_acao');

// ------------------------------ Aluno (Reação + 360°) ------------------------------
var respR = { acao_1: 'NA', acao_2: 5, dificuldades: ['Falta de apoio da chefia', '__outra'], dificuldades_outra: '=HYPERLINK("http://x")',
  aberta_contribuiu: '+55 61 0000', aberta_melhorar: '12/03', nome: 'campo extra que não deve ser gravado',
  al1_c1: 'NA', al1_c2: 5, al2_c1: 3 };
var r1 = enviarAluno(respR, '123.456-7', 'abc123');
ok('aluno: um envio grava Reação, 360° dos 3 instrutores e participação', r1.ok === true && linhasDe('Respostas_Reacao').length === 1 && linhasDe('Respostas_360').length === 3 && linhasDe('Participacao').length === 1, r1);
var r1b = enviarAluno(respR, '123.456-7', 'abc123');
ok('envio repetido (mesmo envioId) não duplica', r1b.ok && linhasDe('Respostas_Reacao').length === 1);
var r1c = enviarAluno({}, '1234567', 'outro-envio');
ok('a mesma matrícula não responde duas vezes', r1c.ok === false && r1c.codigo === 'ja_respondeu', r1c);
var tP = tabela('Participacao');
ok('participação guarda só matrícula normalizada e data (sem horário)', valor(tP, tP.linhas[0], 'Matrícula') === '1234567' && /^\d{2}\/\d{2}\/\d{4}$/.test(valor(tP, tP.linhas[0], 'Data')), tP.linhas[0]);
var tR = tabela('Respostas_Reacao');
var l = tR.linhas[0];
ok('"Não se aplica" gravado como texto', valor(tR, l, 'A1. ' + ITENS_ACAO[0]) === 'Não se aplica');
ok('escala gravada como número', valor(tR, l, 'A2. ' + ITENS_ACAO[1]) === 5);
ok('dificuldades com "Outra"', valor(tR, l, 'O que pode dificultar a aplicação do conteúdo na sua rotina?') === 'Falta de apoio da chefia; Outra');
ok('antes/depois gravados por disciplina', valor(tR, l, 'Domínio ANTES – Disciplina 1') === 2 && valor(tR, l, 'Domínio DEPOIS – Disciplina 2') === 4);
ok('nenhuma fórmula gravada (=, +, -, @)', __formulas.length === 0, __formulas);
ok('texto iniciado por = preservado como texto', valor(tR, l, 'Dificuldades – Outra (descrição)') === '=HYPERLINK("http://x")');
ok('texto que parece data fica como texto', valor(tR, l, 'O que deveria ser melhorado nas próximas edições?') === '12/03');
ok('nenhuma coluna de identificação nas respostas', !tR.cab.concat(tabela('Respostas_360').cab).some(function (c) { return /matr[íi]cula|cpf|e-mail|email|\bip\b/i.test(c); }), tR.cab);
var t3 = tabela('Respostas_360');
ok('aluno é anônimo no 360°', t3.linhas.every(function (x) { return valor(t3, x, 'Avaliador(a)') === 'Anônimo' && valor(t3, x, 'Perspectiva') === 'Aluno'; }));

var r2 = salvarResposta({ acao: 'EXEMPLO-01', form: 'aluno', respostas: { matricula: '2002' } });
ok('envio vazio recusado com lista de pendências', r2.ok === false && r2.erros.length >= 40, r2.erros && r2.erros.length);
var r3 = enviarAluno({ acao_3: 7, recomendacao: 11, turno: 'Noturno', aberta_temas: new Array(2002).join('a') }, '2003');
ok('valores fora da escala / opção inexistente / texto > 2000 recusados', r3.ok === false &&
   ['acao_3', 'recomendacao', 'turno', 'aberta_temas'].every(function (id) { return r3.erros.some(function (e) { return e.id === id; }); }), r3.erros);
ok('"Outra" marcada sem descrição é recusada', enviarAluno({ dificuldades: ['__outra'] }, '2004').ok === false);
var semAl2 = respostasDeExemplo_(etA); semAl2.matricula = '2005'; Object.keys(semAl2).filter(function (k) { return k.indexOf('al2_') === 0; }).forEach(function (k) { delete semAl2[k]; });
ok('aluno não envia sem avaliar todos os instrutores', salvarResposta({ acao: 'EXEMPLO-01', form: 'aluno', respostas: semAl2 }).ok === false);
ok('aluno não envia sem matrícula', enviarAluno({}, '').codigo === 'matricula');
ok('matrícula sem números é recusada', enviarAluno({}, 'abc').codigo === 'matricula');
ok('Reação sozinha (link antigo) é recusada', salvarResposta({ acao: 'EXEMPLO-01', form: 'reacao', respostas: {} }).codigo === 'desatualizado');
ok('360° com perfil aluno é recusado', salvarResposta({ acao: 'EXEMPLO-01', form: '360', perfil: 'aluno', respostas: {} }).codigo === 'desatualizado');
ok('verificar matrícula: livre', verificarMatricula({ acao: 'EXEMPLO-01', matricula: '999' }).ok === true);
ok('verificar matrícula: já respondeu', verificarMatricula({ acao: 'EXEMPLO-01', matricula: '1234567' }).codigo === 'ja_respondeu');

// ----------------------------------- 360° -----------------------------------
var d3 = p3.definicao;
function r360(perfil, extra) {
  var base = respostasDeExemplo_([d3.etapaPerfil].concat(d3.ramos[perfil]), { perfil: perfil });
  Object.keys(extra || {}).forEach(function (k) { base[k] = extra[k]; });
  return salvarResposta({ acao: 'EXEMPLO-01', form: '360', perfil: perfil, respostas: base });
}
var rc = r360('coordenacao', { co1_c1: 2 });
ok('coordenação: um envio grava os 3 instrutores', rc.ok && rc.linhas === 3, rc);
var rc2 = r360('coordenacao');
ok('coordenação não avalia o mesmo instrutor 2 vezes', rc2.ok === false && rc2.codigo === 'duplicado', rc2);
var p3b = montarDadosPagina_('EXEMPLO-01', '360');
ok('instrutores já avaliados somem da coordenação', p3b.definicao.ramos.coordenacao.every(function (e) { return e.jaAvaliado; }));
var ri1 = r360('instrutor', { in_nome: 'Instrutor(a) 1', in_c1: 5, in_relato: 'Projetor apresentou falha no turno da manhã.' });
ok('instrutor: um envio grava autoavaliação + 2 colegas', ri1.ok && ri1.linhas === 3, ri1);
var ri2 = r360('instrutor', { in_nome: 'Instrutor(a) 2', inp1_c1: 3, inp1_c9: 5 });
ok('segundo instrutor grava', ri2.ok, ri2);
var riDup = r360('instrutor', { in_nome: 'Instrutor(a) 1' });
ok('instrutor não responde 2 vezes', riDup.ok === false && riDup.codigo === 'duplicado', riDup);
ok('nome de quem já respondeu aparece bloqueado', montarDadosPagina_('EXEMPLO-01', '360').definicao.ramos.instrutor[0].perguntas[0].opcoes[0].desabilitada === true);
ok('perfil inválido recusado', salvarResposta({ acao: 'EXEMPLO-01', form: '360', perfil: 'admin', respostas: {} }).ok === false);
ok('formulário inválido recusado', salvarResposta({ acao: 'EXEMPLO-01', form: 'x' }).ok === false);
t3 = tabela('Respostas_360');
var porPersp = {};
t3.linhas.forEach(function (x) { var p = valor(t3, x, 'Perspectiva'); porPersp[p] = (porPersp[p] || 0) + 1; });
ok('linhas por perspectiva (3 aluno, 3 coord., 2 auto, 4 pares)', JSON.stringify(porPersp) === '{"Aluno":3,"Coordenação":3,"Autoavaliação":2,"Pares":4}', porPersp);
ok('nenhum instrutor avaliou a si mesmo como par', t3.linhas.every(function (x) { return valor(t3, x, 'Perspectiva') !== 'Pares' || valor(t3, x, 'Avaliador(a)') !== valor(t3, x, 'Instrutor(a) avaliado(a)'); }));
var linhaPar = t3.linhas.filter(function (x) { return valor(t3, x, 'Perspectiva') === 'Pares' && valor(t3, x, 'Instrutor(a) avaliado(a)') === 'Instrutor(a) 1'; })[0];
ok('pares: avaliador e colega corretos + C9', valor(t3, linhaPar, 'Avaliador(a)') === 'Instrutor(a) 2' && valor(t3, linhaPar, 'C9. ' + CRITERIO_COLABORACAO + ' (pares)') === 5);
var linhaAuto = t3.linhas.filter(function (x) { return valor(t3, x, 'Perspectiva') === 'Autoavaliação'; })[0];
ok('autoavaliação grava curso, turno, turma, coordenação e relato',
   valor(t3, linhaAuto, 'Curso – ' + ITENS_CURSO[0]) === 4 && valor(t3, linhaAuto, 'Turno em que ministrou aula') === 'Matutino' &&
   valor(t3, linhaAuto, 'Turma – ' + ITENS_TURMA[0]) === 4 && valor(t3, linhaAuto, 'Avaliação da coordenação – ' + ITENS_COORDENACAO[0]) === 4 &&
   /Projetor/.test(valor(t3, linhaAuto, 'Relato de situação ocorrida em sala')));

// -------------------------------- Consolidado --------------------------------
// Segunda resposta de Reação: A1 = 3 (a primeira foi "Não se aplica"), recomendação 5
ok('segundo aluno concluiu', enviarAluno({ acao_1: 3, recomendacao: 5, antes_1: 1, depois_1: 5, al1_c1: 'NA', al1_c2: 5 }, '3003').ok);
atualizarConsolidado();
var C = aba('Consolidado').dados;
function linhaC(prefixo, aPartirDe) {
  for (var i = aPartirDe || 0; i < C.length; i++) if (String(C[i][0]).indexOf(prefixo) === 0) return C[i];
  return null;
}
var a1 = linhaC('A1. ');
ok('consolidado: "Não se aplica" fora da média (A1 = 3, 1 válida, 1 N/A)', a1[1] === 3 && a1[2] === 1 && a1[3] === 1, a1);
var nps = linhaC('Respostas: 2');
ok('consolidado: NPS (9 e 5 → 50% promotores, 50% detratores, NPS 0)', nps && nps[1] === 7 && nps[2] === 50 && nps[4] === 50 && nps[5] === 0, nps);
var g1 = linhaC('1 – Disciplina 1');
ok('consolidado: ganho de competência (antes 1,5 → depois 4,5 = 3)', g1 && g1[1] === 1.5 && g1[2] === 4.5 && g1[3] === 3, g1);
var iInst1 = C.map(function (r) { return String(r[0]); }).indexOf('Instrutor(a): Instrutor(a) 1  |  Disciplina(s): 1 – Disciplina 1');
var c1 = linhaC('C1. ', iInst1);
ok('consolidado 360°: C1 por perspectiva (aluno N/A→—, coord 2, auto 5, par 3; média 3,33)',
   c1 && c1[1] === '—' && c1[2] === 2 && c1[3] === 5 && c1[4] === 3 && c1[5] === 3.33, c1);
var c2 = linhaC('C2. ', iInst1);
ok('consolidado 360°: C2 aluno = 5', c2 && c2[1] === 5, c2);
ok('consolidado separa instrutores', C.filter(function (r) { return String(r[0]).indexOf('Instrutor(a): ') === 0; }).length === 3);
var tu = linhaC(ITENS_TURMA[0]);
ok('consolidado: avaliação da turma por turno (Matutino 4, geral 4)', tu && tu[1] === 4 && tu[4] === 4, tu);
var co = linhaC(ITENS_COORDENACAO[0]);
ok('consolidado: avaliação da coordenação (média 4, 2 respostas)', co && co[1] === 4 && co[2] === 2, co);
ok('consolidado: relato listado com instrutor e turno', (function () { var r = linhaC('Projetor'); return r && r[1] === 'Instrutor(a) 1' && r[2] === 'Matutino'; })());

// ----------------------------------- Painel -----------------------------------
function P(op, extra) { var o = { api: 'painel', op: op }; Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; }); return JSON.parse(doPost({ postData: { contents: JSON.stringify(o) } }).__texto); }
ok('painel: código errado recusado', P('entrar', { codigo: 'errado' }).ok === false);
for (var tt = 0; tt < 8; tt++) P('entrar', { codigo: 'errado' + tt });
ok('painel: bloqueia após muitas tentativas', P('entrar', { codigo: CODIGO_PAINEL_INICIAL }).codigo === 'bloqueado');
delete __cache.painel_falhas;
var ent = P('entrar', { codigo: CODIGO_PAINEL_INICIAL.toUpperCase() });
ok('painel: código certo devolve token', ent.ok && /^[0-9a-f]{32,}$/i.test(ent.token), ent);
var TK = ent.token;
ok('painel: sem token não lista', P('listar', { token: 'x' }).codigo === 'sessao');
var lst = P('listar', { token: TK });
var ex = lst.acoes.filter(function (a) { return a.id === 'EXEMPLO-01'; })[0];
ok('painel: lista a ação de exemplo com contagens', lst.ok && ex && ex.respostas.reacao === 2 && ex.respostas.instrutores === 2 && ex.respostas.totalInstrutores === 3, ex && ex.respostas);
var tErr = P('salvar', { token: TK, acao: Object.assign({}, ex, { turma: '1234567 Aluno(a) 1\nlinha sem número' }) });
ok('painel: turma com linha sem matrícula é recusada', tErr.ok === false && tErr.erros.some(function (e) { return e.id === 'turma'; }), tErr);
var tOk = P('salvar', { token: TK, acao: Object.assign({}, ex, { turma: '123.456-7  Aluno(a) 1\n3003; Aluno(a) 2\nAluno(a) 3 - 5005\n\n5005 repetido' }) });
ok('painel: cadastra a turma colando "matrícula nome"', tOk.ok && tOk.turma === 3, tOk);
var tm = P('turma', { token: TK, id: 'EXEMPLO-01' });
ok('painel: mostra quem concluiu e quem falta', tm.ok && tm.total === 3 && tm.concluiram === 2 &&
   tm.alunos.filter(function (x) { return !x.concluiu; }).map(function (x) { return x.matricula + ' ' + x.nome; }).join() === '5005 Aluno(a) 3', tm);
var lst2 = P('listar', { token: TK }).acoes.filter(function (a) { return a.id === 'EXEMPLO-01'; })[0];
ok('painel: cartão mostra alunos que concluíram / turma', lst2.respostas.turma === 3 && lst2.respostas.concluiram === 2 && /5005 Aluno\(a\) 3/.test(lst2.turmaTexto), lst2.respostas);
ok('com turma cadastrada, matrícula de fora é recusada', verificarMatricula({ acao: 'EXEMPLO-01', matricula: '8888' }).codigo === 'fora_da_turma');
ok('com turma cadastrada, aluno da turma pode responder', verificarMatricula({ acao: 'EXEMPLO-01', matricula: '5005' }).ok);
ok('editar a ação sem enviar a turma mantém a lista', P('salvar', { token: TK, acao: Object.assign({}, ex, { turma: undefined }) }).ok && turmaDaAcao_('EXEMPLO-01').length === 3);
var nova = { nome: 'Ação de Teste do Painel', datas: '10/12/2026', local: 'Sala 1', coordenacao: 'Coordenador(a) 1', turnos: ['Matutino', 'Vespertino'],
  disciplinas: [{ nome: 'Disciplina A', instrutores: ['Instrutor(a) 4', 'Instrutor(a) 5'] }, { nome: 'Disciplina B', instrutores: ['Instrutor(a) 4'] }] };
var sv = P('salvar', { token: TK, acao: nova });
ok('painel: cria ação com ID automático', sv.ok && /^AE-\d{4}-001$/.test(sv.id), sv);
var an = carregarAcao_(sv.id);
ok('painel: ação criada com disciplinas e instrutores', an && an.disciplinas.length === 2 && an.instrutores.join() === 'Instrutor(a) 4,Instrutor(a) 5' && an.turnos.join() === 'Matutino,Vespertino', an);
ok('painel: disciplinas da outra ação continuam intactas', carregarAcao_('EXEMPLO-01').instrutores.length === 3);
ok('painel: formulário da ação nova abre', montarDadosPagina_(sv.id, '360').tela === 'formulario');
nova.id = sv.id; nova.disciplinas = [{ nome: 'Disciplina A (revisada)', instrutores: ['Instrutor(a) 4'] }]; nova.encerramento = '2030-01-31';
var ed2 = P('salvar', { token: TK, acao: nova });
var an2 = carregarAcao_(sv.id);
ok('painel: edição troca disciplinas e grava encerramento', ed2.ok && an2.disciplinas.length === 1 && an2.disciplinas[0].nome === 'Disciplina A (revisada)' && an2.encTs > 0, an2);
ok('painel: segunda ação recebe o próximo número', /-002$/.test(P('salvar', { token: TK, acao: { nome: 'Outra', datas: 'x', turnos: ['Matutino'], disciplinas: [{ nome: 'D', instrutores: ['Instrutor(a) 6'] }] } }).id));
var inv = P('salvar', { token: TK, acao: { nome: '', datas: '', turnos: [], disciplinas: [{ nome: 'Sem instrutor', instrutores: [] }] } });
ok('painel: recusa cadastro incompleto com campos apontados', inv.ok === false && ['nome', 'datas', 'turnos', 'disc0'].every(function (id) { return inv.erros.some(function (e) { return e.id === id; }); }), inv);
__formulas = [];
P('salvar', { token: TK, acao: { nome: '=HYPERLINK("x")', datas: '+1', turnos: ['@t'], disciplinas: [{ nome: '-d', instrutores: ['=n'] }] } });
ok('painel: nada cadastrado vira fórmula', __formulas.length === 0, __formulas);
ok('painel: encerrar ação', P('status', { token: TK, id: sv.id, status: 'encerrada' }).ok && montarDadosPagina_(sv.id, 'reacao').tela === 'encerrada');
ok('painel: reabrir ação', P('status', { token: TK, id: sv.id, status: 'aberta' }).ok && montarDadosPagina_(sv.id, 'reacao').tela === 'formulario');
var res = P('resultados', { token: TK, id: 'EXEMPLO-01' });
var i1 = res.r360 && res.r360.instrutores[0];
ok('painel: resultados da Reação (2 respostas, A1 = 3, NPS 0)', res.ok && res.reacao.n === 2 && res.reacao.itens[0].media === 3 && res.reacao.nps.nps === 0, res.reacao && res.reacao.nps);
ok('painel: resultados 360° por perspectiva (C1 do Instrutor(a) 1: —, 2, 5, 3)', i1 && JSON.stringify(i1.criterios[0].valores) === '[null,2,5,3]' && i1.criterios[0].geral === 3.33, i1 && i1.criterios[0]);
ok('painel: resultados trazem relato, turma e coordenação', res.r360.relatos.length === 2 && res.r360.relatos[0].instrutor === 'Instrutor(a) 1' && res.r360.turma.itens[0].geral === 4 && res.r360.coordenacao[0].media === 4, { relatos: res.r360.relatos, turma: res.r360.turma.itens[0], coord: res.r360.coordenacao[0] });
ok('painel: código novo curto é recusado', P('trocar_codigo', { token: TK, novo: 'curto' }).ok === false);
ok('painel: troca o código de acesso', P('trocar_codigo', { token: TK, novo: 'novo-codigo-123' }).ok && P('entrar', { codigo: 'novo-codigo-123' }).ok && P('entrar', { codigo: CODIGO_PAINEL_INICIAL }).ok === false);
delete __props.CODIGO_PAINEL;
ok('painel: não exclui ação com respostas', P('excluir', { token: TK, id: 'EXEMPLO-01' }).codigo === 'tem_respostas' && carregarAcao_('EXEMPLO-01') !== null);
var antesDisc = linhasDe('Disciplinas').length;
ok('painel: exclui ação sem respostas (e suas disciplinas)', P('excluir', { token: TK, id: sv.id }).ok && carregarAcao_(sv.id) === null && linhasDe('Disciplinas').length === antesDisc - 1 && carregarAcao_('EXEMPLO-01').instrutores.length === 3);
ok('painel: sair encerra a sessão', P('sair', { token: TK }).ok && P('listar', { token: TK }).codigo === 'sessao');

// Migração: aba com só respostas de teste é recriada limpa
__props.ESQUEMA = '2';
migrarEsquema_();
ok('migração limpa a aba 360° que só tem testes', linhasDe('Respostas_360').length === 0 && __props.ESQUEMA === VERSAO_ESQUEMA);

// --------------------------------- Encerramento ---------------------------------
var tA = tabela('Acoes');
aba('Acoes').dados[1][tA.idx['Status']] = 'encerrada'; limparCacheDados_();
ok('ação encerrada mostra tela de encerramento', montarDadosPagina_('EXEMPLO-01', 'reacao').tela === 'encerrada');
var rEnc = enviarAluno({}, '4004');
ok('ação encerrada não recebe respostas', rEnc.ok === false && rEnc.codigo === 'encerrada', rEnc);
aba('Acoes').dados[1][tA.idx['Status']] = 'aberta'; limparCacheDados_();
aba('Acoes').dados[1][tA.idx['Data de encerramento']] = new Date(2020, 0, 1); limparCacheDados_();
ok('ação com data de encerramento vencida fica encerrada', montarDadosPagina_('EXEMPLO-01', '360').tela === 'encerrada');
aba('Acoes').dados[1][tA.idx['Data de encerramento']] = ''; limparCacheDados_();

// --------------------------------- Estilo ---------------------------------
__props.ESTILO = '0';
var antesEstilo = JSON.stringify(aba('Acoes').dados) + JSON.stringify(aba('Respostas_Reacao').dados);
garantirInstalacao_();
ok('estilo novo aplicado uma vez, sem alterar nenhum dado', __props.ESTILO === VERSAO_ESTILO &&
   antesEstilo === JSON.stringify(aba('Acoes').dados) + JSON.stringify(aba('Respostas_Reacao').dados));

var falhas = __res.filter(function (r) { return r.indexOf('FALHOU') === 0; }).length;
var __relatorio = __res.join('\n') + '\n\n' + (__res.length - falhas) + ' de ' + __res.length + ' verificações passaram.' +
  '\n===CONSOLIDADO===\n' + C.map(function (r) { return r.filter(function (v) { return v !== ''; }).join(' | '); }).join('\n');
__relatorio;

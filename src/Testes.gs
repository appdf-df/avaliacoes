/**
 * Testes.gs — Teste de envio de cada perfil na planilha real.
 *
 * Como usar: no editor, selecione a função "testarEnvios" e clique em Executar.
 * Ela grava respostas fictícias na ação EXEMPLO-01 (uma Reação e uma resposta de
 * cada perfil do 360°), confere as regras e mostra o resultado no Registro de execução.
 * Depois do teste, apague as linhas da ação EXEMPLO-01 nas abas de respostas.
 */
function testarEnvios() {
  const ID = 'EXEMPLO-01';
  const acao = carregarAcao_(ID);
  if (!acao) throw new Error('A ação ' + ID + ' não existe. Execute setup() primeiro.');
  if (acao.encerrada) throw new Error('A ação ' + ID + ' está encerrada. Reabra-a para testar.');

  const resultados = [];
  const registrar = (nome, r, esperado) => {
    const ok = esperado === undefined ? r.ok === true : esperado(r);
    resultados.push((ok ? 'OK    ' : 'FALHOU') + '  ' + nome + (r.ok ? '' : '  → ' + r.mensagem));
  };

  registrar('Reação completa', salvarResposta({ acao: ID, form: 'reacao', respostas: respostasDeExemplo_(defReacao_(acao).etapas) }));

  const d = def360_(acao);
  const r360 = (perfil, extra) => salvarResposta({
    acao: ID, form: '360', perfil: perfil,
    respostas: Object.assign(respostasDeExemplo_([d.etapaPerfil].concat(etapasDoRamo_(d.ramos[perfil], extra)), { perfil: perfil }), extra || {}),
  });
  registrar('360° – aluno (todos os instrutores de uma vez)', r360('aluno'));
  const pendentesCoord = d.ramos.coordenacao.filter(et => !et.jaAvaliado);
  if (pendentesCoord.length) {
    registrar('360° – coordenação (todos os instrutores de uma vez)', r360('coordenacao'));
    registrar('360° – coordenação repetida (deve ser recusada)', r360('coordenacao'),
      r => r.ok === false && r.codigo === 'duplicado');
  }
  const livre = d.ramos.instrutor[0].perguntas[0].opcoes.filter(o => !o.desabilitada)[0];
  if (livre) {
    registrar('360° – instrutor (turma, autoavaliação, colegas, curso, coordenação)', r360('instrutor', { in_nome: livre.valor }));
    registrar('360° – instrutor respondendo de novo (deve ser recusado)', r360('instrutor', { in_nome: livre.valor }),
      r => r.ok === false && r.codigo === 'duplicado');
  }
  registrar('Reação sem respostas obrigatórias (deve ser recusada)',
    salvarResposta({ acao: ID, form: 'reacao', respostas: {} }), r => r.ok === false && r.erros.length > 0);

  atualizarConsolidado();
  Logger.log('RESULTADO DOS TESTES\n' + resultados.join('\n'));
  return resultados;
}

/** Preenche todas as perguntas com valores válidos (a primeira opção ou 4 nas escalas). */
function respostasDeExemplo_(etapas, base) {
  const r = Object.assign({}, base || {});
  etapas.forEach(et => et.perguntas.forEach(q => {
    if (q.id in r) return;
    if (q.tipo === 'select' || q.tipo === 'radio') {
      const op = q.opcoes.filter(o => !o.desabilitada)[0];
      if (op) r[q.id] = String(op.valor);
    } else if (q.tipo === 'likert') {
      q.itens.forEach(it => { r[it.id] = 4; });
    } else if (q.tipo === 'antes_depois') {
      q.itens.forEach(it => { r[it.idAntes] = 2; r[it.idDepois] = 4; });
    } else if (q.tipo === 'checkbox') {
      r[q.id] = [String(q.opcoes[0].valor)];
    } else if (q.tipo === 'nps') {
      r[q.id] = 9;
    } else if (q.tipo === 'texto') {
      r[q.id] = 'Resposta de teste.';
    }
  }));
  return r;
}

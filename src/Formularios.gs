/**
 * Formularios.gs — Estrutura das perguntas, validação no servidor e gravação.
 *
 * A mesma definição é enviada para a página (que desenha as telas) e usada aqui
 * para validar cada resposta recebida. Assim, a tela e o servidor nunca divergem.
 */

// ============================== DEFINIÇÃO: REAÇÃO ==============================
function defReacao_(acao) {
  const ops = lista => lista.map(t => ({ valor: t, rotulo: t }));
  const etapaCompetencias = [];
  if (acao.disciplinas.length) {
    etapaCompetencias.push({
      id: 'dominio', tipo: 'antes_depois', titulo: 'Nível de domínio por disciplina',
      escala: 'dominio', obrigatorio: true,
      rotuloAntes: 'Meu nível de domínio ANTES da ação',
      rotuloDepois: 'Meu nível de domínio DEPOIS da ação',
      itens: acao.disciplinas.map(d => ({
        texto: d.numero + ' – ' + d.nome,
        idAntes: 'antes_' + idSeguro_(d.numero),
        idDepois: 'depois_' + idSeguro_(d.numero),
      })),
    });
  }
  etapaCompetencias.push(
    { id: 'aplic', tipo: 'likert', titulo: 'Aplicação no trabalho', escala: 'concordancia', obrigatorio: true,
      itens: ITENS_APLICACAO.map((t, i) => ({ id: 'aplic_' + (i + 1), texto: t })) },
    { id: 'dificuldades', tipo: 'checkbox', obrigatorio: false,
      titulo: 'O que pode dificultar a aplicação do conteúdo na sua rotina?',
      ajuda: 'Marque todas as opções que se aplicam.',
      opcoes: ops(DIFICULDADES),
      outro: { valor: VALOR_OUTRA, rotulo: 'Outra', id: 'dificuldades_outra' } });

  return {
    tipo: 'reacao',
    titulo: 'Avaliação de Reação',
    descricao: TEXTOS.descricaoReacao,
    privacidade: TEXTOS.privacidadeReacao,
    tempo: 'cerca de 5 minutos',
    anonimo: true,
    etapas: [
      { id: 'perfil', titulo: 'Perfil do participante', perguntas: [
        { id: 'unidade', tipo: 'select', titulo: 'Unidade de lotação', obrigatorio: true, opcoes: ops(acao.unidades) },
        { id: 'turno', tipo: 'radio', titulo: 'Turno em que participou', obrigatorio: true, opcoes: ops(acao.turnos) },
        { id: 'tempo_servico', tipo: 'radio', titulo: 'Tempo de serviço na Polícia Penal do DF', obrigatorio: true,
          opcoes: ops(TEMPOS_SERVICO) },
      ] },
      { id: 'acao', titulo: 'Avaliação da ação educacional',
        ajuda: 'Indique seu grau de concordância com cada afirmação.', perguntas: [
          { id: 'acao', tipo: 'likert', titulo: 'Sobre a ação educacional', escala: 'concordancia', obrigatorio: true,
            itens: ITENS_ACAO.map((t, i) => ({ id: 'acao_' + (i + 1), texto: t })) },
        ] },
      { id: 'competencias', titulo: 'Desenvolvimento de competências',
        ajuda: 'Compare seu nível de domínio de cada tema ANTES e DEPOIS da ação. ' +
               'Não há resposta certa: o objetivo é medir o ganho percebido.',
        perguntas: etapaCompetencias },
      { id: 'geral', titulo: 'Avaliação geral e sugestões', perguntas: [
        { id: 'recomendacao', tipo: 'nps', obrigatorio: true, min: 0, max: 10,
          titulo: 'De 0 a 10, quanto você recomendaria esta ação a um colega?',
          extremos: ['Não recomendaria', 'Recomendaria muito'] },
        { id: 'aberta_contribuiu', tipo: 'texto', titulo: 'O que mais contribuiu para sua aprendizagem?' },
        { id: 'aberta_melhorar', tipo: 'texto', titulo: 'O que deveria ser melhorado nas próximas edições?' },
        { id: 'aberta_temas', tipo: 'texto', titulo: 'Que temas você sugere para futuras ações educacionais?' },
      ] },
    ],
  };
}

// =============================== DEFINIÇÃO: 360° ===============================
/**
 * Cada perfil avalia todas as pessoas de uma vez, num único envio:
 *  - aluno: uma etapa por instrutor(a) da ação;
 *  - coordenação: uma etapa por instrutor(a) ainda não avaliado(a);
 *  - instrutor(a): formulário único com turma, relato, autoavaliação, uma etapa por colega,
 *    avaliação do curso e avaliação da coordenação.
 * Etapas marcadas com "paraColega" somem quando o nome escolhido é o do próprio colega;
 * etapas com "jaAvaliado" somem para a coordenação.
 */
function def360_(acao, semConsultar) {
  const criterios = (prefixo, extras) => CRITERIOS_DOCENTE.concat(extras || [])
    .map((t, i) => ({ id: prefixo + (i + 1), texto: t }));
  const itens = (prefixo, lista) => lista.map((t, i) => ({ id: prefixo + (i + 1), texto: t }));
  const avaliadosCoord = semConsultar ? [] : instrutoresAvaliadosPelaCoordenacao_(acao.id);
  const jaResponderam = semConsultar ? [] : instrutoresQueResponderam_(acao.id);
  const disc = {};
  acao.instrutores.forEach(n => { disc[n] = disciplinasDoInstrutor_(acao, n); });
  const cab = (nome, rotulo) => ({ nome: nome, rotulo: rotulo, detalhe: disc[nome] ? 'Disciplina(s): ' + disc[nome] : '' });

  const aluno = acao.instrutores.map((nome, i) => {
    const k = 'al' + (i + 1);
    return {
      id: k, titulo: 'Avaliação dos instrutores',
      ajuda: 'Avalie cada instrutor(a) da ação, um de cada vez. Se não assistiu à aula de algum(a), marque "Não se aplica / não observei".',
      cabecalho: cab(nome, 'Instrutor(a)'), marcarNA: true,
      perguntas: [
        { id: k, tipo: 'likert', titulo: 'Avalie o desempenho de ' + nome, escala: 'desempenho',
          obrigatorio: true, itens: criterios(k + '_c') },
        { id: k + '_coment', tipo: 'texto', titulo: 'Comentários ou sugestões para ' + nome + ' (opcional)' },
      ],
    };
  });

  const coordenacao = acao.instrutores.map((nome, i) => {
    const k = 'co' + (i + 1);
    return {
      id: k, instrutor: nome, jaAvaliado: avaliadosCoord.indexOf(nome) !== -1,
      titulo: 'Avaliação pela coordenação',
      ajuda: 'Avalie cada instrutor(a) desta ação. Tudo é enviado de uma vez, ao final.',
      cabecalho: cab(nome, 'Instrutor(a)'),
      perguntas: [
        { id: k, tipo: 'likert', titulo: 'Desempenho em sala', escala: 'desempenho', obrigatorio: true,
          itens: criterios(k + '_c') },
        { id: k + '_comp', tipo: 'likert', titulo: 'Compromissos institucionais', escala: 'desempenho', obrigatorio: true,
          itens: itens(k + '_comp', COMPROMISSOS) },
        { id: k + '_obs', tipo: 'texto', titulo: 'Observações da coordenação' },
      ],
    };
  });

  const instrutor = [
    { id: 'in1', titulo: 'Identificação e turma',
      ajuda: 'Formulário único do(a) instrutor(a): turma, autoavaliação, colegas, curso e coordenação.',
      perguntas: [
        { id: 'in_nome', tipo: 'select', titulo: 'Seu nome', obrigatorio: true,
          opcoes: acao.instrutores.map(n => ({ valor: n, rotulo: n, desabilitada: jaResponderam.indexOf(n) !== -1 })),
          notaDesabilitada: 'já respondeu' },
        { id: 'in_turno', tipo: 'radio', titulo: 'Turno em que ministrou aula', obrigatorio: true,
          opcoes: acao.turnos.map(t => ({ valor: t, rotulo: t })) },
        { id: 'in_turma', tipo: 'likert', titulo: 'Avaliação da turma', escala: 'desempenho', obrigatorio: true,
          itens: itens('in_turma', ITENS_TURMA) },
        { id: 'in_participacao', tipo: 'texto',
          titulo: 'Participação dos alunos, conhecimentos prévios e dificuldades observadas' },
        { id: 'in_relato', tipo: 'texto', titulo: 'Relato de situação ocorrida em sala (opcional)',
          ajuda: 'Registre aqui qualquer ocorrência que a coordenação precise conhecer: conflitos, problemas de estrutura, intercorrências, entre outras.' },
      ] },
    { id: 'in2', titulo: 'Autoavaliação', ajuda: 'Reflita sobre sua atuação nesta ação educacional.',
      perguntas: [
        { id: 'in', tipo: 'likert', titulo: 'Como você avalia o seu próprio desempenho?', escala: 'desempenho',
          obrigatorio: true, itens: criterios('in_c') },
      ] },
  ].concat(acao.instrutores.map((nome, i) => {
    const k = 'inp' + (i + 1);
    return {
      id: k, paraColega: nome, titulo: 'Avaliação dos colegas (pares)',
      ajuda: 'Se não acompanhou a atuação deste(a) colega, marque "Não se aplica / não observei".',
      cabecalho: cab(nome, 'Colega'), marcarNA: true,
      textoNA: 'Não acompanhei este(a) colega: marcar todos como "Não se aplica / não observei"',
      perguntas: [
        { id: k, tipo: 'likert', titulo: 'Desempenho do(a) colega', escala: 'desempenho', obrigatorio: true,
          itens: criterios(k + '_c', [CRITERIO_COLABORACAO]) },
        { id: k + '_coment', tipo: 'texto', titulo: 'Contribuições e sugestões ao(à) colega' },
      ],
    };
  }), [
    { id: 'in3', titulo: 'Avaliação do curso', ajuda: 'Item 12 do Plano de Capacitação.',
      perguntas: [
        { id: 'in_curso', tipo: 'likert', titulo: 'Avaliação do curso pelo docente', escala: 'desempenho',
          obrigatorio: true, itens: itens('in_curso', ITENS_CURSO) },
      ] },
    { id: 'in4', titulo: 'Avaliação da coordenação',
      perguntas: [
        { id: 'in_coord', tipo: 'likert', titulo: 'Como você avalia a coordenação desta ação?', escala: 'desempenho',
          obrigatorio: true, itens: itens('in_coord', ITENS_COORDENACAO) },
        { id: 'in_coord_coment', tipo: 'texto', titulo: 'Comentários sobre a coordenação' },
      ] },
    { id: 'in5', titulo: 'Considerações finais',
      perguntas: [
        { id: 'in_pontos', tipo: 'texto', titulo: 'Pontos fortes da sua atuação e o que pretende aprimorar' },
        { id: 'in_sugestoes', tipo: 'texto', titulo: 'Sugestões para o planejamento de futuras edições' },
      ] },
  ]);

  return {
    tipo: '360',
    titulo: 'Avaliação 360° do Corpo Docente',
    descricao: TEXTOS.descricao360,
    privacidade: TEXTOS.privacidade360,
    tempo: 'cerca de ' + Math.max(5, 2 * acao.instrutores.length) + ' minutos',
    disciplinasPorInstrutor: disc,
    etapaPerfil: { id: 'perfil', titulo: 'Perfil do avaliador', perguntas: [
      { id: 'perfil', tipo: 'radio', titulo: 'Qual é o seu perfil nesta avaliação?', obrigatorio: true,
        ajuda: 'A coordenação avalia todos os instrutores da ação, um de cada vez. ' +
               'Instrutores respondem um formulário único com turma, autoavaliação, colegas, curso e coordenação. ' +
               'Alunos respondem por um link próprio.',
        opcoes: PERFIS.filter(p => p.valor !== 'aluno').map(p => ({ valor: p.valor, rotulo: p.rotulo })) },
    ] },
    ramos: { aluno: aluno, coordenacao: coordenacao, instrutor: instrutor },
  };
}

/** Etapas que valem para esta resposta (sem a do próprio colega e sem instrutores já avaliados). */
function etapasDoRamo_(ramo, resp) {
  const nome = texto_(resp && resp.in_nome);
  return ramo.filter(et => !et.jaAvaliado && !(et.paraColega && et.paraColega === nome));
}

function idSeguro_(s) { return texto_(s).replace(/[^0-9A-Za-z]/g, '_'); }

// =========================== COLUNAS DAS ABAS DE RESPOSTAS ===========================
/** Pares [chave da resposta, cabeçalho da coluna] da aba Respostas_Reacao. */
function colunasReacao_(numeros) {
  const c = [
    ['_carimbo', 'Carimbo de data/hora'],
    ['_acao', 'ID da ação'],
    ['unidade', 'Unidade de lotação'],
    ['turno', 'Turno em que participou'],
    ['tempo_servico', 'Tempo de serviço na Polícia Penal do DF'],
  ];
  ITENS_ACAO.forEach((t, i) => c.push(['acao_' + (i + 1), 'A' + (i + 1) + '. ' + t]));
  ITENS_APLICACAO.forEach((t, i) => c.push(['aplic_' + (i + 1), 'Aplicação ' + (i + 1) + '. ' + t]));
  c.push(
    ['dificuldades', 'O que pode dificultar a aplicação do conteúdo na sua rotina?'],
    ['dificuldades_outra', 'Dificuldades – Outra (descrição)'],
    ['recomendacao', 'Recomendação (0 a 10)'],
    ['aberta_contribuiu', 'O que mais contribuiu para sua aprendizagem?'],
    ['aberta_melhorar', 'O que deveria ser melhorado nas próximas edições?'],
    ['aberta_temas', 'Que temas você sugere para futuras ações educacionais?']);
  numeros.forEach(n => {
    c.push(['antes_' + n, cabAntes_(n)], ['depois_' + n, cabDepois_(n)]);
  });
  return c;
}
function cabAntes_(n) { return 'Domínio ANTES – Disciplina ' + n; }
function cabDepois_(n) { return 'Domínio DEPOIS – Disciplina ' + n; }
function cabecalhosReacao_(qtd) {
  const nums = [];
  for (let i = 1; i <= qtd; i++) nums.push(String(i));
  return colunasReacao_(nums).map(c => c[1]);
}

function colunas360_() {
  const c = [
    ['_carimbo', 'Carimbo de data/hora'],
    ['_envio', 'ID do envio'],
    ['_acao', 'ID da ação'],
    ['_perspectiva', 'Perspectiva'],
    ['_avaliador', 'Avaliador(a)'],
    ['_instrutor', 'Instrutor(a) avaliado(a)'],
  ];
  CRITERIOS_DOCENTE.forEach((t, i) => c.push(['c' + (i + 1), 'C' + (i + 1) + '. ' + t]));
  c.push(['c9', 'C9. ' + CRITERIO_COLABORACAO + ' (pares)']);
  // Itens sem numeração no cabeçalho: mudar a lista não desloca as colunas antigas.
  COMPROMISSOS.forEach((t, i) => c.push(['comp' + (i + 1), 'Compromisso – ' + t]));
  ITENS_CURSO.forEach((t, i) => c.push(['curso' + (i + 1), 'Curso – ' + t]));
  c.push(['turno', 'Turno em que ministrou aula']);
  ITENS_TURMA.forEach((t, i) => c.push(['turma' + (i + 1), 'Turma – ' + t]));
  ITENS_COORDENACAO.forEach((t, i) => c.push(['coord' + (i + 1), 'Avaliação da coordenação – ' + t]));
  c.push(
    ['coment_aluno', 'Comentários ou sugestões (aluno)'],
    ['obs_coord', 'Observações da coordenação'],
    ['au_participacao', 'Participação dos alunos, conhecimentos prévios e dificuldades observadas'],
    ['relato', 'Relato de situação ocorrida em sala'],
    ['au_pontos', 'Pontos fortes da sua atuação e o que pretende aprimorar'],
    ['au_sugestoes', 'Sugestões para o planejamento de futuras edições'],
    ['coment_coord', 'Comentários sobre a coordenação'],
    ['pa_coment', 'Contribuições e sugestões ao(à) colega']);
  return c;
}

function linhas360DaAcao_(acaoId, perspectiva, colunaNome) {
  const t = lerTabela_(planilha_().getSheetByName(ABAS.R360));
  const iA = t.idx['ID da ação'], iP = t.idx['Perspectiva'], iN = t.idx[colunaNome];
  if (iA === undefined || iP === undefined || iN === undefined) return [];
  return t.linhas
    .filter(l => mesmoId_(l[iA], acaoId) && texto_(l[iP]) === perspectiva)
    .map(l => texto_(l[iN]));
}
function instrutoresAvaliadosPelaCoordenacao_(acaoId) {
  return linhas360DaAcao_(acaoId, 'Coordenação', 'Instrutor(a) avaliado(a)');
}
/** Instrutores que já enviaram o formulário único (a autoavaliação marca o envio). */
function instrutoresQueResponderam_(acaoId) {
  return linhas360DaAcao_(acaoId, 'Autoavaliação', 'Avaliador(a)');
}

// =================================== VALIDAÇÃO ===================================
/**
 * Confere as respostas de um conjunto de etapas.
 * Retorna { erros: [{id, mensagem}], val: {chave: valor pronto para a planilha} }.
 */
function validar_(etapas, resp) {
  const erros = [];
  const val = {};
  const obter = id => (Object.prototype.hasOwnProperty.call(resp, id) ? resp[id] : null);
  const vazio = v => v === null || v === undefined || v === '';

  etapas.forEach(et => et.perguntas.forEach(q => {
    switch (q.tipo) {
      case 'select':
      case 'radio': {
        const raw = obter(q.id);
        if (!vazio(raw) && typeof raw !== 'string') { erros.push({ id: q.id, mensagem: 'Opção inválida.' }); break; }
        const v = texto_(raw);
        if (!v) { if (q.obrigatorio) erros.push({ id: q.id, mensagem: 'Resposta obrigatória.' }); break; }
        const op = q.opcoes.filter(o => String(o.valor) === v)[0];
        if (!op || op.desabilitada) { erros.push({ id: q.id, mensagem: 'Opção inválida.' }); break; }
        if (q.excluirValorDe && v === texto_(obter(q.excluirValorDe))) {
          erros.push({ id: q.id, mensagem: 'Não é permitido avaliar a si mesmo(a). Selecione outro(a) colega.' });
          break;
        }
        val[q.id] = v;
        break;
      }
      case 'likert':
        q.itens.forEach(it => validarEscala_(q.escala, it.id, obter(it.id), q.obrigatorio, erros, val));
        break;
      case 'antes_depois':
        q.itens.forEach(it => {
          validarEscala_(q.escala, it.idAntes, obter(it.idAntes), q.obrigatorio, erros, val);
          validarEscala_(q.escala, it.idDepois, obter(it.idDepois), q.obrigatorio, erros, val);
        });
        break;
      case 'checkbox': {
        let v = obter(q.id);
        if (vazio(v)) v = [];
        if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) { erros.push({ id: q.id, mensagem: 'Opção inválida.' }); break; }
        const validos = q.opcoes.map(o => String(o.valor));
        if (q.outro) validos.push(q.outro.valor);
        if (v.some(x => validos.indexOf(x) === -1)) { erros.push({ id: q.id, mensagem: 'Opção inválida.' }); break; }
        const escolhidas = q.opcoes.filter(o => v.indexOf(String(o.valor)) !== -1).map(o => o.rotulo);
        if (q.outro && v.indexOf(q.outro.valor) !== -1) {
          const t = textoLivre_(obter(q.outro.id));
          if (t === null) { erros.push({ id: q.id, mensagem: 'Texto inválido ou acima de 2.000 caracteres.' }); break; }
          if (!t) { erros.push({ id: q.id, mensagem: 'Descreva a opção "Outra".' }); break; }
          escolhidas.push(q.outro.rotulo);
          val[q.outro.id] = t;
        }
        if (q.obrigatorio && !escolhidas.length) { erros.push({ id: q.id, mensagem: 'Resposta obrigatória.' }); break; }
        val[q.id] = escolhidas.join('; ');
        break;
      }
      case 'nps': {
        const raw = obter(q.id);
        if (vazio(raw)) { if (q.obrigatorio) erros.push({ id: q.id, mensagem: 'Resposta obrigatória.' }); break; }
        const n = Number(raw);
        if (typeof raw === 'boolean' || !Number.isInteger(n) || n < q.min || n > q.max) {
          erros.push({ id: q.id, mensagem: 'Valor fora da escala.' });
          break;
        }
        val[q.id] = n;
        break;
      }
      case 'texto': {
        const t = textoLivre_(obter(q.id));
        if (t === null) { erros.push({ id: q.id, mensagem: 'Texto inválido ou acima de 2.000 caracteres.' }); break; }
        if (!t && q.obrigatorio) { erros.push({ id: q.id, mensagem: 'Resposta obrigatória.' }); break; }
        val[q.id] = t;
        break;
      }
      default:
        break;
    }
  }));
  return { erros: erros, val: val };
}

function validarEscala_(nomeEscala, id, raw, obrigatorio, erros, val) {
  if (raw === null || raw === undefined || raw === '') {
    if (obrigatorio) erros.push({ id: id, mensagem: 'Resposta obrigatória.' });
    return;
  }
  if (typeof raw !== 'string' && typeof raw !== 'number') { erros.push({ id: id, mensagem: 'Valor fora da escala.' }); return; }
  const op = ESCALAS[nomeEscala].opcoes.filter(o => String(o.valor) === String(raw))[0];
  if (!op) { erros.push({ id: id, mensagem: 'Valor fora da escala.' }); return; }
  val[id] = op.valor === NA ? ROTULO_NA_PLANILHA : op.valor;
}

/** Texto aberto: null se inválido; senão o texto aparado (pode ser ''). */
function textoLivre_(raw) {
  if (raw === null || raw === undefined) return '';
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/\r\n?/g, '\n').trim();
  return t.length > LIMITE_TEXTO ? null : t;
}

// ==================================== GRAVAÇÃO ====================================
/**
 * Recebe uma resposta da página. Chamado por google.script.run.
 * payload = { acao, form: 'reacao' | '360', perfil, envioId, respostas: {...} }
 */
function salvarResposta(payload) {
  try {
    const p = (payload && typeof payload === 'object') ? payload : {};
    const tipo = p.form === 'aluno' ? 'aluno' : (p.form === '360' ? '360' : '');
    if (p.form === 'reacao') {
      return falha_('Este link foi atualizado. Recarregue a página para responder a avaliação completa.', 'desatualizado');
    }
    if (!tipo) return falha_('Formulário inválido.');
    const resp = (p.respostas && typeof p.respostas === 'object' && !Array.isArray(p.respostas)) ? p.respostas : {};
    const envioId = texto_(p.envioId).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 64);

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) {
      return falha_('O sistema está recebendo muitas respostas ao mesmo tempo. Aguarde alguns segundos e envie novamente.');
    }
    try {
      const cache = CacheService.getScriptCache();
      if (envioId && cache.get('envio_' + envioId)) return { ok: true, repetido: true };

      const acao = carregarAcao_(p.acao);
      if (!acao) return falha_('Ação educacional não encontrada.');
      if (acao.encerrada) return falha_('Esta avaliação está encerrada e não recebe mais respostas.', 'encerrada');

      const r = tipo === 'aluno' ? gravarAluno_(acao, resp) : gravar360_(acao, texto_(p.perfil), resp);
      if (r.ok && envioId) cache.put('envio_' + envioId, '1', 21600);
      return r;
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    console.error(e && e.stack ? e.stack : e);
    return falha_('Não foi possível registrar sua avaliação agora. Tente novamente em instantes.');
  }
}

function falha_(mensagem, codigo, erros) {
  return { ok: false, mensagem: mensagem, codigo: codigo || 'erro', erros: erros || [] };
}

function gravarReacao_(acao, resp) {
  const def = defReacao_(acao);
  const v = validar_(def.etapas, resp);
  if (v.erros.length) return falha_('Há respostas pendentes ou inválidas. Revise o formulário.', 'validacao', v.erros);
  const numeros = acao.disciplinas.map(d => idSeguro_(d.numero));
  const linha = Object.assign({ _carimbo: new Date(), _acao: acao.id }, v.val);
  gravarLinhas_(ABAS.REACAO, colunasReacao_(numeros), [linha]);
  return { ok: true };
}

function gravar360_(acao, perfil, resp) {
  if (perfil === 'aluno') {
    return falha_('Alunos respondem pelo link da avaliação da turma, que inclui a Reação e o 360°.', 'desatualizado');
  }
  const def = def360_(acao, true);
  const ramoBase = def.ramos[perfil];
  if (!ramoBase) return falha_('Selecione o seu perfil nesta avaliação.', 'validacao', [{ id: 'perfil', mensagem: 'Resposta obrigatória.' }]);
  if (!acao.instrutores.length) return falha_('Esta ação ainda não tem instrutores cadastrados.');

  let ramo = ramoBase;
  if (perfil === 'coordenacao') {
    // Uma avaliação da coordenação por instrutor(a): os já avaliados ficam de fora.
    const avaliados = instrutoresAvaliadosPelaCoordenacao_(acao.id);
    const repetidos = ramoBase.filter(et => avaliados.indexOf(et.instrutor) !== -1 &&
      Object.keys(resp).some(k => k.indexOf(et.id + '_') === 0));
    if (repetidos.length) {
      return falha_('A coordenação já avaliou ' + repetidos.map(et => et.instrutor).join(', ') +
        ' nesta ação. Recarregue a página para ver só os instrutores pendentes.', 'duplicado');
    }
    ramo = ramoBase.filter(et => avaliados.indexOf(et.instrutor) === -1);
    if (!ramo.length) return falha_('A coordenação já avaliou todos os instrutores desta ação.', 'duplicado');
  }
  if (perfil === 'instrutor') {
    const nome = texto_(resp.in_nome);
    if (nome && instrutoresQueResponderam_(acao.id).indexOf(nome) !== -1) {
      return falha_('Este(a) instrutor(a) já respondeu a avaliação desta ação.', 'duplicado',
        [{ id: 'in_nome', mensagem: 'Já existe uma resposta com este nome.' }]);
    }
    ramo = etapasDoRamo_(ramoBase, resp);
  }

  const respComPerfil = Object.assign({}, resp, { perfil: perfil });
  const v = validar_([def.etapaPerfil].concat(ramo), respComPerfil);
  if (v.erros.length) return falha_('Há respostas pendentes ou inválidas. Revise o formulário.', 'validacao', v.erros);
  const val = v.val;

  const base = { _carimbo: new Date(), _envio: Utilities.getUuid().slice(0, 8), _acao: acao.id };
  const copiar = (destino, prefixoOrigem, prefixoDestino, qtd) => {
    for (let i = 1; i <= qtd; i++) destino[prefixoDestino + i] = val[prefixoOrigem + i];
    return destino;
  };
  const linhas = [];
  const n = CRITERIOS_DOCENTE.length;

  if (perfil === 'aluno') {
    ramo.forEach(et => {
      const l = Object.assign({}, base, { _perspectiva: 'Aluno', _avaliador: 'Anônimo',
        _instrutor: et.cabecalho.nome, coment_aluno: val[et.id + '_coment'] });
      linhas.push(copiar(l, et.id + '_c', 'c', n));
    });
  } else if (perfil === 'coordenacao') {
    ramo.forEach(et => {
      const l = Object.assign({}, base, { _perspectiva: 'Coordenação', _avaliador: acao.coordenacao || 'Coordenação',
        _instrutor: et.instrutor, obs_coord: val[et.id + '_obs'] });
      copiar(l, et.id + '_c', 'c', n);
      linhas.push(copiar(l, et.id + '_comp', 'comp', COMPROMISSOS.length));
    });
  } else if (perfil === 'instrutor') {
    const nome = val.in_nome;
    const auto = Object.assign({}, base, {
      _perspectiva: 'Autoavaliação', _avaliador: nome, _instrutor: nome, turno: val.in_turno,
      au_participacao: val.in_participacao, relato: val.in_relato, au_pontos: val.in_pontos,
      au_sugestoes: val.in_sugestoes, coment_coord: val.in_coord_coment });
    copiar(auto, 'in_c', 'c', n);
    copiar(auto, 'in_curso', 'curso', ITENS_CURSO.length);
    copiar(auto, 'in_turma', 'turma', ITENS_TURMA.length);
    linhas.push(copiar(auto, 'in_coord', 'coord', ITENS_COORDENACAO.length));
    ramo.filter(et => et.paraColega).forEach(et => {
      const l = Object.assign({}, base, { _perspectiva: 'Pares', _avaliador: nome, _instrutor: et.paraColega,
        pa_coment: val[et.id + '_coment'] });
      linhas.push(copiar(l, et.id + '_c', 'c', n + 1));
    });
  }

  gravarLinhas_(ABAS.R360, colunas360_(), linhas);
  if (perfil !== 'aluno') limparCacheDados_();   // atualiza quem já avaliou/respondeu
  return { ok: true, linhas: linhas.length };
}

/** Grava objetos como linhas, localizando cada coluna pelo cabeçalho. */
function gravarLinhas_(nomeAba, colunas, objetos) {
  const ss = planilha_();
  const sh = ss.getSheetByName(nomeAba) || ss.insertSheet(nomeAba);
  const cab = garantirColunas_(sh, colunas.map(c => c[1]));
  const chavePorCab = {};
  colunas.forEach(c => { chavePorCab[c[1]] = c[0]; });
  // Garante linhas livres no fim da aba (a planilha começa com 1.000)
  const falta = sh.getLastRow() + objetos.length - sh.getMaxRows();
  if (falta > 0) sh.insertRowsAfter(sh.getMaxRows(), falta + 100);
  const linhas = objetos.map(o => cab.map(h => {
    const k = chavePorCab[h];
    return k === undefined ? '' : celula_(o[k]);
  }));
  sh.getRange(sh.getLastRow() + 1, 1, linhas.length, cab.length).setValues(linhas);
}

/**
 * Prepara um valor para a célula. Textos que começam com = + - @ (que a planilha
 * leria como fórmula) ou que parecem número/data recebem o prefixo ' (texto puro).
 */
function celula_(v) {
  if (v === undefined || v === null) return '';
  if (v instanceof Date || typeof v === 'number') return v;
  const s = String(v);
  if (!s) return '';
  if (/^[=+\-@]/.test(s) || /^[\d\s\/.,:%]+$/.test(s)) return "'" + s;
  return s;
}

# Avaliações da APPDF – Reação e 360° do Corpo Docente

Sistema de avaliação das ações educacionais da Academia da Polícia Penal do Distrito Federal (APPDF/SEAPE-DF). Base normativa: Portaria SEAPE nº 80/2025, arts. 35 a 37 e art. 48, § 2º.

Há também um guia visual de uso, para a coordenação, publicado como página à parte.

| Formulário | Quem responde | Identificação |
|---|---|---|
| **Avaliação do aluno (obrigatória)** | Alunos, num link único: Reação e depois 360° de todos os instrutores | Respostas anônimas. A matrícula fica só numa lista separada de quem concluiu |
| **Avaliação 360° do Corpo Docente** | Alunos, coordenação e instrutores | Alunos: anônima. Demais perfis: identificados |

No 360°, cada perfil avalia todas as pessoas de uma vez, num único envio:

- **Aluno:** avalia todos os instrutores da ação, um por etapa.
- **Coordenação:** avalia todos os instrutores ainda não avaliados. Para cada um, preenche desempenho, compromissos institucionais e observações. A Ficha de Registro de Aula não entra, porque é a própria coordenação que a preenche.
- **Instrutor(a):** responde um formulário único, que reúne:
  - turno e avaliação da turma;
  - relato de situação ocorrida em sala;
  - autoavaliação;
  - avaliação de cada colega (pares);
  - avaliação do curso;
  - avaliação da coordenação;
  - considerações finais.

Os itens de avaliação da turma e da coordenação são uma proposta inicial: ajuste os textos em `src/Config.gs` (`ITENS_TURMA` e `ITENS_COORDENACAO`).

---

## 1. Como funciona

```
Site dos formulários  ──pede dados / envia respostas──▶  Serviço Apps Script  ──lê e grava──▶  Planilha Google
(GitHub Pages, docs/)                                     (src/)                               "APPDF – Avaliações"
```

- **Site (`docs/`):** a página que os participantes abrem. É estática, abre rápido e não pede login.
- **Serviço (`src/`):** script do Google ligado à planilha. Entrega os dados de cada ação, valida e grava as respostas e monta o consolidado.
- **Planilha:** onde a coordenação cadastra as ações, recebe as respostas e usa o menu **APPDF**.

Para criar uma ação nova, **não é preciso mexer em código**: basta cadastrá-la na planilha.

---

## 2. Instalação atual

| Peça | Onde está |
|---|---|
| Planilha | "APPDF – Avaliações", no Google Drive da conta que fez a instalação |
| Serviço | `https://script.google.com/macros/s/AKfycbyR-gBpe6ZWB7DwytgBjva03mOwFKXzrby1jxR0Kbnug2djZHEl3_oMs6flTDFJfbtM/exec` |
| Site | https://appdf-df.github.io/avaliacoes/ (repositório `appdf-df/avaliacoes`, pasta `docs/`) |

As ferramentas de linha de comando (Node.js e clasp) estão em `~/.appdf-ferramentas`. Antes de usá-las num terminal, rode:

```
export PATH=~/.appdf-ferramentas/node/bin:$PATH
```

---

## 3. Uso no dia a dia (coordenação)

A coordenação usa o **painel**: https://appdf-df.github.io/avaliacoes/painel.html

1. **Entrar:** com o código de acesso. O código inicial está em `src/Segredo.gs`, arquivo que não vai para o GitHub. Para trocá-lo, use o botão **Trocar código** no painel.
2. **Nova ação:** preencha nome, data, local, turnos, disciplinas, instrutores e a **turma** (uma linha por aluno, com matrícula e nome). O ID é criado sozinho, no formato `AE-2026-001`.
   - **Quem falta:** mostra quem da turma já concluiu as duas avaliações e quem falta, com botão para copiar os pendentes.
   - **Anonimato:** a matrícula vai só para a aba `Participacao`, que guarda matrícula e data (sem horário) e é reordenada por matrícula. As respostas não têm identificação.
3. **Links e QR code:** para cada formulário, há opções para copiar o link, mostrar o QR code no projetor ou baixar a imagem. Também há uma mensagem pronta para o WhatsApp.
4. **Encerrar / Reabrir:** direto no cartão da ação. Opcionalmente, defina uma data de encerramento automático.
5. **Resultados:** quatro abas.
   - **Reação:** médias, NPS, ganho por disciplina e dificuldades.
   - **Corpo docente:** cada instrutor nas quatro perspectivas.
   - **Turma e coordenação:** turma por turno, avaliação da coordenação e relatos.
   - **Comentários:** todos os textos abertos.
6. **Excluir:** em **Editar**. Só é possível enquanto a ação não tem nenhuma resposta.

A planilha continua funcionando como antes, com o menu **APPDF**: gerar links, encerrar e atualizar o consolidado para o relatório oficial. A aba **Unidades** (lista de unidades de lotação) só se edita na planilha.

## 4. Onde mexer em cada coisa

| Para mudar… | Arquivo | Depois |
|---|---|---|
| Ações, disciplinas, instrutores | o painel (ou a planilha) | vale na hora |
| Unidades de lotação | aba Unidades da planilha | vale na hora |
| Telas do painel | `docs/painel.js`, `docs/painel.css` | publicar o site |
| Serviço do painel (acesso, cadastro, resultados) | `src/Painel.gs` | publicar o serviço |
| Perguntas, escalas, critérios (texto oficial) | `src/Config.gs` | publicar o serviço |
| Validação e gravação | `src/Formularios.gs` | publicar o serviço |
| Consolidado | `src/Consolidado.gs` | publicar o serviço |
| Menu e `setup()` | `src/Planilha.gs` | publicar o serviço |
| Cores, fontes, layout | `docs/estilos.css` | publicar o site |
| Comportamento das telas | `docs/app.js` | publicar o site |
| Endereço do serviço | `docs/config.js` | publicar o site |
| Brasões | `docs/imagens/` | publicar o site |

### Publicar o serviço

Na pasta `appdf-avaliacoes`, rode:

```
clasp push -f
clasp deploy -i AKfycbyR-gBpe6ZWB7DwytgBjva03mOwFKXzrby1jxR0Kbnug2djZHEl3_oMs6flTDFJfbtM -d "descrição"
```

Use sempre o mesmo `-i`. Assim o endereço do serviço não muda e o site continua funcionando.

### Publicar o site

O GitHub Pages publica a pasta `docs/` do branch `main`. Faça commit e push das mudanças; o site atualiza em cerca de um minuto.

---

## 5. Velocidade

O Google leva de 1,5 a 4 s para responder cada pedido, e isso não muda. O sistema contorna essa demora de três formas:

- **Página imediata:** o site é estático e abre na hora, com um esqueleto enquanto os dados chegam.
- **Cache no serviço:** os dados de cada ação ficam guardados por 10 minutos. Qualquer edição nas abas de cadastro, ou uso do menu, limpa esse cache.
- **Cache no celular:** quem já abriu o link uma vez vê a página na hora, e a atualização acontece por trás.

Medições na instalação:

| Situação | Tempo |
|---|---|
| Dados da ação, com o cache do serviço ativo | ~1,7 s |
| Segunda abertura no mesmo celular | imediata |
| Envio de uma resposta | ~4 s, com o aviso "Enviando…" |

---

## 6. Regras garantidas no servidor

- **Anonimato do aluno:** sem login e sem colunas de nome, e-mail, matrícula, CPF ou IP.
- **Validação:**
  - a ação existe e está aberta;
  - os valores estão dentro das escalas;
  - as perguntas obrigatórias foram respondidas;
  - os textos abertos têm no máximo 2.000 caracteres.
- **Pares:** o instrutor não avalia a si mesmo.
- **Coordenação:** avalia cada instrutor uma única vez por ação.
- **Sem fórmulas:** textos que começam com `=`, `+`, `-` ou `@` são gravados como texto puro.
- **Sem duplicatas:** um envio repetido (duplo clique ou nova tentativa) não duplica a linha.
- **Rascunho:** se a página recarregar, as respostas voltam. Elas ficam só no aparelho da pessoa e são apagadas após o envio.

---

## 7. Testes

1. **Serviço (107 verificações).** Rode `zsh ferramentas/testar.sh`. O script executa o código de `src/` no Mac, com uma planilha simulada, e confere:
   - o setup;
   - a gravação de cada perfil;
   - cada perfil gravando todas as pessoas num só envio;
   - as recusas: valor fora da escala, obrigatórias em branco, aluno sem avaliar todos os instrutores, coordenação ou instrutor respondendo de novo, ação encerrada;
   - nenhum instrutor avaliando a si mesmo como par;
   - o envio repetido;
   - a ausência de fórmulas e de dados do aluno;
   - o cache e a sua limpeza;
   - a avaliação obrigatória do aluno: matrícula fora da turma recusada, mesma matrícula não responde duas vezes, participação sem horário, nada que identifique o aluno nas respostas;
   - o painel: código de acesso e bloqueio após tentativas erradas, criação e edição de ação, ID automático, recusa de cadastro incompleto, encerrar e reabrir, exclusão só sem respostas, resultados e troca do código;
   - os cálculos do consolidado, comparados com valores feitos à mão.
2. **Ponta a ponta real.** Com o site aberto localmente e ligado ao serviço publicado, cada perfil foi preenchido, enviado e gravado na planilha real, na ação `EXEMPLO-01`:
   - Reação;
   - 360° do aluno;
   - 360° da coordenação, com os 3 instrutores;
   - formulário único do instrutor.

   Também foi conferido o bloqueio de quem já respondeu.
3. **Visual.** As telas foram conferidas em 360, 390, 768 e 1280 px, sem rolagem horizontal.
4. **Na planilha real.** A função `testarEnvios()`, rodada no editor do Apps Script, envia um exemplo de cada perfil para a `EXEMPLO-01` e confere as recusas.

Depois dos testes, apague as linhas da `EXEMPLO-01` nas abas de respostas.

---

## 8. Arquivos

```
appdf-avaliacoes/
├── .clasp.json              ligação com o script publicado
├── .clasp.exemplo.json      modelo para outra instalação
├── README.md
├── docs/                    site dos formulários (GitHub Pages)
│   ├── index.html, estilos.css, app.js      formulários
│   ├── painel.html, painel.css, painel.js   painel da coordenação
│   ├── config.js            endereço do serviço
│   └── imagens/             brasão do DF e distintivo da Polícia Penal
├── src/                     serviço Apps Script (enviado com clasp push)
│   ├── appsscript.json      fuso horário e acesso anônimo
│   ├── Code.gs              API (doGet/doPost), cache e instalação automática
│   ├── Config.gs            perguntas, escalas e critérios (texto oficial)
│   ├── Formularios.gs       estrutura, validação e gravação
│   ├── Planilha.gs          setup(), cadastros e menu APPDF
│   ├── Consolidado.gs       consolidado
│   ├── Painel.gs            serviço do painel da coordenação
│   ├── Aluno.gs             avaliação obrigatória do aluno (matrícula e participação)
│   ├── Estilo.gs            visual preto e dourado da planilha
│   ├── Segredo.gs           código de acesso inicial (não vai para o GitHub)
│   └── Testes.gs            testarEnvios()
├── imagens/                 cópias das imagens tratadas
└── ferramentas/             testes locais (testar.sh, testes.js, simulador_gas.js)
```

---

## 9. Para desenvolvedores

### Visão rápida

| Parte | Onde | Tecnologia |
|---|---|---|
| Site dos formulários e painel | `docs/` (GitHub Pages, branch `main`, pasta `/docs`) | HTML, CSS e JavaScript puros, sem build |
| Serviço (API) | `src/` | Google Apps Script (V8), enviado com `clasp` |
| Banco de dados | Planilha Google "APPDF – Avaliações" (o script é vinculado a ela) | Google Sheets |
| Testes do serviço | `ferramentas/` | JavaScript rodado com `osascript` (macOS), com uma planilha simulada |

O site chama o serviço por `fetch`. O endereço do serviço fica em `docs/config.js`.
- **GET** `?api=dados&acao=ID&form=aluno|360` devolve a definição do formulário.
- **POST** com corpo JSON (`Content-Type: text/plain`, para evitar a checagem prévia de CORS):
  - `{ form, acao, respostas, envioId }` grava respostas;
  - `{ api: 'verificar_matricula', ... }` confere a matrícula;
  - `{ api: 'painel', op, token, ... }` atende o painel.

### Arquivos do serviço (`src/`)

| Arquivo | Responsabilidade |
|---|---|
| `Code.gs` | `doGet`/`doPost`, cache dos dados (CacheService), instalação e migração automáticas |
| `Config.gs` | Texto oficial das perguntas, escalas, critérios, perfis e endereço do site |
| `Formularios.gs` | Definição dos formulários, validação no servidor (`validar_`) e gravação (`gravarLinhas_`, proteção contra fórmulas) |
| `Aluno.gs` | Fluxo obrigatório do aluno (Reação + 360°), matrícula, turma e participação |
| `Painel.gs` | API do painel: acesso por código e token, listar, salvar, encerrar, excluir, turma e resultados |
| `Planilha.gs` | `setup()`, leitura das abas, menu APPDF e migração de esquema (`VERSAO_ESQUEMA`) |
| `Consolidado.gs` | Aba Consolidado (relatório) |
| `Estilo.gs` | Visual da planilha (`VERSAO_ESTILO`) |
| `Testes.gs` | `testarEnvios()`, para rodar no editor contra a planilha real |

### Acessos necessários

1. **GitHub:** ser membro da organização `appdf-df` com permissão de escrita no repositório.
2. **Google:** a dona do projeto compartilha a planilha "APPDF – Avaliações" como **Editor**. Isso dá acesso ao script vinculado, em Extensões › Apps Script.
3. **Código de acesso do painel:** é passado à parte, nunca pelo repositório.

### Configurar e publicar o serviço

```
npm install -g @google/clasp
clasp login
```

- O `.clasp.json` já aponta para o script (`scriptId`), com `rootDir: src`.
- O endereço público do serviço é a implantação `AKfycbyR-gBpe6ZWB7DwytgBjva03mOwFKXzrby1jxR0Kbnug2djZHEl3_oMs6flTDFJfbtM`. Para publicar uma mudança, use sempre o mesmo ID; assim o endereço que o site usa não muda:

```
clasp push -f
clasp deploy -i AKfycbyR-gBpe6ZWB7DwytgBjva03mOwFKXzrby1jxR0Kbnug2djZHEl3_oMs6flTDFJfbtM -d "descrição"
```

- O App da Web roda como quem publicou a implantação (`executeAs: USER_DEPLOYING`) e com acesso anônimo. Confira, no primeiro deploy feito com outra conta, se a planilha continua acessível para essa conta.
- Mudanças de estrutura nas abas: aumente `VERSAO_ESQUEMA` e trate o caso em `migrarEsquema_()`. A migração roda sozinha no primeiro acesso depois do deploy.
- Mudanças no visual da planilha: aumente `VERSAO_ESTILO`.

### Código de acesso do painel

- O código vale a partir da propriedade do script `CODIGO_PAINEL`, que é trocada pelo botão **Trocar código** do painel.
- `src/Segredo.gs` (fora do git) só define o valor inicial de uma instalação nova. Há um modelo em `src/Segredo.gs.exemplo`.

### Testes

```
zsh ferramentas/testar.sh
```

O script junta `ferramentas/simulador_gas.js` (que imita SpreadsheetApp, CacheService etc.), os arquivos de `src/` e `ferramentas/testes.js`, e roda tudo com `osascript -l JavaScript`. Rode antes de cada deploy; todas as verificações devem passar.

Para ver o site localmente:

```
python3 -m http.server 8770 --directory docs
```

Depois abra `http://localhost:8770/?acao=EXEMPLO-01`. O site local usa o serviço publicado, então os envios gravam na planilha real.

### Regras que não podem quebrar

- As respostas dos alunos não podem ter nada que identifique a pessoa. A matrícula vai só para a aba `Participacao`, apenas com a data e reordenada.
- "Não se aplica" nunca entra nas médias.
- Todo texto vindo de fora entra no DOM com `textContent`. Nada de `innerHTML` com dado do usuário.
- Todo valor gravado na planilha passa por `celula_()`, que evita fórmulas.
- A validação no servidor é a que vale, mesmo que o site também valide.

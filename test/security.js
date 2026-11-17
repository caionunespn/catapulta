// Suíte automatizada de auditoria de segurança (HTTP, WebSocket, Auth, Fuzzing de Ações).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { WebSocket } from 'ws';
import { act, createGame, view } from '../server/game.js';
import { LEVELS, LEVEL_INFO, generatePuzzle, solveByDeduction, validateBoard, findNextDeduction } from '../public/sol-e-lua/js/engine.js';
import {
  EMPTY as CR_EMPTY,
  QUEEN as CR_QUEEN,
  LEVELS as CR_LEVELS,
  LEVEL_INFO as CR_LEVEL_INFO,
  generatePuzzle as generateCoroas,
  solveByDeduction as solveCoroas,
  validateBoard as validateCoroas,
  findNextDeduction as findCoroasHint,
} from '../public/coroas/js/engine.js';
import {
  LEVELS as SP_LEVELS,
  LEVEL_INFO as SP_LEVEL_INFO,
  generatePuzzle as generateSerpentina,
  validateBoard as validateSerpentina,
  findNextDeduction as findSerpentinaHint,
} from '../public/serpentina/js/engine.js';
import {
  LEVELS as RT_LEVELS,
  LEVEL_INFO as RT_LEVEL_INFO,
  generatePuzzle as generateRetalhos,
  solveByDeduction as solveRetalhos,
  validateBoard as validateRetalhos,
  findNextDeduction as findRetalhosHint,
} from '../public/retalhos/js/engine.js';
import {
  LEVELS as SK_LEVELS,
  LEVEL_INFO as SK_LEVEL_INFO,
  generatePuzzle as generateSudoku,
  solveByDeduction as solveSudoku,
  validateBoard as validateSudoku,
  findNextDeduction as findSudokuHint,
} from '../public/sudoku/js/engine.js';
import {
  LEVELS as PL_LEVELS,
  LEVEL_INFO as PL_LEVEL_INFO,
  WORD_BANK as PL_WORD_BANK,
  generatePuzzle as generatePalavra,
  evaluateGuess as evaluatePalavra,
  isValidGuessWord as isValidPalavra,
  findClueViolations as findPalavraViolations,
  findNextDeduction as findPalavraHint,
} from '../public/palavra/js/engine.js';
import {
  CHAPTERS as SD_CHAPTERS,
  LEVELS as SD_LEVELS,
  getLevel as getDogeLevel,
  buildStroke as buildDogeStroke,
  createSim as createDogeSim,
  stepSim as stepDogeSim,
} from '../public/salve-o-caramelo/js/engine.js';
import {
  MAX_CRASHES as PK_MAX_CRASHES,
  CHAPTERS as PK_CHAPTERS,
  LEVELS as PK_LEVELS,
  evaluateExit as evaluateParkingExit,
  solveParking,
  findNextHint as findParkingHint,
  computeStars as computeParkingStars,
  getLevel as getParkingLevel,
  vehicleCells as parkingVehicleCells,
} from '../public/estacionamento/js/engine.js';
import {
  STYLES as TR_STYLES,
  CHAPTERS as TR_CHAPTERS,
  LEVELS as TR_LEVELS,
  getLevel as getTropaLevel,
  styleMultiplier as tropaStyleMult,
  createRun as createTropaRun,
  stepRun as stepTropaRun,
  evaluatePower as evalTropaPower,
  solveTropaLevel,
  simulateFixedPolicy as simTropaFixed,
} from '../public/tropa-da-quermesse/js/engine.js';
import {
  PIECES as AR_PIECES,
  CHAPTERS as AR_CHAPTERS,
  LEVELS as AR_LEVELS,
  MAX_TIER as AR_MAX_TIER,
  getLevel as getArsenalLevel,
  createStageRun as createArsenalRun,
  canPlacePiece as canPlaceArsenal,
  buyShopToGrid as buyArsenalToGrid,
  moveGridPiece as moveArsenalPiece,
  rotateGridPiece as rotateArsenalPiece,
  computeGridSynergies as computeArsenalSynergies,
  estimateGridDps as estimateArsenalDps,
  expandGridCell as expandArsenalCell,
  pieceCells as arsenalPieceCells,
} from '../public/arsenal-da-quermesse/js/engine.js';
import { hudIco as arsenalHudIco, pieceSvg as arsenalPieceSvg, shapeMiniSvg as arsenalShapeMiniSvg } from '../public/arsenal-da-quermesse/js/art.js';
import { playSmartBot as playArsenalSmart, playEmptyBot as playArsenalEmpty } from './arsenal-bot.js';

process.argv.push('--port=0', '--key=segredo123');
const { server, wss } = await import('../server/index.js');

if (!server.listening) {
  await new Promise((r) => server.once('listening', r));
}
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;
const wsUrl = `ws://127.0.0.1:${port}`;

function req(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request(`${baseUrl}${path}`, { agent: false, ...opts }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    r.on('error', reject);
    r.end();
  });
}

function connectWs(opts = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, opts);
    const msgs = [];
    ws.on('message', (raw) => msgs.push(JSON.parse(raw)));
    ws.once('open', () => {
      ws.on('error', () => {});
      resolve({ ws, msgs });
    });
    ws.once('unexpected-response', (_, res) => resolve({ rejected: res.statusCode }));
    ws.once('error', reject);
  });
}

const waitMsg = (ws, pred = () => true, timeout = 2000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout esperando mensagem WS')), timeout);
    const onMsg = (raw) => {
      const m = JSON.parse(raw);
      if (pred(m)) {
        clearTimeout(t);
        ws.off('message', onMsg);
        resolve(m);
      }
    };
    ws.on('message', onMsg);
  });

// 1. Testes de motor de jogo contra Prototype Pollution e tipos maliciosos
{
  const s = createGame([
    { name: 'A', color: 0, avatar: 0, bot: false },
    { name: 'B', color: 1, avatar: 1, bot: false },
  ]);
  s.phase = 'main';
  s.sub = 'catapult';
  s.turn = 0;
  const origCatapult = s.catapult;

  // Tentativa de acessar Array.prototype.slice em moveCatapult
  const err1 = act(s, 0, { type: 'moveCatapult', tile: 'slice' });
  assert.ok(err1, 'moveCatapult deve rejeitar índice não-inteiro ("slice")');
  assert.equal(s.catapult, origCatapult, 's.catapult não pode ser corrompido');

  // Tentativa de acessar Object.prototype.toString em playCard / buildCastle / act
  s.sub = 'action';
  assert.ok(act(s, 0, { type: 'playCard', card: 'toString' }), 'playCard deve rejeitar toString');
  assert.ok(act(s, 0, { type: 'buildCastle', v: 'toString' }), 'buildCastle deve rejeitar toString');
  assert.ok(act(s, 0, { type: 'constructor' }), 'act deve rejeitar constructor');
  assert.ok(act(s, '__proto__', { type: 'roll' }), 'act deve rejeitar jogador inválido');
}

// 2. Testes HTTP: URI malformada (não pode derrubar o servidor), Path Traversal, Métodos e Headers
{
  const badUri = await req('/%E0%A4%A');
  assert.equal(badUri.status, 400, 'URI malformada deve retornar 400 sem derrubar o servidor');

  const traversal = await req('/..%2Fpackage.json');
  assert.equal(traversal.status, 403, 'Path traversal codificado deve retornar 403');

  const postRes = await req('/index.html', { method: 'POST' });
  assert.equal(postRes.status, 405, 'POST deve retornar 405');

  const okRes = await req('/');
  assert.equal(okRes.status, 200, 'GET / deve retornar 200');
  assert.ok(okRes.body.includes('href="/catapulta"'), 'Página inicial deve ter o botão apontando para /catapulta');
  assert.ok(okRes.body.includes('href="/sol-e-lua"'), 'Página inicial deve ter o botão apontando para /sol-e-lua');
  assert.equal(okRes.headers['x-content-type-options'], 'nosniff');
  assert.equal(okRes.headers['x-frame-options'], 'DENY');
  assert.ok(okRes.headers['content-security-policy']?.includes("default-src 'self'"));

  const gameRes = await req('/catapulta');
  assert.equal(gameRes.status, 200, 'GET /catapulta deve retornar 200');
  assert.ok(gameRes.body.includes('id="board"'), 'GET /catapulta deve entregar a página do jogo');

  const gameSlashRes = await req('/catapulta/');
  assert.equal(gameSlashRes.status, 200, 'GET /catapulta/ deve retornar 200');

  const slRes = await req('/sol-e-lua');
  assert.equal(slRes.status, 200, 'GET /sol-e-lua deve retornar 200');
  assert.ok(slRes.body.includes('id="sl-grid"'), 'GET /sol-e-lua deve entregar o tabuleiro de Sol & Lua');
}

// 3. Testes WebSocket: Cross-Site WebSocket Hijacking (Origin inválido)
{
  const evil = await connectWs({ headers: { Origin: 'https://site-malicioso.com' } });
  assert.equal(evil.rejected, 403, 'Conexão WS de Origin externo deve ser bloqueada com 403');
}

// 4. Testes WebSocket: Proteção por Chave de Convite e Token Gerado no Servidor
{
  const { ws: wsNoKey } = await connectWs();
  const pErr = waitMsg(wsNoKey, (m) => m.t === 'err');
  wsNoKey.send(JSON.stringify({ t: 'hello', name: 'Intruso', key: 'errada' }));
  const errMsg = await pErr;
  assert.equal(errMsg.needKey, true, 'Deve exigir chave de convite válida');
  wsNoKey.close();

  const { ws: wsHost } = await connectWs();
  const pHello = waitMsg(wsHost, (m) => m.t === 'hello');
  const fakeToken = 'token-forjado-pelo-cliente-12345';
  wsHost.send(JSON.stringify({ t: 'hello', name: 'Anfitriao', key: 'segredo123', token: fakeToken }));
  const helloMsg = await pHello;
  assert.notEqual(helloMsg.token, fakeToken, 'Servidor nunca deve aceitar token escolhido pelo cliente em vaga nova');
  assert.equal(helloMsg.code.length, 4);
  wsHost.close();
}

// 5. Teste de Rate Limiting de Mensagens WebSocket (Flood)
{
  const { ws: wsFlood } = await connectWs();
  const closed = new Promise((r) => wsFlood.once('close', (code) => r(code)));
  for (let i = 0; i < 40; i++) {
    wsFlood.send(JSON.stringify({ t: 'emote', e: '😂' }));
  }
  const closeCode = await closed;
  assert.equal(closeCode, 1008, 'Flood de mensagens deve encerrar o socket com código 1008');
}

// 6. Teste de regressão do fluxo de ações no GitHub Pages / Firebase (vila -> trilha sem precisar de F5)
{
  const mainSrc = fs.readFileSync(new URL('../public/catapulta/js/main.js', import.meta.url), 'utf8');
  const fbSrc = fs.readFileSync(new URL('../public/catapulta/js/net-firebase.js', import.meta.url), 'utf8');

  // Em onPick, ui.pending = true deve acontecer ANTES das chamadas a act(...), nunca depois
  const onPickBlock = mainSrc.slice(mainSrc.indexOf('function onPick'), mainSrc.indexOf('function render()'));
  const pendingIdx = onPickBlock.indexOf('ui.pending = true');
  const firstActIdx = onPickBlock.indexOf('act({');
  assert.ok(pendingIdx > 0 && firstActIdx > pendingIdx, 'onPick deve definir ui.pending = true antes de chamar act() para não apagar os alvos da trilha no retorno síncrono');

  // Em net-firebase.js, send() do Host deve enfileirar via queueMicrotask e syncAll não deve sobrescrever game com room
  assert.ok(fbSrc.includes('queueMicrotask(() => handlePlayerMsg(uid, m))'), 'Host Firebase deve despachar ações via queueMicrotask');
  assert.ok(fbSrc.includes('includeRoom = false'), 'syncAll só deve emitir room quando a sala realmente mudar');

  // Verifica presença do modal Sobre e créditos com Caio Nunes e Iuri
  assert.ok(mainSrc.includes('porque o Iuri duvidou que eu era muito poderoso'), 'Modal Sobre deve conter a história do Iuri');
  assert.ok(mainSrc.includes('Caio Nunes'), 'Modal Sobre deve conter os créditos de Caio Nunes');

  // Verifica mini ranking flutuante, rótulo claro do Banco da Quermesse, animações de fundo, zoom/pan e peça da Catapulta
  const artSrc = fs.readFileSync(new URL('../public/js/art.js', import.meta.url), 'utf8');
  const boardSrc = fs.readFileSync(new URL('../public/catapulta/js/board.js', import.meta.url), 'utf8');
  assert.ok(mainSrc.includes('function renderRank()') && mainSrc.includes('rk-chip'), 'Deve renderizar o mini ranking enxuto (1º, 2º + carinha)');
  assert.ok(mainSrc.includes('Banco da Quermesse'), 'Área do banco deve identificar claramente que é o Banco da Quermesse');
  assert.ok(mainSrc.includes('function buildAmbient'), 'Deve inicializar as animações sutis de fundo na home e no palco');
  assert.ok(artSrc.includes('cat-arm'), 'Peça do ladrão no tabuleiro deve ser uma catapulta com braço lançador (cat-arm)');
  assert.ok(boardSrc.includes('zoomBy(') && boardSrc.includes('resetCam('), 'Tabuleiro deve suportar zoom e pan interativos');

  // Simula o ciclo cliente (onPick -> send -> motor -> applyGame -> targets) em modo síncrono e microtask
  for (const syncMode of [true, false]) {
    const game = createGame([
      { name: 'Caio', color: 0, avatar: 0, bot: false },
      { name: 'Iuri', color: 1, avatar: 1, bot: false },
    ]);
    // Garante que o jogador 0 começa para testar o fluxo direto do anfitrião
    game.turn = 0;
    game.setupOrder = [0, 1, 1, 0];
    game.setupStep = 0;

    let G = view(game, 0);
    const ui = { mode: null, pending: false };
    let renderedTargets = null;

    const getTargets = () => {
      const t = { vertices: [], edges: [], tiles: [], kind: null };
      if (!G || G.turn !== G.me || G.phase === 'ended' || ui.pending) return t;
      const L = G.legal;
      if (G.sub === 'setupVillage') t.vertices = L.villages;
      else if (G.sub === 'setupRoad') t.edges = L.roads;
      else if (G.sub === 'catapult') t.tiles = L.tiles;
      else if (G.sub === 'action') {
        if (G.freeRoads > 0 || ui.mode === 'road') t.edges = L.roads;
        else if (ui.mode === 'village') t.vertices = L.villages;
        else if (ui.mode === 'castle') {
          t.vertices = L.castles;
          t.kind = 'castle';
        }
      }
      return t;
    };

    const applyGameSim = (sView) => {
      G = sView;
      ui.pending = false;
      if (G.turn !== G.me || G.sub !== 'action') ui.mode = null;
      renderedTargets = getTargets();
    };

    const sendAction = (a) => {
      const deliver = () => {
        const err = act(game, 0, a);
        assert.equal(err, null, `Ação ${a.type} não deveria falhar: ${err}`);
        applyGameSim(view(game, 0));
      };
      if (syncMode) deliver();
      else queueMicrotask(deliver);
    };

    const onPickSim = async (kind, id) => {
      assert.equal(ui.pending, false, 'ui.pending deve estar false antes do clique');
      const mode = ui.mode;
      ui.mode = null;
      ui.pending = true;
      renderedTargets = getTargets();
      if (kind === 'vertex') {
        if (G.sub === 'setupVillage') sendAction({ type: 'placeVillage', v: id });
        else if (mode === 'castle') sendAction({ type: 'buildCastle', v: id });
        else sendAction({ type: 'buildVillage', v: id });
      } else if (kind === 'edge') {
        if (G.sub === 'setupRoad') sendAction({ type: 'placeRoad', e: id });
        else sendAction({ type: 'buildRoad', e: id });
      }
      if (!syncMode) await new Promise((r) => queueMicrotask(r));
    };

    // Passo 1: Estado inicial mostra os alvos para a primeira vila
    renderedTargets = getTargets();
    assert.equal(G.sub, 'setupVillage');
    assert.ok(renderedTargets.vertices.length > 0, 'Deve exibir vértices para a 1ª vila');

    // Passo 2: Jogador clica na primeira vila -> deve atualizar imediatamente para setupRoad e exibir as trilhas!
    const firstVillage = renderedTargets.vertices[0];
    await onPickSim('vertex', firstVillage);
    assert.equal(ui.pending, false, `ui.pending deve voltar a false após criar vila (sync=${syncMode})`);
    assert.equal(G.sub, 'setupRoad', `Subfase deve mudar para setupRoad sem F5 (sync=${syncMode})`);
    assert.ok(renderedTargets.edges.length > 0, `Alvos de trilha devem aparecer imediatamente após a 1ª vila (sync=${syncMode})`);

    // Passo 3: Jogador clica na trilha -> turno passa para o jogador 1
    const firstRoad = renderedTargets.edges[0];
    await onPickSim('edge', firstRoad);
    assert.equal(ui.pending, false, `ui.pending deve voltar a false após criar trilha (sync=${syncMode})`);
    assert.equal(G.turn, 1, 'Turno deve avançar para o jogador 1 após colocar a 1ª trilha');

    // Jogador 1 faz suas 2 vilas e 2 trilhas no servidor
    const v1a = view(game, 1).legal.villages[0];
    assert.equal(act(game, 1, { type: 'placeVillage', v: v1a }), null);
    const e1a = view(game, 1).legal.roads[0];
    assert.equal(act(game, 1, { type: 'placeRoad', e: e1a }), null);
    const v1b = view(game, 1).legal.villages[0];
    assert.equal(act(game, 1, { type: 'placeVillage', v: v1b }), null);
    const e1b = view(game, 1).legal.roads[0];
    assert.equal(act(game, 1, { type: 'placeRoad', e: e1b }), null);

    // Atualiza visão do jogador 0: agora é a 2ª vila do jogador 0
    applyGameSim(view(game, 0));
    assert.equal(G.turn, 0);
    assert.equal(G.sub, 'setupVillage');
    assert.ok(renderedTargets.vertices.length > 0, 'Deve exibir vértices para a 2ª vila');

    // Passo 4: Jogador 0 coloca a 2ª vila -> trilha aparece imediatamente
    const secondVillage = renderedTargets.vertices[0];
    await onPickSim('vertex', secondVillage);
    assert.equal(ui.pending, false);
    assert.equal(G.sub, 'setupRoad');
    assert.ok(renderedTargets.edges.length > 0, 'Alvos da 2ª trilha devem aparecer imediatamente');

    // Passo 5: Jogador 0 coloca a 2ª trilha -> entra na fase principal (sub === 'roll')
    const secondRoad = renderedTargets.edges[0];
    await onPickSim('edge', secondRoad);
    assert.equal(ui.pending, false);
    assert.equal(G.phase, 'main');
    assert.equal(G.sub, 'roll');

    // Passo 6: Na fase de ação, selecionar modo 'road' exibe alvos e construir trilha atualiza sem travar
    game.sub = 'action';
    game.players[0].hand = { wood: 5, stone: 5, cheese: 5, pumpkin: 5, crystal: 5 };
    applyGameSim(view(game, 0));
    ui.mode = 'road';
    renderedTargets = getTargets();
    assert.ok(renderedTargets.edges.length > 0, 'Modo trilha na fase principal deve mostrar arestas legais');
    await onPickSim('edge', renderedTargets.edges[0]);
    assert.equal(ui.pending, false, 'ui.pending deve ser false após construir trilha na partida');
    assert.equal(ui.mode, null, 'ui.mode deve ser limpo após construir trilha');
  }
}

// 9. Níveis de bot (easy, medium, hard) na criação da sala, no lobby e no motor
{
  const { ws } = await connectWs({ headers: { Origin: baseUrl } });
  const h = waitMsg(ws, (m) => m.t === 'hello');
  const r1 = waitMsg(ws, (m) => m.t === 'room');
  ws.send(JSON.stringify({ t: 'hello', name: 'Caio', key: 'segredo123', botLevel: 'hard' }));
  await h;
  const room1 = await r1;
  assert.equal(room1.botLevel, 'hard', 'Sala criada deve iniciar com botLevel=hard');

  const r2 = waitMsg(ws, (m) => m.t === 'room' && m.seats.length === 2);
  ws.send(JSON.stringify({ t: 'addBot' }));
  const room2 = await r2;
  assert.equal(room2.seats[1].bot, true);
  assert.equal(room2.seats[1].botLevel, 'hard', 'Bot adicionado deve herdar o nível da sala');

  const r3 = waitMsg(ws, (m) => m.t === 'room' && m.botLevel === 'easy');
  ws.send(JSON.stringify({ t: 'botLevel', level: 'easy' }));
  const room3 = await r3;
  assert.equal(room3.botLevel, 'easy');
  assert.equal(room3.seats[1].botLevel, 'easy', 'Mudar nível no lobby deve atualizar os bots existentes');

  // Verifica também o HTML/JS do modal "Sobre" (avatar masculino e sem avatar(4)) e "Como joga"
  const mainJs = fs.readFileSync(new URL('../public/catapulta/js/main.js', import.meta.url), 'utf8');
  assert.ok(!mainJs.includes('avatar(4)'), 'Aba Sobre não deve usar o avatar feminino avatar(4) no quadro do criador');
  assert.ok(mainJs.includes('porque o Iuri duvidou que eu era muito poderoso'), 'Aba Sobre deve manter a história do Iuri');
  assert.ok(mainJs.includes('rules-steps') && mainJs.includes('rules-builds'), 'Aba Como joga deve estar organizada em seções visuais claras');

  ws.close();
}

// 10. Mini-jogo Sol & Lua: 4 dificuldades, dedutibilidade sem chute, validação de regras e dicas
{
  assert.deepEqual(LEVELS, ['easy', 'medium', 'hard', 'expert']);
  for (const lv of LEVELS) {
    const puz = generatePuzzle(lv);
    assert.ok(puz, `Deve gerar quebra-cabeça para o nível ${lv}`);
    assert.equal(puz.solution.length, 36);
    assert.equal(puz.givens.length, 36);

    // Solução completa deve ser 100% válida
    const valSol = validateBoard(puz.solution, puz.signs);
    assert.equal(valSol.isSolved, true, `Solução gerada em ${lv} deve ser válida`);
    assert.equal(valSol.badCells.size, 0);

    // Deve ser 100% resolvida apenas por dedução lógica até o maxTier do nível
    const ded = solveByDeduction(puz.givens, puz.signs, LEVEL_INFO[lv].maxTier);
    assert.equal(ded.solved, true, `Quebra-cabeça ${lv} deve ser resolvido por dedução sem precisar chutar`);
    assert.deepEqual(ded.grid, puz.solution, `Dedução em ${lv} deve chegar à solução única`);

    // Primeira dica a partir do estado inicial deve existir e explicar o motivo
    const firstHint = findNextDeduction(puz.givens, puz.signs, LEVEL_INFO[lv].maxTier);
    assert.ok(firstHint && typeof firstHint.reason === 'string' && firstHint.reason.length > 5, 'Dica deve explicar o passo lógico');
  }

  // Validador deve acusar 3 iguais seguidos
  const badGrid = new Array(36).fill(null);
  badGrid[0] = 0;
  badGrid[1] = 0;
  badGrid[2] = 0;
  const vBad = validateBoard(badGrid, []);
  assert.equal(vBad.badCells.has(0) && vBad.badCells.has(1) && vBad.badCells.has(2), true, 'Deve detectar 3 símbolos iguais seguidos');

  // Verifica padronização do modal de regras/créditos e contador de erros com debounce
  const slHtml = fs.readFileSync(new URL('../public/sol-e-lua/index.html', import.meta.url), 'utf8');
  const slJs = fs.readFileSync(new URL('../public/sol-e-lua/js/main.js', import.meta.url), 'utf8');
  assert.ok(slHtml.includes('id="modal-root"'), 'Sol & Lua deve ter #modal-root padronizado');
  assert.ok(slHtml.includes('id="sl-errors"'), 'Sol & Lua deve exibir contador de erros');
  assert.ok(slJs.includes('function rulesModal()') && slJs.includes('rules-steps') && slJs.includes('modal-tabs'), 'Sol & Lua deve usar o mesmo modal padronizado de Como joga / Sobre e créditos');
  assert.ok(slJs.includes('ERROR_DELAY_MS') && slJs.includes('commitErrors'), 'Sol & Lua deve aguardar o jogador parar de clicar antes de acusar erro');
}

// 11. Mini-jogo Coroas (/coroas): rota HTTP, 4 níveis, regiões conexas, dedução sem chute, debounce de erros e modal padronizado
{
  const rCoroas = await req('/coroas');
  assert.equal(rCoroas.status, 200);
  assert.ok(rCoroas.body.includes('id="screen-coroas"'), 'Rota /coroas deve servir o mini-jogo Coroas');

  assert.deepEqual(CR_LEVELS, ['easy', 'medium', 'hard', 'expert']);
  for (const lv of CR_LEVELS) {
    const puz = generateCoroas(lv);
    const sz = CR_LEVEL_INFO[lv].size;
    assert.equal(puz.size, sz);
    assert.equal(puz.regions.length, sz * sz);
    assert.equal(puz.solution.length, sz * sz);

    // Solução deve ser 100% válida
    const solGrid = puz.solution.map((v) => (v === 1 ? CR_QUEEN : CR_EMPTY));
    const vSol = validateCoroas(solGrid, puz.regions, sz);
    assert.equal(vSol.isSolved, true, `Solução de Coroas em ${lv} deve ser válida`);
    assert.equal(vSol.badCells.size, 0);

    // Deve ser 100% resolvida apenas por dedução lógica até maxTier
    const ded = solveCoroas(puz.regions, sz, CR_LEVEL_INFO[lv].maxTier);
    assert.equal(ded.solved, true, `Tabuleiro de Coroas em ${lv} deve fechar sem chute`);
    assert.deepEqual(Array.from(ded.placedQueens), puz.solution);

    // Primeira dica a partir do tabuleiro vazio deve existir e explicar o motivo
    const emptyGrid = new Array(sz * sz).fill(CR_EMPTY);
    const hint = findCoroasHint(emptyGrid, puz.regions, sz, CR_LEVEL_INFO[lv].maxTier);
    assert.ok(hint && hint.kind === 'queen' && typeof hint.reason === 'string', 'Dica de Coroas deve indicar uma coroa com explicação');
  }

  // Validador deve detectar duas coroas se tocando na diagonal
  const diagGrid = new Array(36).fill(CR_EMPTY);
  const dummyRegs = Array.from({ length: 36 }, (_, i) => Math.floor(i / 6));
  diagGrid[0] = CR_QUEEN; // (0,0)
  diagGrid[7] = CR_QUEEN; // (1,1) - diagonal!
  const vDiag = validateCoroas(diagGrid, dummyRegs, 6);
  assert.equal(vDiag.badCells.has(0) && vDiag.badCells.has(7), true, 'Deve acusar coroas que se tocam na diagonal');

  // Verifica modal padronizado e debounce de erro em Coroas
  const crHtml = fs.readFileSync(new URL('../public/coroas/index.html', import.meta.url), 'utf8');
  const crJs = fs.readFileSync(new URL('../public/coroas/js/main.js', import.meta.url), 'utf8');
  assert.ok(crHtml.includes('id="modal-root"') && crHtml.includes('id="cr-errors"'));
  assert.ok(crJs.includes('function rulesModal()') && crJs.includes('ERROR_DELAY_MS') && crJs.includes('commitErrors'));
}

// 12. Mini-jogo Serpentina (/serpentina): rota HTTP, 4 níveis, caminho Hamiltoniano completo, validação de ordem, debounce de erros e modal padronizado
{
  const rSerp = await req('/serpentina');
  assert.equal(rSerp.status, 200);
  assert.ok(rSerp.body.includes('id="screen-serpentina"'), 'Rota /serpentina deve servir o mini-jogo Serpentina');

  assert.deepEqual(SP_LEVELS, ['easy', 'medium', 'hard', 'expert']);
  for (const lv of SP_LEVELS) {
    const puz = generateSerpentina(lv);
    const sz = SP_LEVEL_INFO[lv].size;
    assert.equal(puz.size, sz);
    assert.equal(puz.total, sz * sz);
    assert.equal(puz.solution.length, sz * sz);

    // Caminho solução deve visitar todas as células sem repetir e fechar válido
    const uniq = new Set(puz.solution);
    assert.equal(uniq.size, sz * sz, `Solução de Serpentina em ${lv} deve cobrir 100% das casas`);
    const vSol = validateSerpentina(puz.solution, puz);
    assert.equal(vSol.isSolved, true, `Solução de Serpentina em ${lv} deve ser válida`);
    assert.equal(vSol.badCells.size, 0);

    // Dica a partir da casa inicial deve funcionar e explicar o movimento
    const hint = findSerpentinaHint([puz.solution[0]], puz);
    assert.ok(hint && Array.isArray(hint.targetPath) && hint.targetPath.length > 1 && typeof hint.reason === 'string');
  }

  // Verifica modal padronizado e debounce de erro em Serpentina
  const spHtml = fs.readFileSync(new URL('../public/serpentina/index.html', import.meta.url), 'utf8');
  const spJs = fs.readFileSync(new URL('../public/serpentina/js/main.js', import.meta.url), 'utf8');
  assert.ok(spHtml.includes('id="modal-root"') && spHtml.includes('id="sp-errors"'));
  assert.ok(spJs.includes('function rulesModal()') && spJs.includes('ERROR_DELAY_MS') && spJs.includes('commitErrors'));
}

// 13. Mini-jogo Retalhos (/retalhos): rota HTTP, 4 níveis, partição 100% dedutível sem chute, validação de formas/áreas, debounce de erros e modal padronizado
{
  const rRet = await req('/retalhos');
  assert.equal(rRet.status, 200);
  assert.ok(rRet.body.includes('id="screen-retalhos"'), 'Rota /retalhos deve servir o mini-jogo Retalhos');

  assert.deepEqual(RT_LEVELS, ['easy', 'medium', 'hard', 'expert']);
  for (const lv of RT_LEVELS) {
    const puz = generateRetalhos(lv);
    const sz = RT_LEVEL_INFO[lv].size;
    assert.equal(puz.size, sz);
    assert.equal(puz.total, sz * sz);
    assert.equal(puz.clues.length, puz.solution.length);

    // Solução completa deve ser 100% válida e cobrir toda a grade
    const vSol = validateRetalhos(puz.solution, puz);
    assert.equal(vSol.isSolved, true, `Solução de Retalhos em ${lv} deve ser válida`);
    assert.equal(vSol.badClues.size, 0);
    assert.equal(vSol.coveredCount, sz * sz);

    // Deve ser 100% resolvida apenas por dedução lógica até maxTier
    const ded = solveRetalhos(puz.clues, sz, RT_LEVEL_INFO[lv].maxTier);
    assert.equal(ded.solved, true, `Tabuleiro de Retalhos em ${lv} deve fechar sem chute`);

    // Primeira dica a partir do tabuleiro vazio deve existir e explicar o motivo
    const emptyRects = new Array(puz.clues.length).fill(null);
    const hint = findRetalhosHint(emptyRects, puz);
    assert.ok(hint && hint.rect && typeof hint.reason === 'string', 'Dica de Retalhos deve indicar uma forma com explicação');
  }

  // Verifica modal padronizado e debounce de erro em Retalhos
  const rtHtml = fs.readFileSync(new URL('../public/retalhos/index.html', import.meta.url), 'utf8');
  const rtJs = fs.readFileSync(new URL('../public/retalhos/js/main.js', import.meta.url), 'utf8');
  assert.ok(rtHtml.includes('id="modal-root"') && rtHtml.includes('id="rt-errors"'));
  assert.ok(rtJs.includes('function rulesModal()') && rtJs.includes('ERROR_DELAY_MS') && rtJs.includes('commitErrors'));
}

// 14. Mini-jogo Sudoku (/sudoku): rota HTTP, 4 níveis, geração 9x9 dedutível sem chute, validação de conflitos, debounce de erros e modal padronizado
{
  const rSudoku = await req('/sudoku');
  assert.equal(rSudoku.status, 200);
  assert.ok(rSudoku.body.includes('id="sk-grid"'), 'Rota /sudoku deve servir o mini-jogo Sudoku');

  assert.deepEqual(SK_LEVELS, ['easy', 'medium', 'hard', 'expert']);
  for (const lv of SK_LEVELS) {
    const puz = generateSudoku(lv);
    assert.equal(puz.size, 9);
    assert.equal(puz.givens.length, 81);
    assert.equal(puz.solution.length, 81);

    // Solução deve ser 100% válida e completa
    const vSol = validateSudoku(puz.solution);
    assert.equal(vSol.isSolved, true, `Solução de Sudoku em ${lv} deve ser válida`);
    assert.equal(vSol.badCells.size, 0);

    // Deve ser 100% resolvida apenas por dedução lógica até maxTier
    const ded = solveSudoku(puz.givens, SK_LEVEL_INFO[lv].maxTier);
    assert.equal(ded.solved, true, `Tabuleiro de Sudoku em ${lv} deve fechar sem chute`);
    assert.deepEqual(Array.from(ded.grid), puz.solution);

    // Primeira dica a partir do estado inicial deve existir e explicar o motivo
    const hint = findSudokuHint(puz.givens, SK_LEVEL_INFO[lv].maxTier);
    assert.ok(hint && hint.val >= 1 && hint.val <= 9 && typeof hint.reason === 'string');
  }

  // Testa detecção de conflitos (linha, coluna e bloco 3x3) no validateSudoku
  {
    const rowConflict = new Array(81).fill(0);
    rowConflict[0] = 5;
    rowConflict[4] = 5;
    const vRow = validateSudoku(rowConflict);
    assert.ok(vRow.badCells.has(0) && vRow.badCells.has(4), 'Sudoku deve marcar conflito na linha');

    const colConflict = new Array(81).fill(0);
    colConflict[1] = 7;
    colConflict[1 + 9 * 6] = 7;
    const vCol = validateSudoku(colConflict);
    assert.ok(vCol.badCells.has(1) && vCol.badCells.has(55), 'Sudoku deve marcar conflito na coluna');

    const boxConflict = new Array(81).fill(0);
    boxConflict[0] = 3;
    boxConflict[10] = 3;
    const vBox = validateSudoku(boxConflict);
    assert.ok(vBox.badCells.has(0) && vBox.badCells.has(10), 'Sudoku deve marcar conflito no bloco 3x3');
  }

  // Verifica modal padronizado e debounce de erro em Sudoku
  const skHtml = fs.readFileSync(new URL('../public/sudoku/index.html', import.meta.url), 'utf8');
  const skJs = fs.readFileSync(new URL('../public/sudoku/js/main.js', import.meta.url), 'utf8');
  assert.ok(skHtml.includes('id="modal-root"') && skHtml.includes('id="sk-errors"'));
  assert.ok(skJs.includes('function rulesModal()') && skJs.includes('ERROR_DELAY_MS') && skJs.includes('commitErrors'));
}

// 15. Mini-jogo Palavra (/palavra): rota HTTP, 4 níveis (4 a 7 letras), avaliação estilo Wordle, dica, debounce de erros e modal padronizado
{
  const rPalavra = await req('/palavra');
  assert.equal(rPalavra.status, 200);
  assert.ok(rPalavra.body.includes('id="pl-grid"'), 'Rota /palavra deve servir o mini-jogo Palavra');

  assert.deepEqual(PL_LEVELS, ['easy', 'medium', 'hard', 'expert']);
  for (const lv of PL_LEVELS) {
    const puz = generatePalavra(lv);
    const cols = PL_LEVEL_INFO[lv].cols;
    assert.equal(puz.cols, cols);
    assert.equal(puz.rows, 6);
    assert.equal(puz.word.length, cols);
    assert.equal(isValidPalavra(puz.word, cols).ok, true);

    const exact = evaluatePalavra(puz.word, puz.word);
    assert.deepEqual(exact, new Array(cols).fill('correct'));

    const hint = findPalavraHint([], new Set(), puz.word);
    assert.ok(hint && hint.col === 0 && hint.letter === puz.word[0]);
  }

  // Valida banco de palavras inteiro (tamanho, letras ASCII maiúsculas e sem duplicatas por nível)
  for (const lv of PL_LEVELS) {
    const cols = PL_LEVEL_INFO[lv].cols;
    const seen = new Set();
    for (const w of PL_WORD_BANK[lv]) {
      assert.match(w, /^[A-Z]+$/, `Palavra ${w} em ${lv} deve conter apenas A-Z`);
      assert.equal(w.length, cols, `Palavra ${w} em ${lv} deve ter ${cols} letras`);
      assert.equal(seen.has(w), false, `Palavra duplicada ${w} em ${lv}`);
      seen.add(w);
      assert.equal(isValidPalavra(w, cols).ok, true, `Palavra ${w} deve passar em isValidGuessWord`);
    }
  }

  // Verifica avaliação de letras duplicadas (correct > present > absent)
  assert.deepEqual(evaluatePalavra('ARARA', 'CARTA'), ['present', 'present', 'absent', 'absent', 'correct']);

  // Verifica findClueViolations com linha parcial/esparsamente preenchida (preservando índices)
  {
    const vGreenOk = findPalavraViolations('   T ', ['FESTA'], 'CARTA');
    assert.equal(vGreenOk.cells.size, 0, 'T exatamente na 4ª casa não deve acusar erro');

    const vGreenWrong = findPalavraViolations('   M ', ['FESTA'], 'CARTA');
    assert.ok(vGreenWrong.cells.has(3), 'Trocar a 4ª letra verde (T) deve apontar exatamente a coluna 3');
    assert.equal(vGreenWrong.cells.has(0), false);

    const vAbsentPos = findPalavraViolations(' F   ', ['FESTA'], 'CARTA');
    assert.ok(vAbsentPos.cells.has(1), 'Letra descartada na coluna 1 deve marcar coluna 1, não 0');
    assert.equal(vAbsentPos.cells.has(0), false);

    const vExcess = findPalavraViolations('AA   ', ['CARTA'], 'PALCO');
    // Em PALCO, palpite anterior CARTA tem A[1]=correct e A[4]=absent -> só 1 ocorrência de A
    assert.ok(vExcess.cells.has(0), 'Segunda ocorrência excedente de A em posição não exata deve ser sinalizada');
  }

  // Verifica modal padronizado e ausência de aviso/erro antes de enviar a palavra
  const plHtml = fs.readFileSync(new URL('../public/palavra/index.html', import.meta.url), 'utf8');
  const plJs = fs.readFileSync(new URL('../public/palavra/js/main.js', import.meta.url), 'utf8');
  assert.ok(plHtml.includes('id="modal-root"') && plHtml.includes('id="pl-errors"'));
  assert.ok(
    plJs.includes('function rulesModal()') &&
      plJs.includes('findClueViolations(guess, state.guesses, word)') &&
      !plJs.includes('scheduleErrorCheck') &&
      !plJs.includes('ERROR_DELAY_MS')
  );
}

// 16. Auditoria HTTP de todas as rotas, CSS/JS referenciados, Web Worker e conformidade CSP (sem scripts inline)
{
  const routes = ['/', '/catapulta', '/sol-e-lua', '/coroas', '/serpentina', '/retalhos', '/sudoku', '/palavra', '/salve-o-caramelo', '/estacionamento'];
  const assetUrls = new Set(['/js/puzzle-worker.js', '/js/puzzle-pool.js']);

  for (const route of routes) {
    const res = await req(route);
    assert.equal(res.status, 200, `Rota ${route} deve responder 200`);
    const html = res.body;

    // CSP script-src 'self': nenhum <script> sem src e nenhum handler inline on*=
    const inlineScripts = [...html.matchAll(/<script\b([^>]*)>/gi)].filter((m) => !/\bsrc=/i.test(m[1]));
    assert.equal(inlineScripts.length, 0, `Rota ${route} não pode conter <script> inline`);
    const inlineHandlers = html.match(/\son[a-z]+\s*=/gi) || [];
    assert.equal(inlineHandlers.length, 0, `Rota ${route} não pode conter atributos inline on*=`);

    // Coleta stylesheets e scripts locais (atributos em qualquer ordem)
    const basePageUrl = new URL(route === '/' ? '/' : `${route}/`, baseUrl);
    for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
      const u = new URL(m[1], basePageUrl);
      if (u.origin === baseUrl) assetUrls.add(u.pathname);
    }
    for (const m of html.matchAll(/<link\b([^>]*)>/gi)) {
      const attrs = m[1];
      if (!/\brel=["']stylesheet["']/i.test(attrs)) continue;
      const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
      if (!href) continue;
      const u = new URL(href, basePageUrl);
      if (u.origin === baseUrl) assetUrls.add(u.pathname);
    }
  }

  // Portal deve apontar para todas as barracas ativas
  const portalRes = await req('/');
  for (const slug of ['/catapulta', '/sol-e-lua', '/coroas', '/serpentina', '/retalhos', '/sudoku', '/palavra', '/salve-o-caramelo', '/estacionamento']) {
    assert.ok(portalRes.body.includes(`href="${slug}"`), `Portal deve conter link para ${slug}`);
  }

  // BFS sobre assets locais + imports ES module para garantir zero imports quebrados
  const checkedAssets = new Set();
  const pendingAssets = [...assetUrls];
  while (pendingAssets.length > 0) {
    const assetPath = pendingAssets.shift();
    if (checkedAssets.has(assetPath)) continue;
    checkedAssets.add(assetPath);

    const res = await req(assetPath);
    assert.equal(res.status, 200, `Asset ${assetPath} deve responder HTTP 200`);
    assert.ok(res.body.length > 20, `Asset ${assetPath} não pode estar vazio`);

    if (assetPath.endsWith('.js')) {
      const assetBase = new URL(assetPath, baseUrl);
      for (const m of res.body.matchAll(/(?:import|export)\s+(?:[^'"]*\s+from\s+)?["']([^"']+)["']/g)) {
        const spec = m[1];
        if (spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/')) {
          const dep = new URL(spec, assetBase);
          if (dep.origin === baseUrl && !checkedAssets.has(dep.pathname)) {
            pendingAssets.push(dep.pathname);
          }
        }
      }
    }
  }
}

// 17. Consistência adicional dos geradores (Coroas expert múltiplas rodadas, Serpentina paredes, Retalhos sobreposição)
{
  for (let i = 0; i < 6; i++) {
    const cp = generateCoroas('expert');
    const cSol = solveCoroas(cp.regions, cp.size, 4);
    assert.equal(cSol.solved, true, `Coroas expert rodada ${i} deve resolver 100% por dedução`);
    assert.deepEqual(Array.from(cSol.placedQueens), cp.solution);
  }

  const sp = generateSerpentina('medium');
  assert.ok(sp.wallSet instanceof Set, 'Serpentina puzzle deve expor wallSet como Set');
  const spBadSkip = validateSerpentina([sp.clueCells[0].cell, sp.clueCells[1].cell], sp);
  assert.ok(
    sp.clueCells[1].cell !== sp.solution[1] ? spBadSkip.badCells.size > 0 : true,
    'Salto ilegal em Serpentina deve ser detectado'
  );

  const rt = generateRetalhos('easy');
  const overlapRects = rt.clues.map(() => null);
  overlapRects[0] = { r1: rt.clues[0].r, c1: rt.clues[0].c, r2: rt.clues[0].r, c2: rt.clues[0].c };
  if (rt.clues.length >= 2) {
    // Cria propositalmente retângulo que invade outra pista
    overlapRects[0] = {
      r1: Math.min(rt.clues[0].r, rt.clues[1].r),
      c1: Math.min(rt.clues[0].c, rt.clues[1].c),
      r2: Math.max(rt.clues[0].r, rt.clues[1].r),
      c2: Math.max(rt.clues[0].c, rt.clues[1].c),
    };
    const vOverlap = validateRetalhos(overlapRects, rt);
    assert.ok(vOverlap.badClues.size > 0, 'Retalhos deve marcar erro quando retângulo engloba outra pista');
  }
}

// 18. Mini-jogo Salve o Caramelo (/salve-o-caramelo): rota HTTP, 40 fases em 4 capítulos, física headless, flanqueamento e modal
{
  const rDoge = await req('/salve-o-caramelo');
  assert.equal(rDoge.status, 200);
  assert.ok(rDoge.body.includes('id="sd-canvas"'), 'Rota /salve-o-caramelo deve servir o mini-jogo Salve o Caramelo');

  assert.equal(SD_LEVELS.length, 40, 'Salve o Doge deve ter exatamente 40 fases');
  assert.equal(SD_CHAPTERS.length, 4, 'Salve o Doge deve organizar as 40 fases em 4 capítulos');

  for (let i = 0; i < 40; i++) {
    const lv = getDogeLevel(i + 1);
    assert.equal(lv.id, i + 1, `Fase ${i + 1} deve ter id sequencial`);
    assert.ok(Array.isArray(lv.hintStroke) && lv.hintStroke.length >= 2, `Fase ${lv.id} deve ter hintStroke válido`);

    // 1) Sem barreira, o Doge deve perder antes dos 6s
    const simEmpty = createDogeSim(lv, []);
    for (let step = 0; step < 400 && simEmpty.status === 'running'; step++) {
      stepDogeSim(simEmpty, 1 / 60);
    }
    assert.equal(simEmpty.status, 'lost', `Fase ${lv.id} (${lv.title}) não pode vencer sem desenho`);

    // 2) Com a linha de referência, o Doge deve sobreviver os 6s dentro do limite de tinta
    const built = buildDogeStroke(lv.hintStroke, lv);
    assert.ok(built.length >= 12 && built.length <= lv.inkMax, `hintStroke da Fase ${lv.id} deve caber em inkMax`);
    const simWin = createDogeSim(lv, lv.hintStroke);
    for (let step = 0; step < 400 && simWin.status === 'running'; step++) {
      stepDogeSim(simWin, 1 / 60);
    }
    assert.equal(simWin.status, 'won', `Fase ${lv.id} (${lv.title}) deve vencer com o hintStroke (falhou: ${simWin.failReason})`);
    assert.ok(simWin.stars >= 1 && simWin.stars <= 3, `Fase ${lv.id} deve pontuar entre 1 e 3 estrelas`);
  }

  // Abelhas devem flanquear barreiras abertas (tampa horizontal rasa sem fechar os lados falha!)
  for (const id of [1, 2, 3, 6, 9]) {
    const lv = getDogeLevel(id);
    const d = lv.doges[0];
    const simFlank = createDogeSim(lv, [[d.x - 32, d.y - 42], [d.x + 32, d.y - 42]]);
    for (let step = 0; step < 400 && simFlank.status === 'running'; step++) stepDogeSim(simFlank, 1 / 60);
    assert.equal(simFlank.status, 'lost', `Abelhas devem contornar tampa aberta na Fase ${id}`);
  }

  // Bola com espinhos em fase de pedra deve causar dano quando desprotegido
  const lv23NoBees = { ...getDogeLevel(23), hives: [] };
  const simBoulder = createDogeSim(lv23NoBees, []);
  for (let step = 0; step < 400 && simBoulder.status === 'running'; step++) stepDogeSim(simBoulder, 1 / 60);
  assert.equal(simBoulder.status, 'lost');
  assert.equal(simBoulder.failReason, 'crushed', 'Bola de espinhos deve esmagar o Doge se desprotegido');

  // Limite máximo de tinta deve truncar traço longo
  const lv1 = getDogeLevel(1);
  const longStroke = [];
  for (let k = 0; k < 25; k++) longStroke.push([40 + (k % 2) * 260, 120 + k * 8]);
  const trunc = buildDogeStroke(longStroke, lv1);
  assert.ok(trunc.length <= lv1.inkMax + 0.01, 'buildStroke nunca deve ultrapassar inkMax');

  const sdHtml = fs.readFileSync(new URL('../public/salve-o-caramelo/index.html', import.meta.url), 'utf8');
  const sdJs = fs.readFileSync(new URL('../public/salve-o-caramelo/js/main.js', import.meta.url), 'utf8');
  assert.ok(sdHtml.includes('id="modal-root"') && sdHtml.includes('id="sd-ink-fill"'));
  assert.ok(sdJs.includes('function rulesModal()') && sdJs.includes('function mapModal()'));
}

// 19. Mini-jogo Estacionamento (/estacionamento): rota HTTP, 40 fases em 4 capítulos, integridade de vagas/cones/muretas, solução em 0 batidas e limite de 3 batidas
{
  const rPark = await req('/estacionamento');
  assert.equal(rPark.status, 200);
  assert.ok(rPark.body.includes('id="pk-canvas"'), 'Rota /estacionamento deve servir o mini-jogo Estacionamento');

  assert.equal(PK_MAX_CRASHES, 3);
  assert.equal(PK_LEVELS.length, 40, 'Estacionamento deve ter exatamente 40 fases');
  assert.equal(PK_CHAPTERS.length, 4, 'Estacionamento deve organizar as 40 fases em 4 capítulos');

  assert.equal(computeParkingStars(0), 3);
  assert.equal(computeParkingStars(1), 2);
  assert.equal(computeParkingStars(2), 1);
  assert.equal(computeParkingStars(3), 0);

  for (let i = 0; i < 40; i++) {
    const lv = getParkingLevel(i + 1);
    assert.equal(lv.id, i + 1);
    assert.ok(lv.size >= 5 && lv.size <= 7);
    assert.ok(lv.vehicles.length >= 4);

    // Zero sobreposições e todas as células dentro do pátio
    const occ = new Set();
    for (const cn of lv.cones || []) {
      assert.ok(cn.r >= 0 && cn.r < lv.size && cn.c >= 0 && cn.c < lv.size);
      const k = `${cn.r},${cn.c}`;
      assert.equal(occ.has(k), false, `Cone duplicado em L${lv.id}`);
      occ.add(k);
    }
    for (const v of lv.vehicles) {
      assert.ok(['moto', 'car', 'truck'].includes(v.type));
      assert.ok(v.dir === 'H' || v.dir === 'V');
      for (const cell of parkingVehicleCells(v)) {
        assert.ok(cell.r >= 0 && cell.r < lv.size && cell.c >= 0 && cell.c < lv.size, `Veículo fora da grade em L${lv.id}`);
        const k = `${cell.r},${cell.c}`;
        assert.equal(occ.has(k), false, `Sobreposição em L${lv.id}`);
        occ.add(k);
      }
    }

    // Deve existir sequência completa que tira todos os veículos sem nenhuma batida
    const sol = solveParking(lv);
    assert.equal(sol.solved, true, `Fase ${lv.id} (${lv.title}) deve ter solução em 0 batidas`);
    assert.equal(sol.order.length, lv.vehicles.length);

    // Reproduz passo a passo e confirma 0 batidas até zerar o pátio
    let rem = lv.vehicles.map((v) => ({ ...v }));
    for (const step of sol.order) {
      const check = evaluateParkingExit(rem, step.id, step.sign, lv);
      assert.equal(check.ok, true, `Passo ${step.id} na Fase ${lv.id} falhou ao reproduzir solução`);
      rem = rem.filter((x) => x.id !== step.id);
    }
    assert.equal(rem.length, 0);

    // Dica da posição inicial deve apontar um movimento válido
    const hint = findParkingHint(lv.vehicles, lv);
    assert.ok(hint && evaluateParkingExit(lv.vehicles, hint.id, hint.sign, lv).ok);
  }

  // Valida detecção de batida em outro veículo, cone e mureta de borda
  const testLv = {
    size: 5,
    cones: [{ r: 2, c: 4 }],
    blockedEdges: { top: [0], bottom: [], left: [], right: [] },
    vehicles: [
      { id: 'a', type: 'car', len: 2, dir: 'H', r: 2, c: 0, front: 1, color: 'red' },
      { id: 'b', type: 'car', len: 2, dir: 'V', r: 1, c: 2, front: 1, color: 'blue' },
      { id: 'c', type: 'moto', len: 1, dir: 'V', r: 1, c: 0, front: -1, color: 'yellow' },
    ],
  };
  const hitVeh = evaluateParkingExit(testLv.vehicles, 'a', 1, testLv);
  assert.equal(hitVeh.ok, false);
  assert.equal(hitVeh.reason, 'vehicle');

  const hitCone = evaluateParkingExit(testLv.vehicles.filter((v) => v.id !== 'b'), 'a', 1, testLv);
  assert.equal(hitCone.ok, false);
  assert.equal(hitCone.reason, 'cone');

  const hitCurb = evaluateParkingExit(testLv.vehicles, 'c', -1, testLv);
  assert.equal(hitCurb.ok, false);
  assert.equal(hitCurb.reason, 'curb');

  const pkHtml = fs.readFileSync(new URL('../public/estacionamento/index.html', import.meta.url), 'utf8');
  const pkJs = fs.readFileSync(new URL('../public/estacionamento/js/main.js', import.meta.url), 'utf8');
  assert.ok(pkHtml.includes('id="modal-root"') && pkHtml.includes('id="pk-crashes-txt"'));
  assert.ok(pkJs.includes('function rulesModal()') && pkJs.includes('function mapModal()'));
}

// 20) Mini-jogo Tropa da Quermesse: rota HTTP, regras de tema/carga/obstáculos e solvabilidade 3★ em 40/40 fases
{
  const rTropa = await req('/tropa-da-quermesse');
  assert.equal(rTropa.status, 200);
  assert.ok(rTropa.body.includes('id="trp-canvas"'), 'Rota /tropa-da-quermesse deve servir o mini-jogo Tropa da Quermesse');

  assert.equal(TR_LEVELS.length, 40, 'Tropa da Quermesse deve ter exatamente 40 fases');
  assert.equal(TR_CHAPTERS.length, 4, 'Tropa da Quermesse deve organizar as 40 fases em 4 capítulos');

  assert.equal(tropaStyleMult({ targetStyle: 'gala', avoidStyle: 'rock' }, 'gala'), 1.6);
  assert.equal(tropaStyleMult({ targetStyle: 'gala', avoidStyle: 'rock' }, 'rock'), 0.72);
  assert.equal(tropaStyleMult({ targetStyle: 'gala', avoidStyle: 'rock' }, 'basico'), 1.0);

  let straightWins = 0;
  for (let i = 0; i < 40; i++) {
    const lv = getTropaLevel(i + 1);
    assert.equal(lv.id, i + 1);
    assert.ok(TR_STYLES[lv.targetStyle], `Tema inválido na Fase ${lv.id}`);
    assert.ok(lv.length / lv.speed >= 60, `Fase ${lv.id} deve durar >= 60s (atual ${(lv.length / lv.speed).toFixed(1)}s)`);
    assert.ok(lv.events.length >= 25, `Fase ${lv.id} deve ter múltiplos eventos na pista`);
    assert.ok(lv.star3Power > lv.star2Power && lv.star2Power > lv.rivalPower);

    const best = solveTropaLevel(lv, 10);
    assert.equal(best.status, 'won', `Fase ${lv.id} (${lv.title}) deve ser vencível pelo solucionador`);
    assert.equal(best.stars, 3, `Fase ${lv.id} (${lv.title}) deve alcançar 3 estrelas (alcancou ${best.power}/${lv.star3Power})`);

    const s0 = simTropaFixed(lv, () => 0);
    if (s0.status === 'won') straightWins++;
  }
  assert.equal(straightWins, 0, 'Nenhuma fase deve ser vencida indo reto sem desviar');
  assert.ok(getTropaLevel(40).rivalPower >= 10_000_000, 'Fase 40 deve escalar para milhões');

  // Testa carregamento de portal charge, destruição de baú/horda a tiros e penalidade de lama
  const dummyLv = {
    id: 99,
    length: 62,
    speed: 12,
    startCount: 24,
    targetStyle: 'junino',
    rivalPower: 20,
    star2Power: 30,
    star3Power: 40,
    events: [
      { type: 'gatePair', z: 22, left: { kind: 'charge', startVal: -6, maxVal: 16, rate: 16 }, right: { kind: 'math', op: '+', val: 1 } },
      { type: 'crate', z: 46, x: -0.45, hw: 0.3, hp: 10, maxHp: 10, rewardOp: '×', rewardVal: 2 },
    ],
  };
  const run = createTropaRun(dummyLv);
  for (let s = 0; s < 200 && run.status === 'running'; s++) stepTropaRun(run, 1 / 30, -0.45);
  assert.equal(run.status, 'won');
  assert.ok(run.count >= 60, `Portal charge + baú ×2 devem multiplicar a tropa (count=${run.count})`);
  run.muddy = true;
  const dirtyPow = evalTropaPower(run).totalPower;
  run.muddy = false;
  const cleanPow = evalTropaPower(run).totalPower;
  assert.ok(cleanPow > dirtyPow);

  const trHtml = fs.readFileSync(new URL('../public/tropa-da-quermesse/index.html', import.meta.url), 'utf8');
  const trJs = fs.readFileSync(new URL('../public/tropa-da-quermesse/js/main.js', import.meta.url), 'utf8');
  assert.ok(trHtml.includes('id="modal-root"') && trHtml.includes('id="trp-overlay"'));
  assert.ok(trJs.includes('function rulesModal()') && trJs.includes('function mapModal()'));
}

// 21) Mini-jogo Arsenal da Quermesse (/arsenal-da-quermesse): rota HTTP, tamanhos exatos, rotação L, fusões, sinergias e 40/40 fases vencíveis
{
  const rArs = await req('/arsenal-da-quermesse');
  assert.equal(rArs.status, 200);
  assert.ok(rArs.body.includes('id="ars-canvas"'), 'Rota /arsenal-da-quermesse deve servir a arena do mini-jogo');
  assert.ok(rArs.body.includes('id="ars-grid"'), 'Rota /arsenal-da-quermesse deve servir a grade tática');

  const homeRes = await req('/');
  assert.ok(homeRes.body.includes('href="/arsenal-da-quermesse"'), 'Portal deve listar a Barraca do Arsenal da Quermesse');

  assert.equal(AR_LEVELS.length, 40, 'Arsenal deve ter exatamente 40 fases');
  assert.equal(AR_CHAPTERS.length, 4, 'Arsenal deve organizar as 40 fases em 4 capítulos');

  // Tamanhos das peças solicitadas pelo usuário
  assert.equal(arsenalPieceCells('witch', 0).length, 2, 'Bruxa deve ocupar 2 espaços');
  assert.equal(arsenalPieceCells('shield', 0).length, 1, 'Escudo deve ocupar 1 espaço');
  assert.equal(arsenalPieceCells('sword', 0).length, 3, 'Espada deve ocupar 3 espaços');
  assert.equal(arsenalPieceCells('voodoo', 0).length, 2, 'Boneco de Voodoo deve ocupar 2 espaços');
  assert.equal(arsenalPieceCells('tome', 0).length, 2, 'Tomo de Feitiços deve ocupar 2 espaços');
  assert.equal(arsenalPieceCells('axe', 0).length, 3, 'Machado Rúnico em L deve ocupar 3 espaços');

  // Testa rotação L, encaixe no canto aberto do L, sinergia do Tomo e fusão até Nv.5
  const testRun = createArsenalRun(4); // box_4x4 (cols 1..4, rows 1..4)
  testRun.gold = 200;
  testRun.shop[0] = { slot: 0, pieceId: 'axe', tier: 1, cost: 7, locked: false };
  const pAxe = buyArsenalToGrid(testRun, 0, 1, 1, 0); // ocupa (1,1),(2,1),(1,2); deixa (2,2) livre!
  assert.equal(pAxe.ok, true);
  assert.equal(canPlaceArsenal(testRun.grid, 'shield', 2, 2, 0), true, 'Canto vazio do L deve permanecer livre para peça 1x1');
  assert.equal(rotateArsenalPiece(testRun, pAxe.piece.uid).ok, true, 'Machado em L deve rotacionar');

  testRun.shop[0] = { slot: 0, pieceId: 'tome', tier: 1, cost: 6, locked: false };
  testRun.shop[1] = { slot: 1, pieceId: 'witch', tier: 1, cost: 5, locked: false };
  testRun.shop[2] = { slot: 2, pieceId: 'witch', tier: 1, cost: 5, locked: false };
  const pTome = buyArsenalToGrid(testRun, 0, 3, 1, 0); // (3,1)-(4,1)
  const pWitch = buyArsenalToGrid(testRun, 1, 3, 2, 0); // (3,2)-(4,2) adjacente ao Tomo!
  assert.equal(pTome.ok && pWitch.ok, true);

  const syn = computeArsenalSynergies(testRun.grid);
  assert.ok(syn.byUid.get(pWitch.piece.uid).dmgMult > 1.15, 'Tomo adjacente deve aumentar o poder da Bruxa');

  const pMerge = buyArsenalToGrid(testRun, 2, 3, 2, 0); // compra sobre a Bruxa existente -> funde!
  assert.equal(pMerge.ok && pMerge.merged, true, 'Comprar/soltar peça igual sobre existente deve somar (fundir)');
  assert.equal(pWitch.piece.tier, 2);

  // Testa expansão de célula adjacente (4x4 -> rumo a 6x6)
  testRun.freeExpands = 1;
  assert.equal(expandArsenalCell(testRun, 0, 1).ok, true, 'Deve abrir célula adjacente grátis');
  assert.equal(expandArsenalCell(testRun, 5, 5).ok, false, 'Não pode abrir célula distante não adjacente');

  // Testa evolução por fusão em cadeia na grade até Nv.5
  pWitch.piece.tier = 4;
  testRun.shop[0] = { slot: 0, pieceId: 'witch', tier: 4, cost: 1, locked: false };
  const pMyth = buyArsenalToGrid(testRun, 0, 3, 2, 0);
  assert.equal(pMyth.ok && pMyth.piece.tier, AR_MAX_TIER);

  // Verifica que mover peça igual na grade também funde
  testRun.shop[0] = { slot: 0, pieceId: 'shield', tier: 1, cost: 3, locked: false };
  testRun.shop[1] = { slot: 1, pieceId: 'shield', tier: 1, cost: 3, locked: false };
  const sA = buyArsenalToGrid(testRun, 0, 1, 3, 0);
  const sB = buyArsenalToGrid(testRun, 1, 2, 3, 0);
  const movedMerge = moveArsenalPiece(testRun, sB.piece.uid, 1, 3, 0);
  assert.equal(movedMerge.ok && movedMerge.merged && sA.piece.tier === 2, true);

  // Verifica 40/40 fases: vazio perde todas e bot inteligente vence 40/40
  for (let id = 1; id <= 40; id++) {
    const lv = getArsenalLevel(id);
    assert.equal(lv.id, id);
    assert.ok(lv.waves.length >= 3);
    assert.equal(playArsenalEmpty(id).phase, 'lost', `Fase ${id} não pode vencer sem peças`);
    let res = playArsenalSmart(id, 1000 + id * 77);
    if (res.phase !== 'won') res = playArsenalSmart(id, 2000 + id * 77 + 13);
    assert.equal(res.phase, 'won', `Fase ${id} (${lv.title}) deve ser vencida pelo bot inteligente`);
  }

  const est = estimateArsenalDps(testRun.grid);
  assert.ok(est.dps > 0 && est.linkCount >= 1, 'estimateGridDps deve somar DPS e vínculos de sinergia');

  for (const icoName of ['coin', 'wall', 'shield', 'dps', 'wave']) {
    assert.ok(arsenalHudIco(icoName).includes('<svg'), `Ícone HUD ${icoName} válido`);
  }

  for (const id of Object.keys(AR_PIECES)) {
    assert.ok(arsenalPieceSvg(id, 1, 0).includes('<svg'), `Arte SVG válida para peça ${id}`);
    assert.ok(arsenalShapeMiniSvg(id, 1).includes('<svg'), `Mini-forma SVG válida para peça ${id}`);
  }

  const arHtml = fs.readFileSync(new URL('../public/arsenal-da-quermesse/index.html', import.meta.url), 'utf8');
  const arJs = fs.readFileSync(new URL('../public/arsenal-da-quermesse/js/main.js', import.meta.url), 'utf8');
  assert.ok(arHtml.includes('id="modal-root"') && arHtml.includes('id="ars-overlay"'));
  assert.ok(arJs.includes('function rulesModal()') && arJs.includes('function mapModal()'));
}

for (const client of wss.clients) client.terminate();
await new Promise((r) => server.close(r));
console.log('OK: todos os testes de segurança e sincronização passaram!');

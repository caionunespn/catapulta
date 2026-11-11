// Suíte automatizada de auditoria de segurança (HTTP, WebSocket, Auth, Fuzzing de Ações).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { WebSocket } from 'ws';
import { act, createGame, view } from '../server/game.js';

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
    const r = http.request(`${baseUrl}${path}`, opts, (res) => {
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
    ws.once('open', () => resolve({ ws, msgs }));
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
  assert.equal(okRes.headers['x-content-type-options'], 'nosniff');
  assert.equal(okRes.headers['x-frame-options'], 'DENY');
  assert.ok(okRes.headers['content-security-policy']?.includes("default-src 'self'"));
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
  const mainSrc = fs.readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8');
  const fbSrc = fs.readFileSync(new URL('../public/js/net-firebase.js', import.meta.url), 'utf8');

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
  const boardSrc = fs.readFileSync(new URL('../public/js/board.js', import.meta.url), 'utf8');
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
  const mainJs = fs.readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8');
  assert.ok(!mainJs.includes('avatar(4)'), 'Aba Sobre não deve usar o avatar feminino avatar(4) no quadro do criador');
  assert.ok(mainJs.includes('porque o Iuri duvidou que eu era muito poderoso'), 'Aba Sobre deve manter a história do Iuri');
  assert.ok(mainJs.includes('rules-steps') && mainJs.includes('rules-builds'), 'Aba Como joga deve estar organizada em seções visuais claras');

  ws.close();
}

for (const client of wss.clients) client.terminate();
await new Promise((r) => server.close(r));
console.log('OK: todos os testes de segurança e sincronização passaram!');

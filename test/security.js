// Suíte automatizada de auditoria de segurança (HTTP, WebSocket, Auth, Fuzzing de Ações).
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';
import { act, createGame } from '../server/game.js';

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

for (const client of wss.clients) client.terminate();
await new Promise((r) => server.close(r));
console.log('OK: todos os testes de segurança passaram!');

// Servidor: arquivos estáticos + salas via WebSocket.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { shuffle } from './board.js';
import { act, createGame, drainEvents, filterEvents, pendingActors, view } from './game.js';
import { botAction } from './bot.js';

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const rawPort = arg('port') ?? process.env.PORT;
const PORT = rawPort !== undefined && rawPort !== '' ? Number(rawPort) : 3000;
const BOT_SPEED = Math.max(0.1, Number(arg('bot-speed')) || 1); // >1 acelera os bots (testes)
const rawKey = arg('key') ?? process.env.ACCESS_KEY ?? '';
const ACCESS_KEY = rawKey === 'auto' ? randomBytes(9).toString('base64url') : String(rawKey).trim();
const TRUST_PROXY = arg('trust-proxy') === '1' || process.env.TRUST_PROXY === '1';
const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' https://www.gstatic.com https://*.firebaseio.com https://*.firebasedatabase.app https://*.europe-west1.firebasedatabase.app; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' ws: wss: https://www.gstatic.com https://*.googleapis.com https://*.firebaseio.com https://*.firebasedatabase.app https://*.europe-west1.firebasedatabase.app wss://*.firebaseio.com wss://*.firebasedatabase.app wss://*.europe-west1.firebasedatabase.app; frame-src https://*.firebaseapp.com https://*.firebasedatabase.app https://*.europe-west1.firebasedatabase.app; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};

const MAX_SEATS = 4;
const MAX_ROOMS = 60;
const MAX_CONN_PER_IP = 16;
const MAX_AUTH_FAILS = 10;
const AUTH_WINDOW_MS = 60_000;
const ROOM_IDLE_TTL_MS = 2 * 60 * 60 * 1000;
const COLORS = 6;
const BOT_NAMES = ['Zé Pedrada', 'Dona Abóbora', 'Tonho Queijo', 'Cristalina', 'Seu Barranco', 'Mari Trilha'];
const EMOTES = ['😂', '😭', '😡', '😎', '🙏', '🎉', '👀', '🧀'];

// ---------- segurança e limites por IP ----------

const ipConns = new Map();
const ipFails = new Map();

function clientIp(req) {
  const direct = req.socket?.remoteAddress || 'unknown';
  const isLocal = direct === '127.0.0.1' || direct === '::1' || direct === '::ffff:127.0.0.1';
  if (TRUST_PROXY || isLocal) {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && cf.trim()) return cf.trim().slice(0, 64);
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim().slice(0, 64);
  }
  return direct;
}

function isRateLimitedAuth(ip) {
  const rec = ipFails.get(ip);
  if (!rec) return false;
  if (Date.now() > rec.resetAt) {
    ipFails.delete(ip);
    return false;
  }
  return rec.count >= MAX_AUTH_FAILS;
}

function recordAuthFail(ip) {
  const now = Date.now();
  const rec = ipFails.get(ip);
  if (!rec || now > rec.resetAt) ipFails.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
  else rec.count++;
}

function checkAccessKey(candidate) {
  if (!ACCESS_KEY) return true;
  if (typeof candidate !== 'string' || !candidate) return false;
  const a = Buffer.from(ACCESS_KEY);
  const b = Buffer.from(candidate);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validOrigin(origin, req) {
  if (!origin) return true;
  try {
    const u = new URL(origin);
    return u.host === req.headers.host;
  } catch {
    return false;
  }
}

// ---------- HTTP ----------

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' }).end('Método não permitido');
    return;
  }
  const rawPath = (req.url || '/').split('?')[0];
  let rel;
  try {
    rel = decodeURIComponent(rawPath);
  } catch {
    res.writeHead(400, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' }).end('Requisição inválida');
    return;
  }
  if (rel.includes('\0')) {
    res.writeHead(400, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' }).end('Requisição inválida');
    return;
  }
  if (rel === '/') rel = '/index.html';
  const file = path.resolve(PUBLIC, '.' + rel);
  const ext = path.extname(file);
  if (!file.startsWith(PUBLIC + path.sep) || !Object.hasOwn(MIME, ext)) {
    res.writeHead(403, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' }).end('Acesso negado');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
      return;
    }
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': MIME[ext],
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});

server.headersTimeout = 10_000;
server.requestTimeout = 10_000;
server.keepAliveTimeout = 5_000;

// ---------- salas ----------

const rooms = new Map();

function newCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let attempt = 0; attempt < 500; attempt++) {
    let c = '';
    for (let i = 0; i < 4; i++) c += abc[randomInt(0, abc.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}

const cleanName = (n) => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 14) || 'Jogador';
const send = (ws, msg) => ws && ws.readyState === 1 && ws.send(JSON.stringify(msg));
const freeColor = (room) => {
  for (let c = 0; c < COLORS; c++) if (!room.seats.some((s) => s.color === c)) return c;
  return 0;
};
const humans = (room) => room.seats.filter((s) => !s.bot);

function sendRoom(room) {
  for (const seat of room.seats) {
    if (!seat.ws) continue;
    send(seat.ws, {
      t: 'room',
      code: room.code,
      you: room.seats.indexOf(seat),
      host: room.host === seat,
      inGame: !!room.game,
      seats: room.seats.map((s) => ({
        name: s.name,
        color: s.color,
        bot: s.bot,
        connected: s.connected,
        host: room.host === s,
      })),
    });
  }
}

function sendGame(room, events = [], full = false) {
  const g = room.game;
  if (!g) return;
  room.order.forEach((seat, i) => {
    if (!seat.ws) return;
    const msg = { t: 'game', s: view(g, i), ev: filterEvents(events, i) };
    if (full || !seat.hasBoard) {
      msg.board = g.board;
      seat.hasBoard = true;
    }
    send(seat.ws, msg);
  });
}

function flush(room) {
  sendGame(room, drainEvents(room.game));
  schedule(room);
}

// Bots (e humanos desconectados há um tempo) jogam por um temporizador por sala.
function schedule(room) {
  clearTimeout(room.timer);
  room.timer = null;
  const g = room.game;
  if (!g || g.phase === 'ended') return;
  if (!humans(room).some((s) => s.connected)) return; // ninguém assistindo: pausa
  let pick = null;
  for (const i of pendingActors(g)) {
    const seat = room.order[i];
    if (!seat.bot && seat.connected) continue;
    const a = botAction(g, i);
    if (!a) continue;
    let delay;
    if (seat.bot) delay = a.type === 'respondTrade' ? 700 : a.type === 'endTurn' ? 600 : 900 + Math.random() * 600;
    else delay = Math.max(1200, 15000 - (Date.now() - seat.goneAt));
    if (!pick || delay < pick.delay) pick = { i, delay };
  }
  if (!pick) return;
  const wait = room.order[pick.i].bot ? pick.delay / BOT_SPEED : pick.delay;
  room.timer = setTimeout(() => {
    room.timer = null;
    if (room.game !== g || g.phase === 'ended') return;
    const seat = room.order[pick.i];
    if (seat.bot || !seat.connected) {
      const a = botAction(g, pick.i);
      if (a) {
        const err = act(g, pick.i, a);
        if (err) {
          console.warn(`[${room.code}] bot ${pick.i} falhou:`, a, err);
          if (g.turn === pick.i && g.sub === 'action') act(g, pick.i, { type: 'endTurn' });
        }
      }
    }
    flush(room);
  }, wait);
}

function startGame(room) {
  room.order = shuffle([...room.seats]);
  room.order.forEach((s) => (s.hasBoard = false));
  room.game = createGame(room.order.map((s) => ({ name: s.name, color: s.color, avatar: s.color, bot: s.bot })));
  room.order.forEach((s, i) => (room.game.players[i].connected = s.bot || s.connected));
  sendRoom(room);
  flush(room);
}

function dropRoom(room) {
  clearTimeout(room.timer);
  rooms.delete(room.code);
}

function leave(ws) {
  const { room, seat } = ws;
  if (!room || !seat || seat.ws !== ws) return;
  ws.room = ws.seat = null;
  seat.ws = null;
  seat.connected = false;
  seat.goneAt = Date.now();
  if (!room.game) {
    room.seats.splice(room.seats.indexOf(seat), 1);
    if (room.host === seat) room.host = humans(room)[0] || null;
    if (!room.host) return dropRoom(room);
    sendRoom(room);
    return;
  }
  const i = room.order.indexOf(seat);
  if (i >= 0) room.game.players[i].connected = false;
  if (room.host === seat) room.host = humans(room).find((s) => s.connected) || seat;
  if (!humans(room).some((s) => s.connected)) {
    clearTimeout(room.timer);
    room.emptyAt = Date.now();
    return;
  }
  sendRoom(room);
  sendGame(room);
  schedule(room);
}

// ---------- mensagens ----------

const handlers = {
  hello(ws, m) {
    if (ws.room) return;
    if (isRateLimitedAuth(ws.ip)) {
      return send(ws, { t: 'err', m: 'Muitas tentativas. Aguarde 1 minuto.', fatal: true });
    }
    if (!checkAccessKey(m.key)) {
      recordAuthFail(ws.ip);
      return send(ws, { t: 'err', m: 'Chave de convite inválida ou ausente', needKey: true, fatal: true });
    }
    const name = cleanName(m.name);
    const clientToken = typeof m.token === 'string' && m.token.length >= 8 && m.token.length <= 64 ? m.token : null;
    let room;
    let seat;
    if (m.code) {
      const code = String(m.code).toUpperCase().trim();
      room = rooms.get(code);
      if (!room) {
        recordAuthFail(ws.ip);
        return send(ws, { t: 'err', m: 'Sala não encontrada', fatal: true });
      }
      seat = clientToken ? room.seats.find((s) => !s.bot && s.token === clientToken) : null;
      if (seat) {
        if (seat.ws && seat.ws !== ws) {
          const old = seat.ws;
          old.room = old.seat = null;
          send(old, { t: 'err', m: 'Você entrou por outra aba', fatal: true });
          old.close();
        }
        if (!room.game) seat.name = name;
      } else if (room.game) {
        return send(ws, { t: 'err', m: 'Essa partida já começou', fatal: true });
      } else if (room.seats.length >= MAX_SEATS) {
        return send(ws, { t: 'err', m: 'Sala cheia', fatal: true });
      }
    } else {
      if (rooms.size >= MAX_ROOMS) {
        return send(ws, { t: 'err', m: 'Servidor cheio no momento', fatal: true });
      }
      const code = newCode();
      if (!code) return send(ws, { t: 'err', m: 'Não foi possível criar sala', fatal: true });
      room = { code, seats: [], host: null, game: null, order: [], timer: null, emptyAt: 0, lastActiveAt: Date.now() };
      rooms.set(room.code, room);
    }
    if (!seat) {
      seat = {
        token: randomUUID(),
        name,
        color: freeColor(room),
        bot: false,
        ws: null,
        connected: false,
        hasBoard: false,
        goneAt: 0,
      };
      room.seats.push(seat);
      if (!room.host) room.host = seat;
    }
    clearTimeout(ws.authTimer);
    seat.ws = ws;
    seat.connected = true;
    seat.hasBoard = false;
    room.emptyAt = 0;
    room.lastActiveAt = Date.now();
    ws.room = room;
    ws.seat = seat;
    send(ws, { t: 'hello', token: seat.token, code: room.code });
    if (room.game) {
      const i = room.order.indexOf(seat);
      if (i >= 0) room.game.players[i].connected = true;
    }
    sendRoom(room);
    if (room.game) {
      sendGame(room);
      schedule(room);
    }
  },

  color(ws, m) {
    const { room, seat } = ws;
    if (!room || room.game) return;
    const c = Number(m.color);
    if (!Number.isInteger(c) || c < 0 || c >= COLORS) return;
    if (room.seats.some((s) => s !== seat && s.color === c)) return;
    seat.color = c;
    room.lastActiveAt = Date.now();
    sendRoom(room);
  },

  addBot(ws) {
    const { room, seat } = ws;
    if (!room || room.game || room.host !== seat || room.seats.length >= MAX_SEATS) return;
    const used = room.seats.map((s) => s.name);
    const name = shuffle(BOT_NAMES.filter((n) => !used.includes(n)))[0];
    room.seats.push({ token: randomUUID(), name, color: freeColor(room), bot: true, ws: null, connected: true });
    room.lastActiveAt = Date.now();
    sendRoom(room);
  },

  kick(ws, m) {
    const { room, seat } = ws;
    if (!room || room.game || room.host !== seat) return;
    if (!Number.isInteger(m.i) || m.i < 0 || m.i >= room.seats.length) return;
    const target = room.seats[m.i];
    if (!target || target === seat) return;
    room.seats.splice(m.i, 1);
    if (target.ws) {
      const old = target.ws;
      old.room = old.seat = null;
      send(old, { t: 'err', m: 'Você foi removido da sala', fatal: true });
      old.close();
    }
    room.lastActiveAt = Date.now();
    sendRoom(room);
  },

  start(ws) {
    const { room, seat } = ws;
    if (!room || room.game || room.host !== seat) return;
    if (room.seats.length < 2) return send(ws, { t: 'err', m: 'Precisa de pelo menos 2 jogadores (adicione um bot!)' });
    room.lastActiveAt = Date.now();
    startGame(room);
  },

  act(ws, m) {
    const { room, seat } = ws;
    if (!room || !room.game) return;
    const i = room.order.indexOf(seat);
    if (i < 0) return;
    if (m.a && m.a.type === 'offerTrade') {
      const now = Date.now();
      if (now - (seat.lastOffer || 0) < 1200) return send(ws, { t: 'err', m: 'Aguarde um instante antes de fazer outra oferta' });
      seat.lastOffer = now;
    }
    const err = act(room.game, i, m.a);
    if (err) return send(ws, { t: 'err', m: err });
    room.lastActiveAt = Date.now();
    flush(room);
  },

  emote(ws, m) {
    const { room, seat } = ws;
    if (!room || !EMOTES.includes(m.e)) return;
    const now = Date.now();
    if (now - (seat.lastEmote || 0) < 600) return;
    seat.lastEmote = now;
    room.lastActiveAt = now;
    const p = room.game ? room.order.indexOf(seat) : room.seats.indexOf(seat);
    for (const s of room.seats) send(s.ws, { t: 'emote', p, e: m.e });
  },

  again(ws) {
    const { room, seat } = ws;
    if (!room || !room.game || room.host !== seat || room.game.phase !== 'ended') return;
    clearTimeout(room.timer);
    room.game = null;
    room.order = [];
    room.seats = room.seats.filter((s) => s.bot || s.connected);
    room.lastActiveAt = Date.now();
    sendRoom(room);
  },

  leave(ws) {
    leave(ws);
  },
};

const wss = new WebSocketServer({
  server,
  maxPayload: 16 * 1024,
  verifyClient: ({ origin, req }, cb) => {
    if (!validOrigin(origin, req)) return cb(false, 403, 'Origem inválida');
    const ip = clientIp(req);
    if ((ipConns.get(ip) || 0) >= MAX_CONN_PER_IP) return cb(false, 429, 'Muitas conexões deste IP');
    cb(true);
  },
});

wss.on('connection', (ws, req) => {
  const ip = clientIp(req);
  ws.ip = ip;
  ipConns.set(ip, (ipConns.get(ip) || 0) + 1);
  ws.alive = true;
  ws.tokens = 25;
  ws.lastMsg = Date.now();
  ws.authTimer = setTimeout(() => {
    if (!ws.room) ws.terminate();
  }, 15_000);

  ws.on('pong', () => (ws.alive = true));
  ws.on('message', (raw) => {
    const now = Date.now();
    ws.tokens = Math.min(25, ws.tokens + ((now - ws.lastMsg) / 1000) * 10);
    ws.lastMsg = now;
    if (ws.tokens < 1) {
      send(ws, { t: 'err', m: 'Muitas mensagens seguidas', fatal: true });
      ws.close(1008, 'Rate limit');
      return;
    }
    ws.tokens -= 1;

    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (!m || typeof m.t !== 'string' || !Object.hasOwn(handlers, m.t)) return;
    try {
      handlers[m.t](ws, m);
    } catch (e) {
      console.error('erro ao tratar mensagem', m.t, e);
      send(ws, { t: 'err', m: 'Erro interno' });
    }
  });
  ws.on('close', () => {
    clearTimeout(ws.authTimer);
    const cur = (ipConns.get(ip) || 1) - 1;
    if (cur <= 0) ipConns.delete(ip);
    else ipConns.set(ip, cur);
    leave(ws);
  });
  ws.on('error', () => {});
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
  const now = Date.now();
  for (const [ip, rec] of ipFails) {
    if (now > rec.resetAt) ipFails.delete(ip);
  }
  for (const room of rooms.values()) {
    if (room.emptyAt && now - room.emptyAt > 10 * 60 * 1000) dropRoom(room);
    else if (room.lastActiveAt && now - room.lastActiveAt > ROOM_IDLE_TTL_MS) dropRoom(room);
  }
}, 20000);
heartbeat.unref();

server.listen(PORT, () => {
  const actualPort = server.address()?.port ?? PORT;
  const qs = ACCESS_KEY ? `?chave=${encodeURIComponent(ACCESS_KEY)}` : '';
  console.log(`\n  CATAPULTA rodando!`);
  console.log(`  Local:   http://localhost:${actualPort}${qs}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) console.log(`  Na rede: http://${ni.address}:${actualPort}${qs}`);
    }
  }
  if (ACCESS_KEY) console.log(`  Chave de convite ativa: ${ACCESS_KEY}`);
  console.log('');
});

export { server, wss, rooms };

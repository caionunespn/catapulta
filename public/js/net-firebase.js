// Transporte Firebase Realtime Database (Anfitrião Autoritativo + Visões Isoladas por UID).
import { shuffle } from './engine/board.js';
import { act, createGame, drainEvents, filterEvents, pendingActors, view } from './engine/game.js';
import { botAction } from './engine/bot.js';
import { FIREBASE_CONFIG } from './firebase-config.js';

const FB_CDN = 'https://www.gstatic.com/firebasejs/11.0.1';
const MAX_SEATS = 4;
const COLORS = 6;
const BOT_NAMES = ['Zé Pedrada', 'Dona Abóbora', 'Tonho Queijo', 'Cristalina', 'Seu Barranco', 'Mari Trilha'];
const EMOTES = ['😂', '😭', '😡', '😎', '🙏', '🎉', '👀', '🧀'];

// O Realtime Database descarta null, objetos e listas vazios e transforma objetos de chave numérica em listas.
// Por isso todo estado de jogo trafega como texto JSON: chega do outro lado exatamente como saiu.
const pack = (v) => JSON.stringify(v);
const unpack = (t) => {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};
// Sala sem chave usa um marcador fixo (evita depender de texto vazio nas regras).
const NO_KEY = '-';

const cleanName = (n) => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 14) || 'Jogador';
const cleanBotLevel = (l) => (['easy', 'medium', 'hard'].includes(l) ? l : 'medium');

function randomCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const buf = new Uint32Array(4);
  crypto.getRandomValues(buf);
  let c = '';
  for (let i = 0; i < 4; i++) c += abc[buf[i] % abc.length];
  return c;
}

let fbPromise = null;
function initFirebase() {
  if (fbPromise) return fbPromise;
  fbPromise = (async () => {
    const [{ initializeApp }, authMod, dbMod] = await Promise.all([
      import(`${FB_CDN}/firebase-app.js`),
      import(`${FB_CDN}/firebase-auth.js`),
      import(`${FB_CDN}/firebase-database.js`),
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    // initializeAuth sem "popup resolver": o login anônimo não precisa dele, e getAuth() tentaria carregar
    // apis.google.com, que a política de segurança da página bloqueia (erro no console a cada acesso).
    const { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, signInAnonymously } = authMod;
    const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
    const cred = await signInAnonymously(auth);
    const db = dbMod.getDatabase(app);
    return { uid: cred.user.uid, db, dbMod };
  })();
  return fbPromise;
}

export function isFirebaseConfigured() {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.databaseURL);
}

export async function connectFirebase({ name, code, key, botLevel }, onMsg) {
  let ctx;
  try {
    ctx = await initFirebase();
  } catch (e) {
    console.error('Erro ao iniciar Firebase:', e);
    onMsg({ t: 'err', m: 'Erro ao autenticar no Firebase (ative o Login Anônimo no console)', fatal: true });
    return null;
  }

  const { uid, db, dbMod } = ctx;
  const { ref, get, set, update, remove, onValue, onDisconnect, serverTimestamp } = dbMod;
  const secret = String(key || '').trim().slice(0, 64) || NO_KEY;
  let closed = false;
  const unsubs = [];
  let hostTimer = null;

  const cleanup = () => {
    closed = true;
    clearTimeout(hostTimer);
    while (unsubs.length) {
      try {
        unsubs.pop()();
      } catch {}
    }
  };

  let roomCode = code ? String(code).toUpperCase().trim() : null;
  let isHost = false;

  try {
    if (!roomCode) {
      // Criar nova sala como Anfitrião
      for (let attempt = 0; attempt < 20; attempt++) {
        const cand = randomCode();
        const snap = await get(ref(db, `catapulta/rooms/${cand}/hostUid`));
        if (!snap.exists()) {
          roomCode = cand;
          break;
        }
      }
      if (!roomCode) {
        onMsg({ t: 'err', m: 'Não foi possível gerar código da sala', fatal: true });
        return null;
      }
      await set(ref(db, `catapulta/rooms/${roomCode}`), {
        hostUid: uid,
        secret,
        createdAt: Date.now(),
      });
      isHost = true;
    } else {
      const hostSnap = await get(ref(db, `catapulta/rooms/${roomCode}/hostUid`));
      if (!hostSnap.exists()) {
        onMsg({ t: 'err', m: 'Sala não encontrada', fatal: true });
        return null;
      }
      isHost = hostSnap.val() === uid;
    }
  } catch (e) {
    console.error('Erro ao acessar sala:', e);
    onMsg({ t: 'err', m: 'Acesso negado pelas regras do Firebase', fatal: true });
    return null;
  }

  if (closed) return null;

  // ==================== MODO ANFITRIÃO (AUTORITATIVO) ====================
  if (isHost) {
    const room = {
      code: roomCode,
      botLevel: cleanBotLevel(botLevel),
      seats: [],
      order: [],
      game: null,
      seq: 0,
      emoteSeq: 0,
    };

    const freeColor = () => {
      for (let c = 0; c < COLORS; c++) if (!room.seats.some((s) => s.color === c)) return c;
      return 0;
    };

    // Recupera estado caso o Anfitrião tenha recarregado a página (F5)
    try {
      const savedSnap = await get(ref(db, `catapulta/rooms/${roomCode}/hostState`));
      if (savedSnap.exists()) {
        const st = savedSnap.val();
        if (st && Array.isArray(st.seats)) {
          if (st.botLevel) room.botLevel = cleanBotLevel(st.botLevel);
          room.seats = st.seats.map((s) => ({
            ...s,
            lastEmote: 0,
            lastOffer: 0,
          }));
          const savedGame = st.gameJson ? unpack(st.gameJson) : st.game;
          if (savedGame) {
            const g = savedGame;
            g.buildings = g.buildings || {};
            g.roads = g.roads || {};
            g.discard = g.discard || {};
            g.stealFrom = g.stealFrom || [];
            g.events = [];
            g.log = g.log || [];
            g.players.forEach((p) => {
              p.cards = p.cards || [];
              p.ports = p.ports || [];
            });
            if (g.trade) g.trade.responses = g.trade.responses || {};
            g.rnd = Math.random;
            room.game = g;
            room.boardJson = pack(g.board);
            room.order = (st.orderUids || []).map((u) => room.seats.find((s) => s.uid === u)).filter(Boolean);
          }
        }
      }
    } catch {}

    let hostSeat = room.seats.find((s) => s.uid === uid);
    if (!hostSeat) {
      hostSeat = {
        uid,
        name: cleanName(name),
        color: freeColor(),
        bot: false,
        connected: true,
        goneAt: 0,
        lastEmote: 0,
        lastOffer: 0,
      };
      room.seats.push(hostSeat);
    } else {
      hostSeat.connected = true;
      if (!room.game) hostSeat.name = cleanName(name);
    }

    const syncAll = async (events = [], includeBoard = false, includeRoom = true) => {
      if (closed) return;
      const g = room.game;
      const seatsPub = room.seats.map((s) => ({
        uid: s.uid,
        name: s.name,
        color: s.color,
        bot: s.bot,
        botLevel: s.bot ? s.botLevel || room.botLevel || 'medium' : null,
        connected: s.connected,
        host: s.uid === uid,
      }));

      room.seq++;
      const patch = {};
      if (includeRoom) {
        patch.public = {
          code: room.code,
          botLevel: room.botLevel,
          inGame: !!g,
          seats: seatsPub,
          boardJson: g ? room.boardJson : null,
          seq: room.seq,
        };
        if (!g) patch.views = null;
        // Atualiza estado da sala no Anfitrião antes do estado da partida (garante tela visível ao desenhar o tabuleiro)
        onMsg({
          t: 'room',
          code: room.code,
          you: room.seats.indexOf(hostSeat),
          host: true,
          botLevel: room.botLevel,
          inGame: !!g,
          seats: seatsPub.map(({ uid: _, ...rest }) => rest),
        });
      }

      patch.hostState = {
        botLevel: room.botLevel,
        seats: room.seats.map(({ uid: u, name: nm, color, bot, botLevel: bl, connected, goneAt }) => ({
          uid: u,
          name: nm,
          color,
          bot,
          botLevel: bl || null,
          connected,
          goneAt: goneAt || 0,
        })),
        orderUids: room.order.map((s) => s.uid),
        gameJson: g ? pack({ ...g, rnd: null, events: [] }) : null,
      };

      if (g) {
        room.order.forEach((seat, i) => {
          if (seat.bot) return;
          const v = view(g, i);
          const ev = filterEvents(events, i);
          if (seat.uid === uid) {
            // cópia: a tela do anfitrião não pode apontar para o estado vivo do motor
            const msg = unpack(pack({ t: 'game', s: v, ev }));
            if (includeBoard) msg.board = unpack(room.boardJson);
            onMsg(msg);
          } else {
            patch[`views/${seat.uid}`] = {
              t: 'game',
              json: pack({ s: v, ev }),
              seq: room.seq,
            };
          }
        });
      }

      try {
        await update(ref(db, `catapulta/rooms/${roomCode}`), patch);
      } catch (e) {
        console.warn('Falha ao sincronizar sala no Firebase:', e);
      }
    };

    const scheduleBots = () => {
      clearTimeout(hostTimer);
      hostTimer = null;
      const g = room.game;
      if (closed || !g || g.phase === 'ended') return;
      let pick = null;
      for (const i of pendingActors(g)) {
        const seat = room.order[i];
        if (!seat || (!seat.bot && seat.connected)) continue;
        const a = botAction(g, i);
        if (!a) continue;
        const delay = seat.bot
          ? a.type === 'respondTrade'
            ? 700
            : a.type === 'endTurn'
              ? 600
              : 900 + Math.random() * 600
          : Math.max(1200, 15000 - (Date.now() - (seat.goneAt || Date.now())));
        if (!pick || delay < pick.delay) pick = { i, delay };
      }
      if (!pick) return;
      hostTimer = setTimeout(() => {
        hostTimer = null;
        if (closed || room.game !== g || g.phase === 'ended') return;
        const seat = room.order[pick.i];
        if (seat && (seat.bot || !seat.connected)) {
          const a = botAction(g, pick.i);
          if (a) {
            const err = act(g, pick.i, a);
            if (err && g.turn === pick.i && g.sub === 'action') {
              act(g, pick.i, { type: 'endTurn' });
            }
          }
        }
        flushHost(false, false);
      }, pick.delay);
    };

    const flushHost = (includeBoard = false, includeRoom = false) => {
      const evs = room.game ? drainEvents(room.game) : [];
      syncAll(evs, includeBoard, includeRoom);
      scheduleBots();
    };

    const sendErrTo = (targetUid, m, fatal = false) => {
      if (targetUid === uid) {
        onMsg({ t: 'err', m, fatal });
      } else {
        set(ref(db, `catapulta/rooms/${roomCode}/views/${targetUid}`), {
          t: 'err',
          m,
          fatal,
          seq: ++room.seq,
        }).catch(() => {});
      }
    };

    const handlePlayerMsg = (fromUid, m) => {
      if (closed || !m || typeof m.t !== 'string') return;
      let seat = room.seats.find((s) => !s.bot && s.uid === fromUid);

      if (m.t === 'hello') {
        const nm = cleanName(m.name);
        if (seat) {
          seat.connected = true;
          if (!room.game) seat.name = nm;
          if (room.game) {
            const idx = room.order.indexOf(seat);
            if (idx >= 0) room.game.players[idx].connected = true;
          }
        } else {
          if (room.game) return sendErrTo(fromUid, 'Essa partida já começou', true);
          if (room.seats.length >= MAX_SEATS) return sendErrTo(fromUid, 'Sala cheia', true);
          seat = {
            uid: fromUid,
            name: nm,
            color: freeColor(),
            bot: false,
            connected: true,
            goneAt: 0,
            lastEmote: 0,
            lastOffer: 0,
          };
          room.seats.push(seat);
        }
        flushHost(true, true);
        return;
      }

      if (!seat) return;

      if (m.t === 'disconnect' || m.t === 'leave') {
        seat.connected = false;
        seat.goneAt = Date.now();
        if (!room.game) {
          const idx = room.seats.indexOf(seat);
          if (idx >= 0) room.seats.splice(idx, 1);
          syncAll([], false, true);
        } else {
          const i = room.order.indexOf(seat);
          if (i >= 0) room.game.players[i].connected = false;
          flushHost(false, true);
        }
        return;
      }

      if (m.t === 'color') {
        if (room.game) return;
        const c = Number(m.color);
        if (!Number.isInteger(c) || c < 0 || c >= COLORS) return;
        if (room.seats.some((s) => s !== seat && s.color === c)) return;
        seat.color = c;
        syncAll([], false, true);
        return;
      }

      if (m.t === 'addBot' && fromUid === uid) {
        if (room.game || room.seats.length >= MAX_SEATS) return;
        if (m.botLevel) room.botLevel = cleanBotLevel(m.botLevel);
        const used = room.seats.map((s) => s.name);
        const botName = shuffle(BOT_NAMES.filter((n) => !used.includes(n)))[0];
        room.seats.push({
          uid: 'bot-' + Math.random().toString(36).slice(2, 10),
          name: botName,
          color: freeColor(),
          bot: true,
          botLevel: room.botLevel,
          connected: true,
        });
        syncAll([], false, true);
        return;
      }

      if (m.t === 'botLevel' && fromUid === uid) {
        if (room.game) return;
        const lv = cleanBotLevel(m.level);
        room.botLevel = lv;
        for (const s of room.seats) if (s.bot) s.botLevel = lv;
        syncAll([], false, true);
        return;
      }

      if (m.t === 'kick' && fromUid === uid) {
        if (room.game) return;
        if (!Number.isInteger(m.i) || m.i < 0 || m.i >= room.seats.length) return;
        const target = room.seats[m.i];
        if (!target || target.uid === uid) return;
        room.seats.splice(m.i, 1);
        if (!target.bot) sendErrTo(target.uid, 'Você foi removido da sala', true);
        syncAll([], false, true);
        return;
      }

      if (m.t === 'start' && fromUid === uid) {
        if (room.game) return;
        if (room.seats.length < 2) {
          return sendErrTo(uid, 'Precisa de pelo menos 2 jogadores (adicione um bot!)');
        }
        room.order = shuffle([...room.seats]);
        room.game = createGame(
          room.order.map((s) => ({
            name: s.name,
            color: s.color,
            avatar: s.color,
            bot: s.bot,
            botLevel: s.botLevel || room.botLevel || 'medium',
          }))
        );
        room.boardJson = pack(room.game.board);
        room.order.forEach((s, i) => (room.game.players[i].connected = s.bot || s.connected));
        flushHost(true, true);
        return;
      }

      if (m.t === 'act') {
        if (!room.game) return;
        const i = room.order.indexOf(seat);
        if (i < 0) return;
        if (m.a && m.a.type === 'offerTrade') {
          const now = Date.now();
          if (now - (seat.lastOffer || 0) < 1200) {
            return sendErrTo(fromUid, 'Aguarde um instante antes de fazer outra oferta');
          }
          seat.lastOffer = now;
        }
        const err = act(room.game, i, m.a);
        if (err) return sendErrTo(fromUid, err);
        flushHost(false, false);
        return;
      }

      if (m.t === 'emote') {
        if (!EMOTES.includes(m.e)) return;
        const now = Date.now();
        if (now - (seat.lastEmote || 0) < 600) return;
        seat.lastEmote = now;
        const p = room.game ? room.order.indexOf(seat) : room.seats.indexOf(seat);
        onMsg({ t: 'emote', p, e: m.e });
        set(ref(db, `catapulta/rooms/${roomCode}/public/emote`), { p, e: m.e, id: ++room.emoteSeq }).catch(() => {});
        return;
      }

      if (m.t === 'again' && fromUid === uid) {
        if (!room.game || room.game.phase !== 'ended') return;
        clearTimeout(hostTimer);
        room.game = null;
        room.order = [];
        room.seats = room.seats.filter((s) => s.bot || s.connected);
        syncAll([], false, true);
      }
    };

    // Escuta mensagens dos convidados em /catapulta/rooms/{code}/inbox
    // Cada convidado tem uma única "caixa": toda mudança de seq é uma mensagem nova.
    // (Comparar por "maior que" fazia o anfitrião ignorar para sempre quem caía e voltava.)
    const lastSeenSeq = new Map();
    let inboxPrimed = false;
    const unsubInbox = onValue(ref(db, `catapulta/rooms/${roomCode}/inbox`), (snap) => {
      const val = snap.val() || {};
      for (const [senderUid, payload] of Object.entries(val)) {
        if (!payload || typeof payload !== 'object') continue;
        const s = Number(payload.seq) || 0;
        if (lastSeenSeq.get(senderUid) === s) continue;
        lastSeenSeq.set(senderUid, s);
        // ao (re)abrir a sala, o que já estava na caixa é antigo: só presença importa
        if (!inboxPrimed && payload.t !== 'hello' && payload.t !== 'disconnect') continue;
        handlePlayerMsg(senderUid, payload);
      }
      inboxPrimed = true;
    });
    unsubs.push(unsubInbox);

    // Presença do anfitrião: se a conexão dele cair, os convidados ficam sabendo.
    const hostOffRef = ref(db, `catapulta/rooms/${roomCode}/public/hostOff`);
    let hostWasOnline = false;
    unsubs.push(
      onValue(ref(db, '.info/connected'), (snap) => {
        if (closed || !snap.val()) return;
        onDisconnect(hostOffRef).set(true).catch(() => {});
        if (hostWasOnline) syncAll([], false, true);
        hostWasOnline = true;
      })
    );

    onMsg({ t: 'hello', token: uid, code: roomCode });
    flushHost(true, true);

    return {
      send(m) {
        if (m.t === 'leave') {
          cleanup();
          remove(ref(db, `catapulta/rooms/${roomCode}`)).catch(() => {});
          return;
        }
        queueMicrotask(() => handlePlayerMsg(uid, m));
      },
      close() {
        cleanup();
      },
    };
  }

  // ==================== MODO CONVIDADO ====================
  let seq = 0;
  let hasBoard = false;
  let cachedBoard = null;
  let lastBoardJson = null;
  let lastGame = null;
  let lastViewSeq = 0;
  let lastEmoteId = 0;
  let hostOffWarned = false;

  const inboxRef = ref(db, `catapulta/rooms/${roomCode}/inbox/${uid}`);

  const sendToHost = async (m) => {
    if (closed) return;
    seq = Math.max(seq + 1, Date.now());
    try {
      await set(inboxRef, { ...m, key: secret, seq });
    } catch (e) {
      if (closed) return;
      const denied = String((e && (e.code || e.message)) || '').toUpperCase().includes('PERMISSION');
      if (denied) onMsg({ t: 'err', m: 'Chave de convite inválida ou ausente', needKey: true, fatal: true });
      else onMsg({ t: 'err', m: 'Sem conexão com a sala. Tentando de novo…' });
    }
  };

  unsubs.push(
    onValue(ref(db, `catapulta/rooms/${roomCode}/public`), (snap) => {
      if (closed) return;
      const pub = snap.val();
      if (!pub) {
        onMsg({ t: 'err', m: 'O anfitrião encerrou a sala', fatal: true });
        return;
      }
      if (pub.boardJson) {
        if (pub.boardJson !== lastBoardJson) {
          lastBoardJson = pub.boardJson;
          cachedBoard = unpack(pub.boardJson);
        }
      } else if (pub.board) {
        cachedBoard = pub.board;
      } else {
        lastBoardJson = null;
        cachedBoard = null;
        hasBoard = false;
        lastGame = null;
      }
      if (pub.hostOff && !hostOffWarned) onMsg({ t: 'err', m: 'O anfitrião caiu. Aguardando ele voltar…' });
      hostOffWarned = !!pub.hostOff;

      if (pub.emote && pub.emote.id !== lastEmoteId) {
        if (lastEmoteId !== 0) onMsg({ t: 'emote', p: pub.emote.p, e: pub.emote.e });
        lastEmoteId = pub.emote.id;
      }

      const seatsList = pub.seats || [];
      const youIdx = seatsList.findIndex((s) => s.uid === uid);
      if (youIdx >= 0) {
        onMsg({
          t: 'room',
          code: roomCode,
          you: youIdx,
          host: false,
          botLevel: pub.botLevel || 'medium',
          inGame: !!pub.inGame,
          seats: seatsList.map(({ uid: _, ...rest }) => rest),
        });
      }
      // o estado do jogo pode chegar antes do tabuleiro: reenvia com ele assim que der
      if (cachedBoard && !hasBoard && lastGame) {
        hasBoard = true;
        onMsg({ ...lastGame, board: cachedBoard });
      }
    })
  );

  unsubs.push(
    onValue(ref(db, `catapulta/rooms/${roomCode}/views/${uid}`), (snap) => {
      if (closed) return;
      const v = snap.val();
      if (!v || v.seq === lastViewSeq) return;
      lastViewSeq = v.seq;
      if (v.t === 'err') {
        onMsg({ t: 'err', m: v.m, fatal: !!v.fatal });
      } else if (v.t === 'game') {
        const data = v.json ? unpack(v.json) : { s: v.s, ev: v.ev };
        if (!data || !data.s) return;
        const msg = { t: 'game', s: data.s, ev: data.ev || [] };
        lastGame = msg;
        if (!hasBoard) {
          if (!cachedBoard) return;
          msg.board = cachedBoard;
          hasBoard = true;
        }
        onMsg(msg);
      }
    })
  );

  onMsg({ t: 'hello', token: uid, code: roomCode });
  // A cada (re)conexão: rearma o aviso de queda e se apresenta de novo ao anfitrião.
  // O aviso usa o relógio do servidor para nunca "valer mais" que as mensagens seguintes.
  unsubs.push(
    onValue(ref(db, '.info/connected'), async (snap) => {
      if (closed || !snap.val()) return;
      try {
        await onDisconnect(inboxRef).set({ t: 'disconnect', key: secret, seq: serverTimestamp() });
      } catch {}
      await sendToHost({ t: 'hello', name: cleanName(name) });
    })
  );

  return {
    send(m) {
      if (m.t === 'leave') {
        sendToHost({ t: 'leave' }).finally(() => cleanup());
        return;
      }
      sendToHost(m);
    },
    close() {
      cleanup();
    },
  };
}

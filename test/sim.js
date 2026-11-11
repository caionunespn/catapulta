// Simulação headless: bots jogam partidas completas e checamos invariantes.
import { RES } from '../server/board.js';
import { act, createGame, pendingActors, view, filterEvents, drainEvents, totalVP, handCount } from '../server/game.js';
import { botAction } from '../server/bot.js';

const GAMES = Number(process.argv[2]) || 200;
let failures = 0;
const fail = (msg) => {
  failures++;
  if (failures <= 10) console.error('FALHA:', msg);
};

function checkInvariants(s, tag) {
  for (const r of RES) {
    const total = s.bank[r] + s.players.reduce((n, p) => n + p.hand[r], 0);
    if (total !== 19) fail(`${tag}: ${r} soma ${total} (esperado 19)`);
    if (s.bank[r] < 0) fail(`${tag}: banco negativo em ${r}`);
    for (const p of s.players) if (p.hand[r] < 0) fail(`${tag}: mão negativa em ${r}`);
  }
  const cards = s.deck.length + s.players.reduce((n, p) => n + p.cards.length, 0);
  if (cards > 24) fail(`${tag}: cartas demais (${cards})`);
  for (const v of Object.keys(s.buildings)) {
    for (const u of s.board.vertices[v].adj) if (s.buildings[u]) fail(`${tag}: construções vizinhas ${v}/${u}`);
  }
  s.players.forEach((p, i) => {
    const roads = Object.values(s.roads).filter((x) => x === i).length;
    if (roads + p.roadsLeft !== 15) fail(`${tag}: trilhas do jogador ${i} = ${roads}+${p.roadsLeft}`);
    const b = Object.values(s.buildings).filter((x) => x.p === i);
    const vil = b.filter((x) => x.kind === 'village').length;
    const cas = b.filter((x) => x.kind === 'castle').length;
    if (vil + p.villagesLeft !== 5 || cas + p.castlesLeft !== 4) fail(`${tag}: peças do jogador ${i} inconsistentes`);
  });
}

function checkBoard(b) {
  if (b.tiles.length !== 19 || b.vertices.length !== 54 || b.edges.length !== 72) fail('topologia do tabuleiro errada');
  if (b.ports.length !== 9) fail('quantidade de portos');
  const seen = new Set();
  for (const p of b.ports) {
    for (const v of [p.a, p.b]) {
      if (seen.has(v)) fail('dois portos no mesmo vértice');
      seen.add(v);
    }
  }
  for (const e of b.edges) {
    if (e.tiles.length !== 2) continue;
    const [x, y] = e.tiles.map((t) => b.tiles[t].number);
    if ((x === 6 || x === 8) && (y === 6 || y === 8)) fail('6/8 vizinhos');
  }
}

const stats = { turns: [], actions: [], winners: [0, 0, 0, 0], stuck: 0 };

const LEVELS = ['easy', 'medium', 'hard'];

for (let g = 0; g < GAMES; g++) {
  const n = 2 + (g % 3);
  const s = createGame(
    Array.from({ length: n }, (_, i) => ({
      name: 'Bot' + i,
      color: i,
      avatar: i,
      bot: true,
      botLevel: LEVELS[(g + i) % LEVELS.length],
    }))
  );
  checkBoard(s.board);
  let steps = 0;
  while (s.phase !== 'ended' && steps < 20000) {
    steps++;
    let moved = false;
    for (const p of pendingActors(s)) {
      const a = botAction(s, p);
      if (!a) continue;
      const err = act(s, p, a);
      if (err) {
        fail(`jogo ${g}: bot ${p} ação ${JSON.stringify(a)} => ${err}`);
        steps = Infinity;
      }
      moved = true;
      break;
    }
    if (!moved) {
      fail(`jogo ${g}: ninguém age (fase ${s.phase}/${s.sub})`);
      break;
    }
    if (steps % 25 === 0) checkInvariants(s, `jogo ${g}`);
    // a visão não pode vazar a mão alheia
    if (steps % 200 === 0 && s.phase !== 'ended') {
      const v = view(s, 0);
      if (v.players[1].hand || v.players[1].cards) fail('visão vazou mão de outro jogador');
      JSON.stringify(v);
      filterEvents(drainEvents(s), 1);
    }
  }
  checkInvariants(s, `jogo ${g} (fim)`);
  if (s.phase !== 'ended') {
    stats.stuck++;
    continue;
  }
  if (totalVP(s, s.winner) < 10) fail(`jogo ${g}: vencedor com menos de 10 pontos`);
  stats.turns.push(s.turnNumber);
  stats.actions.push(steps);
  stats.winners[s.winner]++;
}

const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
console.log(`partidas: ${GAMES}  terminadas: ${stats.turns.length}  travadas: ${stats.stuck}`);
console.log(`turnos (média/máx): ${avg(stats.turns)}/${Math.max(0, ...stats.turns)}  ações (média): ${avg(stats.actions)}`);
console.log(`vitórias por assento: ${stats.winners.join(', ')}`);
console.log(failures ? `FALHAS: ${failures}` : 'OK: nenhuma falha');
process.exit(failures || stats.stuck ? 1 : 0);

// Desenho do tabuleiro em SVG: ilha de quermesse à noite.
import { INK, SHAPES, BOULDER, walkerShape, cartShape } from './art.js';

const SCENERY = {
  forest: { icons: ['pine', 'tree', 'pine', 'tree'], spots: [[-25, -19], [21, -25], [-15, 31], [20, 27]] },
  quarry: { icons: ['stone', 'stone', 'stone'], spots: [[-24, -21], [22, -23], [0, 33]] },
  pasture: { icons: ['cheese', 'cheese', 'cheese'], spots: [[-24, -21], [22, -23], [0, 33]] },
  garden: { icons: ['pumpkin', 'pumpkin', 'pumpkin'], spots: [[-24, -21], [22, -23], [0, 33]] },
  cave: { icons: ['crystal', 'crystal', 'crystal'], spots: [[-24, -21], [22, -23], [0, 33]] },
  swamp: { icons: ['reed', 'reed', 'reed', 'reed'], spots: [[-24, -8], [18, -22], [8, 26], [-12, 30]] },
};

// pseudoaleatório estável por ladrilho (o tabuleiro não "pisca" entre renders)
const rnd = (seed) => {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
};

function texture(t) {
  const r = rnd(t.id + 1);
  let out = '';
  const at = () => [t.x + (r() - 0.5) * 70, t.y + (r() - 0.5) * 70];
  if (t.terrain === 'garden') {
    for (let i = -2; i <= 2; i++) out += `<path d="M${t.x - 34} ${t.y + i * 15 + 4}q34-9 68 0"/>`;
  } else if (t.terrain === 'pasture') {
    for (let i = 0; i < 9; i++) {
      const [x, y] = at();
      out += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l2-5 2 5 2-4"/>`;
    }
  } else if (t.terrain === 'quarry') {
    for (let i = 0; i < 12; i++) {
      const [x, y] = at();
      out += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l4-2 3 3"/>`;
    }
  } else if (t.terrain === 'forest') {
    for (let i = 0; i < 7; i++) {
      const [x, y] = at();
      out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(4 + r() * 5).toFixed(1)}" class="blob"/>`;
    }
  } else if (t.terrain === 'cave') {
    out += `<ellipse cx="${t.x}" cy="${t.y + 2}" rx="30" ry="22" class="blob"/>`;
    for (let i = 0; i < 6; i++) {
      const [x, y] = at();
      out += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l2-4 2 4"/>`;
    }
  } else {
    out += `<ellipse cx="${t.x - 8}" cy="${t.y + 6}" rx="24" ry="10" class="blob"/><ellipse cx="${t.x + 16}" cy="${t.y - 14}" rx="13" ry="6" class="blob"/>`;
  }
  return `<g class="tex">${out}</g>`;
}

const pts = (list) => list.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

export class BoardView {
  constructor(svg, onPick, onCam) {
    this.svg = svg;
    this.onCam = onCam;
    this.b = null;
    this.prev = new Set();
    this.ready = false;
    this.last = {};
    this.lastCat = null;
    this.cam = { x: 0, y: -2, z: 1 };
    this.ptrs = new Map();
    this.dragged = false;
    this.downAt = { x: 0, y: 0 };
    this.pinchDist = 0;

    svg.addEventListener('pointerdown', (e) => {
      if (e.button && e.button !== 0) return;
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.ptrs.size === 1) {
        this.downAt = { x: e.clientX, y: e.clientY };
        this.dragged = false;
      } else if (this.ptrs.size === 2) {
        this.dragged = true;
        const [a, b] = [...this.ptrs.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.ptrs.has(e.pointerId)) return;
      const prev = this.ptrs.get(e.pointerId);
      const cur = { x: e.clientX, y: e.clientY };
      this.ptrs.set(e.pointerId, cur);

      if (this.ptrs.size === 1) {
        if (!this.dragged && Math.hypot(cur.x - this.downAt.x, cur.y - this.downAt.y) > 6) {
          this.dragged = true;
          this.svg.classList.add('dragging');
        }
        if (this.dragged) {
          const m = this.svg.getScreenCTM();
          if (m && m.a && m.d) {
            this.cam.x -= (cur.x - prev.x) / m.a;
            this.cam.y -= (cur.y - prev.y) / m.d;
            this.applyCam();
          }
        }
      } else if (this.ptrs.size === 2) {
        const [a, b] = [...this.ptrs.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        if (this.pinchDist > 0) {
          this.zoomBy(dist / this.pinchDist, midX, midY);
        }
        this.pinchDist = dist;
      }
    });

    const endPtr = (e) => {
      if (!this.ptrs.has(e.pointerId)) return;
      this.ptrs.delete(e.pointerId);
      if (this.ptrs.size < 2) this.pinchDist = 0;
      if (this.ptrs.size === 0) this.svg.classList.remove('dragging');
    };
    window.addEventListener('pointerup', endPtr);
    window.addEventListener('pointercancel', endPtr);

    svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        this.zoomBy(factor, e.clientX, e.clientY);
      },
      { passive: false }
    );

    svg.addEventListener('dblclick', (e) => {
      if (e.target.closest('[data-pick]')) return;
      this.resetCam();
    });

    svg.addEventListener('click', (e) => {
      if (this.dragged) {
        this.dragged = false;
        return;
      }
      const t = e.target.closest('[data-pick]');
      if (t) onPick(t.dataset.pick, Number(t.dataset.id));
    });
  }

  applyCam() {
    const maxPan = 240;
    this.cam.z = Math.min(2.6, Math.max(0.75, this.cam.z));
    this.cam.x = Math.min(maxPan, Math.max(-maxPan, this.cam.x));
    this.cam.y = Math.min(maxPan, Math.max(-maxPan, this.cam.y));
    const w = 660 / this.cam.z;
    const h = 640 / this.cam.z;
    const vx = this.cam.x - w / 2;
    const vy = this.cam.y - h / 2;
    this.svg.setAttribute('viewBox', `${vx.toFixed(1)} ${vy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
    this.onCam?.(this.cam);
  }

  resetCam() {
    this.cam = { x: 0, y: -2, z: 1 };
    this.applyCam();
  }

  zoomBy(factor, clientX, clientY) {
    const prevZ = this.cam.z;
    const nextZ = Math.min(2.6, Math.max(0.75, prevZ * factor));
    if (Math.abs(nextZ - prevZ) < 0.001) return;
    if (clientX != null && clientY != null) {
      const m = this.svg.getScreenCTM();
      if (m) {
        const p0 = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
        this.cam.z = nextZ;
        this.applyCam();
        const m1 = this.svg.getScreenCTM();
        if (m1) {
          const p1 = new DOMPoint(clientX, clientY).matrixTransform(m1.inverse());
          this.cam.x += p0.x - p1.x;
          this.cam.y += p0.y - p1.y;
          this.applyCam();
          return;
        }
      }
    }
    this.cam.z = nextZ;
    this.applyCam();
  }

  setBoard(b) {
    this.b = b;
    this.prev = new Set();
    this.ready = false;
    this.last = {};
    this.lastCat = null;
    this.cam = { x: 0, y: -2, z: 1 };
    const V = b.vertices;
    let foam = '';
    let shoreOut = '';
    let shore = '';
    let tiles = '';
    for (const t of b.tiles) {
      const outer = pts(t.v.map((v) => [V[v].x, V[v].y]));
      const inner = pts(t.v.map((v) => [t.x + (V[v].x - t.x) * 0.86, t.y + (V[v].y - t.y) * 0.86]));
      foam += `<polygon points="${outer}"/>`;
      shoreOut += `<polygon points="${outer}"/>`;
      shore += `<polygon points="${outer}"/>`;
      const sc = SCENERY[t.terrain];
      const decor = sc.spots
        .map(([dx, dy], i) => {
          const sz = 25 + ((t.id * 7 + i * 5) % 3) * 3;
          return `<use href="#i-${sc.icons[i]}" x="${t.x + dx - sz / 2}" y="${t.y + dy - sz / 2}" width="${sz}" height="${sz}"/>`;
        })
        .join('');
      let token = '';
      if (t.number) {
        const k = 6 - Math.abs(7 - t.number);
        let dots = '';
        for (let i = 0; i < k; i++) dots += `<circle class="pip" cx="${((i - (k - 1) / 2) * 4.4).toFixed(1)}" cy="9.500" r="1.500"/>`;
        const hot = t.number === 6 || t.number === 8 ? ' hot' : '';
        token = `<g class="token${hot}" transform="translate(${t.x},${t.y})"><g class="token-in"><circle class="tk-shadow" cy="2.500" r="16.5"/><circle class="tk" r="16.5"/><circle class="tk-ring" r="13.8"/><text y="3.500">${t.number}</text>${dots}</g></g>`;
      }
      tiles += `<g class="tile t-${t.terrain}" data-tile="${t.id}"><polygon class="hex" points="${outer}"/><polygon class="hex-in" points="${inner}"/>${texture(t)}<g class="decor">${decor}</g><polygon class="hex-glow" points="${outer}"/>${token}</g>`;
    }
    let ports = '';
    for (const p of b.ports) {
      const body =
        p.type === 'any'
          ? `<text class="big" y="5">3:1</text>`
          : `<use href="#i-${p.type}" x="-9.500" y="-15" width="19" height="19"/><text y="12.500">2:1</text>`;
      const pier = (v) => `M${V[v].x} ${V[v].y}L${p.x} ${p.y}`;
      ports +=
        `<g class="port"><path class="pier-out" d="${pier(p.a)}${pier(p.b)}"/><path class="pier" d="${pier(p.a)}${pier(p.b)}"/>` +
        `<g transform="translate(${p.x},${p.y})"><rect class="sign-shadow" x="-18.5" y="-15.500" width="37" height="34" rx="8"/><rect class="sign" x="-18.5" y="-18" width="37" height="34" rx="8"/><rect class="sign-in" x="-15.5" y="-15" width="31" height="28" rx="5.5"/>${body}</g></g>`;
    }
    this.applyCam();
    this.svg.innerHTML =
      `<defs><radialGradient id="sea-glow"><stop offset="0" stop-color="#2a8c95" stop-opacity=".95"/><stop offset=".62" stop-color="#1a5d6c" stop-opacity=".7"/><stop offset="1" stop-color="#143c4c" stop-opacity="0"/></radialGradient></defs>` +
      `<circle r="322" fill="url(#sea-glow)"/><g class="foam2">${foam}</g><g class="foam">${foam}</g>` +
      `<g class="shore-out">${shoreOut}</g><g class="shore">${shore}</g><g class="l-ports">${ports}</g><g class="l-tiles">${tiles}</g>` +
      `<g class="l-roads"></g><g class="l-walk"></g><g class="l-builds"></g><g class="l-cat"></g><g class="l-tg"></g>`;
  }

  layer(name, html) {
    if (this.last[name] === html) return;
    this.last[name] = html;
    this.svg.querySelector('.l-' + name).innerHTML = html;
  }

  // Trajetos que a gente da vila percorre: as maiores trilhas contínuas de cada jogador.
  walkers(G, colorOf) {
    const { vertices: V, edges: E } = this.b;
    let html = '';
    G.players.forEach((_, p) => {
      const mine = Object.keys(G.roads).filter((e) => G.roads[e] === p).map(Number);
      if (!mine.length) return;
      const set = new Set(mine);
      const trail = (start, skip) => {
        let best = [start];
        const used = new Set();
        const cur = [start];
        const dfs = (v) => {
          if (cur.length > best.length) best = [...cur];
          if (cur.length > 7) return;
          for (const e of V[v].edges) {
            if (!set.has(e) || used.has(e) || e === skip) continue;
            used.add(e);
            const u = E[e].a === v ? E[e].b : E[e].a;
            cur.push(u);
            dfs(u);
            cur.pop();
            used.delete(e);
          }
        };
        dfs(start);
        return best;
      };
      const homes = Object.keys(G.buildings).filter((v) => G.buildings[v].p === p).map(Number).sort((a, b) => a - b);
      const starts = homes.length ? homes : [E[mine[0]].a];
      const routes = [];
      for (const s of starts) {
        const t = trail(s);
        if (t.length < 2) continue;
        const key = [...t].sort((a, b) => a - b).join('.');
        if (routes.some((r) => r.key === key)) continue;
        routes.push({ key, t });
        if (routes.length >= 2) break;
      }
      const c = colorOf(p);
      routes.forEach((r, k) => {
        const d = 'M' + r.t.map((v) => `${V[v].x} ${V[v].y}`).join('L');
        const len = (r.t.length - 1) * 60;
        const dur = (len / 6.5).toFixed(1);
        const mover = (shape, phase, cls) =>
          `<g class="mover ${cls}" style="offset-path:path('${d}');animation-duration:${dur}s;animation-delay:-${((phase * len) / 6.5).toFixed(1)}s"><g transform="scale(1.5)">${shape}</g></g>`;
        html += mover(walkerShape(c, p * 3 + k), 0.13 + k * 0.31, '');
        if (r.t.length >= 4) html += mover(cartShape(c), 0.62, 'cart');
        else if (r.t.length === 3 && k === 0) html += mover(walkerShape(c, p * 3 + 2), 0.71, '');
      });
    });
    return html;
  }

  update(G, tg, colorOf) {
    if (!this.b) return;
    const { vertices: V, edges: E, tiles: T } = this.b;
    const keys = new Set();
    const isNew = (k) => {
      keys.add(k);
      return this.ready && !this.prev.has(k);
    };
    const seg = (e, a0, a1) => {
      const a = V[E[e].a];
      const b = V[E[e].b];
      return `x1="${(a.x + (b.x - a.x) * a0).toFixed(1)}" y1="${(a.y + (b.y - a.y) * a0).toFixed(1)}" x2="${(a.x + (b.x - a.x) * a1).toFixed(1)}" y2="${(a.y + (b.y - a.y) * a1).toFixed(1)}"`;
    };

    let roads = '';
    for (const [e, p] of Object.entries(G.roads)) {
      const pop = isNew('r' + e) ? ' pop' : '';
      const c = seg(e, 0.14, 0.86);
      roads += `<g class="road${pop}"><line class="road-out" ${c}/><line class="road-in" ${c} stroke="${colorOf(p).hex}"/><line class="road-dash" ${c}/></g>`;
    }
    this.layer('roads', roads);
    this.layer('walk', this.walkers(G, colorOf));

    // desenha de cima para baixo para as peças da frente cobrirem as de trás
    let builds = '';
    const order = Object.keys(G.buildings).map(Number).sort((a, b) => V[a].y - V[b].y);
    for (const v of order) {
      const b = G.buildings[v];
      const pop = isNew('b' + v + b.kind);
      const delay = `style="animation-delay:-${((v * 0.73) % 4).toFixed(2)}s"`;
      const art = SHAPES[b.kind](colorOf(b.p)).replace('class="smoke"', `class="smoke" ${delay}`).replace('class="flag"', `class="flag" ${delay}`);
      builds += `<g transform="translate(${V[v].x},${V[v].y})">${pop ? '<circle class="dust" r="20"/>' : ''}<g class="piece${pop ? ' pop' : ''}"><g transform="scale(${b.kind === 'castle' ? 1.1 : 1.16})">${art}</g></g></g>`;
    }
    this.layer('builds', builds);

    const ct = T[G.catapult];
    const thud = this.lastCat !== null && this.lastCat !== G.catapult;
    this.layer('cat', `<g transform="translate(${ct.x},${ct.y - 2})"><g class="${thud ? 'boulder' : ''}" data-t="${G.catapult}">${BOULDER}</g></g>`);
    if (this.lastCat !== G.catapult) {
      this.svg.querySelectorAll('.tile.blocked').forEach((el) => el.classList.remove('blocked'));
      this.svg.querySelector(`.tile[data-tile="${G.catapult}"]`)?.classList.add('blocked');
      this.lastCat = G.catapult;
    }

    let tgs = '';
    for (const v of tg.vertices) {
      const up = tg.kind === 'castle';
      tgs +=
        `<g class="tg tg-v${up ? ' up' : ''}" data-pick="vertex" data-id="${v}" transform="translate(${V[v].x},${V[v].y})">` +
        `<circle class="hit" r="25"/><circle class="dot" r="${up ? 23 : 10.5}"/>${up ? '' : '<path d="M-4.500 0h9M0-4.500v9"/>'}</g>`;
    }
    for (const e of tg.edges) {
      tgs += `<g class="tg tg-e" data-pick="edge" data-id="${e}"><line class="hit" ${seg(e, 0.2, 0.8)}/><line class="bar-out" ${seg(e, 0.22, 0.78)}/><line class="bar" ${seg(e, 0.22, 0.78)}/></g>`;
    }
    for (const t of tg.tiles) {
      tgs += `<g class="tg tg-t" data-pick="tile" data-id="${t}" transform="translate(${T[t].x},${T[t].y})"><circle class="hit" r="44"/><circle class="ring" r="29"/><path d="M-37 0h16M21 0h16M0-37v16M0 21v16"/></g>`;
    }
    this.layer('tg', tgs);
    this.svg.classList.toggle('picking', tgs !== '');

    this.prev = keys;
    this.ready = true;
  }

  flash(sum, catapult) {
    if (!this.b) return;
    for (const t of this.b.tiles) {
      if (t.number !== sum || t.id === catapult) continue;
      const el = this.svg.querySelector(`.tile[data-tile="${t.id}"]`);
      if (!el) continue;
      el.classList.remove('flash');
      void el.getBoundingClientRect();
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1300);
    }
  }

  screen(x, y) {
    const m = this.svg.getScreenCTM();
    if (!m) return { x: innerWidth / 2, y: innerHeight / 2 };
    const p = new DOMPoint(x, y).matrixTransform(m);
    return { x: p.x, y: p.y };
  }

  pieceScreen(kind, at) {
    const { vertices: V, edges: E } = this.b;
    if (kind === 'road') {
      const e = E[at];
      return this.screen((V[e.a].x + V[e.b].x) / 2, (V[e.a].y + V[e.b].y) / 2);
    }
    return this.screen(V[at].x, V[at].y);
  }

  tileScreen(id) {
    const t = this.b.tiles[id];
    return this.screen(t.x, t.y);
  }
}

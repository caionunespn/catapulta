// Sons sintetizados (WebAudio) e efeitos visuais.
const fxRoot = () => document.getElementById('fx');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem('catapulta_mute') === '1';
} catch {}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem('catapulta_mute', m ? '1' : '0');
  } catch {}
}

function ac() {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx.state === 'running' ? ctx : null;
  } catch {
    return null;
  }
}

function tone(freq, dur, { type = 'sine', vol = 0.14, at = 0, to = null } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.2, at = 0, freq = 1200 } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + at;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  click: () => tone(520, 0.06, { type: 'triangle', vol: 0.08 }),
  pop: () => tone(380, 0.12, { type: 'triangle', to: 760 }),
  err: () => tone(180, 0.2, { type: 'sawtooth', vol: 0.08, to: 110 }),
  dice: () => {
    for (let i = 0; i < 6; i++) noise(0.05, { at: i * 0.09, freq: 2600, vol: 0.16 });
  },
  build: () => {
    noise(0.09, { freq: 500, vol: 0.3 });
    tone(150, 0.14, { type: 'square', vol: 0.08, to: 80 });
  },
  gain: (i = 0) => tone(660 + i * 110, 0.14, { type: 'triangle', vol: 0.09, at: i * 0.07 }),
  whoosh: () => noise(0.55, { freq: 900, vol: 0.12 }),
  boom: () => {
    noise(0.4, { freq: 300, vol: 0.5 });
    tone(110, 0.4, { type: 'sine', vol: 0.3, to: 40 });
  },
  turn: () => {
    tone(523, 0.12, { type: 'triangle' });
    tone(784, 0.2, { type: 'triangle', at: 0.11 });
  },
  card: () => {
    tone(440, 0.1, { type: 'square', vol: 0.07 });
    tone(660, 0.1, { type: 'square', vol: 0.07, at: 0.08 });
    tone(990, 0.2, { type: 'square', vol: 0.07, at: 0.16 });
  },
  deal: () => {
    tone(700, 0.08, { type: 'triangle' });
    tone(1050, 0.16, { type: 'triangle', at: 0.08 });
  },
  land: (seven) => {
    noise(0.07, { freq: 420, vol: 0.32 });
    tone(seven ? 130 : 240, 0.16, { type: 'triangle', vol: 0.12, to: seven ? 70 : 320 });
  },
  win: () => {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'square', vol: 0.09, at: i * 0.13 }));
  },
};

function spawn(cls, html) {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  fxRoot().appendChild(el);
  return el;
}

const tr = (p, extra = '') => `translate(${p.x}px, ${p.y}px) ${extra}`;

export function flyIcon(res, from, to, delay = 0) {
  if (calm) return;
  const el = spawn('fly', `<svg viewBox="0 0 32 32" width="34" height="34"><use href="#i-${res}"/></svg>`);
  const side = (Math.random() - 0.5) * 70;
  const mid = { x: (from.x + to.x) / 2 + side, y: Math.min(from.y, to.y) - 50 - Math.random() * 40 };
  el.animate(
    [
      { transform: tr(from, 'scale(.2)'), opacity: 0, easing: 'cubic-bezier(.2,1.5,.4,1)' },
      { transform: tr({ x: from.x, y: from.y - 22 }, 'scale(1.5)'), opacity: 1, offset: 0.22, easing: 'cubic-bezier(.5,0,.6,.4)' },
      { transform: tr(mid, 'scale(1.15) rotate(140deg)'), opacity: 1, offset: 0.62, easing: 'cubic-bezier(.3,.4,.3,1)' },
      { transform: tr(to, 'scale(.45) rotate(320deg)'), opacity: 0.1 },
    ],
    { duration: 900, delay, fill: 'backwards' }
  ).onfinish = () => el.remove();
  setTimeout(() => el.remove(), 1400 + delay);
}

const ROCK =
  '<svg viewBox="-28 -28 56 56" width="56" height="56"><path d="M-20 12-17-10-3-22 13-18 22-3 17 16-5 20Z" fill="#6f7c8c" stroke="#14202b" stroke-width="3" stroke-linejoin="round"/>' +
  '<path d="M-17-10-3-22 13-18 2-7Z" fill="#a9b6c6"/><path d="M2-7 6 9M-9 3l6 5" fill="none" stroke="#3b4654" stroke-width="2.4" stroke-linecap="round"/></svg>';

export function flyBoulder(from, to) {
  if (calm) return new Promise((r) => setTimeout(r, 150));
  return new Promise((resolve) => {
    const el = spawn('fly-rock', ROCK);
    const apex = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 200 };
    // aba em segundo plano pausa as animações: o temporizador garante que a partida nunca trave esperando
    let landed = false;
    const land = () => {
      if (landed) return;
      landed = true;
      el.remove();
      const puff = spawn('puff', '');
      puff.animate([{ transform: tr(to, 'scale(.2)'), opacity: 0.9 }, { transform: tr(to, 'scale(1.5)'), opacity: 0 }], {
        duration: 520,
        easing: 'cubic-bezier(.16,1,.3,1)',
      }).onfinish = () => puff.remove();
      setTimeout(() => puff.remove(), 900);
      resolve();
    };
    el.animate(
      [
        { transform: tr(from, 'scale(.4) rotate(0)'), easing: 'cubic-bezier(.2,.7,.4,1)' },
        { transform: tr(apex, 'scale(1.9) rotate(380deg)'), easing: 'cubic-bezier(.6,0,.9,.5)' },
        { transform: tr(to, 'scale(.95) rotate(760deg)') },
      ],
      { duration: 760 }
    ).onfinish = land;
    setTimeout(land, 1000);
  });
}

// faíscas saindo de um ponto (construções, impacto)
export function burst(at, color = '#f7b733', n = 10) {
  if (calm || !at) return;
  for (let i = 0; i < n; i++) {
    const el = spawn('spark', '');
    el.style.background = i % 3 ? color : '#f6e8c8';
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 26 + Math.random() * 34;
    const to = { x: at.x + Math.cos(ang) * dist, y: at.y + Math.sin(ang) * dist - 10 };
    el.animate([{ transform: tr(at, 'scale(1.3)'), opacity: 1 }, { transform: tr(to, 'scale(.2)'), opacity: 0 }], {
      duration: 480 + Math.random() * 260,
      easing: 'cubic-bezier(.16,1,.3,1)',
    }).onfinish = () => el.remove();
    setTimeout(() => el.remove(), 1200);
  }
}

export function shake(el, k = 1) {
  if (calm || !el) return;
  el.animate(
    [
      { transform: 'translate(0,0)' },
      { transform: `translate(${-9 * k}px, ${5 * k}px) rotate(${-0.6 * k}deg)` },
      { transform: `translate(${8 * k}px, ${-6 * k}px) rotate(${0.6 * k}deg)` },
      { transform: `translate(${-6 * k}px, ${-3 * k}px)` },
      { transform: `translate(${5 * k}px, ${4 * k}px)` },
      { transform: 'translate(0,0)' },
    ],
    { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' }
  );
}

export function bubble(el, emoji) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const from = { x: r.left + r.width * (0.3 + Math.random() * 0.4), y: r.top + r.height / 2 };
  const b = spawn('bubble', emoji);
  b.animate(
    [
      { transform: tr(from, 'scale(.2)'), opacity: 0 },
      { transform: tr({ x: from.x + 10, y: from.y - 20 }, 'scale(1.5) rotate(-12deg)'), opacity: 1, offset: 0.25 },
      { transform: tr({ x: from.x - 8, y: from.y - 60 }, 'scale(1.3) rotate(10deg)'), opacity: 1, offset: 0.7 },
      { transform: tr({ x: from.x, y: from.y - 110 }, 'scale(1)'), opacity: 0 },
    ],
    { duration: 1900, easing: 'ease-out' }
  ).onfinish = () => b.remove();
  setTimeout(() => b.remove(), 2600);
}

export function confetti(n = 110) {
  if (calm) return;
  const colors = ['#f7b733', '#e5482f', '#1fae96', '#f6e8c8', '#3d7be0', '#e0569d'];
  for (let i = 0; i < n; i++) {
    const el = spawn('confetto', '');
    el.style.left = Math.random() * 100 + 'vw';
    el.style.background = colors[i % colors.length];
    const drift = (Math.random() - 0.5) * 300;
    el.animate(
      [
        { transform: 'translate(0,0) rotate(0)' },
        { transform: `translate(${drift}px, ${innerHeight + 60}px) rotate(${720 + Math.random() * 720}deg)` },
      ],
      { duration: 2200 + Math.random() * 2200, delay: Math.random() * 900, easing: 'cubic-bezier(.3,.6,.6,1)', fill: 'backwards' }
    ).onfinish = () => el.remove();
    setTimeout(() => el.remove(), 6000);
  }
}

export function toast(html, cls = '', ms = 2600) {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + cls;
  el.innerHTML = html;
  root.appendChild(el);
  while (root.children.length > 4) root.firstChild.remove();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, ms);
}

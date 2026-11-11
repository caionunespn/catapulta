// Identidade visual do jogo: paleta, personagens, iconografia e peças do tabuleiro.
// Tudo desenhado em SVG no mesmo traço (contorno "piche", tinta esmalte chapada).

export const INK = '#14202b';
export const CREAM = '#f6e8c8';
const S = `stroke="${INK}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"`;
const L = `fill="none" ${S}`;

// Elenco: cada cor é um personagem da quermesse.
export const COLORS = [
  { hex: '#e8472f', dark: '#a82c1b', name: 'Capitão Brasa' },
  { hex: '#3d7be0', dark: '#2452a8', name: 'Dona Maré' },
  { hex: '#f5b62e', dark: '#c4861a', name: 'Zé Coalho' },
  { hex: '#e0569d', dark: '#a8306e', name: 'Madame Pipoca' },
  { hex: '#1fae96', dark: '#147a69', name: 'Tia Hortelã' },
  { hex: '#f4efe4', dark: '#b9b09c', name: 'Vovô Pedregulho' },
];

// ---------- ícones (viewBox -16 -16 32 32) ----------
const ICONS = {
  // recursos
  wood:
    `<path d="M-6-3q-2-8 6-10 2 7-6 10Z" fill="#43b06c" ${S}/>` +
    `<rect x="-13" y="-3" width="23" height="11" rx="5.5" fill="#a0683a" ${S}/>` +
    `<path d="M-8 1h9M-5 5h5" fill="none" stroke="#6b4022" stroke-width="1.4" stroke-linecap="round"/>` +
    `<ellipse cx="9.5" cy="2.5" rx="3.8" ry="5.5" fill="#ecc994" ${S}/>` +
    `<ellipse cx="9.5" cy="2.5" rx="1.3" ry="2.2" fill="none" stroke="#a0683a" stroke-width="1.2"/>`,
  stone:
    `<path d="M-13 10-10-3-3-9 5-6 8 3 6 10Z" fill="#9fb0c4" ${S}/>` +
    `<path d="M-10-3-3-9 5-6-2-1Z" fill="#dbe4ee"/>` +
    `<path d="M2 10 4 1 10-2 14 4 13 10Z" fill="#7f91a8" ${S}/>`,
  cheese:
    `<path d="M-13 8v-8L6-10l7 10v8Z" fill="#f7c843" ${S}/>` +
    `<path d="M-13 0 6-10l7 10Z" fill="#fde28a" ${S}/>` +
    `<circle cx="-6" cy="4" r="2.2" fill="#d99a1c"/><circle cx="5" cy="4.5" r="1.7" fill="#d99a1c"/><circle cx="3" cy="-4.5" r="1.5" fill="#e8b23a"/>`,
  pumpkin:
    `<ellipse cx="-5.5" cy="3" rx="7" ry="9" fill="#ee6c1d" ${S}/>` +
    `<ellipse cx="5.5" cy="3" rx="7" ry="9" fill="#ee6c1d" ${S}/>` +
    `<ellipse cx="0" cy="3" rx="5.5" ry="9.6" fill="#fb9238" ${S}/>` +
    `<path d="M0-7q1-6 6-6" fill="none" stroke="${INK}" stroke-width="4.6" stroke-linecap="round"/>` +
    `<path d="M0-7q1-6 6-6" fill="none" stroke="#43b06c" stroke-width="2.2" stroke-linecap="round"/>`,
  crystal:
    `<path d="M-3 12-10-2l5-11 7 9Z" fill="#c7a6ff" ${S}/>` +
    `<path d="M1 12V-3l6-7 6 10-4 12Z" fill="#8a5cf0" ${S}/>` +
    `<path d="M-5-10v10M7-7v14" fill="none" stroke="#f3eaff" stroke-width="1.3" stroke-linecap="round" opacity=".85"/>`,
  // cenário
  reed:
    `<path d="M-4 14q-2-14 0-22M3 14q2-12 1-18" fill="none" stroke="#4d8a45" stroke-width="2.2" stroke-linecap="round"/>` +
    `<rect x="-6.5" y="-13" width="5" height="10" rx="2.5" fill="#7a4a21" ${S}/><rect x="1.5" y="-9" width="5" height="9" rx="2.5" fill="#7a4a21" ${S}/>`,
  pine:
    `<rect x="-2" y="7" width="4" height="7" rx="1" fill="#7a4a21" ${S}/>` +
    `<path d="M0-14 9-1H5l6 9h-22l6-9h-4Z" fill="#1f8a55" ${S}/><path d="M0-10 3.5-4.5h-4Z" fill="#7fe0a2" opacity=".7"/>`,
  tree:
    `<rect x="-2" y="5" width="4" height="9" rx="1" fill="#7a4a21" ${S}/>` +
    `<path d="M0-13q9 0 9 8 3 2 1 6-2 4-10 4t-10-4q-2-4 1-6 0-8 9-8Z" fill="#2fa567" ${S}/><path d="M-4-8q2-3 5-3" fill="none" stroke="#9cf0b8" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`,
  // interface
  hand:
    `<rect x="-11" y="-10" width="13" height="18" rx="2.5" transform="rotate(-12 -4 0)" fill="${CREAM}" ${S}/>` +
    `<rect x="-2" y="-9" width="13" height="18" rx="2.5" transform="rotate(10 4 0)" fill="#f7b733" ${S}/>`,
  trick: `<rect x="-8" y="-12" width="16" height="24" rx="3" fill="#7a55c4" ${S}/><path d="M0-6 4 0 0 6-4 0Z" fill="${CREAM}" ${S}/>`,
  aim: `<circle r="11.5" fill="${CREAM}" ${S}/><circle r="6.6" fill="#e5482f" ${S}/><circle r="2.2" fill="${CREAM}"/>`,
  road:
    `<path d="M-9 12C-12 2 9 4 6-4 4-9-1-9-3-13" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="M-9 12C-12 2 9 4 6-4 4-9-1-9-3-13" fill="none" stroke="#d9a65a" stroke-width="5.4" stroke-linecap="round"/>` +
    `<path d="M-9 12C-12 2 9 4 6-4 4-9-1-9-3-13" fill="none" stroke="${CREAM}" stroke-width="1.2" stroke-dasharray="2.5 3.5"/>`,
  star: `<path d="M0-12 3.5-4 12-3.5 5.5 2 7.5 11 0 6.2-7.5 11-5.5 2-12-3.5-3.5-4Z" fill="#f7b733" ${S}/>`,
  crown: `<path d="M-11 8-12-6-5 0 0-10 5 0 12-6 11 8Z" fill="#f7b733" ${S}/><circle cy="3" r="2" fill="#e5482f" ${S}/>`,
  bot:
    `<path d="M0-7v-5" ${L}/><circle cy="-12.5" r="1.9" fill="#e5482f" ${S}/>` +
    `<rect x="-10" y="-7" width="20" height="16" rx="4" fill="#9fb0c4" ${S}/><circle cx="-4" cy="0" r="2.2" fill="${INK}"/><circle cx="4" cy="0" r="2.2" fill="${INK}"/><path d="M-4 5h8" ${L}/>`,
  sound: `<path d="M-12-4h5l7-6v20l-7-6h-5Z" fill="${CREAM}" ${S}/><path d="M4-5q4 5 0 10M8-9q7 9 0 18" ${L}/>`,
  mute: `<path d="M-12-4h5l7-6v20l-7-6h-5Z" fill="${CREAM}" ${S}/><path d="M5-5 13 5M13-5 5 5" fill="none" stroke="#e5482f" stroke-width="2.6" stroke-linecap="round"/>`,
  help: `<circle r="12" fill="#f7b733" ${S}/><path d="M-4-4q0-5 4-5t4 4q0 3-4 5v2" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><circle cy="7.5" r="1.7" fill="${INK}"/>`,
  log: `<rect x="-9" y="-12" width="18" height="24" rx="2.5" fill="${CREAM}" ${S}/><path d="M-5-6h10M-5-1h10M-5 4h6" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
  trade: `<path d="M-12-9h14v-3l8 5.5-8 5.5v-3h-14Z" fill="#43b06c" ${S}/><path d="M12 9h-14v3l-8-5.5 8-5.5v3h14Z" fill="#3d7be0" ${S}/>`,
  next: `<path d="M-11-9 0 0-11 9ZM1-9 12 0 1 9Z" fill="${CREAM}" ${S}/>`,
  link:
    `<rect x="-13" y="-4.5" width="15" height="9" rx="4.5" fill="none" stroke="currentColor" stroke-width="3" transform="rotate(-35)"/>` +
    `<rect x="-2" y="-4.5" width="15" height="9" rx="4.5" fill="none" stroke="currentColor" stroke-width="3" transform="rotate(-35)"/>`,
  stall:
    `<path d="M-12-3v13h24V-3" fill="${CREAM}" ${S}/><rect x="-3" y="2" width="6" height="8" fill="#8a5a34" ${S}/>` +
    `<path d="M-14-3-10-11h20l4 8q-3.5 4-7 0-3.5 4-7 0-3.5 4-7 0-3.5 4-7 0Z" fill="#e5482f" ${S}/>` +
    `<path d="M-6.5-11-7-3M0-11v8M6.5-11 7-3" fill="none" stroke="${CREAM}" stroke-width="1.6"/>`,
  dice: `<rect x="-11" y="-11" width="22" height="22" rx="5" fill="${CREAM}" ${S}/><circle cx="-5" cy="-5" r="2" fill="${INK}"/><circle r="2" fill="${INK}"/><circle cx="5" cy="5" r="2" fill="${INK}"/>`,
  smile: `<circle r="12" fill="#f7b733" ${S}/><circle cx="-4" cy="-3" r="1.7" fill="${INK}"/><circle cx="4" cy="-3" r="1.7" fill="${INK}"/><path d="M-6 3q6 6 12 0" ${L}/>`,
  close: `<path d="M-7-7 7 7M7-7-7 7" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>`,
  check: `<circle r="12" fill="#43b06c" ${S}/><path d="M-6 0 -1.5 5 6-5" fill="none" stroke="${CREAM}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  nope: `<circle r="12" fill="#e5482f" ${S}/><path d="M-5-5 5 5M5-5-5 5" fill="none" stroke="${CREAM}" stroke-width="3" stroke-linecap="round"/>`,
  wait: `<circle r="12" fill="${CREAM}" ${S}/><circle cx="-5" r="1.8" fill="${INK}"/><circle r="1.8" fill="${INK}"/><circle cx="5" r="1.8" fill="${INK}"/>`,
  sleep: `<path d="M-9-10h8l-8 9h8M2-2h7l-7 8h7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  medal: `<path d="M-6-13h12l-3 9h-6Z" fill="#e5482f" ${S}/><circle cy="3" r="8.5" fill="#f7b733" ${S}/><path d="M0-1.5 1.6 1.6 5 2 2.5 4.3 3.2 7.6 0 6-3.2 7.6-2.5 4.3-5 2-1.6 1.6Z" fill="${CREAM}"/>`,
  // peças (a cor vem de "color" do elemento que usa)
  village:
    `<path d="M-13 11V1l5-6 5 6v10Z" fill="${CREAM}" ${S}/><path d="M-15 2-8-7-1 2Z" fill="currentColor" ${S}/>` +
    `<path d="M-3 11V-1h15v12Z" fill="${CREAM}" ${S}/><path d="M-6 0 4.5-11 15 0Z" fill="currentColor" ${S}/><path d="M2 11V4h4.5v7Z" fill="#8a5a34" ${S}/>`,
  castle:
    `<path d="M-13 12V-4h7v16ZM6 12V-4h7v16Z" fill="${CREAM}" ${S}/><path d="M-15-4-9.500-13-4-4ZM4-4 9.500-13 15-4Z" fill="currentColor" ${S}/>` +
    `<path d="M-7 12V-7h3v2h2.500v-2h3v2h2.500v-2h3v19Z" fill="${CREAM}" ${S}/><path d="M-2.500 12V6a2.500 2.500 0 0 1 5 0v6Z" fill="${INK}"/>`,
  // cartas de trapaça
  'c-knight':
    `<path d="M-9 6h18l-3-6H-6Z" fill="#a0683a" ${S}/><circle cx="-7" cy="9" r="3.3" fill="#6b4022" ${S}/><circle cx="7" cy="9" r="3.3" fill="#6b4022" ${S}/>` +
    `<path d="M-2 1 9-11" fill="none" stroke="${INK}" stroke-width="4.6" stroke-linecap="round"/><path d="M-2 1 9-11" fill="none" stroke="#d9a65a" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="9.500" cy="-10.500" r="3.8" fill="#9fb0c4" ${S}/>`,
  'c-vp':
    `<path d="M-4-8q-2-3 0-5M3-8q-2-3 0-5" ${L}/><path d="M-12 3q0-9 12-9t12 9Z" fill="#f2c57a" ${S}/>` +
    `<path d="M-13 3h26l-3 8h-20Z" fill="#c9793a" ${S}/><path d="M-6-1l3 2M2-2l3 2" fill="none" stroke="#c9793a" stroke-width="1.6" stroke-linecap="round"/>`,
  'c-roads':
    `<path d="M-1 1 9-10M6-13l6 6" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M-1 1 9-10M6-13l6 6" fill="none" stroke="#d9a65a" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M-6-2 2 6-4 12q-6 1-8-1t-1-8Z" fill="#9fb0c4" ${S}/>`,
  'c-plenty':
    `<circle cx="-4" cy="-3" r="4.4" fill="#e5482f" ${S}/><circle cx="4.500" cy="-4" r="4.8" fill="#f7b733" ${S}/><path d="M-9-1q9-15 18 0" ${L}/>` +
    `<path d="M-12-1h24l-3 12h-18Z" fill="#d9a65a" ${S}/><path d="M-9 3h18M-8 7h16" fill="none" stroke="#a0683a" stroke-width="1.4"/>`,
  'c-monopoly':
    `<path d="M-10-10v9a10 10 0 0 0 20 0v-9h-7v9a3 3 0 0 1-6 0v-9Z" fill="#e5482f" ${S}/><path d="M-10-10h7v5h-7ZM3-10h7v5h-7Z" fill="${CREAM}" ${S}/>`,
  'c-gale':
    `<path d="M-12-5h14a4 4 0 1 0-4-4M-12 1h20a4.500 4.500 0 1 1-4.500 4.500M-12 7h8" fill="none" stroke="${INK}" stroke-width="5.2" stroke-linecap="round"/>` +
    `<path d="M-12-5h14a4 4 0 1 0-4-4M-12 1h20a4.500 4.500 0 1 1-4.500 4.500M-12 7h8" fill="none" stroke="#8fe0d6" stroke-width="2.4" stroke-linecap="round"/>`,
};

export function installSprite() {
  const syms = Object.entries(ICONS)
    .map(([k, v]) => `<symbol id="i-${k}" viewBox="-16 -16 32 32">${v}</symbol>`)
    .join('');
  document.body.insertAdjacentHTML(
    'afterbegin',
    `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${syms}<clipPath id="av-clip"><circle cx="32" cy="32" r="29"/></clipPath></defs></svg>`
  );
}

export const ico = (name, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 32 32" aria-hidden="true"><use href="#i-${name}"/></svg>`;

// ---------- personagens (viewBox 0 0 64 64) ----------
const eyes = `<circle cx="27" cy="31" r="1.9" fill="${INK}"/><circle cx="37" cy="31" r="1.9" fill="${INK}"/>`;
const head = (skin) =>
  `<circle cx="19.500" cy="32.500" r="3.200" fill="${skin}" ${S}/><circle cx="44.500" cy="32.500" r="3.200" fill="${skin}" ${S}/><ellipse cx="32" cy="31" rx="12.500" ry="13.500" fill="${skin}" ${S}/>`;
const body = (shirt) =>
  `<path d="M9 68Q9 47 32 47 55 47 55 68Z" fill="${shirt}" ${S}/><path d="M26 47.500l6 6 6-6" fill="none" stroke="${CREAM}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;

const CHARS = [
  // Capitão Brasa: panela na cabeça e bigodão
  (c) =>
    body(c.hex) + head('#e7b58a') +
    `<path d="M19 26Q19 9 32 9 45 9 45 26Z" fill="#b9c5d2" ${S}/><path d="M24 16q3-4 8-4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>` +
    `<rect x="16" y="23.500" width="32" height="5" rx="2.500" fill="#8a98aa" ${S}/><rect x="47" y="24.500" width="10" height="3" rx="1.500" fill="#8a98aa" ${S}/>` +
    `<path d="M23 29.800l6 1.400M41 29.800l-6 1.400" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<circle cx="27" cy="33" r="1.9" fill="${INK}"/><circle cx="37" cy="33" r="1.9" fill="${INK}"/>` +
    `<path d="M21 40q6-7 11-1 5-6 11 1-6 4-11 0-5 4-11 0Z" fill="#5b3620" ${S}/>`,
  // Dona Maré: chapéu de pescadora e sorrisão
  (c) =>
    body(c.hex) +
    `<circle cx="17" cy="33" r="7" fill="#241812" ${S}/><circle cx="47" cy="33" r="7" fill="#241812" ${S}/>` +
    head('#9c6240') +
    `<path d="M19 24Q20 8 32 8 44 8 45 24Z" fill="${c.hex}" ${S}/><path d="M10 25q22-9 44 0-22 8-44 0Z" fill="${c.dark}" ${S}/><path d="M20 19.500q12-4 24 0" fill="none" stroke="${CREAM}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<circle cx="27" cy="32" r="1.9" fill="${INK}"/><circle cx="37" cy="32" r="1.9" fill="${INK}"/>` +
    `<path d="M25.500 37.500h13q-1 6-6.500 6t-6.500-6Z" fill="#fff" ${S}/>` +
    `<circle cx="19.500" cy="39" r="2.200" fill="#f7b733" ${S}/><circle cx="44.500" cy="39" r="2.200" fill="#f7b733" ${S}/>`,
  // Zé Coalho: chapéu de palha e palito na boca
  (c) =>
    body(c.hex) + head('#efc79d') +
    `<ellipse cx="32" cy="22" rx="25" ry="5.500" fill="#f3cf6b" ${S}/><path d="M21 21.500Q21 7 32 7 43 7 43 21.500Z" fill="#f3cf6b" ${S}/><path d="M21.200 17h21.600v4.200H21.200Z" fill="#e5482f" ${S}/>` +
    `<path d="M24 12.500h4M30 10.500h4M36 13h4" fill="none" stroke="#c99b2f" stroke-width="1.3" stroke-linecap="round"/>` +
    `<circle cx="27" cy="32" r="1.9" fill="${INK}"/><circle cx="37" cy="32" r="1.9" fill="${INK}"/>` +
    `<path d="M26 37.500q6 5 12 0" ${L}/><path d="M36 39.500l11 3.500" fill="none" stroke="#b98a2e" stroke-width="1.8" stroke-linecap="round"/>` +
    `<circle cx="23.500" cy="36" r="2.200" fill="#f0a08a" opacity=".7"/><circle cx="40.500" cy="36" r="2.200" fill="#f0a08a" opacity=".7"/>`,
  // Madame Pipoca: penteado-nuvem, laço e óculos
  (c) =>
    body(c.hex) +
    `<circle cx="18" cy="27" r="7" fill="#fbf3dc" ${S}/><circle cx="46" cy="27" r="7" fill="#fbf3dc" ${S}/><circle cx="22" cy="17" r="8" fill="#fbf3dc" ${S}/><circle cx="42" cy="17" r="8" fill="#fbf3dc" ${S}/><circle cx="32" cy="13" r="9.500" fill="#fbf3dc" ${S}/>` +
    head('#f2cfb5') +
    `<path d="M20 26q5-9 12-8 7-1 12 8-6-4-12-4t-12 4Z" fill="#fbf3dc" ${S}/>` +
    `<path d="M32 6.500l-8-4v8ZM32 6.500l8-4v8Z" fill="${c.hex}" ${S}/><circle cx="32" cy="6.500" r="2.400" fill="${c.dark}" ${S}/>` +
    `<circle cx="26.500" cy="32" r="4.800" fill="#fff" fill-opacity=".45" ${S}/><circle cx="37.500" cy="32" r="4.800" fill="#fff" fill-opacity=".45" ${S}/><path d="M31.300 32h1.400" ${L}/>` +
    `<circle cx="26.500" cy="32" r="1.600" fill="${INK}"/><circle cx="37.500" cy="32" r="1.600" fill="${INK}"/>` +
    `<path d="M28.500 40q3.500 3 7 0-3.500-2.200-7 0Z" fill="#d43a5c" ${S}/>`,
  // Tia Hortelã: lenço de bolinhas, argolas e piscadela
  (c) =>
    body(c.hex) + head('#c68a5b') +
    `<path d="M32 10q-7-9-10-3 3 5 10 3ZM32 10q7-9 10-3-3 5-10 3Z" fill="${c.dark}" ${S}/>` +
    `<path d="M18.500 29Q16 10 32 10 48 10 45.500 29 32 20 18.500 29Z" fill="${c.hex}" ${S}/>` +
    `<circle cx="25" cy="17" r="1.500" fill="${CREAM}"/><circle cx="32" cy="14.500" r="1.500" fill="${CREAM}"/><circle cx="39" cy="17" r="1.500" fill="${CREAM}"/><circle cx="28.500" cy="20.500" r="1.300" fill="${CREAM}"/><circle cx="35.500" cy="20.500" r="1.300" fill="${CREAM}"/>` +
    `<circle cx="27" cy="32" r="1.9" fill="${INK}"/><path d="M34.500 32.500q2.500-2.400 5 0" ${L}/>` +
    `<path d="M26.500 38q5.500 5 11 0" ${L}/>` +
    `<circle cx="19" cy="39.500" r="3" fill="none" stroke="#f7b733" stroke-width="2"/><circle cx="45" cy="39.500" r="3" fill="none" stroke="#f7b733" stroke-width="2"/>`,
  // Vovô Pedregulho: boina, monóculo e barbão
  (c) =>
    body(c.hex) + head('#e2ae89') +
    `<path d="M20.500 22Q21 11 32 11 43 11 43.500 22Z" fill="#8a98aa" ${S}/><path d="M18 22h22q5 0 7 3.500H18Z" fill="#6f7d90" ${S}/>` +
    `<path d="M19.500 34q0 22 12.500 22t12.500-22q-5 5-12.500 5t-12.500-5Z" fill="#fbf7ee" ${S}/>` +
    `<circle cx="27" cy="31" r="1.9" fill="${INK}"/><circle cx="37" cy="31" r="1.9" fill="${INK}"/>` +
    `<circle cx="37" cy="31" r="4.800" fill="none" stroke="#f7b733" stroke-width="1.800"/><path d="M41.500 33q3 6 1 14" fill="none" stroke="#f7b733" stroke-width="1.200"/>` +
    `<path d="M22 27.500q3.500-3 7 0" fill="none" stroke="#fbf7ee" stroke-width="3" stroke-linecap="round"/>` +
    `<ellipse cx="32" cy="35" rx="2.800" ry="2.200" fill="#cf9470" ${S}/>` +
    `<path d="M23 39.500q4.500-4 9 0 4.500-4 9 0-4.500 3.500-9 1-4.500 2.500-9-1Z" fill="#fbf7ee" ${S}/>`,
];

export function avatar(i, cls = '') {
  const c = COLORS[i] || COLORS[0];
  return (
    `<svg class="av ${cls}" viewBox="0 0 64 64" aria-hidden="true">` +
    `<circle cx="32" cy="32" r="30" fill="#1c2b3a"/><circle cx="32" cy="32" r="30" fill="${c.hex}" opacity=".3"/>` +
    `<g clip-path="url(#av-clip)">${CHARS[i % CHARS.length](c)}</g>` +
    `<circle cx="32" cy="32" r="29" fill="none" stroke="${c.hex}" stroke-width="4"/><circle cx="32" cy="32" r="31.200" fill="none" stroke="${INK}" stroke-width="1.600"/></svg>`
  );
}

// ---------- peças do tabuleiro (unidades do tabuleiro, origem no vértice) ----------
const B = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const WALL = '#ead9b4';
const WALL_SHADE = '#cdb98e';
const GLOW = '#ffd76a';

export const SHAPES = {
  village: (c) =>
    `<ellipse cx="0" cy="8" rx="19" ry="8.500" fill="${c.dark}" ${B}/><ellipse cx="0" cy="6.500" rx="19" ry="8.500" fill="${c.hex}" ${B}/>` +
    // casinha de trás
    `<path d="M-15 6V-5l5.500-6 5.500 6V6Z" fill="${WALL_SHADE}" ${B}/><path d="M-17.500-4-9.500-13.500-1.500-4Z" fill="${c.dark}" ${B}/>` +
    `<rect x="-11.500" y="-3" width="3.500" height="3.500" fill="${GLOW}" stroke="${INK}" stroke-width="1.200"/>` +
    // fumaça da chaminé
    `<g class="smoke"><circle cx="9.500" cy="-21" r="2.400" fill="#fff" opacity=".55"/></g>` +
    `<rect x="7.500" y="-19" width="4" height="8" fill="#b5553c" ${B}/>` +
    // casa principal
    `<path d="M-5 9V-5h18V9Z" fill="${WALL}" ${B}/><path d="M-8.500-4 4-18 16.500-4Z" fill="${c.hex}" ${B}/><path d="M-3-7 4-14.500" fill="none" stroke="#fff" stroke-width="1.600" stroke-linecap="round" opacity=".45"/>` +
    `<path d="M-1.500 9V1.500h5.500V9Z" fill="#7a4a21" ${B}/><rect x="6.500" y="-1.500" width="4.500" height="4.500" fill="${GLOW}" stroke="${INK}" stroke-width="1.400"/>`,
  castle: (c) =>
    `<ellipse cx="0" cy="11" rx="25" ry="10" fill="${c.dark}" ${B}/><ellipse cx="0" cy="9" rx="25" ry="10" fill="${c.hex}" ${B}/>` +
    // bandeira
    `<path d="M0-24V-39" fill="none" stroke="${INK}" stroke-width="2.200" stroke-linecap="round"/><g class="flag"><path d="M0-39q5.500 3 11 0v7q-5.500 3-11 0Z" fill="${c.hex}" ${B}/></g>` +
    // torres
    `<path d="M-21 11V-11h11V11Z" fill="${WALL_SHADE}" ${B}/><path d="M10 11V-11h11V11Z" fill="${WALL_SHADE}" ${B}/>` +
    `<path d="M-23.500-10-15.500-27-7.500-10Z" fill="${c.hex}" ${B}/><path d="M7.500-10 15.500-27 23.500-10Z" fill="${c.hex}" ${B}/>` +
    `<path d="M-17-13-15.500-21M14-13 15.500-21" fill="none" stroke="#fff" stroke-width="1.600" stroke-linecap="round" opacity=".45"/>` +
    `<rect x="-17.200" y="-5" width="3.400" height="6" rx="1.700" fill="${GLOW}" stroke="${INK}" stroke-width="1.300"/><rect x="13.800" y="-5" width="3.400" height="6" rx="1.700" fill="${GLOW}" stroke="${INK}" stroke-width="1.300"/>` +
    // torre de menagem com ameias
    `<path d="M-11 12V-24h4.400v3.400h4.400V-24h4.400v3.400h4.400V-24H11V12Z" fill="${WALL}" ${B}/>` +
    `<path d="M-11-14.500h22" fill="none" stroke="${WALL_SHADE}" stroke-width="2"/>` +
    `<rect x="-6.500" y="-11" width="4" height="5.500" rx="2" fill="${GLOW}" stroke="${INK}" stroke-width="1.300"/><rect x="2.500" y="-11" width="4" height="5.500" rx="2" fill="${GLOW}" stroke="${INK}" stroke-width="1.300"/>` +
    `<path d="M-4.500 12V4a4.500 4.500 0 0 1 9 0v8Z" fill="#3a2414" ${B}/><path d="M0 0v12" fill="none" stroke="${INK}" stroke-width="1.200"/>`,
};

export const BOULDER =
  `<ellipse cx="0" cy="16" rx="25" ry="8" fill="#0b1219" opacity=".5"/>` +
  `<path d="M-22 12q4-5 9-3M22 12q-4-5-9-3M-6 17q6-4 12 0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>` +
  `<path d="M-18 8-15-9-3-18 11-15 19-2 15 13-4 16Z" fill="#6f7c8c" stroke="${INK}" stroke-width="2.600" stroke-linejoin="round"/>` +
  `<path d="M-15-9-3-18 11-15 2-6Z" fill="#a9b6c6"/>` +
  `<path d="M2-6 5 8M-8 2l5 4M9 2l-3-3" fill="none" stroke="#3b4654" stroke-width="2" stroke-linecap="round"/>`;

const SKINS = ['#e7b58a', '#9c6240', '#efc79d', '#c68a5b'];

// Gente e carroças que circulam pelas trilhas (origem nos pés).
export const walkerShape = (c, n) =>
  `<ellipse cx="0" cy=".600" rx="4" ry="1.500" fill="#0b1219" opacity=".4"/>` +
  `<g class="wk-bob"><path d="M-3 0v-6a3 3 0 0 1 6 0V0Z" fill="${CREAM}" stroke="${INK}" stroke-width="1.300" stroke-linejoin="round"/>` +
  `<circle cx="0" cy="-10.400" r="2.900" fill="${SKINS[n % SKINS.length]}" stroke="${INK}" stroke-width="1.300"/>` +
  `<path d="M-3-4.200h6" fill="none" stroke="${c.hex}" stroke-width="1.800"/>` +
  `<path d="M-3.600-11q3.600-4.600 7.200 0Z" fill="${c.hex}" stroke="${INK}" stroke-width="1"/></g>`;

export const cartShape = (c) =>
  `<ellipse cx="0" cy=".800" rx="9" ry="1.800" fill="#0b1219" opacity=".4"/>` +
  `<g class="wk-bob"><rect x="-6" y="-12.500" width="10" height="4.500" rx="2" fill="${CREAM}" stroke="${INK}" stroke-width="1.300"/>` +
  `<path d="M-8-8.500h14l-1.500 6h-11Z" fill="#a0683a" stroke="${INK}" stroke-width="1.300" stroke-linejoin="round"/><path d="M-7-6.500h12" fill="none" stroke="${c.hex}" stroke-width="1.800"/></g>` +
  `<g class="wheel"><circle cx="-4.500" cy="-2.300" r="2.500" fill="#3a2414" stroke="${INK}" stroke-width="1.200"/><path d="M-4.500-4.300v4M-6.500-2.300h4" stroke="#d9a65a" stroke-width=".900"/></g>` +
  `<g class="wheel"><circle cx="2.500" cy="-2.300" r="2.500" fill="#3a2414" stroke="${INK}" stroke-width="1.200"/><path d="M2.500-4.300v4M.500-2.300h4" stroke="#d9a65a" stroke-width=".900"/></g>`;

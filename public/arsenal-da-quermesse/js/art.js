// Arte vetorial elaborada (SVG para grade/loja/HUD e Canvas 2D para arena vertical).
// Estilo "quermesse noturna": contorno #14202b, camadas de sombra/luz e personagens expressivos.

import { ARENA_W, ARENA_H, WALL_Y, GRID_COLS, TIERS, PIECES, pieceCells, pieceBounds } from './engine.js';

const INK = '#14202b';
const CREAM = '#f6e8c8';
const S = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const S_THIN = `stroke="${INK}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"`;

let svgUid = 0;

export function hudIco(name) {
  if (name === 'coin') {
    return (
      `<svg class="ars-ico" viewBox="0 0 24 24" aria-hidden="true">` +
      `<circle cx="12" cy="12" r="9.5" fill="#f7b733" ${S_THIN}/>` +
      `<circle cx="12" cy="12" r="6.5" fill="#ffd75e" stroke="#b86b14" stroke-width="1.2"/>` +
      `<path d="M12 7.5 V16.5 M10 9.5 H13.5 A1.5 1.5 0 0 1 13.5 12 H10.5 A1.5 1.5 0 0 0 10.5 14.5 H14" fill="none" stroke="#8a4d0c" stroke-width="1.5" stroke-linecap="round"/>` +
      `</svg>`
    );
  }
  if (name === 'wall') {
    return (
      `<svg class="ars-ico" viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M4 9 V20 H20 V9 L18 5 H15 V8 H13.5 V5 H10.5 V8 H9 V5 H6 Z" fill="#e5482f" ${S_THIN}/>` +
      `<rect x="6" y="11" width="12" height="7" rx="1.5" fill="#f7b733" stroke="${INK}" stroke-width="1.2"/>` +
      `<path d="M12 12.2 C10.6 10.7 8.5 11.7 9 13.6 C9.5 15.2 12 17 12 17 C12 17 14.5 15.2 15 13.6 C15.5 11.7 13.4 10.7 12 12.2 Z" fill="#e5482f"/>` +
      `</svg>`
    );
  }
  if (name === 'shield') {
    return (
      `<svg class="ars-ico" viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M5 5 L12 3 L19 5 V12 C19 17 15 20 12 21.5 C9 20 5 17 5 12 Z" fill="#3d7be0" ${S_THIN}/>` +
      `<path d="M12 6 V18 M8 11 H16" stroke="#9cc5ff" stroke-width="2" stroke-linecap="round"/>` +
      `</svg>`
    );
  }
  if (name === 'dps') {
    return (
      `<svg class="ars-ico" viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M13 2 L5 13 H11 L10 22 L19 10 H13 Z" fill="#ffd75e" ${S_THIN}/>` +
      `</svg>`
    );
  }
  if (name === 'wave') {
    return (
      `<svg class="ars-ico" viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M5 20 V4 M5 5 H18 L15 9 L18 13 H5" fill="#e5482f" ${S_THIN}/>` +
      `<circle cx="5" cy="4" r="1.5" fill="#f7b733" stroke="${INK}" stroke-width="1"/>` +
      `</svg>`
    );
  }
  return '';
}

function pieceIllustrationInner(pieceId, tier, gPrefix) {
  const tierCol = TIERS[tier]?.color || '#f6e8c8';

  if (pieceId === 'shield') {
    // Escudo (1x1): Cavaleiro Paladino com elmo alado, penacho, luvas e escudão heráldico com gema
    return (
      `<defs>` +
      `<linearGradient id="${gPrefix}-sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a9cff"/><stop offset="1" stop-color="#1e4898"/></linearGradient>` +
      `<linearGradient id="${gPrefix}-st" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef4fa"/><stop offset="1" stop-color="#8498ae"/></linearGradient>` +
      `</defs>` +
      // Penacho carmesim + asas laterais do elmo
      `<path d="M26 5 Q31 1 39 6 Q34 11 29 13 Z" fill="#e5482f" ${S_THIN}/>` +
      `<path d="M15 16 L9 10 L13 21 Z M45 16 L51 10 L47 21 Z" fill="#f7b733" ${S_THIN}/>` +
      // Elmo + ombreiras
      `<path d="M11 33 C11 24 19 21 30 21 C41 21 49 24 49 33 Z" fill="#5e7388" ${S}/>` +
      `<path d="M17 22 C17 10 43 10 43 22 V28 H17 Z" fill="url(#${gPrefix}-st)" ${S}/>` +
      `<path d="M21 17 H39 V23 H21 Z" fill="#14202b"/>` +
      `<circle cx="25.5" cy="20" r="1.9" fill="#9cc5ff"/><circle cx="34.5" cy="20" r="1.9" fill="#9cc5ff"/>` +
      `<circle cx="25" cy="19.3" r=".7" fill="#ffffff"/><circle cx="34" cy="19.3" r=".7" fill="#ffffff"/>` +
      // Escudão heráldico em camadas
      `<path d="M12 24 L30 19.5 L48 24 V36.5 C48 46.5 38 53 30 56 C22 53 12 46.5 12 36.5 Z" fill="#d9a65a" ${S}/>` +
      `<path d="M15.5 26.5 L30 22.8 L44.5 26.5 V36 C44.5 44 36.5 49 30 51.8 C23.5 49 15.5 44 15.5 36 Z" fill="url(#${gPrefix}-sh)" ${S_THIN}/>` +
      `<path d="M30 24.5 V49.5 M18 35 H42" stroke="#f7b733" stroke-width="3.2" stroke-linecap="round"/>` +
      `<polygon points="30,29.5 35,35 30,40.5 25,35" fill="#7ceeff" stroke="${INK}" stroke-width="1.4"/>` +
      `<path d="M18 28 L25 25.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" opacity=".75"/>` +
      `<circle cx="12" cy="35" r="3.4" fill="#dbe4ee" ${S_THIN}/><circle cx="48" cy="35" r="3.4" fill="#dbe4ee" ${S_THIN}/>`
    );
  }

  if (pieceId === 'ice_orb') {
    // Orbe Glacial (1x1): Espírito da Geada em esfera cristalina facetada sobre pedestal rúnico
    return (
      `<defs>` +
      `<radialGradient id="${gPrefix}-ice" cx="38%" cy="32%" r="65%"><stop offset="0" stop-color="#e3fbff"/><stop offset=".5" stop-color="#58d5f5"/><stop offset="1" stop-color="#1c7da8"/></radialGradient>` +
      `</defs>` +
      // Cristais ao redor + pedestal
      `<path d="M14 26 L8 18 L16 20 Z M46 26 L52 18 L44 20 Z" fill="#9ff0ff" ${S_THIN}/>` +
      `<path d="M16 50 L21 40 H39 L44 50 Z" fill="#51687d" ${S}/>` +
      `<rect x="19" y="47" width="22" height="4" rx="1.5" fill="#9cc5ff" ${S_THIN}/>` +
      // Esfera de gelo com facetas e espírito sorridente
      `<circle cx="30" cy="27" r="17" fill="url(#${gPrefix}-ice)" ${S}/>` +
      `<path d="M17 27 Q30 35 43 27" fill="none" stroke="#ffffff" stroke-width="1.3" opacity=".5"/>` +
      `<path d="M21 15 L25 8.5 L30 14 L35 8.5 L39 15 Z" fill="#e6fbff" ${S_THIN}/>` +
      `<circle cx="24.5" cy="26" r="2.7" fill="${INK}"/><circle cx="35.5" cy="26" r="2.7" fill="${INK}"/>` +
      `<circle cx="23.6" cy="24.9" r="1.1" fill="#ffffff"/><circle cx="34.6" cy="24.9" r="1.1" fill="#ffffff"/>` +
      `<ellipse cx="20.5" cy="30.5" rx="2.7" ry="1.4" fill="#ff8fd8" opacity=".7"/>` +
      `<ellipse cx="39.5" cy="30.5" rx="2.7" ry="1.4" fill="#ff8fd8" opacity=".7"/>` +
      `<path d="M26 30.5 Q30 34.5 34 30.5" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M19 19 A11 11 0 0 1 28 13" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" opacity=".85"/>`
    );
  }

  if (pieceId === 'dagger') {
    // Adaga Sombria (1x1): Ladino Sombrio mascarado com capa, fecho dourado e adagas Damascus
    return (
      `<defs>` +
      `<linearGradient id="${gPrefix}-hood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#58428c"/><stop offset="1" stop-color="#22193d"/></linearGradient>` +
      `</defs>` +
      `<path d="M11 20 L8 7 L21 14 H39 L52 7 L49 20 V45 C49 50 40 53 30 53 C20 53 11 50 11 45 Z" fill="url(#${gPrefix}-hood)" ${S}/>` +
      `<rect x="17" y="19" width="26" height="16" rx="7" fill="#ffe0be" ${S}/>` +
      `<path d="M16 28 H44 V38 Q30 43 16 38 Z" fill="#d9387a" ${S}/>` +
      `<path d="M22 33 Q30 36 38 33" fill="none" stroke="#961c4e" stroke-width="1.6"/>` +
      `<circle cx="24" cy="24" r="2.6" fill="${INK}"/><circle cx="36" cy="24" r="2.6" fill="${INK}"/>` +
      `<circle cx="23.2" cy="23.1" r="1" fill="#ffd75e"/><circle cx="35.2" cy="23.1" r="1" fill="#ffd75e"/>` +
      // Fecho dourado da capa + adagas gêmeas com brilho magenta
      `<circle cx="30" cy="43" r="3.4" fill="#f7b733" ${S_THIN}/>` +
      `<path d="M6 34 L14 21 L18 37 L12 39 Z" fill="#dbe4ee" ${S_THIN}/>` +
      `<path d="M54 34 L46 21 L42 37 L48 39 Z" fill="#dbe4ee" ${S_THIN}/>` +
      `<path d="M9 32 L14 24 M51 32 L46 24" stroke="#ff8fd8" stroke-width="1.4" stroke-linecap="round"/>`
    );
  }

  if (pieceId === 'lantern') {
    // Lampião Dourado (1x1): Lampião de bronze ornamentado com Chama Viva sorridente
    return (
      `<defs>` +
      `<radialGradient id="${gPrefix}-lt" cx="50%" cy="55%" r="55%"><stop offset="0" stop-color="#fff8d6"/><stop offset=".6" stop-color="#ffd75e"/><stop offset="1" stop-color="#f7941d"/></radialGradient>` +
      `</defs>` +
      `<circle cx="30" cy="10" r="4.2" fill="none" stroke="#f7b733" stroke-width="2.6"/>` +
      `<path d="M17 19 L30 12 L43 19 Z" fill="#d98218" ${S}/>` +
      `<rect x="16" y="19" width="28" height="25" rx="5" fill="url(#${gPrefix}-lt)" ${S}/>` +
      `<path d="M30 21 C38 26 39 36 30 41 C21 36 22 26 30 21 Z" fill="#ff9f1c" stroke="${INK}" stroke-width="1.3"/>` +
      `<circle cx="26.5" cy="31" r="2.1" fill="${INK}"/><circle cx="33.5" cy="31" r="2.1" fill="${INK}"/>` +
      `<circle cx="25.9" cy="30.2" r=".9" fill="#ffffff"/><circle cx="32.9" cy="30.2" r=".9" fill="#ffffff"/>` +
      `<path d="M27.5 35 Q30 37.5 32.5 35" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M22 19 V44 M38 19 V44" stroke="#b86b14" stroke-width="1.6" opacity=".6"/>` +
      `<rect x="14" y="44" width="32" height="6.5" rx="2.5" fill="#b86b14" ${S}/>`
    );
  }

  if (pieceId === 'witch') {
    // Bruxa (2x1 = 120x60): Bruxa Alquimista detalhada + Cajado de Cristal + Caldeirão sobre brasas
    return (
      `<defs>` +
      `<linearGradient id="${gPrefix}-wr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b65d6"/><stop offset="1" stop-color="#452b7d"/></linearGradient>` +
      `</defs>` +
      // Bruxinha elaborada (esquerda)
      `<g transform="translate(33,34)">` +
      // Cabelos volumosos + manto em camadas
      `<path d="M-15 -3 Q-20 8 -14 17 H14 Q20 8 15 -3 Z" fill="#b83b7a" ${S_THIN}/>` +
      `<path d="M-17 19 Q-14 2 0 2 Q14 2 17 19 Z" fill="url(#${gPrefix}-wr)" ${S}/>` +
      `<path d="M-7 4 L0 12 L7 4" fill="none" stroke="#f7b733" stroke-width="2" stroke-linecap="round"/>` +
      `<circle cx="0" cy="-3" r="12" fill="#ffe0be" ${S}/>` +
      `<path d="M-11 -6 Q-4 -10 0 -5 Q4 -10 11 -6" fill="none" stroke="#e0569d" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="-4.3" cy="-2" r="2.4" fill="${INK}"/><circle cx="4.3" cy="-2" r="2.4" fill="${INK}"/>` +
      `<circle cx="-5.1" cy="-2.8" r=".95" fill="#ffffff"/><circle cx="3.5" cy="-2.8" r=".95" fill="#ffffff"/>` +
      `<ellipse cx="-7.8" cy="1.5" rx="2.3" ry="1.3" fill="#ff8fd8" opacity=".75"/>` +
      `<ellipse cx="7.8" cy="1.5" rx="2.3" ry="1.3" fill="#ff8fd8" opacity=".75"/>` +
      `<path d="M-3 3 Q0 6 3 3" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>` +
      // Chapéu pontudo com fivela dourada e amuleto
      `<ellipse cx="0" cy="-11.5" rx="21" ry="4.8" fill="#41297a" ${S}/>` +
      `<path d="M-11.5 -11.5 L-2 -29 L13 -22 L10.5 -11.5 Z" fill="url(#${gPrefix}-wr)" ${S}/>` +
      `<rect x="-10" y="-14.5" width="20" height="3.8" rx="1" fill="#e5482f" stroke="${INK}" stroke-width="1.2"/>` +
      `<rect x="-2.5" y="-15" width="5" height="4.8" rx="1" fill="#f7b733" stroke="${INK}" stroke-width="1.1"/>` +
      `<circle cx="13" cy="-21" r="2.3" fill="#6df0a4" stroke="${INK}" stroke-width="1.1"/>` +
      `</g>` +
      // Cajado rúnico + Caldeirão fervendo sobre brasas (direita)
      `<g transform="translate(86,34)">` +
      `<line x1="-24" y1="19" x2="-14" y2="-17" stroke="${INK}" stroke-width="6.5" stroke-linecap="round"/>` +
      `<line x1="-24" y1="19" x2="-14" y2="-17" stroke="#8a5a34" stroke-width="3.6" stroke-linecap="round"/>` +
      `<polygon points="-14,-23 -9,-17 -14,-11 -19,-17" fill="#6df0a4" ${S_THIN}/>` +
      // Brasas laranjas sob o caldeirão
      `<ellipse cx="6" cy="18" rx="14" ry="3.5" fill="#e5482f" opacity=".85"/>` +
      `<ellipse cx="6" cy="18" rx="8" ry="2" fill="#ffd75e"/>` +
      // Caldeirão de ferro com alças e poção borbulhante
      `<circle cx="-11" cy="3" r="3.5" fill="none" stroke="#8f9fb0" stroke-width="2"/>` +
      `<circle cx="23" cy="3" r="3.5" fill="none" stroke="#8f9fb0" stroke-width="2"/>` +
      `<ellipse cx="6" cy="6" rx="16" ry="12.5" fill="#2c3e50" ${S}/>` +
      `<path d="M-8 6 C-4 13 12 13 18 6" fill="none" stroke="#4f6880" stroke-width="2" opacity=".7"/>` +
      `<ellipse cx="6" cy="-4.5" rx="14.5" ry="4.8" fill="#14202b"/>` +
      `<ellipse cx="6" cy="-4.5" rx="11.5" ry="3" fill="#6df0a4"/>` +
      `<circle cx="1" cy="-12" r="3.2" fill="#6df0a4" ${S_THIN}/>` +
      `<circle cx="10" cy="-17" r="2.4" fill="#b8f7d4" ${S_THIN}/>` +
      `</g>`
    );
  }

  if (pieceId === 'voodoo') {
    // Boneco de Voodoo (2x1 = 120x60): Boneco de retalhos costurados, botão dourado, cinto e alfinetes mágicos
    return (
      `<g transform="translate(58,31)">` +
      `<path d="M-16 -10 L-30 -18 M-16 10 L-30 18 M-2 -9 L-3 -20 M-2 9 L-3 20" stroke="#a0683a" stroke-width="9" stroke-linecap="round"/>` +
      `<path d="M-16 -10 L-30 -18 M-16 10 L-30 18 M-2 -9 L-3 -20 M-2 9 L-3 20" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>` +
      `<rect x="-23" y="-12.5" width="25" height="25" rx="11" fill="#c9793a" ${S}/>` +
      // Retalho + cinto de couro + coração costurado
      `<rect x="-15" y="-12.5" width="4.5" height="25" fill="#7355b8" stroke="${INK}" stroke-width="1.3"/>` +
      `<path d="M-9 -3 C-12 -7 -16 -3 -10 4 C-4 -3 -6 -7 -9 -3 Z" fill="#e5482f" stroke="${INK}" stroke-width="1.3"/>` +
      // Cabeça redonda + topete de fios de lã
      `<path d="M27 -6 L34 -10 M29 0 L36 0 M27 6 L34 10" stroke="#7355b8" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="14" cy="0" r="18" fill="#d99457" ${S}/>` +
      `<path d="M10 -15 V15" stroke="#a05a28" stroke-width="1.6" stroke-dasharray="2.5 3"/>` +
      // Olho de botão brilhante + olho X costurado + sorriso
      `<circle cx="19" cy="-7" r="4.8" fill="#f7b733" stroke="${INK}" stroke-width="1.6"/>` +
      `<circle cx="17.8" cy="-8" r="1" fill="${INK}"/><circle cx="20.4" cy="-6" r="1" fill="${INK}"/>` +
      `<path d="M16 4 L22 10 M22 4 L16 10" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M8 -5 Q4 0 8 5" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>` +
      // Alfinetes brilhantes com aura
      `<line x1="-15" y1="-5" x2="-25" y2="-17" stroke="${INK}" stroke-width="2.2"/>` +
      `<circle cx="-26" cy="-18" r="4.5" fill="#e5482f" ${S_THIN}/>` +
      `<line x1="-10" y1="6" x2="-19" y2="19" stroke="${INK}" stroke-width="2.2"/>` +
      `<circle cx="-20" cy="20" r="4.2" fill="#ff8fd8" ${S_THIN}/>` +
      `<line x1="2" y1="-12" x2="-2" y2="-23" stroke="${INK}" stroke-width="2"/>` +
      `<circle cx="-2.5" cy="-24" r="3.4" fill="#6df0a4" ${S_THIN}/>` +
      `</g>`
    );
  }

  if (pieceId === 'tome') {
    // Tomo de Feitiços (2x1 = 120x60): Grimório vivo encadernado em couro roxo e cantoneiras douradas
    return (
      `<defs>` +
      `<linearGradient id="${gPrefix}-tm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6a48b8"/><stop offset="1" stop-color="#38236e"/></linearGradient>` +
      `</defs>` +
      `<g transform="translate(60,31)">` +
      `<rect x="-46" y="-22" width="92" height="44" rx="7" fill="url(#${gPrefix}-tm)" ${S}/>` +
      // Cantoneiras douradas
      `<path d="M-46 -13 V-22 H-37 M37 -22 H46 V-13 M-46 13 V22 H-37 M37 22 H46 V13" fill="none" stroke="#f7b733" stroke-width="3.2" stroke-linecap="round"/>` +
      `<path d="M-41 -17 H-2 V17 H-41 Z" fill="${CREAM}" ${S}/>` +
      `<path d="M2 -17 H41 V17 H2 Z" fill="#ead8ad" ${S}/>` +
      `<line x1="0" y1="-18" x2="0" y2="18" stroke="${INK}" stroke-width="2.6"/>` +
      // Mandala arcana + estrela dourada à esquerda
      `<circle cx="-21" cy="0" r="12" fill="none" stroke="#9d5cf0" stroke-width="1.4" stroke-dasharray="3 2"/>` +
      `<path d="M-21 -10 L-18 -3 L-11 -3 L-16.5 1.5 L-14.5 8.5 L-21 4.5 L-27.5 8.5 L-25.5 1.5 L-31 -3 L-24 -3 Z" fill="#f7b733" stroke="${INK}" stroke-width="1.4"/>` +
      // Olhinhos mágicos e runas à direita
      `<circle cx="16" cy="-5" r="3.2" fill="#7355b8"/><circle cx="28" cy="-5" r="3.2" fill="#7355b8"/>` +
      `<circle cx="15" cy="-6" r="1.2" fill="#ffffff"/><circle cx="27" cy="-6" r="1.2" fill="#ffffff"/>` +
      `<path d="M18 3 Q22 7 26 3" fill="none" stroke="#7355b8" stroke-width="2.2" stroke-linecap="round"/>` +
      `<path d="M11 11 H31" stroke="#b48cff" stroke-width="2" stroke-linecap="round"/>` +
      `<circle cx="35" cy="-12" r="2.6" fill="#ffd75e"/>` +
      `</g>`
    );
  }

  if (pieceId === 'crossbow') {
    // Besta Precisa (2x1 = 120x60): Patrulheira com capa de pele, aljava e besta mecânica detalhada
    return (
      `<g transform="translate(30,33)">` +
      `<path d="M-16 19 Q-14 3 0 3 Q14 3 16 19 Z" fill="#216e47" ${S}/>` +
      `<ellipse cx="0" cy="6" rx="12" ry="4" fill="#d9a65a" ${S_THIN}/>` +
      `<circle cx="0" cy="-2" r="12" fill="#ffe0be" ${S}/>` +
      `<circle cx="-3.5" cy="-2" r="2.3" fill="${INK}"/><circle cx="5" cy="-2" r="2.3" fill="${INK}"/>` +
      `<circle cx="-4.3" cy="-2.8" r=".9" fill="#ffffff"/><circle cx="4.2" cy="-2.8" r=".9" fill="#ffffff"/>` +
      `<path d="M-2 3 Q1.5 5.5 4.5 3" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M-14 -6 L-2 -22 L14 -12 L12 -5 Z" fill="#3bab6a" ${S}/>` +
      `<path d="M-8 -16 Q-19 -25 -12 -28 Q-5 -24 -4 -17 Z" fill="#f7b733" ${S_THIN}/>` +
      `</g>` +
      `<g transform="translate(82,31)">` +
      `<path d="M12 -19 Q30 0 12 19" fill="none" stroke="#8f9fb0" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M12 -19 Q30 0 12 19" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>` +
      `<line x1="12" y1="-18" x2="-11" y2="0" stroke="${CREAM}" stroke-width="1.8"/>` +
      `<line x1="12" y1="18" x2="-11" y2="0" stroke="${CREAM}" stroke-width="1.8"/>` +
      `<rect x="-33" y="-5" width="54" height="10" rx="4" fill="#8a5a34" ${S}/>` +
      `<rect x="-18" y="-3" width="12" height="6" rx="2" fill="#f7b733" stroke="${INK}" stroke-width="1.2"/>` +
      `<line x1="-12" y1="0" x2="29" y2="0" stroke="#ffd75e" stroke-width="3.2" stroke-linecap="round"/>` +
      `<path d="M23 -5.5 L35 0 L23 5.5 Z" fill="#eef4fa" ${S_THIN}/>` +
      `</g>`
    );
  }

  if (pieceId === 'sword') {
    // Espada (3x1 = 180x60): Guerreiro Campeão de armadura completa + capa + Montante Rúnica
    return (
      `<defs>` +
      `<linearGradient id="${gPrefix}-sw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f7fc"/><stop offset=".5" stop-color="#cfdce8"/><stop offset="1" stop-color="#7f94aa"/></linearGradient>` +
      `</defs>` +
      // Guerreiro (esquerda)
      `<g transform="translate(33,33)">` +
      `<path d="M-21 19 L-16 2 L16 2 L20 19 Z" fill="#e5482f" ${S}/>` +
      `<path d="M-16 19 Q-14 3 0 3 Q14 3 16 19 Z" fill="#3d7be0" ${S}/>` +
      `<ellipse cx="-14" cy="6" rx="6" ry="5" fill="#9fb0c4" ${S_THIN}/>` +
      `<ellipse cx="14" cy="6" rx="6" ry="5" fill="#9fb0c4" ${S_THIN}/>` +
      `<path d="M-9 -21 Q0 -31 15 -21 Q8 -14 0 -14 Z" fill="#e5482f" ${S}/>` +
      `<circle cx="0" cy="-3" r="13" fill="#dbe4ee" ${S}/>` +
      `<rect x="-9" y="-6" width="18" height="8" rx="3.5" fill="#14202b"/>` +
      `<circle cx="-4" cy="-2" r="2.2" fill="#ffd75e"/><circle cx="4.5" cy="-2" r="2.2" fill="#ffd75e"/>` +
      `<circle cx="15" cy="10" r="4.6" fill="#f7b733" ${S_THIN}/>` +
      `</g>` +
      // Montante gigante através dos 3 espaços
      `<g transform="translate(109,31)">` +
      `<rect x="-57" y="-5" width="18" height="10" rx="3" fill="#7a4a21" ${S}/>` +
      `<path d="M-52 -5 L-48 5 M-45 -5 L-41 5" stroke="#f7b733" stroke-width="2"/>` +
      `<polygon points="-64,0 -58,-6 -52,0 -58,6" fill="#f7b733" ${S_THIN}/>` +
      `<path d="M-40 -18 Q-34 -18 -33 -12 V12 Q-34 18 -40 18 Q-38 0 -40 -18 Z" fill="#f7b733" ${S}/>` +
      `<path d="M-32 -9.5 H46 L68 0 L46 9.5 H-32 Z" fill="url(#${gPrefix}-sw)" ${S}/>` +
      `<line x1="-26" y1="0" x2="48" y2="0" stroke="#7f94aa" stroke-width="2.2" stroke-linecap="round"/>` +
      `<line x1="-26" y1="-4.5" x2="43" y2="-4.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>` +
      `<circle cx="-35" cy="0" r="3.6" fill="${tierCol}" stroke="${INK}" stroke-width="1.3"/>` +
      `</g>`
    );
  }

  if (pieceId === 'axe') {
    // Machado Rúnico (L-3): Anão Berserker com barba trançada + elmo de chifres + Machadão Rúnico
    return (
      `<defs>` +
      `<linearGradient id="${gPrefix}-ax" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef4fa"/><stop offset="1" stop-color="#7f94aa"/></linearGradient>` +
      `</defs>` +
      `<path d="M30 88 L46 28" stroke="${INK}" stroke-width="10.5" stroke-linecap="round"/>` +
      `<path d="M30 88 L46 28" stroke="#8a5a34" stroke-width="6" stroke-linecap="round"/>` +
      // Lâmina dupla rúnica no topo do L
      `<path d="M35 22 C60 6 93 8 108 24 C96 44 74 53 43 46 Z" fill="url(#${gPrefix}-ax)" ${S}/>` +
      `<path d="M80 12 C92 14 102 19 108 24 C100 36 88 45 74 46 C83 34 83 22 80 12 Z" fill="#fff3d1"/>` +
      `<path d="M44 29 C63 23 77 26 83 33" fill="none" stroke="#e5482f" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="46" cy="28" r="6" fill="#f7b733" ${S}/>` +
      // Anão Viking fofo com barba trançada + elmo alado na base do L
      `<g transform="translate(30,88)">` +
      `<path d="M-16 20 Q-14 4 0 4 Q14 4 16 20 Z" fill="#e5482f" ${S}/>` +
      `<path d="M-12 10 L12 10" stroke="#f7b733" stroke-width="3"/>` +
      `<circle cx="0" cy="-2" r="12" fill="#ffe0be" ${S}/>` +
      `<path d="M-11 0 Q-12 16 0 19 Q12 16 11 0 Q5 4 0 4 Q-5 4 -11 0 Z" fill="#d96b27" ${S}/>` +
      `<circle cx="-4.5" cy="14" r="2.2" fill="#f7b733" stroke="${INK}" stroke-width="1"/>` +
      `<circle cx="4.5" cy="14" r="2.2" fill="#f7b733" stroke="${INK}" stroke-width="1"/>` +
      `<circle cx="-4" cy="-3" r="2.2" fill="${INK}"/><circle cx="4" cy="-3" r="2.2" fill="${INK}"/>` +
      `<circle cx="-4.7" cy="-3.8" r=".8" fill="#ffffff"/><circle cx="3.3" cy="-3.8" r=".8" fill="#ffffff"/>` +
      `<path d="M-12 -5 A12 12 0 0 1 12 -5 Z" fill="#8f9fb0" ${S}/>` +
      `<path d="M-10 -8 Q-20 -18 -13 -22 Q-9 -16 -6 -12 Z" fill="#f7b733" ${S_THIN}/>` +
      `<path d="M10 -8 Q20 -18 13 -22 Q9 -16 6 -12 Z" fill="#f7b733" ${S_THIN}/>` +
      `</g>`
    );
  }

  return '';
}

export function pieceSvg(pieceId, tier = 1, rot = 0, boxPx = null) {
  const def = PIECES[pieceId];
  if (!def) return '';
  const { w, h } = pieceBounds(pieceId, rot);
  const baseB = pieceBounds(pieceId, 0);
  const baseW = baseB.w * 60;
  const baseH = baseB.h * 60;
  const viewW = w * 60;
  const viewH = h * 60;

  let transform = '';
  const r = ((rot % def.rotCount) + def.rotCount) % def.rotCount;
  if (r === 1) transform = `translate(${baseH}, 0) rotate(90)`;
  else if (r === 2) transform = `translate(${baseW}, ${baseH}) rotate(180)`;
  else if (r === 3) transform = `translate(0, ${baseW}) rotate(270)`;

  const gPrefix = `p${++svgUid}`;
  const sizeAttr = boxPx ? `width="${boxPx.w}" height="${boxPx.h}"` : '';
  return (
    `<svg class="ars-piece-svg" viewBox="0 0 ${viewW} ${viewH}" ${sizeAttr} aria-hidden="true">` +
    `<g transform="${transform}">${pieceIllustrationInner(pieceId, tier, gPrefix)}</g>` +
    `</svg>`
  );
}

export function shapeMiniSvg(pieceId, tier = 1) {
  const cells = pieceCells(pieceId, 0);
  const maxC = Math.max(...cells.map(([c]) => c)) + 1;
  const maxR = Math.max(...cells.map(([, r]) => r)) + 1;
  const sz = 10;
  const gap = 2;
  const w = maxC * (sz + gap) - gap + 2;
  const h = maxR * (sz + gap) - gap + 2;
  const col = TIERS[tier]?.border || '#f7b733';
  const rects = cells
    .map(([c, r]) => `<rect x="${1 + c * (sz + gap)}" y="${1 + r * (sz + gap)}" width="${sz}" height="${sz}" rx="2.5" fill="${col}" stroke="${INK}" stroke-width="1.3"/>`)
    .join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${rects}</svg>`;
}

// ---------- Renderização do Campo de Batalha Vertical em Canvas 2D ----------

function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function drawEnemy(c, e, time) {
  const def = e.def;
  const bob = e.stunLeft > 0 ? 0 : Math.sin(e.walkPhase * 1.4) * (def.flying ? 4.5 : 2.2);
  const stride = e.stunLeft > 0 ? 0 : Math.sin(e.walkPhase * 1.4) * 3;
  const floatY = def.flying ? -8 : 0;
  const x = e.x;
  const y = e.y + floatY + bob;
  const r = def.radius;

  // Sombra no chão
  c.fillStyle = 'rgba(0,0,0,0.36)';
  c.beginPath();
  c.ellipse(e.x, e.y + r * 0.78, r * 0.9, r * 0.34, 0, 0, Math.PI * 2);
  c.fill();

  c.save();
  c.translate(x, y);

  // Símbolo rúnico girando sob inimigo amaldiçoado pelo Voodoo
  if (e.curseLeft > 0) {
    c.save();
    c.rotate(time * 2.4);
    c.strokeStyle = 'rgba(255, 110, 175, 0.85)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, r + 6, 0, Math.PI * 2);
    c.moveTo(-r - 6, 0);
    c.lineTo(r + 6, 0);
    c.moveTo(0, -r - 6);
    c.lineTo(0, r + 6);
    c.stroke();
    c.restore();
  }

  // Pezinhos marchando (para terrestres)
  if (!def.flying && e.type !== 'bomber') {
    c.fillStyle = def.trim;
    c.strokeStyle = INK;
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(-r * 0.42, r * 0.8 + stride, r * 0.25, 0, Math.PI * 2);
    c.arc(r * 0.42, r * 0.8 - stride, r * 0.25, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  // Asas com nervuras (Morcego / Gárgula)
  if (def.flying) {
    const flap = Math.sin(time * 16 + e.id) * 6.5;
    c.fillStyle = e.hitFlash > 0 ? '#ffffff' : def.trim;
    c.strokeStyle = INK;
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(-4, -2);
    c.quadraticCurveTo(-r - 13, -14 + flap, -r - 5, 5);
    c.lineTo(-r * 0.6, 2);
    c.lineTo(-2, 5);
    c.moveTo(4, -2);
    c.quadraticCurveTo(r + 13, -14 + flap, r + 5, 5);
    c.lineTo(r * 0.6, 2);
    c.lineTo(2, 5);
    c.fill();
    c.stroke();
  }

  // Orelhas pontudas / chifres
  if (e.type === 'goblin' || e.type === 'bat' || e.type === 'boss_goblin' || e.type === 'gargoyle') {
    c.fillStyle = e.hitFlash > 0 ? '#ffffff' : def.color;
    c.strokeStyle = INK;
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(-r * 0.65, -r * 0.4);
    c.lineTo(-r * 1.2, -r * 1.05);
    c.lineTo(-r * 0.15, -r * 0.8);
    c.moveTo(r * 0.65, -r * 0.4);
    c.lineTo(r * 1.2, -r * 1.05);
    c.lineTo(r * 0.15, -r * 0.8);
    c.fill();
    c.stroke();
  }

  const bodyCol = e.hitFlash > 0 ? '#ffffff' : e.slowLeft > 0 ? '#84e5ff' : def.color;
  c.fillStyle = bodyCol;
  c.strokeStyle = INK;
  c.lineWidth = def.boss ? 2.6 : 2;

  if (e.type === 'bomber') {
    roundRect(c, -r, -r, r * 2, r * 2, 6);
    c.fill();
    c.stroke();
    c.strokeStyle = '#f7b733';
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(-r + 2, -4);
    c.lineTo(r - 2, -4);
    c.moveTo(-r + 2, 5);
    c.lineTo(r - 2, 5);
    c.stroke();
    c.fillStyle = '#fff8ea';
    c.beginPath();
    c.arc(-4, 0, 2.7, 0, Math.PI * 2);
    c.arc(4, 0, 2.7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = INK;
    c.beginPath();
    c.arc(-4, 0.5, 1.3, 0, Math.PI * 2);
    c.arc(4, 0.5, 1.3, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -r);
    c.quadraticCurveTo(4, -r - 7, 8, -r - 5);
    c.stroke();
    c.fillStyle = time % 0.2 < 0.1 ? '#ffd75e' : '#e5482f';
    c.beginPath();
    c.arc(8, -r - 5, 3.6, 0, Math.PI * 2);
    c.fill();
  } else {
    // Capa real para chefes e Xamã
    if (def.boss || e.type === 'shaman') {
      c.fillStyle = def.trim;
      c.beginPath();
      c.moveTo(-r * 0.9, -2);
      c.lineTo(-r * 1.15, r * 0.9);
      c.lineTo(r * 1.15, r * 0.9);
      c.lineTo(r * 0.9, -2);
      c.closePath();
      c.fill();
      c.stroke();
    }

    c.fillStyle = bodyCol;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Brilho sutil superior
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.beginPath();
    c.ellipse(-r * 0.25, -r * 0.45, r * 0.45, r * 0.22, -0.3, 0, Math.PI * 2);
    c.fill();

    // Armadura / Chapéu / Coroa
    if (def.boss) {
      c.fillStyle = '#f7b733';
      c.beginPath();
      c.moveTo(-12, -r + 4);
      c.lineTo(-8, -r - 9);
      c.lineTo(0, -r - 2);
      c.lineTo(8, -r - 9);
      c.lineTo(12, -r + 4);
      c.closePath();
      c.fill();
      c.stroke();
    } else if (e.type === 'shaman') {
      c.fillStyle = '#4d3688';
      c.beginPath();
      c.moveTo(-r * 0.95, -2);
      c.lineTo(0, -r - 10);
      c.lineTo(r * 0.95, -2);
      c.closePath();
      c.fill();
      c.stroke();
      // Cajado com orbe roxo
      c.strokeStyle = '#8a5a34';
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(r + 3, -6);
      c.lineTo(r + 3, r);
      c.stroke();
      c.fillStyle = '#ff6d9c';
      c.beginPath();
      c.arc(r + 3, -8, 3.2, 0, Math.PI * 2);
      c.fill();
    } else if (e.armor > 0) {
      c.fillStyle = '#c8d6e5';
      c.beginPath();
      c.arc(0, -2, r * 0.9, Math.PI, Math.PI * 2);
      c.closePath();
      c.fill();
      c.stroke();
    }

    // Clava / arma para Diabrete & Ogro
    if (e.type === 'ogre' || e.type === 'goblin') {
      c.fillStyle = '#8a5a34';
      c.strokeStyle = INK;
      c.lineWidth = 1.4;
      c.beginPath();
      c.roundRect?.(r * 0.72, -4, 4, 11, 2);
      if (!c.roundRect) c.rect(r * 0.72, -4, 4, 11);
      c.fill();
      c.stroke();
    }

    // Olhinhos expressivos virados para baixo
    c.fillStyle = def.boss || e.type === 'shaman' ? '#ffd75e' : '#fff8ea';
    c.beginPath();
    c.arc(-r * 0.3, r * 0.16, def.boss ? 4 : 2.7, 0, Math.PI * 2);
    c.arc(r * 0.3, r * 0.16, def.boss ? 4 : 2.7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = INK;
    c.beginPath();
    c.arc(-r * 0.3, r * 0.22, def.boss ? 1.7 : 1.25, 0, Math.PI * 2);
    c.arc(r * 0.3, r * 0.22, def.boss ? 1.7 : 1.25, 0, Math.PI * 2);
    c.fill();

    if (e.type === 'ogre' || e.type === 'goblin' || e.type === 'boss_goblin') {
      c.fillStyle = '#fff8ea';
      c.beginPath();
      c.moveTo(-r * 0.34, r * 0.56);
      c.lineTo(-r * 0.22, r * 0.35);
      c.lineTo(-r * 0.1, r * 0.56);
      c.moveTo(r * 0.1, r * 0.56);
      c.lineTo(r * 0.22, r * 0.35);
      c.lineTo(r * 0.34, r * 0.56);
      c.fill();
    } else if (e.type === 'skeleton') {
      c.fillStyle = INK;
      c.fillRect(-3.2, r * 0.52, 2, 3.2);
      c.fillRect(1.2, r * 0.52, 2, 3.2);
    }
  }

  if (e.stunLeft > 0) {
    c.fillStyle = '#ffd75e';
    for (let k = 0; k < 3; k++) {
      const a = time * 8 + (k * Math.PI * 2) / 3;
      c.beginPath();
      c.arc(Math.cos(a) * (r * 0.72), -r - 6 + Math.sin(a) * 2.5, 2.5, 0, Math.PI * 2);
      c.fill();
    }
  }

  if (e.poisonStacks.length > 0) {
    c.fillStyle = '#6df0a4';
    c.beginPath();
    c.arc(4 + Math.sin(time * 6) * 3, -r - 3, 2.6, 0, Math.PI * 2);
    c.fill();
  }

  const barW = Math.max(24, r * 2.15);
  const barY = -r - (def.boss ? 16 : 10);
  c.fillStyle = INK;
  c.fillRect(-barW / 2 - 1, barY - 1, barW + 2, 5.5);
  const hpFrac = Math.max(0, e.hp / e.maxHp);
  c.fillStyle = def.boss ? '#f7b733' : '#e5482f';
  c.fillRect(-barW / 2, barY, barW * hpFrac, 3.5);

  if (e.maxArmor > 0 && e.armor > 0) {
    const armFrac = Math.max(0, e.armor / e.maxArmor);
    c.fillStyle = '#9cc5ff';
    c.fillRect(-barW / 2, barY - 3.5, barW * armFrac, 2.5);
  }

  c.restore();
}

function drawWallDefender(c, p, ox, animTime) {
  const def = PIECES[p.pieceId];
  const glowing = p.flash > 0.1;
  const bounce = glowing ? -4 : Math.sin(animTime * 4 + p.uid) * 1;
  c.save();
  c.translate(ox, WALL_Y - 1 + bounce);
  c.strokeStyle = INK;
  c.lineWidth = 1.6;

  // Halo ao disparar
  if (glowing) {
    c.fillStyle = 'rgba(255, 215, 94, 0.55)';
    c.beginPath();
    c.arc(0, -4, 12, 0, Math.PI * 2);
    c.fill();
  }

  // Minidefensor fofinho sobre a Muralha alinhado com a peça da grade
  if (p.pieceId === 'witch') {
    c.fillStyle = '#7355b8';
    c.beginPath();
    c.moveTo(-7, 2);
    c.lineTo(0, -10);
    c.lineTo(7, 2);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#6df0a4';
    c.beginPath();
    c.arc(6, -3, 2.5, 0, Math.PI * 2);
    c.fill();
  } else if (p.pieceId === 'sword' || p.pieceId === 'axe') {
    c.fillStyle = p.pieceId === 'sword' ? '#3d7be0' : '#e5482f';
    c.beginPath();
    c.arc(0, -2, 6, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = '#f7b733';
    c.beginPath();
    c.arc(0, -8, 3, 0, Math.PI * 2);
    c.fill();
  } else {
    c.fillStyle = glowing ? '#ffd75e' : def.color;
    c.beginPath();
    c.arc(0, -2, 5.5, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  c.restore();
}

export function drawArenaFrame(c, run, animTime) {
  c.save();

  // Céu noturno + horizonte da quermesse
  const sky = c.createLinearGradient(0, 0, 0, 56);
  sky.addColorStop(0, '#08121d');
  sky.addColorStop(1, '#162b3e');
  c.fillStyle = sky;
  c.fillRect(0, 0, ARENA_W, 56);

  c.fillStyle = 'rgba(246, 232, 200, 0.55)';
  for (const [sx, sy] of [[28, 16], [76, 28], [128, 12], [234, 14], [286, 26], [332, 18]]) {
    c.beginPath();
    c.arc(sx, sy, 1.3, 0, Math.PI * 2);
    c.fill();
  }

  c.fillStyle = '#112232';
  for (const tx of [48, 312]) {
    c.beginPath();
    c.moveTo(tx - 32, 54);
    c.lineTo(tx, 25);
    c.lineTo(tx + 32, 54);
    c.closePath();
    c.fill();
  }

  // Gramado lateral + Avenida vertical de paralelepípedo
  c.fillStyle = '#112130';
  c.fillRect(0, 50, ARENA_W, ARENA_H - 50);

  const road = c.createLinearGradient(0, 44, 0, WALL_Y);
  road.addColorStop(0, '#1d3144');
  road.addColorStop(0.5, '#273c4f');
  road.addColorStop(1, '#31495f');
  c.fillStyle = road;
  c.fillRect(24, 44, ARENA_W - 48, WALL_Y - 44);

  // Pedras sutis na pista para dar profundidade
  c.fillStyle = 'rgba(255, 248, 234, 0.04)';
  for (let py = 68; py < WALL_Y - 12; py += 34) {
    c.fillRect(46 + ((py * 13) % 60), py, 18, 6);
    c.fillRect(210 + ((py * 7) % 70), py + 12, 20, 6);
  }

  // Bordas douradas da pista + Postes de lampião com brilho quente nas laterais
  c.strokeStyle = '#f7b733';
  c.lineWidth = 2.6;
  c.beginPath();
  c.moveTo(24, 44);
  c.lineTo(24, WALL_Y);
  c.moveTo(ARENA_W - 24, 44);
  c.lineTo(ARENA_W - 24, WALL_Y);
  c.stroke();

  for (const py of [112, 212, 304]) {
    for (const px of [16, ARENA_W - 16]) {
      const glow = c.createRadialGradient(px, py, 2, px, py, 26);
      glow.addColorStop(0, 'rgba(247, 183, 51, 0.34)');
      glow.addColorStop(1, 'rgba(247, 183, 51, 0)');
      c.fillStyle = glow;
      c.beginPath();
      c.arc(px, py, 26, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = '#ffd75e';
      c.strokeStyle = INK;
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(px, py, 3.8, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
  }

  // 3 faixas verticais de marcha
  c.strokeStyle = 'rgba(246, 232, 200, 0.1)';
  c.lineWidth = 2;
  c.setLineDash([8, 10]);
  for (const lx of [82, 180, 278]) {
    c.beginPath();
    c.moveTo(lx, 48);
    c.lineTo(lx, WALL_Y - 4);
    c.stroke();
  }
  c.setLineDash([]);

  // Portal sombrio no TOPO com vórtice animado
  c.save();
  c.translate(ARENA_W * 0.5, 34);
  c.fillStyle = '#180e2b';
  c.strokeStyle = '#9d5cf0';
  c.lineWidth = 2.8;
  c.beginPath();
  c.ellipse(0, 0, 88, 16, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = 'rgba(157, 92, 240, 0.34)';
  c.beginPath();
  c.ellipse(0, 1, 66 + Math.sin(animTime * 4) * 5, 10, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#e0569d';
  c.beginPath();
  c.arc(Math.cos(animTime * 3) * 52, Math.sin(animTime * 3) * 5, 2.5, 0, Math.PI * 2);
  c.arc(Math.cos(animTime * 3 + Math.PI) * 52, Math.sin(animTime * 3 + Math.PI) * 5, 2.5, 0, Math.PI * 2);
  c.fill();
  c.restore();

  // Cordão de luzes colorido no topo
  c.strokeStyle = INK;
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(0, 8);
  c.quadraticCurveTo(ARENA_W * 0.5, 22, ARENA_W, 8);
  c.stroke();
  const bulbs = ['#f7b733', '#e5482f', '#1fae96', '#f6e8c8', '#3d7be0'];
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9;
    const bx = t * ARENA_W;
    const by = 8 + 4 * t * (1 - t) * 10;
    c.fillStyle = bulbs[i % bulbs.length];
    c.beginPath();
    c.arc(bx, by + 2.5, 3.2, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  const combat = run.combat;
  if (combat) {
    // Zonas persistentes no chão (poça de veneno / gelo)
    for (const z of combat.zones || []) {
      const a = Math.min(1, z.life / 0.5) * 0.32;
      c.save();
      c.globalAlpha = a;
      c.fillStyle = z.color;
      c.beginPath();
      c.ellipse(z.x, z.y, z.r, z.r * 0.65, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    // Ondas de choque de impacto / abate
    for (const sw of combat.shockwaves || []) {
      const prog = 1 - sw.life / sw.maxLife;
      const rad = 8 + (sw.maxR - 8) * prog;
      c.save();
      c.globalAlpha = Math.max(0, 1 - prog);
      c.strokeStyle = sw.color;
      c.lineWidth = 3 * (1 - prog) + 1;
      c.beginPath();
      c.arc(sw.x, sw.y, rad, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }

    // Ondas cortantes da Espada subindo para cima
    for (const sl of combat.slashes) {
      const a = sl.life / sl.maxLife;
      c.save();
      c.globalAlpha = a;
      c.strokeStyle = sl.color;
      c.lineWidth = 7 * a + 2;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(sl.x, sl.y, sl.reach * (1 - a * 0.45), -Math.PI * 0.84, -Math.PI * 0.16);
      c.stroke();
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2.5 * a;
      c.beginPath();
      c.arc(sl.x, sl.y, sl.reach * (1 - a * 0.45) - 4, -Math.PI * 0.78, -Math.PI * 0.22);
      c.stroke();
      c.restore();
    }

    // Raios de Tomo / Vínculo Voodoo com brilho externo
    for (const bm of combat.beams) {
      const a = bm.life / bm.maxLife;
      c.save();
      c.globalAlpha = a;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      bm.pts.forEach((pt, idx) => {
        if (idx === 0) c.moveTo(pt.x, pt.y);
        else {
          const prev = bm.pts[idx - 1];
          const mx = (prev.x + pt.x) * 0.5 + (Math.random() - 0.5) * 12;
          const my = (prev.y + pt.y) * 0.5 + (Math.random() - 0.5) * 12;
          c.lineTo(mx, my);
          c.lineTo(pt.x, pt.y);
        }
      });
      c.strokeStyle = bm.color;
      c.lineWidth = 5;
      c.stroke();
      c.strokeStyle = '#fff8ea';
      c.lineWidth = 2;
      c.stroke();
      c.restore();
    }

    // Inimigos ordenados por profundidade Y
    const sorted = combat.enemies.slice().sort((a, b) => a.y - b.y);
    for (const e of sorted) drawEnemy(c, e, animTime);

    // Projéteis detalhados
    for (const pr of combat.projectiles) {
      c.save();
      c.translate(pr.x, pr.y);
      if (pr.kind === 'axe') {
        c.rotate(pr.spin || 0);
        c.fillStyle = '#dbe4ee';
        c.strokeStyle = INK;
        c.lineWidth = 1.6;
        c.beginPath();
        c.arc(0, 0, 8, 0, Math.PI * 1.35);
        c.lineTo(0, 0);
        c.closePath();
        c.fill();
        c.stroke();
        c.fillStyle = '#e5482f';
        c.beginPath();
        c.arc(0, 0, 3, 0, Math.PI * 2);
        c.fill();
      } else if (pr.kind === 'bolt') {
        c.rotate(Math.atan2(pr.vy, pr.vx));
        c.strokeStyle = 'rgba(247, 183, 51, 0.45)';
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(-16, 0);
        c.lineTo(6, 0);
        c.stroke();
        c.strokeStyle = '#ffd75e';
        c.lineWidth = 2.6;
        c.beginPath();
        c.moveTo(-10, 0);
        c.lineTo(8, 0);
        c.stroke();
      } else if (pr.kind === 'dagger') {
        if (pr.tx !== undefined) c.rotate(Math.atan2(pr.ty - pr.y, pr.tx - pr.x));
        c.fillStyle = pr.color;
        c.strokeStyle = INK;
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(8, 0);
        c.lineTo(-6, -3.5);
        c.lineTo(-4, 0);
        c.lineTo(-6, 3.5);
        c.closePath();
        c.fill();
        c.stroke();
      } else {
        c.fillStyle = 'rgba(255,255,255,0.28)';
        c.beginPath();
        c.arc(0, 0, 8, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = pr.color;
        c.strokeStyle = INK;
        c.lineWidth = 1.6;
        c.beginPath();
        c.arc(0, 0, pr.kind === 'witch' ? 5.8 : 4.8, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
      c.restore();
    }

    // Partículas
    for (const pt of combat.particles) {
      c.save();
      c.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      c.fillStyle = pt.color;
      c.beginPath();
      c.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  // Muralha / Bastião da Quermesse na BASE (seu lado!)
  const wallHit = run.combat?.wallFlash > 0;
  c.fillStyle = wallHit ? '#683035' : '#263f54';
  c.strokeStyle = INK;
  c.lineWidth = 2.5;
  roundRect(c, 8, WALL_Y, ARENA_W - 16, ARENA_H - WALL_Y - 4, 8);
  c.fill();
  c.stroke();

  const segW = (ARENA_W - 28) / 8;
  for (let i = 0; i < 8; i++) {
    const sx = 14 + i * segW;
    c.fillStyle = i % 2 === 0 ? '#e5482f' : '#f7b733';
    c.fillRect(sx, WALL_Y - 3, segW - 2, 11);
    c.strokeRect(sx, WALL_Y - 3, segW - 2, 11);
  }
  c.fillStyle = '#8a5a34';
  c.fillRect(14, WALL_Y + 11, ARENA_W - 28, ARENA_H - WALL_Y - 20);
  c.strokeRect(14, WALL_Y + 11, ARENA_W - 28, ARENA_H - WALL_Y - 20);

  // Mini-defensores sobre a Muralha alinhados com as peças da grade
  for (const p of run.grid.pieces) {
    const def = PIECES[p.pieceId];
    if (!def || def.cd <= 0) continue;
    const { w } = pieceBounds(p.pieceId, p.rot);
    const ox = 28 + ((p.col + w * 0.5) / GRID_COLS) * (ARENA_W - 56);
    drawWallDefender(c, p, ox, animTime);
  }

  // Domo de Armadura (Escudo ativo curvando para cima na Muralha)
  if (run.wallArmor > 0) {
    const pulse = 0.38 + Math.sin(animTime * 5) * 0.1;
    c.strokeStyle = '#78b4ff';
    c.fillStyle = `rgba(61, 123, 224, ${pulse * 0.34})`;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(14, WALL_Y - 4);
    c.quadraticCurveTo(ARENA_W * 0.5, WALL_Y - 28, ARENA_W - 14, WALL_Y - 4);
    c.stroke();
    c.fill();
  }

  // Números flutuantes por cima da Muralha e inimigos
  if (combat) {
    c.textAlign = 'center';
    for (const pop of combat.popups) {
      c.save();
      c.globalAlpha = Math.min(1, pop.life / (pop.maxLife * 0.6));
      c.font = pop.big ? '700 13px Bungee, sans-serif' : '700 11px "Barlow Condensed", sans-serif';
      c.lineWidth = 3;
      c.strokeStyle = INK;
      c.strokeText(pop.text, pop.x, pop.y);
      c.fillStyle = pop.color;
      c.fillText(pop.text, pop.x, pop.y);
      c.restore();
    }
  }

  c.restore();
}

// Motor de regras, solucionador 0-batida e 40 fases para Estacionamento (Parking Jam).

export const MAX_CRASHES = 3;

export const VEHICLE_COLORS = [
  { id: 'red', body: '#e5482f', dark: '#a82c1b', trim: '#ffd2c9' },
  { id: 'blue', body: '#3d7be0', dark: '#2452a8', trim: '#cfe2ff' },
  { id: 'yellow', body: '#f7b733', dark: '#c4861a', trim: '#fff3cc' },
  { id: 'green', body: '#3bab6a', dark: '#23784a', trim: '#d5f7e3' },
  { id: 'plum', body: '#7a55c4', dark: '#543593', trim: '#e6dcff' },
  { id: 'teal', body: '#1fae96', dark: '#137766', trim: '#ccfaf1' },
  { id: 'cream', body: '#f6e8c8', dark: '#c5b084', trim: '#ffffff' },
];

export const CHAPTERS = [
  { id: 1, name: 'Capítulo 1 · Pátio da Entrada', from: 1, to: 10 },
  { id: 2, name: 'Capítulo 2 · Hora do Rush', from: 11, to: 20 },
  { id: 3, name: 'Capítulo 3 · Pátio Central', from: 21, to: 30 },
  { id: 4, name: 'Capítulo 4 · Hora do Caos', from: 31, to: 40 },
];

export function vehicleCells(v) {
  const out = [];
  for (let i = 0; i < v.len; i++) {
    out.push(v.dir === 'H' ? { r: v.r, c: v.c + i } : { r: v.r + i, c: v.c });
  }
  return out;
}

export function isCurbBlocked(level, side, idx) {
  const list = level.blockedEdges?.[side];
  return Array.isArray(list) ? list.includes(idx) : false;
}

/**
 * Avalia deslizar veículo `vehicleId` na direção `sign` (-1 = topo/esquerda, +1 = baixo/direita).
 * Se caminho livre até borda aberta -> { ok: true, edgeSide, steps }.
 * Caso contrário -> { ok: false, reason: 'vehicle'|'cone'|'curb', blockerId?, steps, hitCell }.
 */
export function evaluateExit(vehicles, vehicleId, sign, level) {
  const target = vehicles.find((v) => v.id === vehicleId);
  if (!target) return { ok: false, reason: 'missing', steps: 0 };

  const size = level.size;
  const occ = new Map();
  for (const v of vehicles) {
    if (v.id === target.id) continue;
    for (const cell of vehicleCells(v)) {
      occ.set(`${cell.r},${cell.c}`, v.id);
    }
  }
  const cones = new Set((level.cones || []).map((cn) => `${cn.r},${cn.c}`));

  const dr = target.dir === 'V' ? sign : 0;
  const dc = target.dir === 'H' ? sign : 0;
  let r = sign < 0 ? target.r : target.dir === 'V' ? target.r + target.len - 1 : target.r;
  let c = sign < 0 ? target.c : target.dir === 'H' ? target.c + target.len - 1 : target.c;

  for (let step = 1; step <= size + 1; step++) {
    r += dr;
    c += dc;
    if (r < 0 || r >= size || c < 0 || c >= size) {
      const edgeSide = c < 0 ? 'left' : c >= size ? 'right' : r < 0 ? 'top' : 'bottom';
      const edgeIdx = edgeSide === 'left' || edgeSide === 'right' ? target.r : target.c;
      if (isCurbBlocked(level, edgeSide, edgeIdx)) {
        return {
          ok: false,
          reason: 'curb',
          steps: step - 1,
          hitCell: { r, c },
          edgeSide,
        };
      }
      return {
        ok: true,
        edgeSide,
        steps: step,
      };
    }

    const key = `${r},${c}`;
    if (cones.has(key)) {
      return {
        ok: false,
        reason: 'cone',
        steps: step - 1,
        hitCell: { r, c },
      };
    }
    if (occ.has(key)) {
      return {
        ok: false,
        reason: 'vehicle',
        blockerId: occ.get(key),
        steps: step - 1,
        hitCell: { r, c },
      };
    }
  }

  return { ok: false, reason: 'curb', steps: 0 };
}

export function computeStars(crashes) {
  if (crashes <= 0) return 3;
  if (crashes === 1) return 2;
  if (crashes === 2) return 1;
  return 0;
}

/**
 * Encontra ordem completa de saída sem batidas (0 batidas).
 */
export function solveParking(level) {
  let rem = level.vehicles.map((v) => ({ ...v }));
  const order = [];

  while (rem.length > 0) {
    let picked = null;
    for (const v of rem) {
      for (const sign of [v.front || 1, -(v.front || 1)]) {
        const res = evaluateExit(rem, v.id, sign, level);
        if (res.ok) {
          picked = { id: v.id, sign, edgeSide: res.edgeSide };
          break;
        }
      }
      if (picked) break;
    }
    if (!picked) {
      return { solved: false, order, remaining: rem.length };
    }
    order.push(picked);
    rem = rem.filter((v) => v.id !== picked.id);
  }

  return { solved: true, order, remaining: 0 };
}

export function findNextHint(vehicles, level) {
  // Prefere veículos com menos saídas livres ou caminhões grandes primeiro para destravar o pátio
  const sorted = [...vehicles].sort((a, b) => b.len - a.len);
  for (const v of sorted) {
    for (const sign of [v.front || 1, -(v.front || 1)]) {
      const res = evaluateExit(vehicles, v.id, sign, level);
      if (res.ok) {
        return { id: v.id, sign, edgeSide: res.edgeSide };
      }
    }
  }
  return null;
}

export const LEVELS = [
  {
    "id": 1,
    "chapter": 1,
    "title": "Primeira Manobra",
    "size": 5,
    "cones": [],
    "blockedEdges": {
      "top": [],
      "bottom": [],
      "left": [],
      "right": []
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 1,
        "c": 1,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 0,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 4,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 1,
        "c": 2,
        "front": -1,
        "color": "yellow"
      }
    ]
  },
  {
    "id": 2,
    "chapter": 1,
    "title": "Saída Dupla",
    "size": 5,
    "cones": [],
    "blockedEdges": {
      "top": [],
      "bottom": [],
      "left": [],
      "right": []
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 4,
        "c": 3,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 4,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v3",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 2,
        "c": 4,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 4,
        "c": 1,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v5",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 4,
        "c": 0,
        "front": -1,
        "color": "teal"
      }
    ]
  },
  {
    "id": 3,
    "chapter": 1,
    "title": "Moto Esperta",
    "size": 5,
    "cones": [],
    "blockedEdges": {
      "top": [],
      "bottom": [],
      "left": [],
      "right": []
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 2,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v2",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 4,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 2,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 3,
        "c": 2,
        "front": 1,
        "color": "red"
      }
    ]
  },
  {
    "id": 4,
    "chapter": 1,
    "title": "Caminhão no Meio",
    "size": 5,
    "cones": [],
    "blockedEdges": {
      "top": [],
      "bottom": [],
      "left": [
        4,
        3
      ],
      "right": [
        2
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 4,
        "c": 0,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 3,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v4",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 2,
        "c": 2,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v5",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 2,
        "c": 1,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 0,
        "front": 1,
        "color": "cream"
      }
    ]
  },
  {
    "id": 5,
    "chapter": 1,
    "title": "Hora da Virada",
    "size": 5,
    "cones": [
      {
        "r": 3,
        "c": 3
      }
    ],
    "blockedEdges": {
      "top": [
        0,
        1
      ],
      "bottom": [
        3
      ],
      "left": [],
      "right": []
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 0,
        "c": 1,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 3,
        "c": 4,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v3",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 4,
        "c": 1,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v4",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 4,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 1,
        "c": 2,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 4,
        "front": -1,
        "color": "blue"
      }
    ]
  },
  {
    "id": 6,
    "chapter": 1,
    "title": "Mureta Fechada",
    "size": 5,
    "cones": [
      {
        "r": 2,
        "c": 1
      }
    ],
    "blockedEdges": {
      "top": [
        1
      ],
      "bottom": [
        4
      ],
      "left": [],
      "right": [
        3
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 2,
        "c": 2,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v2",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 0,
        "c": 4,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 2,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 4,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v6",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 2,
        "c": 0,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v7",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 3,
        "c": 0,
        "front": 1,
        "color": "cream"
      }
    ]
  },
  {
    "id": 7,
    "chapter": 1,
    "title": "Cone Traiçoeiro",
    "size": 5,
    "cones": [
      {
        "r": 3,
        "c": 2
      }
    ],
    "blockedEdges": {
      "top": [],
      "bottom": [],
      "left": [
        1,
        3
      ],
      "right": [
        4
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 1,
        "c": 0,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 4,
        "c": 2,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 3,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 4,
        "c": 0,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 4,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v6",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 1,
        "c": 3,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v7",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 3,
        "c": 4,
        "front": -1,
        "color": "plum"
      }
    ]
  },
  {
    "id": 8,
    "chapter": 1,
    "title": "Esquina Apertada",
    "size": 5,
    "cones": [
      {
        "r": 3,
        "c": 3
      }
    ],
    "blockedEdges": {
      "top": [],
      "bottom": [],
      "left": [
        4,
        2
      ],
      "right": [
        1
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 4,
        "c": 0,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 4,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 0,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v4",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 1,
        "c": 0,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v5",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 2,
        "c": 2,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 1,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 4,
        "c": 3,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 3,
        "front": 1,
        "color": "blue"
      }
    ]
  },
  {
    "id": 9,
    "chapter": 1,
    "title": "Cruzamento Quente",
    "size": 5,
    "cones": [
      {
        "r": 1,
        "c": 3
      }
    ],
    "blockedEdges": {
      "top": [
        2,
        1
      ],
      "bottom": [],
      "left": [],
      "right": [
        2
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 0,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 0,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v4",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 1,
        "c": 1,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 4,
        "c": 3,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v6",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 0,
        "c": 2,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 3,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v8",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 4,
        "c": 2,
        "front": -1,
        "color": "green"
      }
    ]
  },
  {
    "id": 10,
    "chapter": 1,
    "title": "Portão Principal",
    "size": 5,
    "cones": [
      {
        "r": 2,
        "c": 3
      }
    ],
    "blockedEdges": {
      "top": [
        1
      ],
      "bottom": [
        1,
        4
      ],
      "left": [],
      "right": []
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 4,
        "c": 0,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 1,
        "c": 2,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v4",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 1,
        "c": 4,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 1,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v6",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 2,
        "c": 4,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 0,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v8",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 4,
        "front": 1,
        "color": "green"
      }
    ]
  },
  {
    "id": 11,
    "chapter": 2,
    "title": "Engarrafamento",
    "size": 6,
    "cones": [
      {
        "r": 4,
        "c": 4
      },
      {
        "r": 1,
        "c": 2
      }
    ],
    "blockedEdges": {
      "top": [
        0
      ],
      "bottom": [],
      "left": [],
      "right": [
        4,
        5,
        2
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 2,
        "c": 1,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 4,
        "c": 0,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 0,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 2,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v5",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 2,
        "c": 2,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v6",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 2,
        "c": 3,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 0,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v8",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 5,
        "c": 1,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v9",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 5,
        "c": 0,
        "front": -1,
        "color": "teal"
      }
    ]
  },
  {
    "id": 12,
    "chapter": 2,
    "title": "Reversa Obrigatória",
    "size": 6,
    "cones": [
      {
        "r": 4,
        "c": 2
      },
      {
        "r": 2,
        "c": 2
      }
    ],
    "blockedEdges": {
      "top": [
        2,
        1
      ],
      "bottom": [
        3
      ],
      "left": [
        3
      ],
      "right": [
        0
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 2,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 2,
        "c": 4,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v3",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 0,
        "c": 3,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 0,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v5",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v6",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 0,
        "c": 1,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v7",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 4,
        "c": 1,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v8",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 2,
        "c": 3,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 4,
        "front": -1,
        "color": "plum"
      }
    ]
  },
  {
    "id": 13,
    "chapter": 2,
    "title": "Caminhões Cruzados",
    "size": 6,
    "cones": [
      {
        "r": 4,
        "c": 1
      },
      {
        "r": 1,
        "c": 1
      }
    ],
    "blockedEdges": {
      "top": [
        2
      ],
      "bottom": [
        5,
        0,
        1
      ],
      "left": [
        4
      ],
      "right": []
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 1,
        "c": 5,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v2",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 0,
        "c": 0,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v3",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 1,
        "c": 2,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v4",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 5,
        "c": 2,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 0,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 3,
        "c": 2,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 3,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 3,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 1,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v10",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 0,
        "c": 5,
        "front": 1,
        "color": "blue"
      }
    ]
  },
  {
    "id": 14,
    "chapter": 2,
    "title": "Três Saídas",
    "size": 6,
    "cones": [
      {
        "r": 1,
        "c": 3
      },
      {
        "r": 1,
        "c": 2
      }
    ],
    "blockedEdges": {
      "top": [
        3,
        2
      ],
      "bottom": [
        0
      ],
      "left": [
        4
      ],
      "right": [
        3
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 2,
        "c": 0,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v2",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 5,
        "c": 3,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v3",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 1,
        "c": 0,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 4,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 1,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v6",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 2,
        "c": 3,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 3,
        "c": 1,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 0,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v9",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 0,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v10",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 5,
        "front": -1,
        "color": "cream"
      }
    ]
  },
  {
    "id": 15,
    "chapter": 2,
    "title": "Beco das Motos",
    "size": 6,
    "cones": [
      {
        "r": 3,
        "c": 3
      },
      {
        "r": 3,
        "c": 2
      }
    ],
    "blockedEdges": {
      "top": [
        0,
        4
      ],
      "bottom": [
        2
      ],
      "left": [],
      "right": [
        5,
        0
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 5,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v2",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 0,
        "c": 3,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v3",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 0,
        "c": 0,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v4",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 2,
        "c": 0,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 4,
        "c": 1,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v6",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 4,
        "c": 0,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v7",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 4,
        "c": 4,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 0,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 4,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v10",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 0,
        "front": -1,
        "color": "plum"
      }
    ]
  },
  {
    "id": 16,
    "chapter": 2,
    "title": "Sinal Vermelho",
    "size": 6,
    "cones": [
      {
        "r": 4,
        "c": 3
      },
      {
        "r": 3,
        "c": 1
      }
    ],
    "blockedEdges": {
      "top": [
        4,
        2
      ],
      "bottom": [
        3,
        2
      ],
      "left": [
        2
      ],
      "right": []
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 0,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v2",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 0,
        "c": 1,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 0,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v4",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 1,
        "c": 3,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v5",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 0,
        "c": 3,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v6",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 5,
        "c": 4,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 3,
        "c": 0,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 1,
        "c": 1,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 4,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v10",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 3,
        "c": 4,
        "front": 1,
        "color": "cream"
      }
    ]
  },
  {
    "id": 17,
    "chapter": 2,
    "title": "Contramão",
    "size": 6,
    "cones": [
      {
        "r": 1,
        "c": 4
      },
      {
        "r": 2,
        "c": 4
      }
    ],
    "blockedEdges": {
      "top": [
        2,
        4,
        3
      ],
      "bottom": [
        3
      ],
      "left": [],
      "right": [
        2
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v2",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 5,
        "c": 0,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 2,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 3,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v5",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 4,
        "c": 0,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v6",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 2,
        "c": 1,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v7",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 5,
        "c": 5,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 4,
        "c": 3,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 3,
        "c": 5,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v10",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 1,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 5,
        "front": -1,
        "color": "blue"
      }
    ]
  },
  {
    "id": 18,
    "chapter": 2,
    "title": "Corredor Estreito",
    "size": 6,
    "cones": [
      {
        "r": 3,
        "c": 1
      },
      {
        "r": 4,
        "c": 1
      }
    ],
    "blockedEdges": {
      "top": [
        0
      ],
      "bottom": [
        4,
        1
      ],
      "left": [],
      "right": [
        4
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 5,
        "c": 0,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v2",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 2,
        "c": 5,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 2,
        "c": 2,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 2,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 1,
        "c": 2,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v6",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 5,
        "c": 5,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v7",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 1,
        "c": 0,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v8",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 5,
        "c": 3,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 1,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v10",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 4,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 3,
        "c": 3,
        "front": -1,
        "color": "blue"
      }
    ]
  },
  {
    "id": 19,
    "chapter": 2,
    "title": "Pátio Lotado",
    "size": 6,
    "cones": [
      {
        "r": 3,
        "c": 2
      },
      {
        "r": 2,
        "c": 3
      }
    ],
    "blockedEdges": {
      "top": [],
      "bottom": [
        4
      ],
      "left": [
        1,
        4,
        5
      ],
      "right": []
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 2,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v2",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 5,
        "c": 0,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v3",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 3,
        "c": 4,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 1,
        "c": 0,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 1,
        "c": 3,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v6",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 4,
        "c": 5,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 5,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 0,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v9",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 0,
        "c": 4,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v10",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 3,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v11",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v12",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 1,
        "front": 1,
        "color": "plum"
      }
    ]
  },
  {
    "id": 20,
    "chapter": 2,
    "title": "Hora do Rush",
    "size": 6,
    "cones": [
      {
        "r": 4,
        "c": 3
      },
      {
        "r": 4,
        "c": 4
      }
    ],
    "blockedEdges": {
      "top": [
        3,
        2
      ],
      "bottom": [],
      "left": [
        1
      ],
      "right": [
        2
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 2,
        "c": 0,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 4,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 1,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 2,
        "c": 2,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v5",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 3,
        "c": 2,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 0,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v7",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 1,
        "c": 2,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 1,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 3,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v10",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 5,
        "c": 5,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v11",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 1,
        "c": 5,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v12",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 4,
        "c": 2,
        "front": 1,
        "color": "yellow"
      }
    ]
  },
  {
    "id": 21,
    "chapter": 3,
    "title": "Nó Cego",
    "size": 6,
    "cones": [
      {
        "r": 1,
        "c": 4
      },
      {
        "r": 4,
        "c": 4
      }
    ],
    "blockedEdges": {
      "top": [
        0,
        2,
        4
      ],
      "bottom": [
        3
      ],
      "left": [],
      "right": [
        3
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 5,
        "c": 0,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 5,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v3",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 4,
        "c": 0,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 1,
        "c": 0,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v5",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 4,
        "c": 1,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 1,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 3,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v8",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 1,
        "c": 5,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 4,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v10",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 1,
        "c": 2,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 2,
        "c": 3,
        "front": -1,
        "color": "cream"
      }
    ]
  },
  {
    "id": 22,
    "chapter": 3,
    "title": "Baliza Perfeita",
    "size": 6,
    "cones": [
      {
        "r": 3,
        "c": 3
      },
      {
        "r": 3,
        "c": 2
      }
    ],
    "blockedEdges": {
      "top": [
        2,
        3,
        4
      ],
      "bottom": [
        5
      ],
      "left": [
        3,
        4
      ],
      "right": [
        4
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 1,
        "c": 0,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 4,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 3,
        "c": 5,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v4",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 5,
        "c": 1,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 0,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 5,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v7",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 5,
        "c": 3,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v8",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 0,
        "c": 1,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 1,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v10",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 1,
        "c": 2,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v11",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 1,
        "c": 4,
        "front": 1,
        "color": "blue"
      }
    ]
  },
  {
    "id": 23,
    "chapter": 3,
    "title": "Desvio de Cones",
    "size": 6,
    "cones": [
      {
        "r": 4,
        "c": 4
      },
      {
        "r": 2,
        "c": 4
      }
    ],
    "blockedEdges": {
      "top": [],
      "bottom": [
        1
      ],
      "left": [],
      "right": [
        0,
        5,
        1
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 0,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 3,
        "c": 0,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v3",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 0,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 5,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v5",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 0,
        "c": 2,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v6",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 5,
        "c": 3,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 4,
        "c": 1,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v8",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 0,
        "c": 1,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 1,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v10",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 4,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v11",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 5,
        "c": 2,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v12",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 0,
        "front": -1,
        "color": "yellow"
      }
    ]
  },
  {
    "id": 24,
    "chapter": 3,
    "title": "Comboio Longo",
    "size": 6,
    "cones": [
      {
        "r": 3,
        "c": 3
      },
      {
        "r": 3,
        "c": 2
      }
    ],
    "blockedEdges": {
      "top": [
        3
      ],
      "bottom": [
        1
      ],
      "left": [
        1,
        2
      ],
      "right": [
        4
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 1,
        "c": 5,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v2",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 4,
        "c": 2,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 5,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v4",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 3,
        "c": 1,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v5",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 0,
        "c": 5,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 5,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v7",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 1,
        "c": 1,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 0,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 3,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v10",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 4,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 2,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v12",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 3,
        "front": 1,
        "color": "green"
      }
    ]
  },
  {
    "id": 25,
    "chapter": 3,
    "title": "Estacionamento Cheio",
    "size": 6,
    "cones": [
      {
        "r": 2,
        "c": 4
      },
      {
        "r": 1,
        "c": 4
      }
    ],
    "blockedEdges": {
      "top": [
        3,
        0
      ],
      "bottom": [
        2,
        3
      ],
      "left": [],
      "right": [
        1,
        5
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 3,
        "c": 2,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 5,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v3",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 3,
        "c": 4,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 2,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 4,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 2,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 5,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v8",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 3,
        "c": 5,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 4,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v10",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 0,
        "c": 0,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v11",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 3,
        "c": 0,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v12",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 1,
        "front": 1,
        "color": "blue"
      }
    ]
  },
  {
    "id": 26,
    "chapter": 3,
    "title": "Rota Bloqueada",
    "size": 6,
    "cones": [
      {
        "r": 2,
        "c": 2
      },
      {
        "r": 3,
        "c": 3
      }
    ],
    "blockedEdges": {
      "top": [
        2,
        3,
        4
      ],
      "bottom": [
        2,
        3
      ],
      "left": [
        4
      ],
      "right": [
        0
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 0,
        "c": 0,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 2,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v3",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 0,
        "c": 3,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v4",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 3,
        "c": 1,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 2,
        "c": 0,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v6",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 4,
        "c": 5,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 4,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 5,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v9",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 1,
        "c": 1,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v10",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 0,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 4,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v12",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 4,
        "c": 0,
        "front": 1,
        "color": "yellow"
      }
    ]
  },
  {
    "id": 27,
    "chapter": 3,
    "title": "Vaga Disputada",
    "size": 6,
    "cones": [
      {
        "r": 4,
        "c": 2
      },
      {
        "r": 1,
        "c": 2
      }
    ],
    "blockedEdges": {
      "top": [
        3
      ],
      "bottom": [
        3,
        1,
        2
      ],
      "left": [
        5
      ],
      "right": [
        1
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 3,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v2",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 3,
        "c": 5,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 5,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 2,
        "c": 4,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 0,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 1,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v7",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 3,
        "c": 2,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 5,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v10",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 2,
        "c": 1,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v11",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 4,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v12",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 1,
        "c": 1,
        "front": 1,
        "color": "yellow"
      }
    ]
  },
  {
    "id": 28,
    "chapter": 3,
    "title": "Cruzamento Central",
    "size": 6,
    "cones": [
      {
        "r": 4,
        "c": 1
      },
      {
        "r": 4,
        "c": 4
      }
    ],
    "blockedEdges": {
      "top": [
        3
      ],
      "bottom": [
        1,
        2,
        3
      ],
      "left": [
        0
      ],
      "right": []
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 5,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v2",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 0,
        "c": 2,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 1,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v4",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 2,
        "c": 1,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 0,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v6",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 1,
        "c": 4,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 5,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 3,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 0,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v10",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 5,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "teal"
      }
    ]
  },
  {
    "id": 29,
    "chapter": 3,
    "title": "Caminhão na Contramão",
    "size": 6,
    "cones": [
      {
        "r": 3,
        "c": 2
      },
      {
        "r": 2,
        "c": 3
      }
    ],
    "blockedEdges": {
      "top": [
        5
      ],
      "bottom": [
        3,
        0
      ],
      "left": [
        0,
        5
      ],
      "right": [
        4,
        3
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 5,
        "c": 3,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v2",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 1,
        "c": 5,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 2,
        "c": 1,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 0,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 0,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 2,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 0,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 1,
        "c": 1,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v9",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 3,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v10",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 1,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v11",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 2,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v12",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 4,
        "front": 1,
        "color": "teal"
      }
    ]
  },
  {
    "id": 30,
    "chapter": 3,
    "title": "Labirinto de Aço",
    "size": 6,
    "cones": [
      {
        "r": 3,
        "c": 1
      },
      {
        "r": 2,
        "c": 1
      }
    ],
    "blockedEdges": {
      "top": [
        1
      ],
      "bottom": [
        4,
        3
      ],
      "left": [],
      "right": [
        4,
        5,
        0
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 4,
        "c": 0,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 1,
        "c": 1,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v3",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 3,
        "c": 5,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v4",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 3,
        "c": 2,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 4,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v6",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 1,
        "c": 5,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v7",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 3,
        "c": 0,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 2,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v10",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 2,
        "c": 5,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 1,
        "c": 3,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v12",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 2,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v13",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 0,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v14",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 4,
        "c": 3,
        "front": 1,
        "color": "cream"
      }
    ]
  },
  {
    "id": 31,
    "chapter": 4,
    "title": "Pátio 7×7",
    "size": 7,
    "cones": [
      {
        "r": 5,
        "c": 4
      },
      {
        "r": 3,
        "c": 5
      },
      {
        "r": 4,
        "c": 2
      }
    ],
    "blockedEdges": {
      "top": [
        2
      ],
      "bottom": [
        1
      ],
      "left": [
        4,
        3,
        6
      ],
      "right": [
        3,
        0,
        4
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 0,
        "c": 0,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 6,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 5,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v4",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 6,
        "c": 3,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 0,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v6",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 3,
        "c": 4,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 6,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v8",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 0,
        "c": 1,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v9",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 6,
        "c": 0,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v10",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 0,
        "c": 4,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 6,
        "c": 4,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v12",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 5,
        "c": 6,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v13",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 1,
        "c": 4,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v14",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 2,
        "front": 1,
        "color": "cream"
      }
    ]
  },
  {
    "id": 32,
    "chapter": 4,
    "title": "Trânsito Travado",
    "size": 7,
    "cones": [
      {
        "r": 3,
        "c": 3
      },
      {
        "r": 2,
        "c": 4
      },
      {
        "r": 3,
        "c": 4
      }
    ],
    "blockedEdges": {
      "top": [
        3,
        6
      ],
      "bottom": [
        1,
        0
      ],
      "left": [
        2,
        5
      ],
      "right": [
        5,
        1,
        6
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 5,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 4,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 5,
        "c": 4,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 4,
        "c": 2,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v5",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 5,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v6",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 1,
        "c": 1,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v7",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 6,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v8",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 0,
        "c": 1,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 5,
        "c": 2,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v10",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 6,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 5,
        "c": 0,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v12",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 4,
        "c": 1,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v13",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v14",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 0,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v15",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 5,
        "c": 6,
        "front": -1,
        "color": "blue"
      }
    ]
  },
  {
    "id": 33,
    "chapter": 4,
    "title": "Cerco de Muretas",
    "size": 7,
    "cones": [
      {
        "r": 4,
        "c": 5
      },
      {
        "r": 1,
        "c": 2
      },
      {
        "r": 2,
        "c": 5
      }
    ],
    "blockedEdges": {
      "top": [
        1,
        2
      ],
      "bottom": [
        1,
        5,
        2
      ],
      "left": [
        3,
        2
      ],
      "right": []
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 1,
        "c": 0,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 6,
        "c": 3,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v3",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 6,
        "c": 2,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v4",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 1,
        "c": 6,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 5,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 1,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 3,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 4,
        "c": 0,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v9",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 6,
        "c": 1,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v10",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 5,
        "c": 0,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v11",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 0,
        "c": 6,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v12",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 3,
        "c": 1,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v13",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 6,
        "c": 6,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v14",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 1,
        "c": 3,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v15",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "red"
      }
    ]
  },
  {
    "id": 34,
    "chapter": 4,
    "title": "Frota Completa",
    "size": 7,
    "cones": [
      {
        "r": 4,
        "c": 1
      },
      {
        "r": 5,
        "c": 1
      },
      {
        "r": 1,
        "c": 4
      }
    ],
    "blockedEdges": {
      "top": [
        0,
        1
      ],
      "bottom": [],
      "left": [
        6,
        4,
        5
      ],
      "right": [
        3,
        0
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 4,
        "c": 4,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 5,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v3",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 6,
        "c": 0,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v4",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 1,
        "c": 3,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 3,
        "c": 0,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 0,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 3,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v8",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 1,
        "c": 1,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 3,
        "c": 5,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v10",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 0,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 6,
        "c": 5,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v12",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 6,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v13",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 6,
        "c": 1,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v14",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 2,
        "c": 3,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v15",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 3,
        "c": 6,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v16",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 1,
        "front": 1,
        "color": "teal"
      }
    ]
  },
  {
    "id": 35,
    "chapter": 4,
    "title": "Comboio Pesado",
    "size": 7,
    "cones": [
      {
        "r": 4,
        "c": 3
      },
      {
        "r": 2,
        "c": 2
      },
      {
        "r": 1,
        "c": 1
      }
    ],
    "blockedEdges": {
      "top": [
        3,
        0,
        1,
        4
      ],
      "bottom": [
        4
      ],
      "left": [
        2
      ],
      "right": []
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 4,
        "c": 0,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 2,
        "c": 3,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v3",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 4,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 0,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v5",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 5,
        "c": 6,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v6",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 1,
        "c": 2,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 5,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 2,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 6,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v10",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 4,
        "c": 5,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 1,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v12",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v13",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 5,
        "c": 0,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v14",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 5,
        "c": 3,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v15",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 1,
        "c": 5,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v16",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 6,
        "c": 5,
        "front": 1,
        "color": "green"
      }
    ]
  },
  {
    "id": 36,
    "chapter": 4,
    "title": "Sem Saída Fácil",
    "size": 7,
    "cones": [
      {
        "r": 3,
        "c": 5
      },
      {
        "r": 5,
        "c": 5
      },
      {
        "r": 4,
        "c": 5
      }
    ],
    "blockedEdges": {
      "top": [
        2,
        0,
        4
      ],
      "bottom": [
        2,
        4
      ],
      "left": [],
      "right": [
        5,
        1,
        6
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 4,
        "c": 4,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 3,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 3,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 3,
        "c": 6,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v5",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 1,
        "c": 3,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 2,
        "c": 5,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v7",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 0,
        "c": 0,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v8",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 5,
        "c": 2,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v9",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 4,
        "c": 1,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v10",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 6,
        "c": 0,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 3,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v12",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 0,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v13",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 1,
        "c": 1,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v14",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 5,
        "c": 6,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v15",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 0,
        "c": 1,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v16",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 0,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v17",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 5,
        "front": 1,
        "color": "plum"
      }
    ]
  },
  {
    "id": 37,
    "chapter": 4,
    "title": "Teia de Caminhões",
    "size": 7,
    "cones": [
      {
        "r": 3,
        "c": 1
      },
      {
        "r": 1,
        "c": 4
      },
      {
        "r": 4,
        "c": 5
      }
    ],
    "blockedEdges": {
      "top": [
        3,
        4,
        1
      ],
      "bottom": [
        4
      ],
      "left": [
        1,
        3
      ],
      "right": [
        6
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 3,
        "c": 3,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v2",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 2,
        "c": 2,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 5,
        "c": 0,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v4",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 4,
        "c": 1,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v5",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 6,
        "c": 2,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 5,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 2,
        "c": 0,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 1,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v10",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 3,
        "c": 0,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 5,
        "c": 5,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v12",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 6,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v13",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 6,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v14",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 1,
        "c": 2,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v15",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 5,
        "front": -1,
        "color": "red"
      }
    ]
  },
  {
    "id": 38,
    "chapter": 4,
    "title": "Aperto Final",
    "size": 7,
    "cones": [
      {
        "r": 2,
        "c": 4
      },
      {
        "r": 5,
        "c": 5
      },
      {
        "r": 5,
        "c": 1
      }
    ],
    "blockedEdges": {
      "top": [
        5,
        0,
        3
      ],
      "bottom": [
        1,
        3
      ],
      "left": [
        0,
        2
      ],
      "right": [
        1,
        2
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 4,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v2",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 0,
        "c": 1,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v3",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 4,
        "c": 0,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 4,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v5",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 1,
        "c": 2,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 4,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v7",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 0,
        "c": 5,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 6,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 0,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v10",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 6,
        "c": 5,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 6,
        "c": 3,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v12",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 6,
        "c": 2,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v13",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 3,
        "c": 2,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v14",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 1,
        "c": 0,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v15",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 6,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v16",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 6,
        "front": -1,
        "color": "plum"
      }
    ]
  },
  {
    "id": 39,
    "chapter": 4,
    "title": "Última Baliza",
    "size": 7,
    "cones": [
      {
        "r": 1,
        "c": 4
      },
      {
        "r": 1,
        "c": 1
      },
      {
        "r": 3,
        "c": 4
      }
    ],
    "blockedEdges": {
      "top": [
        6,
        3
      ],
      "bottom": [
        5,
        2,
        3
      ],
      "left": [],
      "right": [
        2
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 5,
        "c": 6,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v2",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 4,
        "c": 0,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 0,
        "c": 3,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v4",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 0,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 5,
        "c": 0,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 5,
        "front": 1,
        "color": "blue"
      },
      {
        "id": "v7",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 2,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 5,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v9",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 2,
        "c": 0,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v10",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 4,
        "c": 1,
        "front": 1,
        "color": "yellow"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 2,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v12",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 5,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v13",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 6,
        "c": 1,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v14",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 4,
        "c": 2,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v15",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 0,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v16",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 2,
        "c": 2,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v17",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 4,
        "c": 4,
        "front": -1,
        "color": "plum"
      }
    ]
  },
  {
    "id": 40,
    "chapter": 4,
    "title": "Caos Total na Quermesse",
    "size": 7,
    "cones": [
      {
        "r": 2,
        "c": 5
      },
      {
        "r": 4,
        "c": 1
      },
      {
        "r": 5,
        "c": 3
      }
    ],
    "blockedEdges": {
      "top": [
        6,
        3
      ],
      "bottom": [
        2,
        6
      ],
      "left": [
        2
      ],
      "right": [
        0,
        4
      ]
    },
    "vehicles": [
      {
        "id": "v1",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 2,
        "c": 0,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v2",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 5,
        "c": 4,
        "front": 1,
        "color": "plum"
      },
      {
        "id": "v3",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 6,
        "c": 0,
        "front": -1,
        "color": "cream"
      },
      {
        "id": "v4",
        "type": "truck",
        "len": 3,
        "dir": "H",
        "r": 0,
        "c": 4,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v5",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 0,
        "c": 0,
        "front": 1,
        "color": "teal"
      },
      {
        "id": "v6",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 5,
        "front": -1,
        "color": "teal"
      },
      {
        "id": "v7",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 4,
        "c": 2,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v8",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 1,
        "c": 5,
        "front": 1,
        "color": "red"
      },
      {
        "id": "v9",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 1,
        "front": -1,
        "color": "green"
      },
      {
        "id": "v10",
        "type": "car",
        "len": 2,
        "dir": "V",
        "r": 4,
        "c": 0,
        "front": -1,
        "color": "red"
      },
      {
        "id": "v11",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 3,
        "c": 3,
        "front": -1,
        "color": "plum"
      },
      {
        "id": "v12",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 1,
        "c": 2,
        "front": -1,
        "color": "blue"
      },
      {
        "id": "v13",
        "type": "moto",
        "len": 1,
        "dir": "V",
        "r": 1,
        "c": 4,
        "front": 1,
        "color": "green"
      },
      {
        "id": "v14",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 3,
        "c": 6,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v15",
        "type": "car",
        "len": 2,
        "dir": "H",
        "r": 6,
        "c": 5,
        "front": -1,
        "color": "yellow"
      },
      {
        "id": "v16",
        "type": "truck",
        "len": 3,
        "dir": "V",
        "r": 0,
        "c": 1,
        "front": 1,
        "color": "cream"
      },
      {
        "id": "v17",
        "type": "moto",
        "len": 1,
        "dir": "H",
        "r": 1,
        "c": 3,
        "front": 1,
        "color": "yellow"
      }
    ]
  }
];

export function getLevel(idOrIndex) {
  const n = Number(idOrIndex);
  if (Number.isFinite(n) && n >= 1 && n <= LEVELS.length) {
    return LEVELS[n - 1];
  }
  return LEVELS[0];
}

// Motor do mini-jogo Palavra (Wordle / Termo em Português com 4 níveis de dificuldade)
// Níveis: Fácil (4 letras), Médio (5 letras), Difícil (6 letras) e Mestre (7 letras).

export const LEVELS = ['easy', 'medium', 'hard', 'expert'];

export const LEVEL_INFO = {
  easy: {
    name: 'Fácil',
    cols: 4,
    rows: 6,
  },
  medium: {
    name: 'Médio',
    cols: 5,
    rows: 6,
  },
  hard: {
    name: 'Difícil',
    cols: 6,
    rows: 6,
  },
  expert: {
    name: 'Mestre',
    cols: 7,
    rows: 6,
  },
};

export const WORD_BANK = {
  easy: [
    'AMOR', 'ANEL', 'ARCO', 'ARTE', 'AZUL', 'BALA', 'BASE', 'BICO', 'BOLA', 'BOLO',
    'BOTA', 'CAFE', 'CAIS', 'CAMA', 'CAPA', 'CASA', 'CEIA', 'CENA', 'COPO', 'CORO',
    'CUBO', 'DADO', 'DAMA', 'DATA', 'DEDO', 'DICA', 'DOCE', 'DONO', 'DUDA', 'ECOS',
    'FACA', 'FADA', 'FAMA', 'FARO', 'FASE', 'FATO', 'FITA', 'FILA', 'FLOR', 'FOGO',
    'FOTO', 'GALO', 'GATO', 'GELO', 'GIRO', 'GOTA', 'GUIA', 'HORA', 'ILHA',
    'JOGO', 'JUIZ', 'LADO', 'LAGO', 'LATA', 'LEAO', 'LIMA', 'LOBO', 'LOJA', 'LUAR',
    'LUPA', 'LUVA', 'MACA', 'MALA', 'MAPA', 'MARE', 'MATO', 'MEIA', 'MESA', 'META',
    'MINA', 'MODA', 'MOLA', 'MURO', 'NAVE', 'NEVE', 'NOTA', 'NOVO', 'OBRA', 'OLHO',
    'ONDA', 'OURO', 'OSSO', 'PATO', 'PECA', 'PELE', 'PENA', 'PERA', 'PESO', 'PIPA',
    'PISO', 'POTE', 'POVO', 'PURO', 'RAMO', 'RATO', 'REDE', 'REMO', 'RIMA', 'RISO',
    'RODA', 'ROSA', 'ROTA', 'RUAS', 'SACO', 'SALA', 'SAPO', 'SEDA', 'SELO', 'SINO',
    'SOPA', 'SUCO', 'TELA', 'TEMA', 'TETO', 'TIME', 'TOCA', 'TOPO', 'URSO', 'VALE',
    'VASO', 'VELA', 'VIDA', 'VILA', 'VOTO', 'ZERO', 'ZONA',
  ],

  medium: [
    'ABRIR', 'AMIGO', 'ANJOS', 'APITO', 'ARENA', 'AROMA', 'AVIAO', 'BALAO', 'BANCO', 'BARCO',
    'BAILE', 'BEIJO', 'BICHO', 'BLOCO', 'BRAVO', 'BRISA', 'BRUXA', 'CABRA', 'CAIXA', 'CALMA',
    'CAMPO', 'CANTO', 'CARRO', 'CARTA', 'CASAL', 'CHAVE', 'CHUVA', 'CIRCO', 'CLARO', 'CLIMA',
    'COBRA', 'CONTA', 'CORDA', 'COROA', 'CORPO', 'COSTA', 'CRAVO', 'DANCA', 'DENTE', 'DISCO',
    'DOCES', 'DRAMA', 'DUPLA', 'ELITE', 'FAROL', 'FEIRA', 'FESTA', 'FICHA', 'FILME', 'FLORA',
    'FOGAO', 'FOLHA', 'FONTE', 'FORCA', 'FORNO', 'FORTE', 'FRUTA', 'FUNDO', 'GALHO', 'GARFO',
    'GENTE', 'GLOBO', 'GOLPE', 'GRAMA', 'GRITO', 'GRUPO', 'HARPA', 'HEROI', 'HOTEL', 'IDEIA',
    'IDOSO', 'IGUAL', 'IMPAR', 'INDIO', 'JANTA', 'JARRA', 'JOVEM', 'JUIZO', 'LAGOA', 'LANCA',
    'LAPIS', 'LEITE', 'LENDA', 'LENTO', 'LIMAO', 'LINDO', 'LINHA', 'LIVRE', 'LIVRO', 'LOUCO',
    'LUGAR', 'LUZES', 'MACIO', 'MAGIA', 'MANGA', 'MANHA', 'MANTO', 'MARCO', 'MORNO', 'METAL',
    'METRO', 'MILHO', 'MOEDA', 'MONTE', 'MORRO', 'MOTOR', 'MUNDO', 'MUSEU', 'NAVIO', 'NEVOA',
    'NINHO', 'NOBRE', 'NOITE', 'NORTE', 'NUVEM', 'OASIS', 'ONTEM', 'ORDEM', 'OUROS', 'OUTRO',
    'PALCO', 'PALHA', 'PAPEL', 'PARDO', 'PARTE', 'PASSO', 'PASTO', 'PATIO', 'PAUSA', 'PEDRA',
    'PEIXE', 'PIANO', 'PILHA', 'PISTA', 'PLANO', 'PODER', 'POEMA', 'PONTE', 'PONTO', 'PORTA',
    'PORTO', 'POUCO', 'PRADO', 'PRAIA', 'PRATA', 'PRATO', 'PRAZO', 'PRECO', 'PRIMO', 'PROVA',
    'PULSO', 'QUASE', 'QUEDA', 'RAIOS', 'RAMOS', 'REGRA', 'REINO', 'RENDA', 'RESTO', 'RITMO',
    'ROCHA', 'ROSTO', 'ROUPA', 'RUINA', 'SABER', 'SABOR', 'SALTO', 'SAMBA', 'SANTO', 'SAUDE',
    'SELVA', 'SENHA', 'SERRA', 'SINAL', 'SOBRA', 'SOLAR', 'SONHO', 'SORTE', 'SUAVE', 'TABUA',
    'TARDE', 'TECLA', 'TEMPO', 'TENDA', 'TERRA', 'TIGRE', 'TINTA', 'TORRE', 'TRACO', 'TRIGO',
    'TRONO', 'TROPA', 'TURMA', 'UNIAO', 'UNICO', 'VALOR', 'VAPOR', 'VELHO', 'VENTO', 'VERAO',
    'VERDE', 'VERSO', 'VIDRO', 'VIGOR', 'VINHO', 'VISTA', 'VIVER', 'VOZES', 'ZEBRA',
  ],

  hard: [
    'ABERTO', 'ABRIGO', 'ACORDO', 'ALEGRE', 'ALTURA', 'AMARGO', 'ANCORA', 'ANIMAL', 'APENAS', 'ARVORE',
    'ATAQUE', 'AVANCO', 'BALCAO', 'BANHOS', 'BARCOS', 'BELEZA', 'BONECO', 'BONITO', 'BRANCO', 'BRILHO',
    'BRONZE', 'CABECA', 'CADEIA', 'CAMISA', 'CANCAO', 'CANETA', 'CANTOR', 'CAPOTE', 'CARETA', 'CAVALO',
    'CEBOLA', 'CENTRO', 'CIDADE', 'CINEMA', 'CLASSE', 'COELHO', 'COLINA', 'COMIDA', 'CONCHA', 'CONTOS',
    'COROAS', 'CORUJA', 'CULTOS', 'DENTRO', 'DESEJO', 'DIRETO', 'DIVINO', 'DOURAR', 'DRAGAO', 'DUVIDA',
    'ENIGMA', 'ENSINO', 'ESCADA', 'ESCOLA', 'ESCUDO', 'ESPACO', 'ESPADA', 'ESFERA', 'ESTACA', 'ESTADO',
    'ESTILO', 'ESTUDO', 'EVENTO', 'EXAMES', 'FABULA', 'FALCAO', 'FAMOSO', 'FARDOS', 'FERROS', 'FESTAS',
    'FIGURA', 'FLECHA', 'FLORES', 'FOGOSO', 'FORMAS', 'FORTES', 'FRENTE', 'FRUTAS', 'FUTURO', 'GAIOLA',
    'GALERA', 'GAROTA', 'GAROTO', 'GELADO', 'GLORIA', 'GRANDE', 'GRUTAS', 'GUARDA', 'GUERRA', 'HUMANO',
    'ILHOTA', 'IMAGEM', 'INICIO', 'JARDIM', 'JANELA', 'JOGADA', 'JORNAL', 'JOVENS', 'LADRAO', 'LAGUNA',
    'LANCHE', 'LEITOR', 'LIMPOS', 'LINGUA', 'LINHAS', 'LIVROS', 'LOUVOR', 'LUZIDO', 'MACACO', 'MAGICO',
    'MANHAS', 'MARFIM', 'MELHOR', 'MENINA', 'MENINO', 'MESTRE', 'MINUTO', 'MOEDAS', 'MOINHO', 'MONTES',
    'MORADA', 'MUSICA', 'NAVIOS', 'NITIDO', 'NOVELO', 'NUMERO', 'NUVENS', 'OCEANO', 'OFICIO', 'OLHADA',
    'ORIGEM', 'OUTONO', 'OUVIDO', 'PAGINA', 'PAINEL', 'PALITO', 'PANELA', 'PAREDE', 'PARQUE', 'PASSAR',
    'PEDRAS', 'PERIGO', 'PEROLA', 'PESSOA', 'PILOTO', 'PINCEL', 'PIRATA', 'PLANTA', 'POESIA', 'POMBAS',
    'PONTES', 'PORTAL', 'PORTAO', 'POVOAR', 'PRATAS', 'PRAZER', 'PREMIO', 'PRISAO', 'QUADRO', 'QUARTO',
    'QUEIJO', 'QUENTE', 'QUINTA', 'RAIZES', 'RAPIDO', 'RAPOSA', 'RECADO', 'REGRAS', 'REINOS', 'RELATO',
    'RIACHO', 'RISADA', 'ROCHAS', 'RODEIO', 'ROTINA', 'ROUPAS', 'SABIDO', 'SACOLA', 'SAIDAS', 'SAPATO',
    'SEMANA', 'SENHOR', 'SEREIA', 'SERENO', 'SERTAO', 'SOMBRA', 'SONHOS', 'SORRIR', 'SUBIDA', 'TABELA',
    'TAMBOR', 'TAPETE', 'TEATRO', 'TECIDO', 'TEMPLO', 'TIGRES', 'TITULO', 'TORRES', 'TRILHA', 'TROFEU',
    'TRONCO', 'TROVAO', 'ULTIMO', 'UNIDOS', 'VENTOS', 'VERDES', 'VIAGEM', 'VIOLAO', 'VULCAO', 'XADREZ',
  ],

  expert: [
    'ABACATE', 'ABOBORA', 'ACERTAR', 'ALEGRIA', 'ALIANCA', 'AMIZADE', 'ANCORAR', 'ARQUIVO', 'ATALHOS', 'BALANCO',
    'BARRACA', 'BATALHA', 'BATERIA', 'BONDADE', 'BRILHAR', 'BUSSOLA', 'CABANAS', 'CADEIRA', 'CADERNO', 'CAMINHO',
    'CAMPINA', 'CAMPEAO', 'CANCOES', 'CAPITAO', 'CARRACA', 'CASTELO', 'CERTEZA', 'CHAMINE', 'CIDADAO', 'CLAREZA',
    'COMETAS', 'CONVITE', 'CORACAO', 'CORAGEM', 'CORRIDA', 'CORTINA', 'CRIANCA', 'CRISTAL', 'CULTURA', 'CURIOSO',
    'DECISAO', 'DEFESAS', 'DESAFIO', 'DESERTO', 'DESTINO', 'DIRECAO', 'DOMINGO', 'DRAGOES', 'EMPATIA', 'ENCANTO',
    'ENERGIA', 'ENIGMAS', 'ENTRADA', 'ESCADAS', 'ESCOLHA', 'ESCRITA', 'ESPELHO', 'ESPERAR', 'ESTACAO', 'ESTRADA',
    'ESTRELA', 'FABRICA', 'FAMILIA', 'FAZENDA', 'FERIADO', 'FESTIVA', 'FIRMEZA', 'FOGUETE', 'FORMIGA', 'FORTUNA',
    'GALAXIA', 'GARRAFA', 'GIGANTE', 'GRANITO', 'GUARDAO', 'HEROICO', 'IMPULSO', 'INVERNO', 'JANGADA', 'JARDINS',
    'JORNADA', 'JUSTICA', 'LAMPADA', 'LARANJA', 'LEITURA', 'LIMPEZA', 'MADEIRA', 'MAESTRO', 'MARINHA', 'MARTELO',
    'MASCARA', 'MEDALHA', 'MELODIA', 'MEMORIA', 'MERCADO', 'MILAGRE', 'MINERIO', 'MOCHILA', 'MOMENTO', 'MONARCA',
    'MORANGO', 'MURALHA', 'NEBLINA', 'NOBREZA', 'NOTURNA', 'NOTURNO', 'OCEANOS', 'OFICINA', 'ORGULHO', 'PALACIO',
    'PALAVRA', 'PALHACO', 'PARAISO', 'PASSARO', 'PASSEIO', 'PEQUENO', 'PERFUME', 'PLANETA', 'PLANTIO', 'PORTAIS',
    'PROJETO', 'QUADROS', 'QUINTAL', 'RAINHAS', 'RAPIDEZ', 'REBANHO', 'RECORDE', 'REFUGIO', 'RELOGIO', 'RESGATE',
    'RETALHO', 'REUNIAO', 'RIQUEZA', 'ROCHEDO', 'ROMANCE', 'ROTEIRO', 'SAUDADE', 'SEGREDO', 'SEMENTE', 'SENTIDO',
    'SIMBOLO', 'SINCERO', 'SISTEMA', 'SOLDADO', 'SORRISO', 'SUCESSO', 'TALENTO', 'TAPETES', 'TESOURO', 'TORNEIO',
    'TRAJETO', 'TESOURA', 'TRILHAS', 'TRIUNFO', 'TROFEUS', 'VALENTE', 'VARANDA', 'VELEIRO', 'VERDADE', 'VIAGENS',
    'VITORIA', 'VONTADE',
  ],
};

export function normalizeWord(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/gi, 'c')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

export function generatePuzzle(level = 'medium', avoidWord = null) {
  const lv = LEVELS.includes(level) ? level : 'medium';
  const cfg = LEVEL_INFO[lv];
  const pool = WORD_BANK[lv].filter((w) => w.length === cfg.cols && w !== avoidWord);
  const word = pool[Math.floor(Math.random() * pool.length)] || WORD_BANK[lv][0];
  return {
    level: lv,
    cols: cfg.cols,
    rows: cfg.rows,
    word,
  };
}

/**
 * Avalia um palpite (`guess`) contra a palavra-alvo (`target`) seguindo a regra exata do Wordle/Termo:
 * - 'correct': letra certa na posição exata (verde)
 * - 'present': letra existe na palavra em outra posição (amarelo)
 * - 'absent': letra não existe (ou já esgotou suas ocorrências) na palavra
 */
export function evaluateGuess(guess, target) {
  const len = target.length;
  const g = normalizeWord(guess);
  const t = normalizeWord(target);
  const result = new Array(len).fill('absent');
  const counts = {};

  for (let i = 0; i < len; i++) {
    const ch = t[i];
    counts[ch] = (counts[ch] || 0) + 1;
  }

  // Passada 1: letras na posição exata ('correct')
  for (let i = 0; i < len; i++) {
    if (g[i] === t[i]) {
      result[i] = 'correct';
      counts[g[i]]--;
    }
  }

  // Passada 2: letras presentes em outra posição ('present')
  for (let i = 0; i < len; i++) {
    if (result[i] === 'correct') continue;
    const ch = g[i];
    if (counts[ch] > 0) {
      result[i] = 'present';
      counts[ch]--;
    }
  }

  return result;
}

/**
 * Verifica se a tentativa digitada pelo jogador é uma sequência alfabética plausível em português
 * (tem o tamanho certo, contém ao menos uma vogal e não tem 3 letras idênticas seguidas).
 */
export function isValidGuessWord(guess, cols) {
  const clean = normalizeWord(guess);
  if (clean.length !== cols) {
    return { ok: false, reason: `Complete as <b>${cols} letras</b> antes de confirmar.` };
  }
  if (!/[AEIOUY]/.test(clean)) {
    return { ok: false, reason: 'A palavra precisa conter pelo menos uma vogal.' };
  }
  if (/(.)\1\1/.test(clean)) {
    return { ok: false, reason: 'Sequência inválida de três letras iguais seguidas.' };
  }
  return { ok: true, reason: null };
}

/**
 * Verifica se a linha digitada ignora pistas já reveladas pelas tentativas anteriores
 * (letra verde trocada de lugar, letra amarela repetida na mesma casa ou ausente,
 * letra já descartada usada de novo). Retorna as casas problemáticas e o motivo.
 */
export function findClueViolations(guess, guesses, target) {
  const len = target.length;
  const cleanStr = Array.isArray(guess)
    ? guess.map((c) => normalizeWord(c)[0] || ' ').join('')
    : String(guess || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ç/gi, 'c')
        .toUpperCase();

  const slots = new Array(len);
  const slotCounts = Object.create(null);
  let filledCount = 0;
  for (let i = 0; i < len; i++) {
    const ch = cleanStr[i];
    if (ch >= 'A' && ch <= 'Z') {
      slots[i] = ch;
      slotCounts[ch] = (slotCounts[ch] || 0) + 1;
      filledCount++;
    } else {
      slots[i] = '';
    }
  }

  const cells = new Set();
  let reason = null;
  const add = (i, why) => {
    if (i >= 0) cells.add(i);
    if (!reason) reason = why;
  };

  const knownExact = new Array(len).fill('');

  for (const prev of guesses) {
    const ev = evaluateGuess(prev, target);
    const p = normalizeWord(prev);
    for (let i = 0; i < len; i++) {
      if (ev[i] === 'correct') knownExact[i] = p[i];
    }
  }

  for (const prev of guesses) {
    const ev = evaluateGuess(prev, target);
    const p = normalizeWord(prev);
    const minCount = Object.create(null);
    const hasAbsent = Object.create(null);

    for (let i = 0; i < len; i++) {
      const ch = p[i];
      if (ev[i] === 'absent') {
        hasAbsent[ch] = true;
      } else {
        minCount[ch] = (minCount[ch] || 0) + 1;
      }

      if (ev[i] === 'correct') {
        if (slots[i] && slots[i] !== ch) add(i, `A <b>${i + 1}ª letra</b> já foi descoberta: é <b>${ch}</b>.`);
      } else if (ev[i] === 'present') {
        if (slots[i] === ch) add(i, `A letra <b>${ch}</b> existe, mas <b>não</b> na ${i + 1}ª posição.`);
      }
    }

    for (const ch of Object.keys(hasAbsent)) {
      const limit = minCount[ch] || 0;
      if (limit === 0) {
        for (let j = 0; j < len; j++) {
          if (slots[j] === ch) add(j, `A letra <b>${ch}</b> já foi descartada: ela não existe na palavra.`);
        }
      } else if ((slotCounts[ch] || 0) > limit) {
        let kept = 0;
        for (let j = 0; j < len; j++) {
          if (slots[j] === ch && knownExact[j] === ch) kept++;
        }
        for (let j = 0; j < len; j++) {
          if (slots[j] === ch && knownExact[j] !== ch) {
            if (kept < limit) kept++;
            else add(j, `A palavra tem apenas <b>${limit}</b> ocorrência${limit > 1 ? 's' : ''} da letra <b>${ch}</b>.`);
          }
        }
      }
    }

    if (filledCount === len) {
      for (const ch of Object.keys(minCount)) {
        if ((slotCounts[ch] || 0) < minCount[ch]) {
          add(-1, `A letra <b>${ch}</b> faz parte da palavra e precisa aparecer.`);
        }
      }
    }
  }
  return { cells, reason };
}

/**
 * Encontra a próxima letra de dica (uma coluna ainda não descoberta como 'correct').
 */
export function findNextDeduction(guesses, revealedCols, target) {
  const len = target.length;
  const solvedCols = new Set(revealedCols || []);

  for (const g of guesses) {
    const ev = evaluateGuess(g, target);
    for (let i = 0; i < len; i++) {
      if (ev[i] === 'correct') solvedCols.add(i);
    }
  }

  for (let i = 0; i < len; i++) {
    if (!solvedCols.has(i)) {
      return {
        col: i,
        letter: target[i],
        reason: `A <b>${i + 1}ª letra</b> da palavra secreta é <b>${target[i]}</b>!`,
      };
    }
  }
  return null;
}

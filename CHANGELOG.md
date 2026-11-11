# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo para manter o histórico técnico entre sessões e agentes de IA.

---

## [0.4.0] - 2026-11-11

**Agente / Modelo:** Antigravity (Google DeepMind)

### Correção Crítica de Sincronização no GitHub Pages / Firebase (`F5` após cada ação)
- **Causa raiz identificada e corrigida em `public/js/main.js` e `public/js/net-firebase.js`**:
  - Em `public/js/main.js`, `onPick()` chamava `act(...)` *antes* de definir `ui.pending = true` e chamar `boardView.update(G, targets(), colorOf)`. No GitHub Pages (onde `USE_FIREBASE = true`), o modo Anfitrião (`net-firebase.js`) executava `handlePlayerMsg()` -> `flushHost()` -> `syncAll()` -> `onMsg({ t: 'game' })` -> `applyGame()` de forma **síncrona** dentro da mesma pilha de chamada de `act(...)`. Quando `applyGame()` terminava (tendo definido `ui.pending = false` e desenhado os alvos de `setupRoad`), a execução retornava para as linhas finais de `onPick()`, que definiam `ui.pending = true` e redesenhavam o tabuleiro com `targets()` vazio — apagando os alvos da trilha e travando a interface até o jogador dar `F5`.
  - Agora `onPick()` salva `const mode = ui.mode`, limpa `ui.mode = null`, define `ui.pending = true` e atualiza o tabuleiro **antes** de despachar `act(...)`.
  - Em `public/js/net-firebase.js`:
    - `send(m)` no Anfitrião agora despacha `handlePlayerMsg(uid, m)` via `queueMicrotask`, garantindo que o envio nunca reentre sincronamente no meio de um handler de UI.
    - `syncAll(events, includeBoard, includeRoom)` emite `room` antes de `game` e apenas quando a sala realmente muda (`includeRoom = true`), evitando re-renderizações desnecessárias a cada jogada.
    - No Convidado, `onValue(views/${uid})` aguarda `cachedBoard` caso a visão chegue antes de `public`, e `onValue(public)` evita reprocessar `boardJson` idêntico.
- **Testes automatizados (`test/security.js`)**:
  - Adicionada suíte de regressão que valida o ciclo completo `setupVillage` -> `setupRoad` -> `setupVillage` -> `setupRoad` -> `main` (`buildRoad`) tanto em entrega síncrona quanto em microtask, garantindo que os alvos da trilha apareçam imediatamente sem precisar de `F5`.

### Modais no Tema "Quermesse Noturna" + Botão "Sobre e Créditos"
- **Modais no tema novo (`public/css/style.css`)**:
  - Todos os modais (`.modal`: descarte, roubo, troca, cartas de trapaça, regras/sobre e fim de jogo) e o cartão de oferta recebida (`.offer-card`) foram migrados do fundo claro antigo para o tema escuro de tábua pintada (`--board`, `--board-2`, `--night-2`, `--cream`, `--yellow`, `--line`), com contraste WCAG AA.
- **Botão e Aba "Sobre e créditos" e Guia "Como joga" (`public/index.html`, `public/js/main.js`, `public/css/style.css`)**:
  - Adicionados botões **Como joga** e **Sobre e créditos** na tela inicial (`#screen-home`) e na sala de espera (`#screen-lobby`), além do botão no canto do jogo (`#screen-game`).
  - Na aba **Sobre e créditos**, o cartão de **Caio Nunes** (`@caionunespn`) usa avatar masculino (`avatar(0)` — Capitão Brasa, e `avatar(2)` — Zé Coalho no bloco da história) e texto direto, bem-humorado e sem clichês de IA, contando que o jogo foi feito do zero *"porque o Iuri duvidou que eu era muito poderoso"*.
  - Na aba **Como joga**, os blocos repetitivos foram substituídos por um guia visual estruturado em 4 seções: banner de objetivo (`.rules-goal`), passo a passo do turno em 3 cartões numerados (`.rules-steps`), grade 2×2 de custos e pontos de construção (`.rules-builds`), destaques do 7/Catapulta e medalhas (`.rules-specials`) e grade compacta das 6 cartas de trapaça (`.rules-tricks`).
- **Níveis de Dificuldade dos Bots (`Fácil`, `Médio`, `Difícil`) (`public/js/engine/bot.js`, `public/js/engine/game.js`, `server/index.js`, `public/js/net-firebase.js`, `public/js/main.js`)**:
  - Seletor de nível dos bots dentro da sala de espera (`renderLobby`), exibido para o anfitrião configurar os bots da sala criada.
  - Três comportamentos distintos em `public/js/engine/bot.js`:
    - **Fácil**: escolhas iniciais com alta variabilidade, aceita trocas generosas, não foca o líder na catapulta e faz menos trocas com o banco.
    - **Médio**: heurística equilibrada de pontuação de vértices, trilhas e trocas.
    - **Difícil**: avalia complementaridade/escassez de recursos na produção atual e bônus de portos, disputa ativamente a Maior Trilha e o Rei da Catapulta, foca implacavelmente o líder com a catapulta, preserva recursos necessários no descarte do 7 e recusa trocas com jogadores próximos da vitória (`>= 7` pts).

### Impeccable (v4.8.2) — Passagem em Duas Frentes (Telas e Assets)
- **Frente 1 — Todas as Telas (`public/index.html`, `public/css/style.css`, `public/js/main.js`, `public/js/fx.js`)**:
  - Auditoria e polimento das 3 telas (`#screen-home`, `#screen-lobby`, `#screen-game`) e de todos os 6 modais.
  - Eliminados todos os alertas do detector `impeccable detect` (`pulsing-dot`, `dark-glow`, `side-tab` e `bounce-easing` -> `0` ocorrências).
  - Adicionado fechamento de modal ao clicar no backdrop (`#modal-root`) e proteção contra duplo clique em `roll` e `end`.
- **Frente 2 — Design Geral dos Assets e Clareza de Jogo (`public/js/art.js`, `public/js/board.js`, `public/js/main.js`, `public/css/style.css`)**:
  - **A Catapulta como o "Ladrão" no tabuleiro**: em vez de um pedregulho estático, a peça estacionada no terreno bloqueado (`BOULDER` em `public/js/art.js` e `ROCK` em `public/js/fx.js`) agora é uma **Catapulta sobre rodas de madeira e ferro**, com flâmula vermelha e braço lançador (`.cat-arm`) que se desloca entre os terrenos e arremessa a carta roubada diretamente para o jogador.
  - **Mini Ranking Enxuto ao lado do Chat (`#rank` em `public/index.html`, `renderRank` em `public/js/main.js`)**: pílulas super compactas (`1º [carinha]`, `2º [carinha]`, `3º [carinha]`, `4º [carinha]`) posicionadas na margem direita do palco ao lado da coluna do chat/diário (`#side`), sem bloquear o banner nem o tabuleiro no mobile.
  - **Zoom e Pan Interativos no Tabuleiro (`BoardView` em `public/js/board.js`, `#zoom-ctrl` em `public/index.html`)**: manipulação fluida do grid estilo Colonize.io via roda do mouse (ancorada no cursor), arraste com mouse ou 1 dedo, pinça com 2 dedos no celular (`pointerdown`/`pointermove`), duplo clique para recentralizar e botões `-` / `+` / `⟲` no canto inferior esquerdo do palco. As coordenadas de tela (`getScreenCTM`) acompanham automaticamente o `viewBox`.
  - **Polimento Completo da Visualização Mobile (`public/css/style.css`)**: ajustes em `@media (max-width: 1100px)`, `@media (max-width: 480px)` e paisagem (`max-height: 540px`) corrigindo quebras nos cantos dos cartões `.pl`, ícones de custo em `.act-btn`, campo `#in-code`, posição de `#offer` acima dos dados/reações e gaveta `#side`.
  - **Identificação clara do Banco (`#bank` em `public/js/main.js` e `public/css/style.css`)**: cabeçalho **Banco da Quermesse** com ícone de barraca, botão rápido de **Trocar** na sua vez e grade com os nomes de cada recurso (`Madeira`, `Pedra`, `Queijo`, `Abóbora`, `Cristal`, `Trapaças`).
  - **Animações de fundo ("juicy") na Home e no Jogo (`buildAmbient` em `public/js/main.js`, `public/css/style.css`)**: balõezinhos/lanternas e vagalumes de quermesse flutuando suavemente no fundo da tela inicial e do palco (`.ambient`), balanço contínuo dos medalhões dos personagens na Home (`.cast-bob`) e maré respirando ao redor da ilha (`.foam`, `.foam2`).
  - Refinamento dos ícones de recursos (`wood`, `stone`, `cheese`, `pumpkin`, `crystal`) e cartas de trapaça (`c-knight`, `c-vp`, `c-roads`, `c-plenty`, `c-monopoly`, `c-gale`) com facetas, volumes e pontos de luz mais ricos.
  - Retratos dos 6 personagens (`CHARS` e `avatar()`) enriquecidos com moldura dupla de medalhão, brilho nos olhos (*catchlights*) e detalhes de acessórios.
  - Peças do tabuleiro (`SHAPES.village`, `SHAPES.castle`) com textura de madeira/pedra e janelas iluminadas; fichas de número com anel interno tracejado (`.tk-ring`) e placas de porto com filete interno (`.sign-in`).

---

## [0.3.0] - 2026-11-11

**Agente / Modelo:** Claude Code (Fable 5.2)

### Redesign: "quermesse noturna"
- Identidade nova registrada em `PRODUCT.md` (para quem é) e `DESIGN.md` (regras do visual).
- `public/js/art.js` (novo): elenco de 6 personagens, ~35 ícones próprios e as peças do tabuleiro
  (vila, castelo, pedregulho, gente e carroças). Emojis ficaram só nas reações.
- `public/js/board.js`: terrenos com textura, mar noturno, portos em placa, vilas/castelos maiores sobre
  base na cor do dono, gente e carroças andando nas trilhas, fumaça e bandeiras.
- `public/css/style.css` reescrito: três layouts (largo, compacto, celular deitado), um botão principal por
  momento, custos nos botões com o que falta apagado, reações num botão só.
- Animações só com `transform`/`opacity`; removidos fundo animado em tela cheia e filtro no tabuleiro inteiro.
- Opção "Sair da partida" (dentro de "Como joga"), com confirmação.

### Correções
- **Partida travava com a aba em segundo plano**: o cliente esperava a animação da catapulta terminar e o
  navegador pausa animações de abas ocultas. Agora toda espera tem temporizador de segurança (`fx.js`).
- **Firebase (`net-firebase.js`)**:
  - O Realtime Database descarta listas/objetos vazios e `null`; o estado chegava incompleto no convidado e a
    tela quebrava ao desenhar. Estado, tabuleiro e cópia do anfitrião agora trafegam como texto JSON.
  - Convidado que caía (ou trocava de aplicativo no celular) era ignorado para sempre: o aviso de queda usava
    um `seq` gigante e as mensagens seguintes pareciam "antigas". Agora o aviso usa o relógio do servidor, o
    anfitrião trata qualquer mudança de `seq` como mensagem nova e o convidado se reapresenta a cada reconexão.
  - Anfitrião recarregando a página não reexecuta mais a última ação de cada convidado.
  - A tela do anfitrião recebia referências vivas do estado do motor; agora recebe cópia.
  - Convidados são avisados quando o anfitrião cai.
  - Sala sem chave usa o marcador `-` em vez de texto vazio (as regras publicadas continuam valendo).
- Em `localhost` o cliente usa o servidor Node; `?fb=1` força o Firebase.

---

## [0.2.0] - 2026-11-10

**Agente / Modelo:** Antigravity (Google DeepMind — Gemini High)

### Arquitetura e Contexto para Outros Agentes (Claude / Antigravity)
- **Fonte única da verdade do motor de jogo (`public/js/engine/`)**:
  - Os módulos puros de regras, geração de tabuleiro e IA dos bots foram movidos para:
    - `public/js/engine/board.js`
    - `public/js/engine/game.js`
    - `public/js/engine/bot.js`
  - Os arquivos em `server/board.js`, `server/game.js` e `server/bot.js` apenas reexportam (`export * from '../public/js/engine/...'`) para manter 100% de compatibilidade com o servidor Node (`server/index.js`) e com os testes (`test/sim.js` e `test/security.js`).
  - **Importante ao editar regras ou bots:** edite sempre em `public/js/engine/` para que tanto o deploy estático/Firebase (Vercel) quanto o servidor WebSocket local reflitam a mudança.
- **Transporte Dual (Firebase Realtime Database + WebSocket Local)**:
  - `public/js/firebase-config.js`: armazena a configuração do projeto Firebase (`habits-e8eb7`). Se `apiKey` e `databaseURL` estiverem preenchidos, `public/js/main.js` usa automaticamente o transporte Firebase (`public/js/net-firebase.js`). Se estiverem vazios, usa o WebSocket nativo (`server/index.js`).
  - `public/js/net-firebase.js`: implementa o modelo **Host-Authoritative (Anfitrião Autoritativo)** sobre o Firebase Realtime Database (no caminho isolado `/catapulta/rooms/{code}`):
    - Autenticação via **Firebase Anonymous Auth** (`signInAnonymously`), garantindo `auth.uid` criptográfico por jogador.
    - O navegador de quem cria a sala (Anfitrião) executa `public/js/engine/game.js` e `public/js/engine/bot.js` em memória, mantendo backup em `/catapulta/rooms/{code}/hostState` (permitindo recuperar a partida se o anfitrião recarregar a página com `F5`).
    - Os convidados enviam intenções de jogada apenas em `/catapulta/rooms/{code}/inbox/{uid}` e leem somente a sua própria visão filtrada (`view(g, i)`) em `/catapulta/rooms/{code}/views/{uid}` (sem acesso às cartas alheias nem ao baralho).

### Segurança e Blindagem (Server, Engine, Firebase e Vercel)
- **Motor do Jogo (`public/js/engine/game.js`)**:
  - Validação estrita com `Number.isInteger` e `Object.hasOwn` em `moveCatapult`, `steal`, `buildRoad`, `buildVillage`, `buildCastle`, `playCard`, `confirmTrade`, `placeVillage`, `placeRoad` e `act`.
  - Corrige vulnerabilidade onde passar nomes de métodos de `Array.prototype` / `Object.prototype` (ex.: `{ type: 'moveCatapult', tile: 'slice' }` ou `card: 'toString'`) corrompia o estado da partida ou causava `TypeError` no meio da mutação.
- **Servidor HTTP e WebSocket (`server/index.js`)**:
  - **HTTP**:
    - Proteção de `decodeURIComponent` com `try/catch` e rejeição de *null bytes* (`\0`), evitando queda do processo Node (`URIError`) ao receber URLs malformadas como `/%`.
    - Proteção estrita contra *Path Traversal* usando `path.resolve` + verificação de prefixo `PUBLIC + path.sep` e *whitelist* de extensões `MIME`.
    - Restrição de métodos HTTP apenas a `GET` e `HEAD` (`405 Method Not Allowed` para os demais).
    - Configuração de `headersTimeout`, `requestTimeout` e `keepAliveTimeout` contra ataques *Slowloris*.
    - Adição de cabeçalhos de segurança: `Content-Security-Policy` (CSP), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` e `Cross-Origin-Resource-Policy`.
  - **WebSocket & Salas**:
    - Validação de cabeçalho `Origin` no handshake (`verifyClient`) contra *Cross-Site WebSocket Hijacking (CSWSH)*.
    - Geração de códigos de sala com CSPRNG (`randomInt` de `node:crypto`) e limite máximo de salas (`MAX_ROOMS = 60`).
    - Prevenção de *Session Fixation*: tokens de assento (`randomUUID()`) agora são gerados exclusivamente pelo servidor ao criar vagas; o token enviado pelo cliente só é usado para reconectar a um assento já existente.
    - *Rate Limiting* por conexão WebSocket (*Token Bucket*: fecha com código `1008` em caso de flood), cooldown de `1200ms` em `offerTrade`, limite de conexões simultâneas por IP (`MAX_CONN_PER_IP = 16`), timeout de `15s` para sockets não autenticados e bloqueio por IP após 10 falhas de autenticação/código de sala por minuto.
    - Suporte a chave de convite do servidor (`--key=auto` / `--key=segredo` / `ACCESS_KEY`) validada com `timingSafeEqual`.
- **Regras do Firebase Realtime Database (`database.rules.json`)**:
  - Leitura raiz bloqueada (`.read: false`, `.write: false`), impedindo listagem de salas ativas.
  - Tudo isolado sob `/catapulta/rooms/$code` para não colidir com outras coleções do projeto Firebase.
  - Nó `/catapulta/rooms/$code/secret` com `.read: false` (ninguém consegue ler a senha da sala), mas validado pelo servidor do Firebase na entrada de mensagens (`newData.child('key').val() === root.child('catapulta/rooms').child($code).child('secret').val()`).
  - Isolamento por `auth.uid`: cada jogador só pode ler `/views/$uid` e escrever em `/inbox/$uid`; apenas o `hostUid` pode escrever em `/public`, `/views/*` e `/hostState`.
- **Deploy no GitHub Pages (`.github/workflows/pages.yml`) e Cliente (`public/`)**:
  - Criado workflow `.github/workflows/pages.yml` publicando `public/` automaticamente no GitHub Pages (`https://caionunespn.github.io/catapulta/`), com `<meta http-equiv="Content-Security-Policy">` embutido em `public/index.html`.
  - Adicionado campo opcional **Chave da sala** na tela inicial (`public/index.html` e `public/js/main.js`), que é anexado automaticamente como `?sala=XXXX&chave=YYYY` ao clicar em **🔗 Copiar link de convite**.

### Testes
- Adicionada suíte automatizada de segurança em `test/security.js` cobrindo:
  - Injeção de `Array.prototype` / `Object.prototype` nas ações do jogo;
  - Requisições HTTP malformadas (`/%E0%A4%A`), *Path Traversal* (`..%2Fpackage.json`), métodos inválidos (`POST`) e presença dos headers CSP/`nosniff`/`DENY`;
  - Bloqueio de WebSocket com `Origin` externo (`403`);
  - Exigência de chave de convite e rejeição de token forjado pelo cliente;
  - Encerramento de conexão (`1008`) em caso de flood de mensagens.

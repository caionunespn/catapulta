# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo para manter o histórico técnico entre sessões e agentes de IA.

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
- **Deploy na Vercel (`vercel.json`) e Cliente (`public/`)**:
  - Criado `vercel.json` servindo `public/` com todos os cabeçalhos de segurança e CSP compatível com Google Fonts e Firebase SDK.
  - Adicionado campo opcional **Chave da sala** na tela inicial (`public/index.html` e `public/js/main.js`), que é anexado automaticamente como `?sala=XXXX&chave=YYYY` ao clicar em **🔗 Copiar link de convite**.

### Testes
- Adicionada suíte automatizada de segurança em `test/security.js` cobrindo:
  - Injeção de `Array.prototype` / `Object.prototype` nas ações do jogo;
  - Requisições HTTP malformadas (`/%E0%A4%A`), *Path Traversal* (`..%2Fpackage.json`), métodos inválidos (`POST`) e presença dos headers CSP/`nosniff`/`DENY`;
  - Bloqueio de WebSocket com `Origin` externo (`403`);
  - Exigência de chave de convite e rejeição de token forjado pelo cliente;
  - Encerramento de conexão (`1008`) em caso de flood de mensagens.

# Catapulta

Party game web multiplayer (2 a 4 jogadores) de hexágonos, recursos, trocas e catapultas.
Servidor Node autoritativo + cliente em SVG, sem etapa de build.

## Rodar

```bash
npm install
```

```bash
npm start
```

Abra `http://localhost:3000`, crie uma sala e mande o link de convite. Quem estiver na mesma
rede entra pelo endereço "Na rede" que o servidor imprime no terminal. Para jogar pela internet,
hospede o servidor em qualquer serviço que rode Node com WebSocket (a porta vem de `PORT`).

Para rodar protegido por chave de convite (só entra quem tiver o link com `?chave=...`):

```bash
npm run start:private
# ou definindo uma senha fixa:
node server/index.js --key=minhasenha
```

## Deploy Gratuito (GitHub Pages + Firebase Realtime Database)

1. No [Console do Firebase](https://console.firebase.google.com/) (plano **Spark** gratuito):
   - Ative **Authentication** → *Sign-in method* → **Anônimo** (*Anonymous*).
   - Crie um **Realtime Database** e, na aba **Regras** (*Rules*), cole o conteúdo de [`database.rules.json`](database.rules.json) e clique em **Publicar**.
2. Em *Configurações do Projeto* → *Seus aplicativos* (Web), copie os campos (`apiKey`, `authDomain`, `databaseURL`, `projectId`) para [`public/js/firebase-config.js`](public/js/firebase-config.js).
3. Qualquer *push* na branch `main` publica automaticamente a pasta `public/` no **GitHub Pages** via [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

## Testes

```bash
npm test
```

Simula centenas de partidas só com bots e checa as invariantes das regras.

Para acompanhar bots em alta velocidade: `node server/index.js --port=3001 --bot-speed=12`.
Para abrir vários jogadores no mesmo navegador, use abas com `?p=1`, `?p=2`…

## Estrutura

- `server/board.js` — geração do tabuleiro (terrenos, números, portos)
- `server/game.js` — regras, ações e visão por jogador (esconde a mão alheia)
- `server/bot.js` — IA dos bots (também assume jogadores desconectados)
- `server/index.js` — HTTP estático + salas via WebSocket
- `public/` — cliente (telas, tabuleiro SVG, efeitos e sons)

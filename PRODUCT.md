# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Amigos de 18 a 35 anos que já jogam jogos de tabuleiro e jogos online. Jogam juntos em grupos de 2 a 4, parte no computador (em call) e parte no celular; os dois contextos têm o mesmo peso. Clima competitivo e zoeiro entre conhecidos.

## Product Purpose

Catapulta é um party game web multiplayer de tabuleiro hexagonal: fundar vilas, abrir trilhas, trocar recursos e sabotar os amigos com a catapulta até alguém chegar a 10 pontos. Sucesso é uma partida que qualquer um do grupo entende de primeira, flui sem travar e rende risada: o tabuleiro precisa ser legível e vivo ao mesmo tempo.

## Positioning

Um jogo de colonização em hexágonos com cara própria: a catapulta (o bloqueio de terreno) é o centro da personalidade, o humor é brasileiro e a apresentação tem "juice" — o oposto da interface utilitária dos concorrentes do gênero.

## Operating Context

Sala criada por link de convite (código de 4 letras), sem cadastro. Bots preenchem vagas e assumem quem desconecta. Roda com servidor Node/WebSocket próprio ou, publicado no GitHub Pages, via Firebase Realtime Database.

## Capabilities and Constraints

- 2 a 4 jogadores, humanos ou bots; regras autoritativas no motor compartilhado (`public/js/engine`).
- Cliente sem etapa de build: HTML, CSS e módulos ES; tabuleiro em SVG.
- Deve funcionar em celular retrato, celular paisagem e desktop.
- Política de segurança de conteúdo restrita (CSP no `index.html`): sem imagens externas; fontes só do Google Fonts.
- Recursos: madeira, pedra, queijo, abóbora, cristal. Peças: trilha, vila, castelo. Cartas de trapaça: Catapulteiro, Banquete, Mutirão, Fartura, Arrastão, Vendaval.

## Brand Commitments

- O nome "Catapulta" é definitivo.
- O tom zoeiro dos textos em pt-BR ("Arrastão", "Nem pensar", "está aprontando…") é definitivo.
- Personagens e iconografia próprios do jogo; emojis não representam jogadores nem substituem ícones. Emojis de reação continuam, discretos.
- Não pode parecer aplicativo infantil.

## Evidence on Hand

Sem arte externa, logotipo ou fotos: toda a arte é desenhada em SVG no próprio projeto. Não há números de uso, depoimentos nem marca registrada a citar.

## Product Principles

1. O tabuleiro é o protagonista; a interface serve a ele e nunca o cobre.
2. Legibilidade antes de enfeite: de relance dá para saber de quem é cada peça e o que cada terreno rende.
3. Toda ação tem resposta visível e sonora na hora.
4. Celular e computador são cidadãos de primeira classe.
5. Zoeira com acabamento: humor no texto e no movimento, não na bagunça visual.

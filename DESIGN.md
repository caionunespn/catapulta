# Design — Catapulta

Mundo visual: **quermesse noturna**. O tabuleiro é uma ilha acesa no escuro; a interface são tábuas
pintadas a esmalte por um pintor de letreiro. Nada de céu azul de bolinhas nem de pergaminho medieval.

## Cor

Estratégia: paleta completa sobre chão noturno. O tabuleiro carrega a cor; a interface recua.

| Papel | Token | Valor |
|---|---|---|
| Chão (noite) | `--night`, `--night-2` | `#0e1a24`, `#132635` |
| Tábua (painéis) | `--board`, `--board-2` | `#1a3040`, `#223d50` |
| Filete de pintor | `--line` | creme a 20% |
| Lona (texto claro, placas, cartazes) | `--cream`, `--cream-2` | `#f6e8c8`, `#e3cfa2` |
| Piche (contorno e texto escuro) | `--ink` | `#14202b` |
| Texto secundário | `--mute` | `#9fb8c2` |
| Amarelo ovo (ação principal, pontos, luz) | `--yellow` | `#f7b733` |
| Vermelho barraca (passar a vez, perigo) | `--red` | `#e5482f` |
| Verde garrafa (confirmar) | `--green` | `#3bab6a` |
| Anil | `--blue` | `#3d7be0` |

Jogadores (em `public/js/art.js`): `#e8472f`, `#3d7be0`, `#f5b62e`, `#e0569d`, `#1fae96`, `#f4efe4`,
cada um com um tom escuro para a base das peças.

Terrenos (borda / miolo): bosque `#1c6443`/`#2c8557`, pedreira `#56667a`/`#7c8da2`, pasto
`#6f9a33`/`#9cc24e`, horta `#bd7f1c`/`#e0a437`, gruta `#4d3688`/`#7355b8`, pântano `#4e4636`/`#74694f`.

Regras: amarelo é sempre "o que fazer agora" (botão principal, placa da vez, lâmpada do jogador ativo).
Vermelho só para passar a vez, recusar e o 7. Texto sobre tábua escura é creme; sobre cartaz creme é piche.

## Tipografia

- **Bungee** (`--display`): logotipo, números (dados, pontos, fichas do tabuleiro), títulos de cartaz.
- **Barlow Condensed** 600/700 (`--label`): rótulos e botões, em caixa alta com espaçamento.
- **Barlow** 500/600 (`--body`): texto corrido (diário, regras).

## Formas

- **Tábua** (`.panel`, HUD, cartões de jogador, modais): fundo `--board`, contorno piche de 2px e um filete creme
  interno (`--line`). Sombra suave com deslocamento vertical real, nunca brilho neon de offset zero.
- **Placa** (`.btn`): tinta chapada, contorno piche, borda inferior no tom escuro da mesma cor (espessura)
  e sombra difusa. Afunda ao pressionar.
- **Cartaz / Modal** (`.modal`, `.offer-card`): também seguem a tábua escura de quermesse noturna (`--board` / `--night-2`) com títulos em amarelo ovo (`--yellow`), texto creme (`--cream`) e subcartões em `--night-2`. No celular sobe da base da tela.
- **Cordão de lâmpadas** (`.garland`): assinatura do mundo, no topo da tela inicial e do palco. Lâmpadas acesas estáticas com reflexo de vidro, sem pisca-pisca infinito.

## Personagens e ícones

Tudo em `public/js/art.js`, no mesmo traço: contorno piche de 1.8, cantos arredondados, tinta chapada e
um único brilho por peça.

- **Elenco**: Capitão Brasa, Dona Maré, Zé Coalho, Madame Pipoca, Tia Hortelã, Vovô Pedregulho — um por cor.
  Emojis nunca representam jogadores; só as reações usam emoji.
- **Ícones**: recursos, estatísticas, ações e as seis cartas de trapaça (`ico('nome')`).
- **Peças**: vila e castelo sobre uma base na cor do dono, telhados na cor, paredes neutras e janelas
  acesas. O dono se lê pela base e pelo telhado, não só pelo contorno.

## Movimento

- Peças, dados e fichas do jogo usam desaceleração rápida (`--snap: cubic-bezier(.22, 1, .36, 1)`): caem, amassam e assentam sem quique artificial.
- Interface (cartazes, avisos, sala) usa desaceleração suave (`--out`), sem quique.
- Vida ambiente no tabuleiro: gente e carroças andando nas trilhas, fumaça das chaminés, bandeiras.
- A placa da vez balança uma única vez quando vira a sua vez; nada pisca sem motivo.
- Só `transform` e `opacity` são animados; nenhum fundo animado em tela cheia.
- Com `prefers-reduced-motion`, todas as animações param e nada fica escondido.
- Nenhuma animação bloqueia a partida: tudo que o jogo espera tem temporizador de segurança.

## Layout

- **Largo** (> 1100px): jogadores à esquerda, tabuleiro no centro, banco e diário à direita, barra inferior.
- **Compacto** (≤ 1100px, celular em pé): faixa de jogadores no topo, tabuleiro, barra inferior em linhas;
  banco e diário abrem numa gaveta.
- **Celular deitado** (altura ≤ 540px): coluna de jogadores, tabuleiro, painel de ações à direita.
- Um único botão principal por momento: "Rolar dados", "Passar a vez" ou a indicação de quem joga.
- Custos aparecem nos próprios botões; o que falta na mão fica apagado.

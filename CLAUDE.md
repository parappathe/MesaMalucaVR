# MesaMalucaVR ("Mesa Maluca")

Ping pong em VR para o Meta Quest 3, no navegador do óculos (WebXR), num parque de diversões.
São 10 mesas malucas, uma por fase, cada uma ensinando um obstáculo (para-choques, buracos,
rede que sobe e desce, degrau...); a última mistura tudo e é o chefe. Cada mesa tem o seu
adversário. Também dá para jogar no PC com o mouse. Feito a partir do `PingPongVR`.

## Como rodar / jogar

**No PC:** `python serve.py` nesta pasta e abrir `http://localhost:8851` (é o que o painel de
visualização usa, via `.claude/launch.json`). Use o `serve.py`, não o `python -m http.server`:
ele manda o navegador não guardar cache.

**No Quest:** quando for publicado, abrir **https://parappathe.github.io/MesaMalucaVR/** no
navegador do óculos e apertar "Entrar em VR" (publicar: commitar e `python publicar.py
MesaMalucaVR` na pasta `C:\claude code`; ainda não foi publicado). Alternativa pela rede de casa:
`jogar-no-quest.bat` (ou `python serve.py --https`), abrir no Quest o endereço `https://192.168.x.x:8443`
que aparece na janela e aceitar o aviso de certificado.

### Controles

| | VR (Quest) | PC |
|---|---|---|
| Raquete | Na mão direita (ou esquerda, nas Opções). Bate de verdade: velocidade e ângulo definem força, direção e efeito | Segue o mouse num plano à frente da mesa |
| Sacar | Gatilho da mão livre (ou A/X) joga a bola para cima; aí bate com a raquete | Clique joga a bola; clique de novo para bater |
| Cortada | Bater forte | Segurar o botão do mouse na hora da batida |
| Mira | A raquete | Lado da raquete que acerta a bola (esquerda manda para a esquerda) |
| Pausa | B ou Y | Esc ou P |
| Menu | Apontar com o controle e gatilho | Clique |
| FPS | Opções → Mostrar FPS | Tecla F |

No menu de pausa do VR tem "Recentralizar" (põe você atrás da mesa, virado para ela); isso
também acontece sozinho ao entrar no VR. A raquete vibra ao bater, ao acertar um para-choque,
ao acertar um alvo e ao fazer ponto.

### As mesas

| # | Mesa | O que tem | Adversário |
|---|---|---|---|
| 1 | Fliperama | 2 para-choques do lado do adversário: rebatem a bola com força extra, acendem e fazem "ping" | Pipoca |
| 2 | Queijo Suíço | 4 buracos (2 de cada lado) | Dona Lurdinha |
| 3 | Rede Elevador | A rede sobe e desce (5 a 34 cm, ciclo de 5 s) | Zé Elevador |
| 4 | Escadaria | Metade do adversário 12 cm mais alta (a parede do degrau faz parte da rede) | Escadinha |
| 5 | Mar de Ondas | Tampo ondulado: a bola quica torta conforme a encosta | Marola |
| 6 | Ventania | Ventilador lateral sopra numa faixa no meio da mesa (força varia num ciclo), partículas mostram o vento | Ventania |
| 7 | Pista de Obstáculos | 2 barreiras baixas que deslizam de lado, uma em cada metade | Porteiro |
| 8 | Gangorra | A mesa inteira inclina devagar de um lado para o outro (até ~6°, ciclo de 7 s) | Madame Balança |
| 9 | Tiro ao Alvo | Um alvo aceso em cada metade, em lugar sorteado a cada saque | Mira Certa |
| 10 | Grande Final do Parque (chefe) | Para-choques, buracos, rede elevador, vento (para o outro lado) e alvos | Mestre do Parque |

### Regras

Partida de 1 set até 7 com 2 de vantagem. Saque troca a cada 2 pontos, e a cada ponto no 6 x 6.
Saque simplificado (a bola pode ir direto para o lado do adversário). Rede no saque e bola certa:
repete. Pegar a bola antes de quicar no seu lado: ponto do outro, a não ser que ela fosse cair fora.

- **Buraco:** bola que cai num buraco do lado do adversário é ponto seu; no seu lado, ponto dele
  (vale para qualquer momento da jogada).
- **Alvo:** o primeiro quique válido dentro do alvo aceso do outro lado dá **1 ponto extra** para
  quem bateu, somado quando a jogada termina (depois do ponto normal). Se o ponto normal já fechou
  a partida, o extra não conta.
- **Para-choque/barreira:** não contam como quique; a bola só muda de caminho.

Progresso: vencer a mesa da vez libera a próxima; dá para jogar de novo qualquer mesa liberada.
Estrelas por mesa (fica a melhor): ★ vencer, ★★ vencer por 4 pontos ou mais, ★★★ perder no máximo
1 ponto. Progresso e opções ficam salvos no navegador (localStorage, chave `mesamalucavr.v1`).

## Como testar

- `node tests/run.js` (ou `npm test`): física básica (quique, rede, efeito, raquete rápida,
  resolvedor, ajuda na mira), um teste de cada obstáculo (para-choque devolve com força, bola cai
  no buraco e a IA não tenta pegar, rede alta bloqueia e baixa deixa passar, degrau, onda entorta
  o quique, vento desvia e o resolvedor compensa, barreira bloqueia e o resolvedor passa por cima,
  gangorra joga a bola para o lado baixo, alvo soma ponto extra), regras (até 7, saque, 6 x 6),
  cada adversário devolve bolas na própria mesa, partidas IA x IA terminam em todas as mesas com
  rallies razoáveis, o Mestre do Parque ganha da Pipoca, e as estrelas. Uns 3 s. Tem que terminar
  com "Tudo certo".
- No navegador (console): `mesa.dev.autoplay = true; mesa.startMatch(0); mesa.dev.advance(60)`
  joga 60 s na hora com a raquete do mouse seguindo a bola sozinha (o autoplay não erra, então não
  mede dificuldade). `mesa.dev.state()` mostra o estado; `mesa.dev.snapshot()` devolve a tela em
  PNG. Usar o `dev` deixa o jogo mudo (testes nunca tocam som). `advance` existe porque o painel
  de visualização escondido não anima a página.
- **Só dá para testar no óculos:** raquete na mão, sensação da batida, ajuda na mira, saque com a
  mão livre, vibração, conforto, desempenho (meta: 72 FPS) e se cada obstáculo fica divertido.

## Estrutura

| Arquivo | O que tem |
|---|---|
| `index.html`, `css/style.css` | Página, botão "Entrar em VR", dica e FPS do modo PC |
| `js/physics.js` | Física da bola (arrasto, Magnus, quique com atrito, rede), colisões com esfera e caixa, raquete contínua, previsão (`landing`/`stepFree`), resolvedor de jogadas (`solveShot`, com busca em grade de plano B) e ajuda na mira (`assistShot`). Tudo recebe a `arena`. Sem navegador |
| `js/arena.js` | `MesaArena` (superfície, normal, buracos, rede, vento, para-choques, barreiras, inclinação) e a lista `TABLES` com as 10 mesas. Sem navegador |
| `js/match.js` | Regras: `Rally` (um ponto, inclusive buraco) e `Match` (placar até 7, saque). Sem navegador |
| `js/ai.js` | Os 10 adversários (`OPPONENTS`) e a IA (`AIPlayer`), que prevê a bola com a física da mesa. Sem navegador |
| `js/game.js` | `GameCore`: uma partida (bola, regras, saque, IA, alvos) em passos de 1/240 s. Sem navegador |
| `js/tournament.js` | Progresso, estrelas (`starsFor`, `recordResult`) e opções salvas |
| `js/main.js` | Liga tudo: renderização, controles do Quest, mouse, menus, placar, sons, laço principal, `window.mesa` |
| `js/scene.js` | Parque, placar, público, raquete, adversário e `buildTable` (monta e anima a mesa de cada fase) |
| `js/ui.js` | Painel de menu 3D (canvas), com botões e cartões das mesas |
| `js/audio.js` | Sons sintetizados e música de carrossel (Web Audio, sem arquivos) |
| `serve.py`, `jogar-no-quest.bat` | Servidor local sem cache (porta 8851); `--https` para o Quest pela rede |
| `tests/run.js` | Testes automáticos |
| `vendor/three/three.module.js` | Three.js r170 (cópia local) |

Coordenadas: metros, mesa centrada na origem, jogador no lado +Z, adversário no -Z, rede em z = 0,
tampo a 0,76 m. No VR, a cabeça do jogador fica em z = 2,0.

## Regras e convenções do projeto

- `physics.js`, `arena.js`, `match.js`, `ai.js`, `game.js` e as regras de `tournament.js` não podem
  usar nada de navegador nem do Three.js: os testes rodam no Node.
- **Todo obstáculo novo entra na arena**, nunca direto no `stepBall`: superfície/normal/buraco em
  `surfaceY`/`normal`/`hasTop`, força em `accel` (entra também na previsão), colisão em `collide` e
  `blocked` (para a previsão da mira desviar). Coisa que se mexe é função do tempo `t`; a bola leva
  o relógio (`b.t`), e o `GameCore` acerta `b.t = core.time` a cada passo.
- Ajustar uma mesa: valores em `TABLES` (`js/arena.js`). Dificuldade de um adversário: `OPPONENTS`
  (`js/ai.js`): `move`, `reaction`, `speed`, `top`/`back`/`side`, `aim`, `err`, `mistake`.
- Mexeu em física, mesas, regras ou IA: rodar `node tests/run.js`.

## Decisões

- WebXR no navegador (como o PingPongVR): joga sem instalar, quase tudo testável no PC.
- Física parametrizada por uma arena passada às funções (sem estado global), para os testes
  rodarem qualquer mesa lado a lado e a IA e a ajuda na mira "enxergarem" cada obstáculo.
- A previsão de mira (`landing`) usa voo livre com as forças da mesa (vento) e trata
  para-choque/barreira no caminho como "bola bloqueada"; a IA, quando a bola vem, simula com a
  física completa (vê buraco, para-choque, degrau). Se a bissecção falha, o resolvedor faz busca em
  grade de arco e velocidade.
- Buraco: ponto contra o dono do lado onde a bola caiu (mais fácil de entender que "quem bateu").
- Alvo dá ponto extra no fim da jogada (e não na hora) para não interromper o rally.
- Partida até 7 (fases curtas); sem a opção "melhor de 3" do PingPongVR.
- Estrelas: 3 estrelas = perder no máximo 1 ponto (7 x 0 em todas as mesas seria duro demais).

## Pendências / problemas conhecidos

- Nada testado no Quest ainda: posição/ângulo da raquete, força das batidas, FPS, se a rede
  elevador e o vento ficam justos para um humano (a IA x IA teve rallies longos em todas as mesas).
- O autoplay do PC ganha quase todas as mesas: não serve para medir dificuldade real.
- A bola que cai num buraco some por baixo de um fundo escuro (não há física dentro do buraco).

// Liga o núcleo do jogo à tela, aos controles do Quest e ao mouse.
import * as THREE from '../vendor/three/three.module.js';
import { TABLE, DT, paddleHit, solveShot, spinFor, assistShot } from './physics.js';
import { OPPONENTS } from './ai.js';
import { TABLES, makeArena } from './arena.js';
import { GameCore } from './game.js';
import { buildScene, makePaddle, makeOpponent } from './scene.js';
import { Panel, Label } from './ui.js';
import { Sfx } from './audio.js';
import * as T from './tournament.js';

const save = T.loadState();
const sfx = new Sfx();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- Render e cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation?.(1);
document.getElementById('app').appendChild(renderer.domElement);

const world = buildScene();
const scene = world.scene;
const rig = new THREE.Group();
scene.add(rig);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.02, 60);
rig.add(camera);
const DESK_CAM = new THREE.Vector3(0, 1.45, 2.55);
function deskCamera() {
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  camera.position.copy(DESK_CAM);
  camera.lookAt(0, 0.88, -0.6);
}
deskCamera();
const VR_HEAD_Z = 2.0; // onde o jogador fica no VR (atrás do fim da mesa, que está em 1,37)

const opp = makeOpponent();
scene.add(opp.group);

const panel = new Panel(1.1);
panel.mesh.position.set(0, 1.33, 1.25);
scene.add(panel.mesh);

const fpsLabel = new Label(0.14);
fpsLabel.mesh.position.set(0.16, -0.14, -0.6);
fpsLabel.mesh.visible = false;
camera.add(fpsLabel.mesh);

// Raquete do jogador: pivot (ângulo na mão) → paddle.
const paddlePivot = new THREE.Group();
const paddle = makePaddle(0xd23c3c);
paddlePivot.add(paddle);
scene.add(paddlePivot);
const freeHand = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), new THREE.MeshLambertMaterial({ color: 0xe8b48a }));
freeHand.visible = false;
scene.add(freeHand);

// ---------- Estado do app ----------
let app = 'menu';     // 'menu' | 'playing' | 'paused' | 'result'
let core = null;
let tableIndex = T.nextTable(save);   // mesa (fase) atual; o adversário é o da mesma posição
let arena = makeArena(tableIndex);
let screen = 'main';  // tela do painel
let optionsBack = 'main';
let boardMsg = '';
let time = 0;
let menuIndex = tableIndex;           // mesa escolhida na tela de apresentação

// Mostra a mesa i (e o adversário dela) no cenário.
function showTable(i) {
  tableIndex = i;
  arena = makeArena(i);
  world.setTable(TABLES[i], arena);
  opp.setLook(OPPONENTS[i]);
}
showTable(tableIndex);

// ---------- VR: controles ----------
const hands = { left: null, right: null };
const ctrls = [];
for (let i = 0; i < 2; i++) {
  const ctrl = renderer.xr.getController(i);
  const grip = renderer.xr.getControllerGrip(i);
  rig.add(ctrl); rig.add(grip);
  const laser = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0xf2b632 }));
  laser.scale.z = 2; laser.visible = false;
  ctrl.add(laser);
  const entry = { ctrl, grip, laser, source: null, hand: null, prevButtons: [] };
  ctrls.push(entry);
  ctrl.addEventListener('connected', (e) => {
    entry.source = e.data; entry.hand = e.data.handedness;
    if (entry.hand === 'left' || entry.hand === 'right') hands[entry.hand] = entry;
    attachHands();
  });
  ctrl.addEventListener('disconnected', () => {
    if (entry.hand && hands[entry.hand] === entry) hands[entry.hand] = null;
    entry.source = null; entry.hand = null;
    attachHands();
  });
  ctrl.addEventListener('selectstart', () => onTrigger(entry));
}

const paddleHandName = () => save.hand === 'left' ? 'left' : 'right';
const freeHandName = () => save.hand === 'left' ? 'right' : 'left';

function attachHands() {
  const inVR = renderer.xr.isPresenting;
  const ph = hands[paddleHandName()];
  if (inVR && ph) {
    ph.grip.add(paddlePivot);
    paddlePivot.position.set(0, 0, 0);
    paddlePivot.rotation.set(THREE.MathUtils.degToRad(save.angle), 0, 0);
    paddle.position.set(0, 0, -0.12);
    paddle.rotation.set(0, 0, 0);
  } else {
    scene.add(paddlePivot);
    paddlePivot.rotation.set(0, 0, 0);
    paddle.position.set(0, 0, 0);
    paddle.rotation.set(Math.PI / 2, Math.PI / 2, 0, 'YXZ');
  }
  const fh = hands[freeHandName()];
  if (inVR && fh) { fh.grip.add(freeHand); freeHand.position.set(0, 0, 0); freeHand.visible = true; }
  else { scene.add(freeHand); freeHand.visible = false; }
}

function pulse(handName, v, ms) {
  try { hands[handName]?.source?.gamepad?.hapticActuators?.[0]?.pulse?.(v, ms); } catch { /* sem vibração */ }
}

// Coloca o jogador atrás da mesa, virado para ela, onde quer que esteja na sala.
function recenter() {
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  rig.rotation.set(0, -e.y, 0);
  const head = camera.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -e.y);
  rig.position.set(-head.x, 0, VR_HEAD_Z - head.z);
}

let recenterIn = 0;
renderer.xr.addEventListener('sessionstart', () => { recenterIn = 5; attachHands(); updateHint(); });
renderer.xr.addEventListener('sessionend', () => { deskCamera(); attachHands(); updateHint(); });

// ---------- Mouse (PC) ----------
const MOUSE_Z = 1.5;
const mouse = { ndc: new THREE.Vector2(0, -0.3), down: false, clicked: false, x: 0, y: TABLE.y + 0.25 };
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -MOUSE_Z);
const tmpV = new THREE.Vector3();

renderer.domElement.addEventListener('pointermove', (e) => {
  mouse.ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  mouse.ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  mouse.down = true;
  if (panel.visible) {
    raycaster.setFromCamera(mouse.ndc, camera);
    const hit = raycaster.intersectObject(panel.mesh)[0];
    doAction(panel.actionAt(panel.pick(hit?.uv)));
    return;
  }
  if (app === 'playing' && core) {
    if (core.state === 'serveWait' && core.isHuman(core.server)) humanToss();
    else mouse.clicked = true;
  }
});
window.addEventListener('pointerup', () => { mouse.down = false; });
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === 'f' || e.key === 'F') { save.fps = !save.fps; T.saveState(save); }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function updateMousePaddle() {
  if (dev.autoplay) return;
  raycaster.setFromCamera(mouse.ndc, camera);
  if (raycaster.ray.intersectPlane(plane, tmpV)) {
    mouse.x = clamp(tmpV.x, -1.3, 1.3);
    mouse.y = clamp(tmpV.y, TABLE.y - 0.1, 1.7);
  }
}

// ---------- Batida do jogador ----------
const pad = { r: 0.075, vx: 0, vy: 0, vz: 0, ax: 0, ay: 0, az: 0, anx: 1, any: 0, anz: 0, bx: 0, by: 0, bz: 0, bnx: 1, bny: 0, bnz: 0 };
const padPrev = { c: new THREE.Vector3(), n: new THREE.Vector3(1, 0, 0), t: 0, valid: false };
const padCur = { c: new THREE.Vector3(), n: new THREE.Vector3(1, 0, 0) };
const tmpQ = new THREE.Quaternion();
let hitCooldown = 0;
let lunge = 0;

function readPaddlePose() {
  paddle.updateWorldMatrix(true, false);
  paddle.getWorldPosition(padCur.c);
  paddle.getWorldQuaternion(tmpQ);
  padCur.n.set(1, 0, 0).applyQuaternion(tmpQ);
}

function vrHit(ball, prev) {
  if (hitCooldown > 0 || !padPrev.valid) return false;
  if (!paddleHit(ball, prev, pad)) return false;
  hitCooldown = 0.15;
  assistShot(ball, T.ASSIST[save.assist], arena);
  const sp = Math.hypot(pad.vx, pad.vy, pad.vz);
  pulse(paddleHandName(), clamp(0.3 + sp / 10, 0.3, 1), 35);
  return true;
}

function mouseShot(ball, tx, tz, speed, top) {
  const dx = tx - ball.px, dz = tz - ball.pz, dl = Math.hypot(dx, dz);
  const w = spinFor(dx / dl, dz / dl, top, 0);
  const v = solveShot(ball.px, ball.py, ball.pz, tx, tz, speed, w.wx, w.wy, w.wz, arena, ball.t || 0);
  Object.assign(ball, { vx: v.vx, vy: v.vy, vz: v.vz, wx: w.wx, wy: w.wy, wz: w.wz });
  lunge = 1;
}

function mouseHit(ball, prev, c) {
  if (c.state === 'toss') {
    if (!mouse.clicked) return false;
    mouse.clicked = false;
    if (Math.hypot(ball.px - mouse.x, ball.py - mouse.y) > 0.3) return false;
    mouseShot(ball, clamp(mouse.x * 0.3, -0.5, 0.5), -0.85 - Math.random() * 0.2, 6.5, 30);
    return true;
  }
  if (!(prev.pz < MOUSE_Z && ball.pz >= MOUSE_Z)) return false;
  const f = (MOUSE_Z - prev.pz) / (ball.pz - prev.pz);
  const bx = lerp(prev.px, ball.px, f), by = lerp(prev.py, ball.py, f);
  const off = bx - mouse.x, offY = by - mouse.y;
  if (Math.hypot(off, offY) > 0.16) return false;
  ball.px = bx; ball.py = by; ball.pz = MOUSE_Z;
  const smash = mouse.down;
  // Bater com o lado esquerdo da raquete manda a bola para a esquerda, e vice-versa.
  const tx = clamp(bx * 0.3 + (off / 0.16) * 0.6, -0.66, 0.66);
  const tz = smash ? -1.1 : -0.8 - Math.random() * 0.3;
  mouseShot(ball, tx, tz, smash ? 12.5 : 8, smash ? 90 : 40);
  return true;
}

// ---------- Partida ----------
function startMatch(i) {
  showTable(i);
  core = new GameCore({ opponent: OPPONENTS[i], arena, onEvent });
  app = 'playing';
  panel.hide();
  boardMsg = '';
  onEvent('serveWait', { server: core.server });
  updateHint();
}

function boardInfo() {
  const p = OPPONENTS[tableIndex];
  return {
    round: `MESA ${tableIndex + 1} DE ${TABLES.length} · ${TABLES[tableIndex].name.toUpperCase()}`,
    pName: 'Você', oName: p.name, oColor: '#' + p.shirt.toString(16).padStart(6, '0'),
    score: core ? core.match.score : [0, 0],
    server: core && core.state !== 'matchOver' ? core.server : null, msg: boardMsg,
  };
}
const drawBoard = () => world.scoreboard.draw(boardInfo());

function onEvent(type, d) {
  const b = core?.ball;
  const pan = b ? clamp(b.px / 2, -1, 1) : 0;
  switch (type) {
    case 'hit':
      sfx.hit(Math.hypot(b.vx, b.vy, b.vz) / 15, pan);
      if (boardMsg.startsWith('Seu saque') || boardMsg.startsWith('Saque de')) { boardMsg = ''; drawBoard(); }
      break;
    case 'table': sfx.bounce(pan); break;
    case 'net': sfx.net(); break;
    case 'floor': sfx.floor(pan); break;
    case 'bumper': sfx.bumper(pan); world.table.flashBumper(d.i); pulse(paddleHandName(), 0.2, 20); break;
    case 'barrier': sfx.wood(pan); break;
    case 'hole': sfx.hole(pan); break;
    case 'target':
      sfx.target(); world.table.flashTarget(d.side);
      boardMsg = d.who === 0 ? 'Alvo! +1 ponto no fim da jogada' : `${OPPONENTS[tableIndex].name} acertou o alvo!`;
      drawBoard();
      if (d.who === 0) pulse(paddleHandName(), 0.6, 80);
      break;
    case 'serveWait': {
      const human = core && core.isHuman(d.server);
      boardMsg = human
        ? (renderer.xr.isPresenting ? 'Seu saque: gatilho da mão livre joga a bola' : 'Seu saque: clique, e clique de novo para bater')
        : `Saque de ${OPPONENTS[tableIndex].name}`;
      drawBoard();
      break;
    }
    case 'let': boardMsg = 'Rede no saque: repete'; drawBoard(); break;
    case 'point': {
      const name = OPPONENTS[tableIndex].name;
      boardMsg = d.winner === 0 ? `Ponto seu! (${d.reason})` : `Ponto de ${name} (${d.reason})`;
      if (d.bonus != null) boardMsg += d.bonus === 0 ? ' +1 do alvo' : ` +1 alvo dele`;
      if (d.winner === 0) { sfx.cheer(false); world.crowd.cheer(1); pulse(paddleHandName(), 0.4, 60); }
      else sfx.groan();
      drawBoard();
      break;
    }
    case 'matchOver': {
      const won = d.winner === 0;
      const score = [...core.match.score];
      const stars = T.starsFor(won, score);
      const before = save.stars[tableIndex] || 0;
      T.recordResult(save, tableIndex, stars);
      T.saveState(save);
      boardMsg = won ? 'VITÓRIA!' : `${OPPONENTS[tableIndex].name} venceu`;
      drawBoard();
      sfx.fanfare(won);
      if (won) world.crowd.cheer(2);
      lastResult = { won, i: tableIndex, score, stars, record: stars > before };
      const ended = core;
      setTimeout(() => { if (app === 'playing' && core === ended) { app = 'result'; showScreen('result'); } }, 1200);
      break;
    }
  }
}
let lastResult = null;

function togglePause() {
  if (app === 'playing') { app = 'paused'; showScreen('pause'); }
  else if (app === 'paused' && screen === 'pause') { app = 'playing'; panel.hide(); }
}

// ---------- Telas do painel ----------
const PW = 1024;
function showScreen(name) {
  screen = name;
  panel.show((p) => SCREENS[name](p));
  updateHint();
}

const hexColor = (c) => '#' + c.toString(16).padStart(6, '0');
const SCREENS = {
  main(p) {
    p.title('Mesa Maluca', 56);
    const champ = T.isChampion(save);
    p.text(champ ? `Você venceu as 10 mesas! Estrelas: ${T.totalStars(save)} de 30` : `Vença cada mesa para liberar a próxima · Estrelas: ${T.totalStars(save)} de 30`, PW / 2, 104, { size: 25, color: '#d9ccff' });
    TABLES.forEach((tb, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      p.card(40 + col * 482, 130 + row * 94, 462, 84, {
        num: i + 1, name: tb.name, sub: `contra ${OPPONENTS[i].name}`, stars: save.stars[i] || 0,
        status: T.statusOf(save, i), action: 'intro:' + i, color: hexColor(tb.top),
      });
    });
    const y = 616;
    const next = T.nextTable(save);
    p.button(champ ? 'Jogar o chefe' : `Jogar: ${TABLES[next].name}`, 'intro:' + next, 40, y, 420, 76, { size: 30, on: true });
    p.button('Opções', 'options', 480, y, 230, 76);
    p.button('Recomeçar', 'askReset', 730, y, 254, 76);
  },
  intro(p) {
    const i = menuIndex, tb = TABLES[i], o = OPPONENTS[i];
    p.title(`Mesa ${i + 1}: ${tb.name}`, 70);
    wrap(p, tb.teach, PW / 2, 150, 880, 36, { size: 32 });
    p.text(`Adversário: ${o.name} (${o.style})`, PW / 2, 330, { size: 32, bold: true });
    p.text(o.desc, PW / 2, 376, { size: 26, color: '#d9ccff' });
    p.text('Partida até 7 pontos (com 2 de vantagem).', PW / 2, 432, { size: 26, color: '#d9ccff' });
    const st = save.stars[i] || 0;
    p.text(`Sua melhor nota: ${'★'.repeat(st)}${'☆'.repeat(3 - st)}   ·   ★ vencer  ★★ vencer por 4+  ★★★ perder no máximo 1 ponto`, PW / 2, 480, { size: 22, color: '#ffd23f' });
    p.button('Jogar', 'play:' + i, PW / 2 - 330, 560, 320, 90, { on: true, size: 38 });
    p.button('Voltar', 'main', PW / 2 + 10, 560, 320, 90);
  },
  options(p) {
    p.title('Opções', 58);
    const line = (y, label, items, current, key) => {
      p.text(label, 50, y + 34, { size: 30, align: 'left', bold: true });
      const x0 = 400, w = (PW - 50 - x0 - (items.length - 1) * 10) / items.length;
      items.forEach(([val, txt], i) => p.button(txt, `set:${key}:${val}`, x0 + i * (w + 10), y, w, 68, { on: String(current) === String(val), size: 28 }));
    };
    line(110, 'Mão da raquete', [['right', 'Direita'], ['left', 'Esquerda']], save.hand, 'hand');
    line(195, 'Ajuda na mira', Object.keys(T.ASSIST).map(k => [k, T.ASSIST_LABEL[k]]), save.assist, 'assist');
    line(280, 'Ângulo da raquete', [[-30, '-30°'], [-15, '-15°'], [0, '0°'], [15, '+15°'], [30, '+30°']], save.angle, 'angle');
    line(365, 'Música', [[1, 'Ligada'], [0, 'Desligada']], save.music ? 1 : 0, 'music');
    line(450, 'Mostrar FPS', [[1, 'Sim'], [0, 'Não']], save.fps ? 1 : 0, 'fps');
    p.text('Ajuda na mira corrige batidas que iam para fora. Ângulo: inclina a raquete na mão (VR).', PW / 2, 560, { size: 22, color: '#d9ccff' });
    p.button('Voltar', 'back', PW / 2 - 160, 610, 320, 76, { on: true });
  },
  pause(p) {
    p.title('Pausa', 70);
    const s = core.match.score;
    p.text(`Você ${s[0]} x ${s[1]} ${OPPONENTS[tableIndex].name} · ${TABLES[tableIndex].name}`, PW / 2, 140, { size: 34 });
    const vr = renderer.xr.isPresenting;
    const items = [['Continuar', 'resume'], ...(vr ? [['Recentralizar', 'recenter']] : []), ['Opções', 'options'], ['Desistir da partida', 'quit']];
    items.forEach(([t, a], i) => p.button(t, a, PW / 2 - 230, 200 + i * 104, 460, 84, { on: i === 0 }));
  },
  result(p) {
    const r = lastResult;
    const o = OPPONENTS[r.i];
    const champNow = r.won && r.i === TABLES.length - 1;
    p.title(champNow ? 'VOCÊ DERROTOU O CHEFE!' : r.won ? 'Vitória!' : 'Derrota', 80);
    p.text(`Você ${r.score[0]} x ${r.score[1]} ${o.name}`, PW / 2, 160, { size: 40 });
    if (r.won) {
      p.text(`${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}`, PW / 2, 235, { size: 72, color: '#ffd23f' });
      p.text(r.record ? 'Nova melhor nota nesta mesa!' : 'Ganhe por mais pontos para mais estrelas.', PW / 2, 300, { size: 26, color: '#d9ccff' });
    } else p.text('Tente de novo: cada partida é diferente.', PW / 2, 240, { size: 30, color: '#d9ccff' });
    const btns = [];
    if (r.won && !champNow) btns.push([`Próxima mesa: ${TABLES[r.i + 1].name}`, 'intro:' + (r.i + 1)]);
    btns.push([r.won ? 'Jogar de novo' : 'Tentar de novo', 'play:' + r.i]);
    btns.push(['Menu das mesas', 'menu']);
    btns.forEach(([t, a], i) => p.button(t, a, PW / 2 - 290, 340 + i * 104, 580, 86, { on: i === 0, size: 32 }));
  },
  confirmReset(p) {
    p.title('Recomeçar do zero?', 150);
    p.text('As mesas vencidas e as estrelas serão apagadas. As opções continuam.', PW / 2, 240, { size: 28, color: '#d9ccff' });
    p.button('Sim, recomeçar', 'reset', PW / 2 - 330, 360, 300, 90);
    p.button('Não', 'main', PW / 2 + 30, 360, 300, 90, { on: true });
  },
};

// Texto com quebra de linha automática.
function wrap(p, text, x, y, maxW, lineH, opts) {
  const g = p.ctx;
  g.font = `${opts.bold ? 'bold ' : ''}${opts.size}px sans-serif`;
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) { p.text(line, x, yy, opts); line = w; yy += lineH; }
    else line = test;
  }
  if (line) p.text(line, x, yy, opts);
}

function doAction(a) {
  if (!a) return;
  sfx.unlock();
  sfx.click();
  if (save.music && !sfx.musicOn) sfx.music(true);
  if (a.startsWith('play:')) { startMatch(Number(a.slice(5))); return; }
  if (a.startsWith('intro:')) { menuIndex = Number(a.slice(6)); showTable(menuIndex); drawBoard(); showScreen('intro'); return; }
  if (a.startsWith('set:')) {
    const [, key, val] = a.split(':');
    if (key === 'hand') save.hand = val;
    else if (key === 'assist') save.assist = val;
    else if (key === 'angle') save.angle = Number(val);
    else if (key === 'music') { save.music = val === '1'; sfx.music(save.music); }
    else if (key === 'fps') save.fps = val === '1';
    T.saveState(save);
    attachHands();
    showScreen('options');
    return;
  }
  switch (a) {
    case 'options': optionsBack = screen; showScreen('options'); break;
    case 'back': showScreen(optionsBack === 'options' ? 'main' : optionsBack); break;
    case 'askReset': showScreen('confirmReset'); break;
    case 'reset': save.beaten = 0; save.stars = []; T.saveState(save); goMenu(); break;
    case 'main': showScreen('main'); break;
    case 'menu': goMenu(); break;
    case 'resume': app = 'playing'; panel.hide(); updateHint(); break;
    case 'recenter': recenter(); break;
    case 'quit': goMenu(); break;
  }
}

function goMenu() {
  app = 'menu';
  core = null;
  showTable(T.nextTable(save));
  boardMsg = 'Escolha uma mesa';
  drawBoard();
  showScreen('main');
}

// No saque, a bola fica na mão livre (VR) ou logo à frente da raquete (mouse).
function holdServeBall() {
  if (!core || core.state !== 'serveWait' || !core.isHuman(core.server)) return;
  if (renderer.xr.isPresenting && hands[freeHandName()]) {
    freeHand.getWorldPosition(tmpV);
    core.holdBall(tmpV.x, tmpV.y + 0.05, tmpV.z);
  } else if (renderer.xr.isPresenting) {
    paddle.getWorldPosition(tmpV);
    core.holdBall(tmpV.x, tmpV.y + 0.25, tmpV.z - 0.1);
  } else core.holdBall(mouse.x, mouse.y + 0.12, MOUSE_Z - 0.06);
}

function humanToss() {
  holdServeBall();
  core.humanToss(0, renderer.xr.isPresenting ? 2.3 : 2.0, 0);
}

function onTrigger(entry) {
  sfx.unlock();
  if (panel.visible) {
    if (entry.hoverIndex >= 0) doAction(panel.actionAt(entry.hoverIndex));
    return;
  }
  if (app === 'playing' && core && core.state === 'serveWait' && core.isHuman(core.server)) {
    const fromFree = entry.hand === freeHandName() || !hands[freeHandName()];
    if (fromFree) humanToss();
  }
}

// Botões B/Y pausam (A/X também jogam a bola no saque).
function pollButtons() {
  for (const e of ctrls) {
    const gp = e.source?.gamepad;
    if (!gp) continue;
    const pressed = (i) => !!gp.buttons[i]?.pressed;
    const was = (i) => !!e.prevButtons[i];
    if (pressed(5) && !was(5)) togglePause();
    if (pressed(4) && !was(4) && app === 'playing' && core?.state === 'serveWait' && core.isHuman(core.server)) humanToss();
    e.prevButtons = gp.buttons.map(b => b.pressed);
  }
}

// ---------- Raio do menu (VR) ----------
const rayOrigin = new THREE.Vector3(), rayDir = new THREE.Vector3();
function updateMenuRays() {
  const vr = renderer.xr.isPresenting;
  let hover = -1;
  for (const e of ctrls) {
    e.hoverIndex = -1;
    e.laser.visible = vr && panel.visible && !!e.source;
    if (!e.laser.visible) continue;
    e.ctrl.getWorldPosition(rayOrigin);
    e.ctrl.getWorldQuaternion(tmpQ);
    rayDir.set(0, 0, -1).applyQuaternion(tmpQ);
    raycaster.set(rayOrigin, rayDir);
    const hit = raycaster.intersectObject(panel.mesh)[0];
    e.laser.scale.z = hit ? hit.distance : 2;
    e.hoverIndex = panel.pick(hit?.uv);
    if (e.hoverIndex >= 0) hover = e.hoverIndex;
  }
  if (!vr && panel.visible) {
    raycaster.setFromCamera(mouse.ndc, camera);
    hover = panel.pick(raycaster.intersectObject(panel.mesh)[0]?.uv);
    renderer.domElement.style.cursor = hover >= 0 && panel.actionAt(hover) ? 'pointer' : 'default';
  } else renderer.domElement.style.cursor = 'default';
  if (panel.visible) panel.setHover(hover);
}

// ---------- HTML (PC) ----------
const hintEl = document.getElementById('hint');
const fpsEl = document.getElementById('fps');
function updateHint() {
  if (renderer.xr.isPresenting) { hintEl.textContent = ''; return; }
  hintEl.textContent = app === 'playing'
    ? 'Mouse move a raquete · segure o botão na batida para cortar · Esc pausa'
    : 'Clique nas opções do painel · No Quest, use o botão "Entrar em VR"';
}

const vrBtn = document.getElementById('vr');
async function setupVR() {
  const ok = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!ok) {
    vrBtn.textContent = window.isSecureContext ? 'VR não disponível neste navegador' : 'VR precisa de HTTPS (veja o CLAUDE.md)';
    vrBtn.disabled = true;
    return;
  }
  vrBtn.textContent = 'Entrar em VR';
  vrBtn.disabled = false;
  vrBtn.onclick = async () => {
    sfx.unlock();
    if (renderer.xr.isPresenting) { renderer.xr.getSession()?.end(); return; }
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
      await renderer.xr.setSession(session);
      vrBtn.textContent = 'Sair do VR';
      session.addEventListener('end', () => { vrBtn.textContent = 'Entrar em VR'; });
    } catch (err) {
      vrBtn.textContent = 'Erro ao entrar em VR';
      console.error(err);
    }
  };
}
setupVR();

// ---------- Laço principal ----------
let acc = 0, lastT = performance.now();
let fpsFrames = 0, fpsTime = 0;
const clock = { padElapsed: 0 };

function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  time += dt;
  const vr = renderer.xr.isPresenting;

  if (recenterIn > 0 && --recenterIn === 0) recenter();
  pollButtons();

  // Raquete do jogador
  if (!vr) {
    updateMousePaddle();
    if (dev.autoplay) autoplay();
    lunge = Math.max(0, lunge - dt * 6);
    paddlePivot.position.set(mouse.x, mouse.y, MOUSE_Z - Math.sin(lunge * Math.PI) * 0.12);
  }
  readPaddlePose();

  if (app === 'playing' && core) {
    holdServeBall();
    acc += dt;
    clock.padElapsed += dt;
    const n = Math.min(12, Math.floor(acc / DT));
    if (n > 0) {
      const span = clock.padElapsed;
      if (padPrev.valid && span > 0) {
        pad.vx = (padCur.c.x - padPrev.c.x) / span;
        pad.vy = (padCur.c.y - padPrev.c.y) / span;
        pad.vz = (padCur.c.z - padPrev.c.z) / span;
      }
      for (let k = 0; k < n; k++) {
        const fa = k / n, fb = (k + 1) / n;
        pad.ax = lerp(padPrev.c.x, padCur.c.x, fa); pad.ay = lerp(padPrev.c.y, padCur.c.y, fa); pad.az = lerp(padPrev.c.z, padCur.c.z, fa);
        pad.bx = lerp(padPrev.c.x, padCur.c.x, fb); pad.by = lerp(padPrev.c.y, padCur.c.y, fb); pad.bz = lerp(padPrev.c.z, padCur.c.z, fb);
        setNormal('a', fa); setNormal('b', fb);
        hitCooldown = Math.max(0, hitCooldown - DT);
        core.step(vr ? vrHit : mouseHit);
      }
      acc -= n * DT;
      if (acc > DT * 4) acc = 0;
      padPrev.c.copy(padCur.c); padPrev.n.copy(padCur.n); padPrev.valid = true;
      clock.padElapsed = 0;
    }
  } else {
    padPrev.c.copy(padCur.c); padPrev.n.copy(padCur.n); padPrev.valid = true;
    clock.padElapsed = 0; acc = 0;
  }

  // Adversário
  if (core) opp.update(core.ai[1].paddle, core.ai[1].swing, time);
  else opp.update({ x: Math.sin(time * 0.7) * 0.15, y: arena.surfaceY(0, -1.3, 0) + 0.25, z: -1.9 }, 0, time);

  // A mesa anda no relógio da física durante a partida (e no relógio da tela no menu).
  const tt = core ? core.time : time;
  world.table.update(tt, dt, core?.targets || null);
  world.updateBall(core ? core.ball : null, !!core, arena, tt);
  world.crowd.update(dt, time);
  world.update(dt, time);
  updateMenuRays();

  // FPS
  fpsFrames++; fpsTime += dt;
  if (fpsTime >= 0.5) {
    const f = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0; fpsTime = 0;
    fpsEl.style.display = save.fps && !vr ? 'block' : 'none';
    fpsEl.textContent = `${f} FPS`;
    fpsLabel.mesh.visible = save.fps && vr;
    fpsLabel.set(`${f} FPS`);
  }

  renderer.render(scene, camera);
}

const nTmp = new THREE.Vector3();
function setNormal(which, f) {
  nTmp.copy(padPrev.n).lerp(padCur.n, f).normalize();
  if (which === 'a') { pad.anx = nTmp.x; pad.any = nTmp.y; pad.anz = nTmp.z; }
  else { pad.bnx = nTmp.x; pad.bny = nTmp.y; pad.bnz = nTmp.z; }
}

attachHands();
goMenu();
renderer.setAnimationLoop(frame);

// Para testes no console: window.mesa (autoplay = a raquete do mouse segue a bola sozinha).
// Usar qualquer coisa do dev silencia o jogo (testes nunca tocam som).
let autoplayOn = false;
const dev = {
  get autoplay() { return autoplayOn; },
  set autoplay(v) { autoplayOn = !!v; if (v) sfx.mute(); },
  // advance(s): roda s segundos de jogo na hora, a 72 quadros/s (o painel escondido não anima).
  advance(sec) { sfx.mute(); for (let i = 0; i < sec * 72; i++) { lastT = performance.now() - 1000 / 72; frame(); } return dev.state(); },
  state() {
    return {
      app, screen, mesa: tableIndex + 1, nome: TABLES[tableIndex].name, estado: core?.state ?? null,
      placar: core ? [...core.match.score] : null, tempo: core ? +core.time.toFixed(2) : 0,
      bola: core ? { x: +core.ball.px.toFixed(2), y: +core.ball.py.toFixed(2), z: +core.ball.pz.toFixed(2) } : null,
      progresso: { vencidas: save.beaten, estrelas: [...save.stars] }, ultimo: lastResult,
    };
  },
  // Foto da tela em PNG (data URL), depois de desenhar um quadro.
  snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
};
function autoplay() {
  const b = core?.ball;
  if (!b) return;
  if (core.state === 'serveWait' && core.isHuman(core.server)) { mouse.x = 0.2; mouse.y = 1.0; humanToss(); return; }
  if (core.state === 'toss' && b.vy < 0 && b.py < mouse.y + 0.15) { mouse.clicked = true; return; }
  if (b.vz > 0 && b.pz > 0.3) { mouse.x = clamp(b.px + (Math.random() - 0.5) * 0.1, -1.3, 1.3); mouse.y = clamp(b.py, TABLE.y - 0.08, 1.7); }
}
window.mesa = { get core() { return core; }, save, startMatch, doAction, dev, mouse, camera };

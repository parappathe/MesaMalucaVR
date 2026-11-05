// Testes automáticos: node tests/run.js  (tem que terminar com "Tudo certo")
import { TABLE, BALL_R, DT, FLAT, makeBall, copyBall, stepBall, paddleHit, solveShot, landing, spinFor, assistShot } from '../js/physics.js';
import { TABLES, MesaArena, makeArena } from '../js/arena.js';
import { Rally, Match } from '../js/match.js';
import { AIPlayer, OPPONENTS } from '../js/ai.js';
import { GameCore } from '../js/game.js';
import { starsFor, recordResult } from '../js/tournament.js';

let fails = 0, count = 0;
function ok(cond, msg) {
  count++;
  if (!cond) { fails++; console.log('  FALHOU: ' + msg); }
}
function section(name) { console.log(name); }

// Gerador aleatório com semente, para os testes darem sempre o mesmo resultado.
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function run(b, seconds, ev, arena = FLAT) { for (let t = 0; t < seconds; t += DT) stepBall(b, DT, ev, arena); }

section('Física');
{
  // Queda de 30 cm acima da mesa: quica e volta a uns 80% da altura.
  const b = makeBall(); b.py = TABLE.y + 0.3 + BALL_R; b.pz = 0.5;
  const ev = []; let maxAfter = 0, bounced = false;
  for (let t = 0; t < 1; t += DT) {
    const n = ev.length; stepBall(b, DT, ev);
    if (ev.length > n && ev[n].type === 'table') bounced = true;
    if (bounced) maxAfter = Math.max(maxAfter, b.py - BALL_R - TABLE.y);
  }
  ok(bounced, 'bola deveria quicar na mesa');
  ok(maxAfter > 0.2 && maxAfter < 0.28, `altura do quique ${maxAfter.toFixed(3)} fora de 0.20..0.28`);
  ok(ev[0].side === 0, 'quique em z>0 deveria ser no lado do jogador');
}
{
  // Bola baixa e reta bate na rede e não passa.
  const b = makeBall(); b.py = TABLE.y + 0.08; b.pz = 0.6; b.vz = -6; b.vy = 0.3;
  const ev = []; run(b, 0.5, ev);
  ok(ev.some(e => e.type === 'net'), 'bola baixa deveria bater na rede');
  ok(b.pz > -0.05, 'bola baixa não deveria atravessar a rede');
}
{
  // Topspin faz cair antes; backspin faz ir mais longe.
  const shoot = (top) => {
    const b = makeBall(); b.py = 1.0; b.pz = 1.6; b.vz = -8; b.vy = 1.2;
    const w = spinFor(0, -1, top, 0); b.wx = w.wx; b.wy = w.wy; b.wz = w.wz;
    return landing(b, -1, 0, -1).s;
  };
  ok(shoot(120) < shoot(0) && shoot(0) < shoot(-120), 'topspin deveria encurtar e backspin alongar a bola');
}
{
  // Bola rápida contra raquete rápida não atravessa (colisão contínua).
  const b = makeBall(); b.py = 1; b.pz = 1.2; b.vz = 15;
  const pad = { r: 0.075, vx: 0, vy: 0, vz: -10 };
  let hit = false; let pz = 1.6;
  for (let i = 0; i < 40 && !hit; i++) {
    const prev = { px: b.px, py: b.py, pz: b.pz };
    stepBall(b, DT);
    const nz = pz - 10 * DT;
    Object.assign(pad, { ax: 0, ay: 1, az: pz, anx: 0, any: 0, anz: 1, bx: 0, by: 1, bz: nz, bnx: 0, bny: 0, bnz: 1 });
    pz = nz;
    hit = paddleHit(b, prev, pad);
  }
  ok(hit, 'raquete deveria acertar a bola rápida');
  ok(b.vz < -15, `bola deveria voltar rápida (vz=${b.vz.toFixed(1)})`);
}
{
  // Raquete inclinada com movimento para cima gera topspin.
  const b = makeBall(); b.py = 0.95; b.pz = 1.5; b.vz = 6;
  const prev = { px: 0, py: 0.95, pz: 1.5 - 6 * DT };
  b.pz = 1.5 + 0.005;
  const pad = { r: 0.075, vx: 0, vy: 4, vz: -3, ax: 0, ay: 0.95, az: 1.505, bx: 0, by: 0.95, bz: 1.505, anx: 0, any: 0, anz: 1, bnx: 0, bny: 0, bnz: 1 };
  paddleHit(b, prev, pad);
  ok(b.wx < -20, `raspar a bola para cima deveria dar topspin para quem recebe do outro lado (wx=${b.wx.toFixed(0)})`);
}
{
  // O resolvedor de jogada acerta o alvo, com e sem efeito.
  for (const [top, side] of [[0, 0], [100, 0], [-80, 0], [60, 80]]) {
    const w = spinFor(0, -1, top, side);
    const v = solveShot(0.2, 1.0, 1.6, -0.4, -0.9, 8, w.wx, w.wy, w.wz);
    const b = makeBall(); Object.assign(b, { px: 0.2, py: 1.0, pz: 1.6, vx: v.vx, vy: v.vy, vz: v.vz, ...w });
    const ev = []; run(b, 1.5, ev);
    const t = ev.find(e => e.type === 'table');
    ok(v.ok && t && Math.hypot(t.x + 0.4, t.z + 0.9) < 0.06, `jogada com efeito (${top},${side}) deveria cair em (-0.4,-0.9), caiu ${t ? t.x.toFixed(2) + ',' + t.z.toFixed(2) : 'fora'}`);
  }
}

{
  // Ajuda na mira: batidas ruins (longa, na rede, aberta) entram com ajuda alta; boa não muda.
  const firstBounce = (v) => {
    const b = makeBall(); Object.assign(b, { px: 0.1, py: 0.95, pz: 1.55, ...v });
    const ev = []; run(b, 2, ev);
    return ev.find(e => e.type === 'table' || e.type === 'floor');
  };
  const cases = { longa: { vx: 0, vy: 2.5, vz: -12 }, rede: { vx: 0, vy: -1.5, vz: -9 }, aberta: { vx: 3, vy: 1, vz: -8 } };
  for (const [name, v] of Object.entries(cases)) {
    const raw = firstBounce(v);
    ok(!(raw.type === 'table' && raw.side === 1), `caso de teste "${name}" deveria errar sem ajuda`);
    const b = makeBall(); Object.assign(b, { px: 0.1, py: 0.95, pz: 1.55, ...v });
    assistShot(b, 1);
    const fixed = firstBounce({ vx: b.vx, vy: b.vy, vz: b.vz });
    ok(fixed.type === 'table' && fixed.side === 1, `batida "${name}" com ajuda total deveria cair na mesa do adversário`);
  }
  const good = makeBall(); Object.assign(good, { px: 0.1, py: 0.95, pz: 1.55 });
  const sv = solveShot(0.1, 0.95, 1.55, 0.3, -0.8, 8); Object.assign(good, { vx: sv.vx, vy: sv.vy, vz: sv.vz });
  ok(!assistShot(good, 1), 'batida boa não deveria ser alterada pela ajuda');
}

section('Mesas malucas');
const A = (id) => makeArena(TABLES.findIndex(t => t.id === id));
const firstOf = (ev, ...types) => ev.find(e => types.includes(e.type));
// Bola sai de (x,y,z) com velocidade v e roda `sec` segundos na arena; devolve a bola e os eventos.
function shoot(arena, x, y, z, v, sec = 1.5, t0 = 0) {
  const b = makeBall(); Object.assign(b, { px: x, py: y, pz: z, vx: v[0], vy: v[1], vz: v[2], t: t0 });
  const ev = []; run(b, sec, ev, arena); return { b, ev };
}
// Confere se a jogada calculada pelo resolvedor cai mesmo no alvo, com a física completa.
function solvedLands(arena, from, to, speed, t0 = 0, w = { wx: 0, wy: 0, wz: 0 }) {
  const v = solveShot(from[0], from[1], from[2], to[0], to[1], speed, w.wx, w.wy, w.wz, arena, t0);
  const { ev } = shoot(arena, from[0], from[1], from[2], [v.vx, v.vy, v.vz], 2, t0);
  const e = firstOf(ev, 'table', 'floor', 'hole');
  return { v, e, ok: v.ok && e && e.type === 'table' && Math.hypot(e.x - to[0], e.z - to[1]) < 0.1 };
}
{
  // 1. Para-choques: a bola que bate volta com mais velocidade do que chegou.
  const ar = A('fliperama'), p = ar.bumpers[0];
  const { b, ev } = shoot(ar, p.x, TABLE.y + 0.05, p.z + 0.5, [0, 0.4, -4], 0.15);
  ok(ev.some(e => e.type === 'bumper'), 'bola deveria bater no para-choque');
  ok(b.vz > 3.6, `para-choque deveria devolver com força (vz=${b.vz.toFixed(2)})`);
  const plain = shoot(FLAT, p.x, TABLE.y + 0.05, p.z + 0.5, [0, 0.4, -4], 0.15);
  ok(!plain.ev.some(e => e.type === 'bumper') && plain.b.vz < 0, 'na mesa normal a bola segue reto');
  ok(ar.blocked({ px: p.x, py: TABLE.y + 0.03, pz: p.z + 0.08 }, 0), 'previsão deveria enxergar o para-choque');
}
{
  // 2. Buracos: bola em cima do buraco cai (sem quicar); ao lado, quica. Regra do ponto.
  const ar = A('buracos'), h = ar.holes[0];
  const inHole = shoot(ar, h.x, TABLE.y + 0.3, h.z, [0, 0, 0], 1);
  ok(firstOf(inHole.ev, 'table', 'hole')?.type === 'hole', 'bola sobre o buraco deveria cair nele');
  ok(firstOf(inHole.ev, 'hole')?.side === 1, 'buraco em z<0 é do lado do adversário');
  const beside = shoot(ar, h.x + h.r + 0.06, TABLE.y + 0.3, h.z, [0, 0, 0], 1);
  ok(firstOf(beside.ev, 'table', 'hole')?.type === 'table', 'bola ao lado do buraco deveria quicar');
  const r = new Rally(0); r.onHit(0);
  ok(r.onHole(1)?.winner === 0, 'cair no buraco do adversário é ponto de quem bateu');
  const r2 = new Rally(1); r2.onHit(1); r2.onTable(0);
  ok(r2.onHole(0)?.winner === 1, 'cair no buraco do próprio lado é ponto do outro');
  // A IA enxerga o buraco: não tenta devolver bola que vai cair nele.
  const ai = new AIPlayer(OPPONENTS[1], -1, seeded(3), ar);
  const b = makeBall(); Object.assign(b, { px: h.x, py: TABLE.y + 0.25, pz: h.z + 0.25, vz: -1.2, vy: 0 });
  ai.planFor(b);
  ok(!ai.plan, 'IA não deveria planejar devolver uma bola que cai no buraco');
}
{
  // 3. Rede elevador: baixa e alta em fases diferentes do ciclo; a mesma bola passa ou bate.
  const ar = A('elevador'), n = ar.net;
  const low = ar.netTop(0, 0) - TABLE.y, high = ar.netTop(0, n.period / 2) - TABLE.y;
  ok(Math.abs(low - n.min) < 1e-6 && Math.abs(high - n.max) < 1e-6, `rede deveria ir de ${n.min} a ${n.max} (${low.toFixed(2)}..${high.toFixed(2)})`);
  const v = [0, 0.6, -7];
  const atLow = shoot(ar, 0, TABLE.y + 0.14, 0.7, v, 0.4, 0);
  const atHigh = shoot(ar, 0, TABLE.y + 0.14, 0.7, v, 0.4, n.period / 2 - 0.1);
  ok(!atLow.ev.some(e => e.type === 'net') && atLow.b.pz < 0, 'com a rede baixa a bola rasante passa');
  ok(atHigh.ev.some(e => e.type === 'net') && atHigh.b.pz > -0.05, 'com a rede alta a mesma bola bate nela');
  for (const t0 of [0, n.period * 0.3, n.period / 2]) {
    const s = solvedLands(ar, [0.1, 1.0, 1.6], [-0.3, -0.8], 8, t0);
    ok(s.ok, `resolvedor deveria passar pela rede no instante ${t0.toFixed(1)} s`);
  }
}
{
  // 4. Degraus: a metade do adversário é mais alta; bola baixa bate na parede do degrau.
  const ar = A('degraus');
  const d = shoot(ar, 0.2, TABLE.y + 0.4, -0.7, [0, 0, 0], 1);
  const e = firstOf(d.ev, 'table');
  ok(e && e.side === 1, 'quique no lado alto');
  ok(Math.abs(ar.surfaceY(0.2, -0.7, 0) - (TABLE.y + ar.step)) < 1e-9, 'lado do adversário 12 cm acima');
  const wall = shoot(ar, 0, TABLE.y + 0.06, 0.5, [0, 0, -5], 0.4);
  ok(wall.ev.some(e => e.type === 'net') && wall.b.pz > 0, 'bola baixa bate na parede do degrau e volta');
  ok(solvedLands(ar, [0.1, 1.0, 1.6], [0.3, -0.9], 8).ok, 'resolvedor deveria subir a bola no degrau');
  ok(solvedLands(ar, [0, 1.1, -1.9], [-0.2, 0.8], 8).ok, 'resolvedor deveria descer a bola do degrau');
}
{
  // 5. Ondas: bola que cai na encosta da onda sai torta; no vale, sobe reta.
  const ar = A('ondas'), w = ar.wave;
  const slope = shoot(ar, 0, TABLE.y + 0.35, -w.lambda / 4, [0, 0, 0], 0.32);
  const valley = shoot(ar, 0, TABLE.y + 0.35, -w.lambda, [0, 0, 0], 0.32);
  const ve = firstOf(valley.ev, 'table');
  ok(firstOf(slope.ev, 'table') && Math.abs(slope.b.vz) > 0.3, `na encosta a bola deveria sair torta (vz=${slope.b.vz.toFixed(2)})`);
  ok(ve && Math.abs(valley.b.vz) < 0.05, 'no vale a bola quica reto');
  ok(solvedLands(ar, [0.1, 1.0, 1.6], [0.2, -0.75], 8).ok, 'resolvedor acerta a mesa ondulada');
}
{
  // 6. Ventilador: empurra a bola para o lado; o resolvedor compensa.
  const ar = A('ventilador');
  const withWind = shoot(ar, 0, 1.0, 1.4, [0, 1.2, -7], 0.6);
  const noWind = shoot(FLAT, 0, 1.0, 1.4, [0, 1.2, -7], 0.6);
  const ew = firstOf(withWind.ev, 'table'), en = firstOf(noWind.ev, 'table');
  ok(ew && en && ew.x - en.x > 0.08, `vento deveria desviar a bola para +x (${ew ? (ew.x - en.x).toFixed(2) : '?'} m)`);
  ok(solvedLands(ar, [0.1, 1.0, 1.6], [-0.3, -0.8], 7).ok, 'resolvedor compensa o vento');
  ok(solvedLands(ar, [0, 1.0, -1.9], [0.4, 0.8], 7, 2).ok, 'resolvedor compensa o vento (lado do adversário)');
}
{
  // 7. Barreiras: deslizam, bola baixa bate nelas, e o resolvedor passa por cima.
  const ar = A('barreiras');
  ok(Math.abs(ar.barrierX(0, 0) - ar.barrierX(0, ar.barriers[0].period / 4)) > 0.4, 'barreira deveria deslizar');
  const t0 = ar.barriers[1].period / 2; // barreira do lado do jogador no meio
  const x = ar.barrierX(1, t0 + 0.05);
  const hit = shoot(ar, x, TABLE.y + 0.06, 0.8, [0, 0.2, -5], 0.3, t0);
  ok(hit.ev.some(e => e.type === 'barrier') && hit.b.vz > 0, 'bola baixa deveria bater na barreira e voltar');
  const s = solvedLands(ar, [x, TABLE.y + 0.2, 1.5], [x, -0.9], 7, t0);
  const v = s.v;
  const { ev } = shoot(ar, x, TABLE.y + 0.2, 1.5, [v.vx, v.vy, v.vz], 1.5, t0);
  ok(s.ok && !ev.some(e => e.type === 'barrier'), 'resolvedor deveria passar a bola por cima das barreiras');
}
{
  // 8. Gangorra: com a mesa inclinada, a bola quica para o lado mais baixo.
  const ar = A('gangorra'), T = ar.tilt.period;
  ok(Math.abs(ar.tiltAngle(T / 4) - ar.tilt.max) < 1e-9, 'inclinação máxima a 1/4 do ciclo');
  const right = shoot(ar, 0.3, TABLE.y + 0.4, 0.6, [0, 0, 0], 0.4, T / 4 - 0.25); // lado +x mais alto
  ok(firstOf(right.ev, 'table') && right.b.vx < -0.2, `bola deveria quicar para o lado baixo (vx=${right.b.vx.toFixed(2)})`);
  ok(ar.surfaceY(0.5, 0, T / 4) > ar.surfaceY(-0.5, 0, T / 4), 'lado +x mais alto quando inclina');
  ok(solvedLands(ar, [0.1, 1.0, 1.6], [0.4, -0.8], 8, T / 4).ok, 'resolvedor acerta a mesa inclinada');
}
{
  // 9. Alvos: acertar o alvo aceso do outro lado dá ponto extra no fim da jogada.
  const ar = A('alvos');
  const core = new GameCore({ opponent: OPPONENTS[8], arena: ar, rng: seeded(5), firstServer: 0 });
  ok(core.targets && core.targets.every(g => g.lit), 'cada lado tem um alvo aceso');
  core.rally = new Rally(0); core.rally.onHit(0); core.state = 'rally';
  const g = core.targets[1];
  core._checkTarget({ type: 'table', side: 1, x: g.x, z: g.z });
  ok(core.rally.bonus === 0 && !g.lit, 'acertar o alvo marca o ponto extra e apaga o alvo');
  core._resolve({ winner: 1, reason: 'teste' });
  ok(core.match.score[0] === 1 && core.match.score[1] === 1, `ponto extra somado no fim da jogada (${core.match.score})`);
  const core2 = new GameCore({ opponent: OPPONENTS[8], arena: ar, rng: seeded(6), firstServer: 0 });
  core2.rally = new Rally(0); core2.rally.onHit(0);
  const g2 = core2.targets[1];
  core2._checkTarget({ type: 'table', side: 1, x: g2.x + g2.r + 0.05, z: g2.z });
  ok(core2.rally.bonus == null, 'fora do alvo não conta');
}
{
  // 10. Chefe: tem de tudo.
  const ar = A('chefe');
  ok(ar.bumpers.length && ar.holes.length && ar.net && ar.wind && ar.cfg.targets, 'mesa do chefe mistura os obstáculos');
  ok(TABLES.length === 10 && OPPONENTS.length === 10, '10 mesas e 10 adversários');
}

section('Regras');
{
  const r = new Rally(0);
  ok(r.onHit(0) === null, 'saque válido');
  ok(r.onTable(1) === null, 'saque cai do outro lado');
  ok(r.onHit(1) === null, 'devolução');
  const res = r.onTable(1);
  ok(res && res.winner === 0 && res.reason === 'quicou no próprio lado', 'quicar no próprio lado é ponto do outro');
}
{
  const r = new Rally(1); r.onHit(1); r.onTable(0); const res = r.onTable(0);
  ok(res && res.winner === 1, 'dois quiques sem devolver: ponto de quem bateu');
}
{
  const r = new Rally(0); r.onHit(0); const res = r.onFloor();
  ok(res && res.winner === 1, 'bola direto no chão: ponto do outro');
}
{
  const r = new Rally(0); r.onHit(0); r.onNet(); const res = r.onTable(1);
  ok(res && res.let, 'saque que toca a rede e entra: repete');
}
{
  const r = new Rally(0); r.onHit(0);
  ok(r.onHit(1, true).winner === 1, 'voleio em bola que ia sair: ponto de quem pegou');
  const r2 = new Rally(0); r2.onHit(0);
  ok(r2.onHit(1, false).winner === 0, 'voleio em bola que ia entrar: ponto de quem bateu');
}
{
  const m = new Match({ firstServer: 0 });
  ok(m.pointsToWin === 7, 'partida até 7');
  const servers = [];
  for (let i = 0; i < 6; i++) { servers.push(m.server); m.addPoint(i % 2); }
  ok(servers.join('') === '001100', `saque a cada 2 pontos (${servers.join('')})`);
  const d = new Match({ firstServer: 0 });
  for (let i = 0; i < 6; i++) { d.addPoint(0); d.addPoint(1); }
  const s1 = d.server; d.addPoint(0); const s2 = d.server;
  ok(s1 !== s2, 'no 6 x 6 o saque troca a cada ponto');
  ok(!d.over, '7 x 6 não termina');
  d.addPoint(0);
  ok(d.over && d.winner === 0, '8 x 6 termina');
}

section('IA e partidas em cada mesa');
{
  // Cada adversário devolve bolas normais na própria mesa.
  OPPONENTS.forEach((p, i) => {
    const ar = makeArena(i);
    let returned = 0;
    const rng = seeded(7);
    for (let k = 0; k < 20; k++) {
      const ai = new AIPlayer(p, -1, rng, ar);
      const tx = (rng() * 2 - 1) * 0.5, tz = -0.5 - rng() * 0.7;
      const t0 = rng() * 10;
      const v = solveShot(0, 1.0, 1.6, tx, tz, 7, 0, 0, 0, ar, t0);
      const b = makeBall(); Object.assign(b, { px: 0, py: 1.0, pz: 1.6, vx: v.vx, vy: v.vy, vz: v.vz, t: t0 });
      ai.planFor(b);
      const ev = [];
      let landed = null;
      for (let t = 0; t < 3; t += DT) {
        stepBall(b, DT, ev, ar);
        const s = ai.tick(DT, b);
        if (s) { Object.assign(b, s); ev.length = 0; landed = 'hit'; }
        if (landed === 'hit') { const e = ev.find(e => e.type === 'table' || e.type === 'floor' || e.type === 'hole'); if (e) { landed = e.type === 'table' && e.side === 0 ? 'in' : 'out'; break; } }
      }
      if (landed === 'in') returned++;
    }
    ok(returned >= 11, `${p.name} (${TABLES[i].name}) devolveu ${returned}/20 bolas`);
  });
}
function playMatch(ai0, ai1, arena, seed) {
  const rng = seeded(seed);
  let hits = 0, points = 0, targets = 0, bumpers = 0, holes = 0;
  const core = new GameCore({
    opponent: ai1, arena, playerAI: new AIPlayer(ai0, 1, rng, arena), rng,
    onEvent: (t) => { if (t === 'hit') hits++; if (t === 'point') points++; if (t === 'target') targets++; if (t === 'bumper') bumpers++; if (t === 'hole') holes++; },
  });
  let steps = 0;
  while (core.state !== 'matchOver' && steps < 240 * 60 * 20) { core.step(); steps++; }
  return { over: core.state === 'matchOver', winner: core.match.winner, hits, points, targets, bumpers, holes, score: [...core.match.score] };
}
{
  // Partidas IA x IA em cada mesa (o adversário da mesa contra ele mesmo): terminam e têm rally.
  const lines = [];
  TABLES.forEach((tb, i) => {
    let hits = 0, points = 0, extra = '';
    for (let m = 0; m < 2; m++) {
      const r = playMatch(OPPONENTS[i], OPPONENTS[i], makeArena(i), 300 + i * 10 + m);
      ok(r.over, `partida na mesa ${tb.name} deveria terminar`);
      hits += r.hits; points += r.points;
      if (tb.cfg.targets) extra += ` alvos:${r.targets}`;
      if (tb.cfg.bumpers) extra += ` para-choques:${r.bumpers}`;
      if (tb.cfg.holes) extra += ` buracos:${r.holes}`;
    }
    const avg = hits / points;
    lines.push(`${String(i + 1).padStart(2)}. ${tb.name.padEnd(24)} ${avg.toFixed(1)} batidas por ponto${extra}`);
    ok(avg > 2.6, `rallies muito curtos na mesa ${tb.name} (${avg.toFixed(1)} batidas por ponto)`);
  });
  console.log('  ' + lines.join('\n  '));
}
{
  // O mais forte ganha do mais fraco na maioria (na primeira e na última mesa).
  for (const ti of [0, 9]) {
    let wins = 0;
    for (let m = 0; m < 4; m++) if (playMatch(OPPONENTS[9], OPPONENTS[0], makeArena(ti), 500 + m + ti).winner === 0) wins++;
    console.log(`  ${OPPONENTS[9].name} x ${OPPONENTS[0].name} na mesa ${TABLES[ti].name}: ${wins}/4`);
    ok(wins >= 3, `${OPPONENTS[9].name} deveria ganhar do ${OPPONENTS[0].name} quase sempre (${wins}/4)`);
  }
}

section('Estrelas e progresso');
{
  ok(starsFor(true, [7, 0]) === 3 && starsFor(true, [7, 1]) === 3, '7x0 e 7x1: 3 estrelas');
  ok(starsFor(true, [7, 3]) === 2 && starsFor(true, [7, 4]) === 1, '7x3: 2 estrelas; 7x4: 1');
  ok(starsFor(true, [10, 8]) === 1 && starsFor(false, [5, 7]) === 0, 'vitória apertada: 1; derrota: 0');
  const st = { beaten: 0, stars: [] };
  recordResult(st, 0, 2); recordResult(st, 0, 1);
  ok(st.beaten === 1 && st.stars[0] === 2, 'guarda a melhor nota e libera a próxima mesa');
  recordResult(st, 3, 3);
  ok(st.beaten === 1, 'vencer mesa ainda trancada não pula o progresso');
}

console.log(fails ? `\n${fails} de ${count} verificações falharam.` : `\nTudo certo (${count} verificações).`);
process.exit(fails ? 1 : 0);

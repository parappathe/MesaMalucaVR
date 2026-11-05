// Adversários controlados pelo computador. Não depende de navegador.
// A IA prevê a trajetória da bola com a mesma física do jogo, escolhe onde bater, anda até
// lá com velocidade limitada e, se chegar a tempo, devolve a bola mirando um ponto da mesa.
import { TABLE, DT, FLAT, makeBall, copyBall, stepBall, solveShot, spinFor } from './physics.js';

// Um adversário por mesa, do mais fraco para o mais forte.
export const OPPONENTS = [
  {
    id: 'pipoca', name: 'Pipoca', style: 'Iniciante',
    desc: 'Pula de alegria, mas é lento e não dá efeito.',
    shirt: 0xffc93c, rubber: 0xd23c3c, skin: 0xf0c9a0,
    move: 2.0, reaction: 0.3, speed: [4.2, 6.2], smash: 0, top: [0, 25], back: 0, side: 0,
    aim: 0.1, err: 0.17, mistake: 0.11, early: false, late: false, serveSpeed: [4.2, 5], serveSpin: 0,
  },
  {
    id: 'lurdinha', name: 'Dona Lurdinha', style: 'Paciente',
    desc: 'Devolve devagar e no meio. Adora ver a bola cair no buraco.',
    shirt: 0x9b6bd8, rubber: 0x222222, skin: 0xe8b48a,
    move: 2.2, reaction: 0.28, speed: [4.5, 6.5], smash: 0, top: [0, 30], back: 0, side: 0,
    aim: 0.2, err: 0.15, mistake: 0.1, early: false, late: false, serveSpeed: [4.4, 5.2], serveSpin: 20,
  },
  {
    id: 'ze', name: 'Zé Elevador', style: 'Defensor',
    desc: 'Joga alto e cortando, por cima da rede que sobe.',
    shirt: 0x3fb47a, rubber: 0x222222, skin: 0xc68e62,
    move: 2.6, reaction: 0.24, speed: [4.5, 6.5], smash: 0.1, top: [-40, 0], back: 0.5, side: 0,
    aim: 0.3, err: 0.13, mistake: 0.08, early: false, late: true, serveSpeed: [4.5, 5.5], serveSpin: 40,
  },
  {
    id: 'escadinha', name: 'Escadinha', style: 'Do alto',
    desc: 'Bate de cima para baixo, aproveitando o degrau.',
    shirt: 0xe5533d, rubber: 0xd23c3c, skin: 0xf0c9a0,
    move: 2.6, reaction: 0.23, speed: [5.5, 7.5], smash: 0.4, top: [20, 70], back: 0, side: 0,
    aim: 0.4, err: 0.13, mistake: 0.08, early: false, late: false, serveSpeed: [5, 6], serveSpin: 40,
  },
  {
    id: 'marola', name: 'Marola', style: 'Surfista',
    desc: 'Mistura efeito para os dois lados e deixa a onda fazer o resto.',
    shirt: 0x2fa4e8, rubber: 0xd23c3c, skin: 0xb07850,
    move: 2.8, reaction: 0.22, speed: [5.5, 8], smash: 0.3, top: [-60, 80], back: 0.2, side: 40,
    aim: 0.45, err: 0.12, mistake: 0.07, early: false, late: false, serveSpeed: [5, 6.5], serveSpin: 80,
  },
  {
    id: 'ventania', name: 'Ventania', style: 'Atacante',
    desc: 'Rápida e sempre de topspin. Usa o vento a favor.',
    shirt: 0x8e5de8, rubber: 0xd23c3c, skin: 0xd9a77c,
    move: 2.8, reaction: 0.21, speed: [6.5, 9], smash: 0.6, top: [30, 90], back: 0, side: 30,
    aim: 0.55, err: 0.11, mistake: 0.07, early: true, late: false, serveSpeed: [5.5, 7], serveSpin: 60,
  },
  {
    id: 'porteiro', name: 'Porteiro', style: 'Paredão',
    desc: 'Alcança quase tudo e devolve cortando, por cima das barreiras.',
    shirt: 0x1fb5a8, rubber: 0x222222, skin: 0xc68e62,
    move: 3.1, reaction: 0.2, speed: [5, 7], smash: 0.2, top: [-60, -10], back: 0.7, side: 0,
    aim: 0.5, err: 0.1, mistake: 0.05, early: false, late: true, serveSpeed: [4.8, 5.8], serveSpin: 70,
  },
  {
    id: 'balanca', name: 'Madame Balança', style: 'Efeito',
    desc: 'Muito giro para todo lado, com a mesa inclinando junto.',
    shirt: 0xf25f8c, rubber: 0x222222, skin: 0xe8b48a,
    move: 2.8, reaction: 0.2, speed: [6, 8.5], smash: 0.4, top: [-120, 130], back: 0.3, side: 70,
    aim: 0.6, err: 0.1, mistake: 0.06, early: false, late: false, serveSpeed: [5, 6.5], serveSpin: 140,
  },
  {
    id: 'miracerta', name: 'Mira Certa', style: 'Atiradora',
    desc: 'Pega a bola subindo e não perde um alvo aceso.',
    shirt: 0x2a9d4b, rubber: 0xd23c3c, skin: 0xf0c9a0,
    move: 3.0, reaction: 0.19, speed: [8, 11], smash: 0.8, top: [50, 110], back: 0, side: 20,
    aim: 0.8, err: 0.08, mistake: 0.05, early: true, late: false, serveSpeed: [6, 7.5], serveSpin: 60,
  },
  {
    id: 'mestre', name: 'Mestre do Parque', style: 'Chefe',
    desc: 'O dono do parque. Rápido, preciso e conhece cada mesa.',
    shirt: 0x5b3fd1, rubber: 0xd23c3c, skin: 0xb07850,
    move: 3.4, reaction: 0.15, speed: [8.5, 12.5], smash: 1, top: [40, 130], back: 0.15, side: 50,
    aim: 0.85, err: 0.06, mistake: 0.03, early: true, late: false, serveSpeed: [6, 8], serveSpin: 120,
  },
];

function gauss(rng) {
  const u = Math.max(1e-9, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class AIPlayer {
  // side = -1: joga no lado -Z (adversário). side = +1: lado do jogador (usado nos testes).
  // arena: a mesa (physics.js). targets: alvos acesos do GameCore (se a mesa tiver).
  constructor(profile, side = -1, rng = Math.random, arena = FLAT) {
    this.p = profile;
    this.arena = arena;
    this.targets = null;
    this.side = side;
    this.rng = rng;
    this.paddle = this.ready();
    this.plan = null;
    this.time = 0;
    this.swing = 0; // 0..1 para animar a batida
    this._b = makeBall();
    this._ev = [];
  }

  ready() { return { x: 0, y: this.arena.surfaceY(0, this.side * 1.3, 0) + 0.25, z: this.side * 1.9 }; }

  reset() {
    this.plan = null;
    Object.assign(this.paddle, this.ready());
  }

  // Chamado quando o outro lado bate: a bola vem para cá.
  planFor(ball) {
    this.plan = null;
    const s = this.side;
    const b = copyBall(ball, this._b);
    const ev = this._ev;
    const pts = [];
    let bounced = false, tb = 0, stop = false;
    for (let t = DT; t < 2.6 && !stop; t += DT) {
      ev.length = 0;
      stepBall(b, DT, ev, this.arena);
      for (const e of ev) {
        if (e.type === 'floor' || e.type === 'hole') stop = true;
        else if (e.type === 'table') {
          if (bounced) stop = true; // segundo quique: só vale o que veio antes
          else if (e.z * s <= 0) return; // vai quicar no lado de quem bateu: ponto, nem tenta
          else { bounced = true; tb = t; }
        }
      }
      if (stop || !bounced || t < tb + 0.04) continue;
      if (b.pz * s > 3 || b.py > 2.1) break;
      const h = b.py - this.arena.surfaceY(b.px, b.pz, b.t);
      if (h > 0.05) pts.push({ x: b.px, y: b.py, h, z: b.pz, vy: b.vy, t });
    }
    if (!bounced || !pts.length) return;

    const pd = this.paddle;
    const stretchOf = (q) => {
      const dist = Math.hypot(q.x - pd.x, (q.y - pd.y) * 0.7, (q.z - pd.z) * 0.6);
      return dist / this.p.move / Math.max(0.01, q.t - this.p.reaction);
    };
    const p = this.p;
    const prefer = [
      p.early ? (q) => q.h > 0.14 && q.t > tb + 0.07 : null,
      p.late ? (q) => (q.vy <= 0 && q.h < 0.3) || q.z * s > 2.2 : null,
      (q) => (q.vy <= 0 && q.h > 0.08) || q.z * s > 1.65,
    ].filter(Boolean);
    let hit = null, stretch = Infinity;
    for (const f of prefer) {
      const q = pts.find(f);
      if (q) { const st = stretchOf(q); if (st <= 1) { hit = q; stretch = st; break; } }
    }
    if (!hit) {
      for (const q of pts) { const st = stretchOf(q); if (st < stretch) { stretch = st; hit = q; } }
    }
    const speedIn = Math.hypot(ball.vx, ball.vy, ball.vz);
    const spinIn = Math.hypot(ball.wx, ball.wy, ball.wz);
    const difficulty = clamp((speedIn - 6) / 10, 0, 1) * 0.5 + clamp(spinIn / 160, 0, 1) * 0.3 + clamp(stretch - 0.5, 0, 1) * 0.4;
    this.plan = {
      x: hit.x, y: hit.y, z: hit.z,
      hitTime: this.time + hit.t, startMove: this.time + p.reaction,
      reachable: stretch <= 1.35, desperate: stretch > 1, difficulty,
    };
  }

  // Avança o tempo; se for a hora e a raquete chegou, devolve {vx,vy,vz,wx,wy,wz}.
  tick(dt, ball) {
    this.time += dt;
    this.swing = Math.max(0, this.swing - dt * 4);
    const pd = this.paddle;
    const pl = this.plan;
    let tx, ty, tz, speed = this.p.move;
    if (pl && this.time >= pl.startMove) { tx = pl.x; ty = pl.y; tz = pl.z + this.side * 0.02; }
    else if (pl) { return null; }
    else { const r = this.ready(); tx = r.x; ty = r.y; tz = r.z; speed *= 0.6; }
    // Mesma métrica do planFor: subir/descer e ir para frente/trás custam menos que o lado.
    const dx = tx - pd.x, dy = ty - pd.y, dz = tz - pd.z;
    const d = Math.hypot(dx, dy * 0.7, dz * 0.6);
    const f = d > 0 ? Math.min(1, speed * dt / d) : 1;
    pd.x += dx * f; pd.y += dy * f; pd.z += dz * f;
    if (!pl || this.time < pl.hitTime - 1e-9) return null;
    this.plan = null;
    const gap = Math.hypot(ball.px - pd.x, ball.py - pd.y, ball.pz - pd.z);
    if (!pl.reachable || gap > (pl.desperate ? 0.45 : 0.16)) return null; // não chegou: a bola passa
    this.swing = 1;
    return this.shot(ball, pl.difficulty + (pl.desperate ? 0.5 : 0));
  }

  // Escolhe a jogada de devolução.
  shot(ball, difficulty) {
    const p = this.p, rng = this.rng, s = this.side;
    const h = ball.py - this.arena.surfaceY(ball.px, ball.pz, ball.t || 0);
    let speed = lerp(p.speed[0], p.speed[1], rng());
    let top = lerp(p.top[0], p.top[1], rng());
    let side = (rng() * 2 - 1) * p.side;
    if (p.back > 0 && rng() < p.back) top = -Math.abs(top || 40) - 20 * rng();
    // Bola alta: chance de cortada.
    if (h > 0.45 && rng() < p.smash) { speed = p.speed[1] * 1.25; top = Math.max(top, 60); }
    if (h < 0.12) speed *= 0.8;
    // Mira: profundidade e lado. Quem mira bem vai mais nos cantos.
    let depth = lerp(0.45, 0.92, rng());
    let tx;
    if (rng() < p.aim) tx = (rng() < 0.5 ? -1 : 1) * lerp(0.45, 0.66, rng());
    else tx = (rng() * 2 - 1) * lerp(0.15, 0.5, p.aim);
    const errK = p.err * (1 + difficulty);
    tx += gauss(rng) * errK;
    depth += gauss(rng) * errK / TABLE.halfL;
    let netErr = false;
    if (rng() < p.mistake * (1 + 3 * difficulty)) {
      const k = rng();
      if (k < 0.4) netErr = true;
      else if (k < 0.7) depth = 1 + lerp(0.1, 0.4, rng()) / TABLE.halfL;
      else tx = (rng() < 0.5 ? -1 : 1) * (TABLE.halfW + lerp(0.08, 0.35, rng()));
    }
    depth = Math.max(0.12, depth);
    let tz = -s * depth * TABLE.halfL;
    // Mesa dos alvos: quem mira bem vai no alvo aceso do outro lado.
    const tg = this.targets?.find(g => g.lit && (g.z > 0) === (s < 0));
    if (tg && !netErr && rng() < p.aim * 0.5) {
      tx = tg.x + gauss(rng) * errK * 0.7; tz = tg.z + gauss(rng) * errK * 0.7;
    }
    // Mesa com buracos: às vezes mira num buraco do outro lado (é ponto se cair).
    const holes = this.arena.holes?.filter(hl => (hl.z > 0) === (s < 0));
    if (holes?.length && !netErr && rng() < p.aim * 0.2) {
      const hl = holes[Math.floor(rng() * holes.length)];
      tx = hl.x + gauss(rng) * errK; tz = hl.z + gauss(rng) * errK;
    }
    return this._solve(ball, tx, tz, speed, top, side, netErr);
  }

  _solve(ball, tx, tz, speed, top, side, netErr) {
    const dx = tx - ball.px, dz = tz - ball.pz, dl = Math.hypot(dx, dz);
    const w = spinFor(dx / dl, dz / dl, top, side);
    const v = solveShot(ball.px, ball.py, ball.pz, tx, tz, speed, w.wx, w.wy, w.wz, this.arena, ball.t || 0);
    if (netErr) v.vy -= lerp(0.8, 1.6, this.rng());
    return { vx: v.vx, vy: v.vy, vz: v.vz, wx: w.wx, wy: w.wy, wz: w.wz };
  }

  // Saque: posição e velocidade do lançamento da bola para cima.
  serveToss(ball) {
    const s = this.side;
    ball.px = lerp(-0.35, 0.35, this.rng());
    ball.pz = s * (TABLE.halfL + 0.12);
    ball.py = this.arena.surfaceY(0, s * TABLE.halfL, 0) + 0.22;
    ball.vx = 0; ball.vy = 2.2; ball.vz = 0; ball.wx = 0; ball.wy = 0; ball.wz = 0;
    this.plan = null;
    Object.assign(this.paddle, { x: ball.px + 0.12, y: ball.py, z: ball.pz + s * 0.05 });
    return ball.py;
  }

  serveShot(ball) {
    const p = this.p, rng = this.rng, s = this.side;
    this.swing = 1;
    Object.assign(this.paddle, { x: ball.px, y: ball.py, z: ball.pz + s * 0.03 });
    const speed = lerp(p.serveSpeed[0], p.serveSpeed[1], rng());
    let top = (rng() * 2 - 1) * p.serveSpin;
    const side = (rng() * 2 - 1) * p.serveSpin * 0.6;
    let tx = (rng() * 2 - 1) * lerp(0.2, 0.6, p.aim);
    let depth = lerp(0.5, 0.9, rng());
    tx += gauss(rng) * p.err * 0.6;
    if (rng() < p.mistake * 0.4) depth = 1.15;
    const tz = -s * depth * TABLE.halfL;
    return this._solve(ball, tx, tz, speed, top, side, false);
  }
}

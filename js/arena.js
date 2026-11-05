// As 10 mesas malucas: cada uma é uma "arena" para a física (physics.js). Não depende de
// navegador. Uma mesa é descrita por uma configuração (cfg) com os obstáculos que ela tem;
// a classe MesaArena transforma isso em superfície, rede, vento e colisões.
import { TABLE, BALL_R, Arena, hitSphere, hitBox } from './physics.js';

const TAU = Math.PI * 2;

export class MesaArena extends Arena {
  constructor(cfg = {}) {
    super();
    this.cfg = cfg;
    this.bumpers = cfg.bumpers || [];
    this.holes = cfg.holes || [];
    this.barriers = cfg.barriers || [];
    this.step = cfg.step || 0;
    this.wave = cfg.wave || null;
    this.tilt = cfg.tilt || null;
    this.wind = cfg.wind || null;
    this.net = cfg.net || null;
  }

  // ---- Peças que mudam com o tempo ----
  tiltAngle(t) { return this.tilt ? this.tilt.max * Math.sin(TAU * t / this.tilt.period + (this.tilt.phase || 0)) : 0; }
  netHeight(t) {
    const n = this.net;
    if (!n) return TABLE.netH;
    return n.min + (n.max - n.min) * (0.5 - 0.5 * Math.cos(TAU * t / n.period));
  }
  barrierX(i, t) { const b = this.barriers[i]; return b.x0 + b.amp * Math.sin(TAU * t / b.period + b.phase); }
  barrierVX(i, t) { const b = this.barriers[i]; return b.amp * TAU / b.period * Math.cos(TAU * t / b.period + b.phase); }
  windAccel(t) { const w = this.wind; return w ? w.dir * w.accel * (0.65 + 0.35 * Math.sin(TAU * t / w.period)) : 0; }

  _waveH(x, z) {
    const w = this.wave;
    return w.A * 0.5 * (1 - Math.cos(TAU * z / w.lambda)) * (0.75 + 0.25 * Math.cos(TAU * x / w.lambdaX));
  }

  // ---- Interface da física ----
  surfaceY(x, z, t) {
    let y = TABLE.y;
    if (this.step && z < 0) y += this.step;
    if (this.wave) y += this._waveH(x, z);
    if (this.tilt) y += x * Math.tan(this.tiltAngle(t));
    return y;
  }
  normal(x, z, t, out) {
    let gx = 0, gz = 0;
    if (this.wave) {
      const w = this.wave;
      const a = 0.5 * (1 - Math.cos(TAU * z / w.lambda)), b = 0.75 + 0.25 * Math.cos(TAU * x / w.lambdaX);
      gz = w.A * 0.5 * Math.sin(TAU * z / w.lambda) * TAU / w.lambda * b;
      gx = w.A * a * -0.25 * Math.sin(TAU * x / w.lambdaX) * TAU / w.lambdaX;
    }
    if (this.tilt) gx += Math.tan(this.tiltAngle(t));
    const l = Math.hypot(gx, 1, gz);
    out.x = -gx / l; out.y = 1 / l; out.z = -gz / l;
    return out;
  }
  hasTop(x, z, t) {
    if (Math.abs(x) > TABLE.halfW || Math.abs(z) > TABLE.halfL) return false;
    for (const h of this.holes) if ((x - h.x) ** 2 + (z - h.z) ** 2 < h.r * h.r) return false;
    return true;
  }
  inHole(x, z) {
    for (const h of this.holes) if ((x - h.x) ** 2 + (z - h.z) ** 2 < (h.r + 0.03) ** 2) return true;
    return false;
  }
  netBase(x, t) { return TABLE.y + (this.tilt ? x * Math.tan(this.tiltAngle(t)) : 0); }
  netWall(x, t) { return this.netBase(x, t) + this.step; }
  netTop(x, t) { return this.netBase(x, t) + this.step + this.netHeight(t); }

  accel(b, t, a) {
    const w = this.wind;
    if (!w) return;
    if (Math.abs(b.pz - w.z) < w.halfZ && b.py < TABLE.y + w.height && Math.abs(b.px) < TABLE.halfW + 0.6) a.x += this.windAccel(t);
  }

  collide(b, ox, oy, oz, t, events) {
    for (let i = 0; i < this.bumpers.length; i++) {
      const p = this.bumpers[i];
      const base = this.surfaceY(p.x, p.z, t);
      // Cápsula vertical: cilindro com topo arredondado.
      const cy = Math.max(base, Math.min(base + p.h, b.py));
      if (hitSphere(b, p.x, cy, p.z, p.r, 0.95, 0.15, p.boost)) events?.push({ type: 'bumper', i });
    }
    for (let i = 0; i < this.barriers.length; i++) {
      const q = this.barriers[i];
      const cx = this.barrierX(i, t);
      const base = this.surfaceY(cx, q.z, t);
      if (hitBox(b, cx, base + q.h / 2, q.z, q.hw, q.h / 2, q.hz, 0.7, 0.3, this.barrierVX(i, t))) events?.push({ type: 'barrier', i });
    }
  }

  blocked(b, t) {
    for (const p of this.bumpers) {
      const base = this.surfaceY(p.x, p.z, t);
      const cy = Math.max(base, Math.min(base + p.h, b.py));
      if (Math.hypot(b.px - p.x, b.py - cy, b.pz - p.z) < p.r + BALL_R) return true;
    }
    for (let i = 0; i < this.barriers.length; i++) {
      const q = this.barriers[i];
      const cx = this.barrierX(i, t);
      const base = this.surfaceY(cx, q.z, t);
      if (Math.abs(b.px - cx) < q.hw + BALL_R && b.py < base + q.h + BALL_R && Math.abs(b.pz - q.z) < q.hz + BALL_R) return true;
    }
    return false;
  }
}

// As mesas, na ordem das fases. Cada uma ensina uma coisa; a última mistura tudo.
// top/accent: cores do tampo e dos detalhes. teach: o que a fase ensina (aparece antes de jogar).
export const TABLES = [
  {
    id: 'fliperama', name: 'Fliperama', top: 0x2f7de1, accent: 0xff4fa3,
    teach: 'Dois para-choques do lado do adversário rebatem a bola com força. Mire neles para pegar o outro desprevenido, ou fuja deles.',
    cfg: { bumpers: [{ x: -0.36, z: -0.72, r: 0.085, h: 0.07, boost: 2.5 }, { x: 0.36, z: -0.72, r: 0.085, h: 0.07, boost: 2.5 }] },
  },
  {
    id: 'buracos', name: 'Queijo Suíço', top: 0xf2a33a, accent: 0x7b4bd8,
    teach: 'A mesa tem buracos. Bola que cai num buraco do lado do adversário é ponto seu; no seu lado, é ponto dele.',
    cfg: { holes: [{ x: -0.38, z: -0.72, r: 0.12 }, { x: 0.38, z: -0.72, r: 0.12 }, { x: 0.38, z: 0.72, r: 0.12 }, { x: -0.38, z: 0.72, r: 0.12 }] },
  },
  {
    id: 'elevador', name: 'Rede Elevador', top: 0x23b07d, accent: 0xffd23f,
    teach: 'A rede sobe e desce sem parar. Rede baixa: bata reto e rápido. Rede alta: jogue a bola em arco.',
    cfg: { net: { min: 0.05, max: 0.34, period: 5 } },
  },
  {
    id: 'degraus', name: 'Escadaria', top: 0xe5533d, accent: 0x2fc6e8,
    teach: 'A metade do adversário é 12 cm mais alta. Suas bolas precisam subir mais; as dele descem com tudo.',
    cfg: { step: 0.12 },
  },
  {
    id: 'ondas', name: 'Mar de Ondas', top: 0x3fa9f5, accent: 0xffffff,
    teach: 'O tampo é ondulado. A bola quica torta conforme o lugar da onda em que cai.',
    cfg: { wave: { A: 0.045, lambda: 0.685, lambdaX: 1.0 } },
  },
  {
    id: 'ventilador', name: 'Ventania', top: 0x8e5de8, accent: 0x7ff0ff,
    teach: 'Um ventilador sopra no meio da mesa, da esquerda para a direita. Mire mais para a esquerda para compensar.',
    cfg: { wind: { z: 0, halfZ: 0.55, height: 1.0, accel: 9, dir: 1, period: 4.5 } },
  },
  {
    id: 'barreiras', name: 'Pista de Obstáculos', top: 0x1fb5a8, accent: 0xff8a1e,
    teach: 'Duas barreiras deslizam de um lado para o outro, uma em cada metade. Bola baixa bate nelas: passe por cima ou pelo vão.',
    cfg: { barriers: [
      { z: -0.42, x0: 0, amp: 0.5, period: 3.6, phase: 0, hw: 0.17, hz: 0.025, h: 0.11 },
      { z: 0.42, x0: 0, amp: 0.5, period: 3.6, phase: Math.PI, hw: 0.17, hz: 0.025, h: 0.11 },
    ] },
  },
  {
    id: 'gangorra', name: 'Gangorra', top: 0xf25f8c, accent: 0xfff06a,
    teach: 'A mesa inteira inclina devagar para um lado e para o outro. A bola quica para o lado mais baixo.',
    cfg: { tilt: { max: 0.1, period: 7 } },
  },
  {
    id: 'alvos', name: 'Tiro ao Alvo', top: 0x2a9d4b, accent: 0xff3b3b,
    teach: 'Cada lado tem um alvo aceso. Acertar o alvo do adversário dá um ponto extra no fim da jogada.',
    cfg: { targets: { r: 0.13 } },
  },
  {
    id: 'chefe', name: 'Grande Final do Parque', top: 0x5b3fd1, accent: 0xffc93c,
    teach: 'O chefe mistura tudo: para-choques, buracos, rede elevador, vento e alvos. Boa sorte!',
    cfg: {
      bumpers: [{ x: -0.5, z: -0.95, r: 0.06, h: 0.06, boost: 1.8 }, { x: 0.5, z: -0.95, r: 0.06, h: 0.06, boost: 1.8 }],
      holes: [{ x: 0, z: -1.0, r: 0.1 }, { x: 0, z: 1.0, r: 0.1 }],
      net: { min: 0.08, max: 0.26, period: 6 },
      wind: { z: 0, halfZ: 0.45, height: 1.0, accel: 6, dir: -1, period: 5 },
      targets: { r: 0.12 },
    },
  },
];

export function makeArena(i) { return new MesaArena(TABLES[i].cfg); }

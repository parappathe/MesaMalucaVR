// Núcleo de uma partida: bola, regras, saque e adversário(s). Não depende de navegador:
// o main.js liga isto à tela e aos controles, e os testes rodam IA contra IA com ele.
import { TABLE, DT, FLAT, makeBall, copyBall, stepBall } from './physics.js';
import { Rally, Match } from './match.js';
import { AIPlayer } from './ai.js';

export class GameCore {
  // sides[0] = jogador (lado +Z), sides[1] = adversário (lado -Z).
  // playerAI: AIPlayer no lado do jogador (só nos testes); null = humano.
  // arena: a mesa (arena.js). Mesa com cfg.targets tem um alvo aceso de cada lado.
  constructor({ opponent, arena = FLAT, playerAI = null, rng = Math.random, bestOf = 1, pointsToWin = 7, firstServer = null, onEvent = null }) {
    this.rng = rng;
    this.arena = arena;
    if (playerAI) playerAI.arena = arena;
    this.ai = [playerAI, new AIPlayer(opponent, -1, rng, arena)];
    this.targets = arena.cfg?.targets ? [0, 1].map(side => ({ side, x: 0, z: 0, r: arena.cfg.targets.r, lit: false })) : null;
    for (const a of this.ai) if (a) a.targets = this.targets;
    this.match = new Match({ bestOf, pointsToWin, firstServer: firstServer ?? (rng() < 0.5 ? 0 : 1) });
    this.ball = makeBall();
    this.prev = makeBall();
    this._pre = makeBall();
    this._tmp = makeBall();
    this.events = [];
    this.onEvent = onEvent;
    this.rally = null;
    this.lastPoint = null;
    this.time = 0;
    this.startServe();
  }

  emit(type, data = {}) { this.onEvent?.(type, data); }

  get server() { return this.match.server; }
  isHuman(i) { return !this.ai[i]; }

  startServe() {
    this.state = 'serveWait';
    this.timer = 0;
    this.rally = null;
    for (const a of this.ai) a?.reset();
    const b = this.ball;
    b.vx = b.vy = b.vz = b.wx = b.wy = b.wz = 0;
    b.pz = (this.server === 0 ? 1 : -1) * (TABLE.halfL + 0.2);
    b.px = 0; b.py = this.arena.surfaceY(0, b.pz, this.time) + 0.25;
    b.t = this.time;
    this._placeTargets();
    this.emit('serveWait', { server: this.server });
  }

  // Jogador humano segura a bola na mão antes de sacar.
  holdBall(x, y, z) {
    if (this.state !== 'serveWait' || !this.isHuman(this.server)) return;
    const b = this.ball;
    b.px = x; b.py = y; b.pz = z; b.vx = b.vy = b.vz = 0; b.wx = b.wy = b.wz = 0;
  }

  humanToss(vx = 0, vy = 2.3, vz = 0) {
    if (this.state !== 'serveWait' || !this.isHuman(this.server)) return false;
    const b = this.ball;
    b.vx = vx; b.vy = vy; b.vz = vz;
    this.tossY = b.py;
    this.state = 'toss';
    this.emit('toss', { server: this.server });
    return true;
  }

  // Um passo fixo de simulação (DT). humanHit(ball, prev, core) testa e aplica a batida do
  // jogador humano; devolve true se bateu.
  step(humanHit = null) {
    const b = this.ball;
    b.t = this.time;
    this.time += DT;
    if (this.state === 'serveWait') {
      this.timer += DT;
      const srv = this.server;
      for (const a of this.ai) if (a && a !== this.ai[srv]) a.tick(DT, b);
      if (!this.isHuman(srv) && this.timer > 0.9) {
        this.tossY = this.ai[srv].serveToss(b);
        this.state = 'toss';
        this.emit('toss', { server: srv });
      }
      return;
    }
    if (this.state === 'matchOver') return;

    copyBall(b, this.prev);
    this.events.length = 0;
    stepBall(b, DT, this.events, this.arena);
    const out = Math.abs(b.px) > 7 || Math.abs(b.pz) > 9;
    if (out) this.events.push({ type: 'floor' });

    for (const e of this.events) {
      this.emit(e.type, e);
      if (this.state === 'toss') {
        if (e.type === 'table' || e.type === 'floor' || e.type === 'hole') { this.startServe(); return; }
      } else if (this.state === 'rally') {
        let r = null;
        if (e.type === 'table') { this._checkTarget(e); r = this.rally.onTable(e.side); }
        else if (e.type === 'hole') r = this.rally.onHole(e.side);
        else if (e.type === 'net') this.rally.onNet();
        else if (e.type === 'floor') r = this.rally.onFloor();
        if (r) { this._resolve(r); break; }
      }
    }
    if (out) { b.vx = b.vy = b.vz = 0; b.py = 0.02; }

    if (this.state === 'pointOver') {
      this.timer += DT;
      for (const a of this.ai) a?.tick(DT, b);
      if (this.timer > 1.7) {
        if (this.match.over) { this.state = 'matchOver'; this.emit('matchOver', { winner: this.match.winner }); }
        else this.startServe();
      }
      return;
    }

    if (this.state === 'toss') {
      const srv = this.server;
      if (!this.isHuman(srv)) {
        this.ai[srv].tick(DT, b);
        if (b.vy < 0 && b.py <= this.tossY) {
          copyBall(b, this._pre);
          this._apply(this.ai[srv].serveShot(b));
          this._hit(srv);
        }
      } else if (humanHit && humanHit(b, this.prev, this)) {
        this._hit(0);
      } else if (b.py < TABLE.y - 0.3) {
        this.startServe();
      }
      for (const a of this.ai) if (a && a !== this.ai[srv]) a.tick(DT, b);
      return;
    }

    // Rally
    const r = this.rally.tick(DT);
    if (r) { this._resolve(r); return; }
    for (let i = 0; i < 2; i++) {
      if (this.state !== 'rally') break;
      if (this.ai[i]) {
        copyBall(b, this._pre);
        const shot = this.ai[i].tick(DT, b);
        if (shot) { this._apply(shot); this._hit(i); }
      } else if (humanHit) {
        copyBall(b, this._pre);
        if (humanHit(b, this.prev, this)) this._hit(i);
      }
    }
  }

  _apply(v) {
    const b = this.ball;
    b.vx = v.vx; b.vy = v.vy; b.vz = v.vz; b.wx = v.wx; b.wy = v.wy; b.wz = v.wz;
  }

  _hit(i) {
    if (this.state === 'toss') {
      this.rally = new Rally(this.server);
      this.rally.onHit(i);
      this.state = 'rally';
    } else {
      const out = this.rally.bounces === 0 ? !this._wouldLandOn(this._pre, i) : false;
      const r = this.rally.onHit(i, out);
      if (r) { this.emit('hit', { who: i }); this._resolve(r); return; }
    }
    this.emit('hit', { who: i, speed: Math.hypot(this.ball.vx, this.ball.vy, this.ball.vz) });
    if (this.ai[i]) this.ai[i].plan = null;
    this.ai[1 - i]?.planFor(this.ball);
  }

  // A bola (antes da batida) cairia na metade do lado `side`?
  _wouldLandOn(ball, side) {
    const b = copyBall(ball, this._tmp);
    const ev = [];
    for (let t = 0; t < 2; t += DT) {
      ev.length = 0;
      stepBall(b, DT, ev, this.arena);
      for (const e of ev) {
        if (e.type === 'table') return e.side === side;
        if (e.type === 'floor' || e.type === 'hole') return false;
      }
    }
    return false;
  }

  // Alvos (mesa dos alvos): um aceso em cada metade, em lugar sorteado a cada saque.
  _placeTargets() {
    if (!this.targets) return;
    for (const g of this.targets) {
      const s = g.side === 0 ? 1 : -1;
      for (let k = 0; k < 20; k++) {
        g.x = (this.rng() * 2 - 1) * 0.5;
        g.z = s * (0.4 + this.rng() * 0.7);
        if (!this.arena.inHole?.(g.x, g.z)) break;
      }
      g.lit = true;
    }
  }

  // Primeiro quique válido dentro do alvo aceso do lado que recebe: ponto extra garantido.
  _checkTarget(e) {
    if (!this.targets || !this.rally || this.rally.result) return;
    const r = this.rally;
    if (r.bounces !== 0 || e.side === r.lastHitter || (r.isServe && r.netOnServe)) return;
    const g = this.targets[e.side];
    if (!g.lit || Math.hypot(e.x - g.x, e.z - g.z) > g.r) return;
    g.lit = false;
    if (r.bonus == null) r.bonus = r.lastHitter;
    this.emit('target', { side: e.side, who: r.lastHitter });
  }

  _resolve(r) {
    if (r.let) {
      this.emit('let', {});
      this.state = 'pointOver';
      this.timer = 0.6;
      this.lastPoint = null;
      return;
    }
    const res = this.match.addPoint(r.winner);
    // Alvo acertado nesta jogada: ponto extra para quem acertou (se o game não acabou agora).
    let bonus = null;
    if (this.rally.bonus != null && !res.gameWon && !this.match.over) {
      bonus = this.rally.bonus;
      Object.assign(res, this.match.addPoint(bonus));
    }
    this.lastPoint = { ...r, ...res, bonus };
    this.state = 'pointOver';
    this.timer = 0;
    for (const a of this.ai) if (a) a.plan = null;
    this.emit('point', this.lastPoint);
  }
}

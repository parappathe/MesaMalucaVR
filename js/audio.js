// Sons sintetizados com Web Audio (sem arquivos).
export class Sfx {
  constructor() { this.ctx = null; this.master = null; this.muted = false; this.musicOn = false; this._mt = null; }

  // Testes automáticos no navegador: nunca tocar som nem música.
  mute() { this.muted = true; this.music(false); if (this.ctx) this.master.gain.value = 0; }

  // Precisa ser chamado num clique/gesto (regra dos navegadores).
  unlock() {
    if (this.muted) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _out(pan) {
    const c = this.ctx;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(this.master);
      return p;
    }
    return this.master;
  }

  _tone(freq, dur, vol, pan = 0, type = 'sine', bend = 1) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * bend, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this._out(pan));
    o.start(t); o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, freq, q, pan = 0, attack = 0.001) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    s.loopStart = Math.random(); s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this._out(pan));
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  hit(strength = 0.5, pan = 0) {
    const v = 0.25 + Math.min(1, strength) * 0.5;
    this._noise(0.05, v, 2600, 2.5, pan);
    this._tone(1300, 0.04, v * 0.5, pan, 'triangle', 0.6);
  }
  bounce(pan = 0) { this._tone(1050, 0.06, 0.35, pan, 'sine', 0.7); this._noise(0.03, 0.15, 3500, 3, pan); }
  net() { this._noise(0.12, 0.3, 500, 1.2); }
  floor(pan = 0) { this._tone(600, 0.08, 0.18, pan, 'sine', 0.6); }
  click() { this._tone(880, 0.05, 0.2, 0, 'square', 1.2); }
  cheer(big = false) {
    this._noise(big ? 2.4 : 1.4, big ? 0.35 : 0.22, 1200, 0.5, -0.4, 0.25);
    this._noise(big ? 2.4 : 1.4, big ? 0.35 : 0.22, 1700, 0.5, 0.4, 0.3);
  }
  groan() { this._noise(1.0, 0.15, 400, 0.7, 0, 0.15); }
  bumper(pan = 0) { this._tone(1760, 0.18, 0.3, pan, 'square', 1.5); this._tone(2640, 0.12, 0.15, pan, 'sine', 1.2); }
  hole(pan = 0) { this._tone(420, 0.35, 0.35, pan, 'sine', 0.35); }
  target() {
    if (!this.ctx) return;
    [988, 1319, 1760].forEach((f, i) => setTimeout(() => this._tone(f, 0.18, 0.22, 0, 'triangle'), i * 90));
  }
  wood(pan = 0) { this._tone(320, 0.07, 0.3, pan, 'triangle', 0.8); this._noise(0.04, 0.2, 900, 2, pan); }

  // Música leve de parque (valsa de carrossel) gerada na hora. on=false para.
  music(on) {
    this.musicOn = on;
    if (!on) { clearInterval(this._mt); this._mt = null; if (this.musicGain) this.musicGain.gain.value = 0; return; }
    if (!this.ctx || this.muted || this._mt) return;
    const c = this.ctx;
    if (!this.musicGain) { this.musicGain = c.createGain(); this.musicGain.connect(this.master); }
    this.musicGain.gain.value = 0.07;
    // Progressão em 3/4: C G Am F (graus em semitons a partir de C4).
    const chords = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];
    const melody = [12, 16, 19, 16, 14, 12, 11, 14, 16, 12, 9, 12, 14, 12, 9, 7, 9, 12, 17, 16, 14, 12, 11, 12];
    const beat = 0.32;
    let next = c.currentTime + 0.1, step = 0;
    const note = (semi, t, dur, vol, type) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = 261.63 * Math.pow(2, semi / 12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.musicGain);
      o.start(t); o.stop(t + dur + 0.05);
    };
    const tick = () => {
      while (next < c.currentTime + 0.5) {
        const bar = Math.floor(step / 3) % chords.length, inBar = step % 3;
        const ch = chords[bar];
        if (inBar === 0) note(ch[0] - 12, next, beat * 1.4, 0.5, 'triangle');
        else note(ch[1], next, beat * 0.8, 0.22, 'sine'), note(ch[2], next, beat * 0.8, 0.18, 'sine');
        note(melody[step % melody.length], next, beat * 0.9, 0.28, 'triangle');
        next += beat; step++;
      }
    };
    tick();
    this._mt = setInterval(tick, 150);
  }

  fanfare(win = true) {
    if (!this.ctx) return;
    const notes = win ? [523, 659, 784, 1047] : [392, 349, 311, 262];
    notes.forEach((f, i) => setTimeout(() => this._tone(f, 0.35, 0.22, 0, 'triangle'), i * 160));
  }
}

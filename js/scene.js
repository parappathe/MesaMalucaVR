// Cenário: parque de diversões a céu aberto, a mesa maluca da fase, placar de fliperama,
// público, raquetes e o adversário. Tudo gerado por código (sem modelos nem imagens) para
// carregar rápido no Quest. Iluminação simples, sem sombras projetadas.
import * as THREE from '../vendor/three/three.module.js';
import { TABLE, BALL_R } from './physics.js';

const TAU = Math.PI * 2;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { tex: t, canvas: c, ctx: g };
}
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export function buildScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd8ff);
  scene.fog = new THREE.Fog(0xbfe6ff, 22, 48);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb07a, 1.9));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
  sun.position.set(3, 8, 4);
  scene.add(sun);

  // Céu em degradê (domo) com nuvens simples.
  const skyTex = canvasTex(64, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#5fb6f5'); gr.addColorStop(0.55, '#a6dcff'); gr.addColorStop(1, '#fff1d6');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(45, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex.tex, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.3;
    const cg = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1.2 + Math.random(), 10, 8), cloudMat);
      s.position.set(k * 1.5 - 2.2, Math.random() * 0.6, Math.random() * 0.8);
      s.scale.y = 0.55;
      cg.add(s);
    }
    cg.position.set(Math.sin(a) * 36, 14 + Math.random() * 6, Math.cos(a) * 36);
    cg.lookAt(0, cg.position.y, 0);
    scene.add(cg);
  }

  // Grama, caminho e o tablado xadrez em volta da mesa.
  const grass = new THREE.Mesh(new THREE.CircleGeometry(44, 32), new THREE.MeshLambertMaterial({ color: 0x7cc96a }));
  grass.rotation.x = -Math.PI / 2;
  scene.add(grass);
  const checker = canvasTex(512, 512, (g, w, h) => {
    const n = 8;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = (i + j) % 2 ? '#fff4d6' : '#ff8fb8';
      g.fillRect(i * w / n, j * h / n, w / n, h / n);
    }
  });
  checker.tex.wrapS = checker.tex.wrapT = THREE.RepeatWrapping;
  checker.tex.repeat.set(4, 6);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(8, 0.06, 12), new THREE.MeshLambertMaterial({ map: checker.tex }));
  deck.position.y = -0.03 + 0.002;
  scene.add(deck);
  const deckEdge = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.05, 12.2), new THREE.MeshLambertMaterial({ color: 0x5b3fd1 }));
  deckEdge.position.y = -0.03;
  scene.add(deckEdge);

  // Roda-gigante atrás do adversário (gira devagar).
  const wheel = new THREE.Group();
  wheel.position.set(-5, 7.5, -17);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(6, 0.12, 6, 40), wheelMat);
  wheel.add(rim);
  const spin = new THREE.Group();
  wheel.add(spin);
  const cabinColors = [0xff4f6d, 0xffd23f, 0x3fc1ff, 0x7be36a, 0xb06bff, 0xff9a3c];
  const cabins = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6, 0.08), wheelMat);
    spoke.position.set(Math.cos(a) * 3, Math.sin(a) * 3, 0);
    spoke.rotation.z = a - Math.PI / 2;
    spin.add(spoke);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.7), new THREE.MeshLambertMaterial({ color: cabinColors[i % 6] }));
    cab.userData.a = a;
    wheel.add(cab);
    cabins.push(cab);
  }
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 8.5, 0.25), wheelMat);
    leg.position.set(sx * 2.2, -3.8, 0); leg.rotation.z = sx * 0.27;
    wheel.add(leg);
  }
  scene.add(wheel);

  // Barracas listradas em volta.
  const stripe = (a, b) => canvasTex(256, 64, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(i * w / 8, 0, w / 8, h); }
  });
  const tents = [['#ff4f6d', '#ffffff'], ['#3fc1ff', '#ffffff'], ['#ffd23f', '#ff7a3c'], ['#7be36a', '#ffffff'], ['#b06bff', '#ffd23f']];
  const tentSpots = [[-7.5, -9], [7.5, -9], [-10, -2], [10, -2], [-9, 5.5], [9, 5.5], [4, -13], [12, -12]];
  tentSpots.forEach(([x, z], i) => {
    const [a, b] = tents[i % tents.length];
    const t = stripe(a, b).tex;
    t.wrapS = THREE.RepeatWrapping; t.repeat.x = 2;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2, 16, 1, true), new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
    body.position.y = 1;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.4, 16), new THREE.MeshLambertMaterial({ map: t }));
    roof.position.y = 2.7;
    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), new THREE.MeshLambertMaterial({ color: 0xffd23f }));
    flag.position.y = 3.6;
    g.add(body, roof, flag);
    g.position.set(x, 0, z);
    scene.add(g);
  });

  // Varal de lâmpadas coloridas sobre a mesa (só visual, brilho próprio).
  const bulbGeo = new THREE.SphereGeometry(0.06, 8, 6);
  const bulbColors = [0xff4f6d, 0xffd23f, 0x3fc1ff, 0x7be36a, 0xffffff];
  const bulbs = [];
  const poleMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const poles = [[-3.6, -5.5], [3.6, -5.5], [-3.6, 4.5], [3.6, 4.5]];
  for (const [x, z] of poles) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 8), poleMat);
    pole.position.set(x, 2.1, z);
    scene.add(pole);
  }
  const strings = [[2, 3], [0, 2], [1, 3], [0, 3], [1, 2]]; // nada passa na frente do placar
  for (const [ia, ib] of strings) {
    const a = poles[ia], b = poles[ib];
    const n = 16;
    for (let k = 1; k < n; k++) {
      const f = k / n;
      const m = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: bulbColors[(k + ia) % bulbColors.length] }));
      m.position.set(a[0] + (b[0] - a[0]) * f, 4.1 - Math.sin(f * Math.PI) * 0.8, a[1] + (b[1] - a[1]) * f);
      scene.add(m);
      bulbs.push(m);
    }
  }

  // Público em pé atrás das cordas, dos dois lados.
  const seats = [];
  for (const sx of [-1, 1]) for (let r = 0; r < 2; r++) for (let k = 0; k < 13; k++) {
    if (Math.random() < 0.25) continue;
    seats.push(new THREE.Vector3(sx * (3.0 + r * 0.6 + Math.random() * 0.15), 0, -4.6 + k * 0.62 + (Math.random() - 0.5) * 0.2));
  }
  const ropeMat = new THREE.MeshLambertMaterial({ color: 0xff4f6d });
  for (const sx of [-1, 1]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 9.6, 6), ropeMat);
    rope.rotation.x = Math.PI / 2; rope.position.set(sx * 2.7, 0.9, -0.6);
    scene.add(rope);
    for (let k = 0; k < 5; k++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.95, 8), new THREE.MeshLambertMaterial({ color: 0xffd23f }));
      post.position.set(sx * 2.7, 0.47, -5.2 + k * 2.4);
      scene.add(post);
    }
  }
  const crowdGeo = new THREE.CapsuleGeometry(0.17, 0.55, 3, 6);
  crowdGeo.translate(0, 0.45, 0);
  const crowd = new THREE.InstancedMesh(crowdGeo, new THREE.MeshLambertMaterial(), seats.length);
  const shirtColors = [0xff4f6d, 0x3fc1ff, 0xffd23f, 0x7be36a, 0xffffff, 0xb06bff, 0xff9a3c, 0x56ccf2];
  const tmp = new THREE.Object3D(), col = new THREE.Color();
  const crowdBase = [];
  seats.forEach((p, i) => {
    crowdBase.push({ wp: p, phase: Math.random() * TAU, jump: 0.5 + Math.random() * 0.5 });
    tmp.position.copy(p); tmp.updateMatrix();
    crowd.setMatrixAt(i, tmp.matrix);
    crowd.setColorAt(i, col.setHex(shirtColors[i % shirtColors.length]));
  });
  scene.add(crowd);
  const headGeo = new THREE.SphereGeometry(0.13, 10, 8);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial(), seats.length);
  const skins = [0xf0c9a0, 0xe8b48a, 0xc68e62, 0xb07850, 0x8a5a3c];
  seats.forEach((p, i) => {
    tmp.position.copy(p); tmp.position.y += 1.0; tmp.updateMatrix();
    heads.setMatrixAt(i, tmp.matrix);
    heads.setColorAt(i, col.setHex(skins[i % skins.length]));
  });
  scene.add(heads);
  let cheerT = 0, cheerAmp = 0;
  const crowdApi = {
    cheer(strength = 1) { cheerT = 1.6; cheerAmp = strength; },
    update(dt, time) {
      if (cheerT <= 0) return;
      cheerT -= dt;
      const k = Math.max(0, cheerT / 1.6) * cheerAmp;
      crowdBase.forEach((c, i) => {
        tmp.position.copy(c.wp);
        tmp.position.y += Math.max(0, Math.sin(time * 9 + c.phase)) * 0.18 * k * c.jump;
        tmp.updateMatrix();
        crowd.setMatrixAt(i, tmp.matrix);
        tmp.position.y += 1.0; tmp.updateMatrix();
        heads.setMatrixAt(i, tmp.matrix);
      });
      crowd.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
    },
  };

  // Placar de fliperama atrás do adversário, com moldura de lâmpadas.
  const board = canvasTex(1024, 512, () => {});
  const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshBasicMaterial({ map: board.tex }));
  boardMesh.position.set(0, 3.1, -6.45);
  scene.add(boardMesh);
  const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.1, 0.12), new THREE.MeshLambertMaterial({ color: 0xff4f6d }));
  boardFrame.position.set(0, 3.1, -6.53);
  scene.add(boardFrame);
  const frameBulbs = [];
  for (let k = 0; k < 36; k++) {
    const f = k / 36;
    let x, y;
    if (f < 0.25) { x = -1.85 + f / 0.25 * 3.7; y = 1.0; }
    else if (f < 0.5) { x = 1.85; y = 1.0 - (f - 0.25) / 0.25 * 2; }
    else if (f < 0.75) { x = 1.85 - (f - 0.5) / 0.25 * 3.7; y = -1.0; }
    else { x = -1.85; y = -1.0 + (f - 0.75) / 0.25 * 2; }
    const m = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xfff1a0 }));
    m.position.set(x, 3.1 + y, -6.44);
    scene.add(m);
    frameBulbs.push(m);
  }
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.1, 0.15), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    leg.position.set(sx * 1.6, 1.05, -6.55);
    scene.add(leg);
  }
  const scoreboard = {
    draw(info) { drawBoard(board.ctx, info); board.tex.needsUpdate = true; },
  };

  // Bola e sombra.
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 16, 12),
    new THREE.MeshLambertMaterial({ color: 0xff8a1e, emissive: 0x662a00 }));
  scene.add(ball);
  const shadowTex = canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07),
    new THREE.MeshBasicMaterial({ map: shadowTex.tex, transparent: true, depthWrite: false }));
  ballShadow.rotation.x = -Math.PI / 2;
  scene.add(ballShadow);

  let table = null;
  const api = {
    scene, scoreboard, crowd: crowdApi, ball, shadowTex: shadowTex.tex,
    get table() { return table; },
    // Troca a mesa (fase) mostrada.
    setTable(def, arena) {
      if (table) { scene.remove(table.group); disposeTree(table.group); }
      table = buildTable(def, arena);
      scene.add(table.group);
      return table;
    },
    updateBall(b, visible, arena, t) {
      ball.visible = visible; ballShadow.visible = visible;
      if (!visible) return;
      ball.position.set(b.px, b.py, b.pz);
      const sy = arena.surfaceY(b.px, b.pz, t);
      const overTable = arena.hasTop(b.px, b.pz, t) && b.py >= sy - 0.01;
      const inHole = !overTable && Math.abs(b.px) <= TABLE.halfW && Math.abs(b.pz) <= TABLE.halfL;
      ballShadow.visible = !inHole;
      const gy = overTable ? sy + 0.002 : 0.004;
      ballShadow.position.set(b.px, gy, b.pz);
      const s = 1 / (1 + (b.py - gy) * 2);
      ballShadow.scale.setScalar(s);
      ballShadow.material.opacity = s;
    },
    update(dt, time) {
      spin.rotation.z = time * 0.08;
      for (const c of cabins) { const a = c.userData.a + time * 0.08; c.position.set(Math.cos(a) * 6, Math.sin(a) * 6 - 0.5, 0.4); }
      // Lâmpadas da moldura do placar piscam em sequência.
      const on = Math.floor(time * 6);
      frameBulbs.forEach((m, k) => m.material.color.setHex((k + on) % 3 === 0 ? 0xffffff : 0xffc93c));
    },
  };
  return api;
}

function disposeTree(o) {
  o.traverse((c) => {
    c.geometry?.dispose();
    const ms = Array.isArray(c.material) ? c.material : c.material ? [c.material] : [];
    for (const m of ms) { m.map?.dispose(); m.dispose(); }
  });
}

// Textura de meia mesa: cor da fase, bordas brancas e linha do meio.
function halfTopTexture(color, accent) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = hex(color); g.fillRect(0, 0, w, h);
    // estrelinhas discretas na cor de destaque
    g.fillStyle = hex(accent); g.globalAlpha = 0.18;
    for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 6, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    g.fillStyle = '#ffffff';
    const lw = 4;
    g.fillRect(0, 0, lw, h); g.fillRect(w - lw, 0, lw, h);   // laterais
    g.fillRect(0, 0, w, lw * 1.5);                            // fundo (ponta da mesa)
    g.fillRect(w / 2 - 1, 0, 2, h);                           // linha do meio
  }).tex;
}

// Atribui uv pelo x e z do vértice (para o tampo com buracos e o ondulado).
function uvFromXZ(geo, z0, z1) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + TABLE.halfW) / (2 * TABLE.halfW);
    uv[i * 2 + 1] = (pos.getZ(i) - z0) / (z1 - z0);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// Monta a mesa da fase: tampo (liso, com buracos, ondulado ou em degrau), rede, pés e os
// obstáculos. update(t) anima tudo no mesmo relógio da física.
export function buildTable(def, arena) {
  const group = new THREE.Group();     // fica parado
  const tilt = new THREE.Group();      // inclina (mesa gangorra); pivô na altura do tampo
  tilt.position.y = TABLE.y;
  group.add(tilt);
  const local = new THREE.Group();     // coordenadas do mundo dentro do grupo que inclina
  local.position.y = -TABLE.y;
  tilt.add(local);
  const cfg = def.cfg;
  const sideMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(def.top).multiplyScalar(0.7) });
  const accentMat = new THREE.MeshLambertMaterial({ color: def.accent, emissive: def.accent, emissiveIntensity: 0.25 });

  // Tampo: uma metade de cada vez (z > 0 é do jogador).
  for (const s of [1, -1]) {
    const z0 = s > 0 ? 0 : -TABLE.halfL, z1 = s > 0 ? TABLE.halfL : 0;
    const lift = s < 0 ? arena.step : 0;
    const tex = halfTopTexture(def.top, def.accent);
    if (s < 0) { tex.center.set(0.5, 0.5); tex.rotation = Math.PI; }
    const topMat = new THREE.MeshPhongMaterial({ map: tex, shininess: 40, specular: 0x333333 });
    if (arena.wave) {
      const geo = new THREE.PlaneGeometry(TABLE.halfW * 2, TABLE.halfL, 24, 48);
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, 0, (z0 + z1) / 2);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, arena.surfaceY(pos.getX(i), pos.getZ(i), 0));
      geo.computeVertexNormals();
      uvFromXZ(geo, z0, z1);
      local.add(new THREE.Mesh(geo, topMat));
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(TABLE.halfW * 2, 0.03, TABLE.halfL), sideMat);
      skirt.position.set(0, TABLE.y - 0.02, (z0 + z1) / 2);
      local.add(skirt);
    } else {
      const holes = arena.holes.filter(h => (h.z > 0) === (s > 0));
      const thick = 0.03 + lift;
      if (holes.length) {
        const shape = new THREE.Shape();
        shape.moveTo(-TABLE.halfW, z0); shape.lineTo(TABLE.halfW, z0); shape.lineTo(TABLE.halfW, z1); shape.lineTo(-TABLE.halfW, z1); shape.closePath();
        for (const h of holes) { const p = new THREE.Path(); p.absarc(h.x, h.z, h.r, 0, TAU, true); shape.holes.push(p); }
        const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 20 });
        // A forma é desenhada no plano XY: deita para o plano XZ (y da forma vira z).
        geo.rotateX(Math.PI / 2);
        geo.translate(0, TABLE.y + lift, 0);
        uvFromXZ(geo, z0, z1);
        local.add(new THREE.Mesh(geo, [topMat, sideMat]));
        for (const h of holes) {
          // Tubo curto embaixo do buraco (dá fundo escuro sem aparecer por baixo da mesa).
          const tube = new THREE.Mesh(new THREE.CylinderGeometry(h.r, h.r, 0.05, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x1a1030, side: THREE.BackSide }));
          tube.position.set(h.x, TABLE.y - 0.025, h.z);
          const bottom = new THREE.Mesh(new THREE.CircleGeometry(h.r, 20), new THREE.MeshBasicMaterial({ color: 0x120a24, side: THREE.DoubleSide }));
          bottom.rotation.x = -Math.PI / 2; bottom.position.set(h.x, TABLE.y - 0.05, h.z);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(h.r + 0.006, 0.008, 6, 28), accentMat);
          ring.rotation.x = Math.PI / 2; ring.position.set(h.x, TABLE.y + 0.002, h.z);
          local.add(tube, bottom, ring);
        }
      } else {
        const geo = new THREE.BoxGeometry(TABLE.halfW * 2, thick, TABLE.halfL);
        geo.translate(0, TABLE.y + lift - thick / 2, (z0 + z1) / 2);
        uvFromXZ(geo, z0, z1);
        local.add(new THREE.Mesh(geo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]));
      }
      if (lift) {
        // Faixa de destaque na parede do degrau.
        const band = new THREE.Mesh(new THREE.PlaneGeometry(TABLE.halfW * 2, lift * 0.35), accentMat);
        band.position.set(0, TABLE.y + lift * 0.5, 0.001);
        local.add(band);
      }
    }
  }

  // Pés: mesa normal tem quatro; a gangorra fica num pivô central.
  const legMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  if (arena.tilt) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, TABLE.y - 0.08, 16), legMat);
    col.position.y = (TABLE.y - 0.08) / 2;
    group.add(col);
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 12), accentMat);
    hinge.rotation.x = Math.PI / 2; hinge.position.y = TABLE.y - 0.08;
    group.add(hinge);
  } else {
    for (const sz of [-1, 1]) {
      const lift = sz < 0 ? arena.step : 0;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.06), legMat);
      frame.position.set(0, TABLE.y - 0.08, sz * 0.9);
      group.add(frame);
      for (const sx of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, TABLE.y - 0.05 + lift, 0.05), legMat);
        leg.position.set(sx * 0.6, (TABLE.y - 0.05 + lift) / 2, sz * 0.9);
        group.add(leg);
      }
    }
  }

  // Rede (a altura muda na rede elevador). A malha começa na base e cresce para cima.
  const netW = (TABLE.halfW + TABLE.netOver) * 2;
  const netTex = canvasTex(512, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,20,80,0.85)'; g.lineWidth = 1.5;
    for (let x = 0; x <= w; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, 7);
  });
  const netGeo = new THREE.PlaneGeometry(netW, 1);
  netGeo.translate(0, 0.5, 0);
  const net = new THREE.Mesh(netGeo, new THREE.MeshBasicMaterial({ map: netTex.tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  net.position.y = TABLE.y + arena.step;
  local.add(net);
  const postMat = arena.net ? accentMat : new THREE.MeshLambertMaterial({ color: 0x333344 });
  const posts = [];
  for (const sx of [-1, 1]) {
    const pgeo = new THREE.CylinderGeometry(0.014, 0.014, 1, 8);
    pgeo.translate(0, 0.5, 0);
    const post = new THREE.Mesh(pgeo, postMat);
    post.position.set(sx * netW / 2, TABLE.y, 0);
    local.add(post);
    posts.push(post);
  }
  if (arena.net) {
    // Caixas do "elevador" nas pontas da rede.
    for (const sx of [-1, 1]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.08), accentMat);
      box.position.set(sx * (netW / 2 + 0.04), TABLE.y - 0.05, 0);
      local.add(box);
    }
  }

  // Para-choques de fliperama: base, corpo e cúpula que acende quando a bola bate.
  const bumpers = arena.bumpers.map((p) => {
    const g = new THREE.Group();
    const base = arena.surfaceY(p.x, p.z, 0);
    const mat = new THREE.MeshLambertMaterial({ color: def.accent, emissive: def.accent, emissiveIntensity: 0.3 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 1.08, p.h, 20), mat);
    body.position.y = p.h / 2;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(p.r, 20, 10, 0, TAU, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.2 }));
    cap.position.y = p.h;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r * 1.15, 0.012, 6, 24), new THREE.MeshLambertMaterial({ color: 0xffd23f }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.012;
    g.add(body, cap, ring);
    g.position.set(p.x, base, p.z);
    local.add(g);
    return { g, mat, cap, flash: 0 };
  });

  // Barreiras listradas que deslizam.
  const stripeTex = canvasTex(128, 32, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : hex(def.accent); g.beginPath(); g.moveTo(i * 16, h); g.lineTo(i * 16 + 16, 0); g.lineTo(i * 16 + 32, 0); g.lineTo(i * 16 + 16, h); g.fill(); }
  }).tex;
  const barriers = arena.barriers.map((q) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(q.hw * 2, q.h, q.hz * 2), new THREE.MeshLambertMaterial({ map: stripeTex, emissive: 0x222222 }));
    local.add(m);
    return { m, q, flash: 0 };
  });
  if (arena.barriers.length) {
    // Trilhos por onde as barreiras correm.
    for (const q of arena.barriers) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(TABLE.halfW * 2, 0.004, 0.012), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      rail.position.set(0, TABLE.y + 0.002, q.z);
      local.add(rail);
    }
  }

  // Ventilador na lateral e as partículas de vento.
  let fan = null, windPts = null;
  if (arena.wind) {
    const w = arena.wind;
    const sx = -w.dir;
    fan = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 28), accentMat);
    housing.rotation.y = Math.PI / 2;
    const blades = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.36, 0.12), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      bl.position.y = 0.18; const piv = new THREE.Group(); piv.rotation.x = k * Math.PI / 2; piv.add(bl); blades.add(piv);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), accentMat);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, TABLE.y + 0.4, 10), legMat);
    stand.position.y = -(TABLE.y + 0.4) / 2;
    fan.add(housing, blades, hub, stand);
    fan.position.set(sx * (TABLE.halfW + 0.5), TABLE.y + 0.4, w.z);
    fan.userData.blades = blades;
    group.add(fan);
    const N = 90;
    const pos = new Float32Array(N * 3);
    const seeds = [];
    for (let i = 0; i < N; i++) seeds.push({ x: Math.random(), y: Math.random(), z: Math.random() * 2 - 1, v: 0.7 + Math.random() * 0.6 });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    windPts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.025, transparent: true, opacity: 0.85, depthWrite: false }));
    windPts.userData.seeds = seeds;
    windPts.frustumCulled = false;
    group.add(windPts);
    // Faixa clarinha no tampo marcando a zona de vento.
    const zone = new THREE.Mesh(new THREE.PlaneGeometry(TABLE.halfW * 2, w.halfZ * 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }));
    zone.rotation.x = -Math.PI / 2; zone.position.set(0, TABLE.y + 0.003, w.z);
    local.add(zone);
  }

  // Alvos (anéis no tampo).
  const targets = cfg.targets ? [0, 1].map(() => {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0.9, depthWrite: false });
    const outer = new THREE.Mesh(new THREE.RingGeometry(cfg.targets.r - 0.025, cfg.targets.r, 32), mat);
    const inner = new THREE.Mesh(new THREE.RingGeometry(cfg.targets.r * 0.35, cfg.targets.r * 0.6, 24), mat);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(cfg.targets.r * 0.15, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    for (const m of [outer, inner, dot]) { m.rotation.x = -Math.PI / 2; g.add(m); }
    local.add(g);
    return { g, mat, flash: 0 };
  }) : [];

  const api = {
    group, def, arena,
    flashBumper(i) { if (bumpers[i]) bumpers[i].flash = 1; },
    flashTarget(side) { if (targets[side]) targets[side].flash = 1; },
    // t = relógio da física; coreTargets = alvos do GameCore (ou null).
    update(t, dt, coreTargets) {
      if (arena.tilt) tilt.rotation.z = arena.tiltAngle(t);
      const nh = arena.netHeight(t) + arena.step;
      net.scale.y = arena.netHeight(t);
      for (const p of posts) p.scale.y = nh + 0.02;
      for (const b of bumpers) {
        b.flash = Math.max(0, b.flash - dt * 3);
        b.mat.emissiveIntensity = 0.3 + b.flash * 1.2;
        b.cap.material.emissiveIntensity = 0.2 + b.flash * 1.5;
        b.g.scale.setScalar(1 + b.flash * 0.15);
      }
      barriers.forEach((b, i) => {
        const x = arena.barrierX(i, t);
        b.m.position.set(x, arena.surfaceY(x, b.q.z, t) + b.q.h / 2, b.q.z);
      });
      if (fan) {
        const a = arena.windAccel(t);
        fan.userData.blades.rotation.x += dt * (8 + Math.abs(a) * 2) * Math.sign(a || 1);
        const w = arena.wind;
        const pos = windPts.geometry.attributes.position;
        const span = TABLE.halfW * 2 + 1.0;
        windPts.userData.seeds.forEach((s, i) => {
          s.x += dt * Math.abs(a) * 0.12 * s.v;
          if (s.x > 1) { s.x -= 1; s.y = Math.random(); s.z = Math.random() * 2 - 1; }
          const x = (w.dir > 0 ? s.x : 1 - s.x) * span - span / 2;
          pos.setXYZ(i, x, TABLE.y + 0.05 + s.y * (w.height - 0.2), w.z + s.z * w.halfZ);
        });
        pos.needsUpdate = true;
      }
      targets.forEach((tg, side) => {
        const g = coreTargets?.[side];
        tg.flash = Math.max(0, tg.flash - dt * 1.5);
        const visible = !!g && (g.lit || tg.flash > 0);
        tg.g.visible = visible;
        if (!visible) return;
        tg.g.position.set(g.x, arena.surfaceY(g.x, g.z, t) + 0.003, g.z);
        tg.mat.opacity = g.lit ? 0.65 + 0.3 * Math.sin(t * 6) : tg.flash;
        tg.g.scale.setScalar(1 + (1 - (g.lit ? 1 : tg.flash)) * 0.8);
      });
    },
  };
  api.update(0, 0, null);
  return api;
}

// Raquete: centro da lâmina na origem, face vermelha virada para +X, cabo para +Z.
export function makePaddle(rubberColor = 0xd23c3c, backColor = 0x1b1b1b) {
  const g = new THREE.Group();
  const r = 0.075;
  const wood = new THREE.MeshLambertMaterial({ color: 0xc9a06a });
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.006, 28), wood);
  blade.rotation.z = Math.PI / 2;
  g.add(blade);
  const face = (color, sx) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.002, r - 0.002, 0.003, 28), new THREE.MeshLambertMaterial({ color }));
    m.rotation.z = Math.PI / 2;
    m.position.x = sx * 0.0045;
    g.add(m);
  };
  face(rubberColor, 1);
  face(backColor, -1);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.032, 0.1), wood);
  handle.position.z = r + 0.045;
  g.add(handle);
  return g;
}

// Adversário estilizado: pernas, tronco, cabeça com chapéu de festa e braço da raquete.
export function makeOpponent() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe0b090 });
  const shorts = new THREE.MeshLambertMaterial({ color: 0x2a2450 });
  const hatMat = new THREE.MeshLambertMaterial({ color: 0xffd23f });
  const body = new THREE.Group();
  g.add(body);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.62, 3, 8), skin);
    leg.position.set(sx * 0.11, 0.42, 0);
    body.add(leg);
  }
  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.22, 12), shorts);
  hips.position.y = 0.86;
  body.add(hips);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.36, 4, 12), shirt);
  torso.position.y = 1.22;
  body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), skin);
  head.position.y = 1.62;
  body.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 12), hatMat);
  hat.position.y = 1.82;
  body.add(hat);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  pom.position.y = 1.95;
  body.add(pom);
  const otherArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.45, 3, 6), skin);
  otherArm.position.set(0.25, 1.15, 0.05);
  otherArm.rotation.z = 0.25;
  body.add(otherArm);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 1, 8), skin);
  arm.geometry.rotateX(Math.PI / 2);
  g.add(arm);
  const paddle = makePaddle();
  g.add(paddle);

  const shoulder = new THREE.Vector3(), hand = new THREE.Vector3();
  const api = {
    group: g, paddle,
    setLook(p) {
      shirt.color.setHex(p.shirt); skin.color.setHex(p.skin);
      hatMat.color.setHex(p.shirt).offsetHSL(0.5, 0, 0.1);
      paddle.children[1].material.color.setHex(p.rubber);
    },
    // pd: posição da raquete {x,y,z}; swing: 0..1
    update(pd, swing, time) {
      const bx = pd.x + 0.32;
      const bz = Math.min(pd.z - 0.4, -TABLE.halfL - 0.28);
      body.position.set(bx, Math.abs(Math.sin(time * 4)) * 0.012, bz);
      body.rotation.y = Math.sin(swing * Math.PI) * 0.3;
      paddle.position.set(pd.x, pd.y, pd.z);
      paddle.rotation.set(Math.PI / 2, -Math.PI / 2 + swing * 0.6, 0, 'YXZ');
      shoulder.set(bx - 0.22, 1.36, bz);
      hand.set(pd.x, pd.y, pd.z).addScaledVector(new THREE.Vector3(0, -1, 0), 0.1);
      arm.position.copy(shoulder).lerp(hand, 0.5);
      arm.scale.set(1, 1, shoulder.distanceTo(hand));
      arm.lookAt(hand);
    },
  };
  return api;
}

function drawBoard(g, info) {
  const w = 1024, h = 512;
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#3b2a8a'); gr.addColorStop(1, '#5b3fd1');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#ffd23f'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
  g.textBaseline = 'middle';
  g.fillStyle = '#ffd23f'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center';
  g.fillText(info.round || 'MESA MALUCA', w / 2, 48);
  const row = (y, name, score, serving, color) => {
    g.fillStyle = color; g.fillRect(30, y - 52, 14, 104);
    g.fillStyle = '#ffffff'; g.font = 'bold 56px sans-serif'; g.textAlign = 'left';
    g.fillText(name.toUpperCase(), 64, y);
    if (serving) { g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(700, y, 14, 0, TAU); g.fill(); }
    g.fillStyle = '#fff1a0'; g.font = 'bold 110px monospace'; g.textAlign = 'right';
    g.fillText(String(score), 980, y + 4);
  };
  row(150, info.pName || 'Você', info.score?.[0] ?? 0, info.server === 0, '#7be36a');
  row(290, info.oName || '', info.score?.[1] ?? 0, info.server === 1, info.oColor || '#ff4f6d');
  g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(24, 380, w - 48, 104);
  g.fillStyle = '#ffffff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center';
  g.fillText(info.msg || '', w / 2, 432);
}

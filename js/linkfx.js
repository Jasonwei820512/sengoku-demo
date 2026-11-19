const RUN = 150;
const LINGER = 70;
const FADE = 90;
const FRAME = 1000 / 60;
const LIMITS = {puffs: 120, petals: 80, sparks: 60};
const THEMES = [
  {core: '255,240,248', smoke: ['255,120,190', '255,160,215', '230,110,200']},
  {core: '250,240,255', smoke: ['200,120,255', '255,130,210', '170,110,255']},
  {core: '255,250,230', smoke: ['255,190,90', '255,150,70', '255,215,140']}
];
const SPARK = '255,225,240';
const random = Math.random;
const glows = new Map();
let petalSprite;

function glowSprite(color) {
  if (!glows.has(color)) {
    const image = document.createElement('canvas');
    image.width = image.height = 64;
    const ctx = image.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `rgba(${color},1)`);
    g.addColorStop(0.45, `rgba(${color},0.55)`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    glows.set(color, image);
  }
  return glows.get(color);
}

function cherryPetal() {
  if (petalSprite) return petalSprite;
  petalSprite = document.createElement('canvas');
  petalSprite.width = petalSprite.height = 48;
  const ctx = petalSprite.getContext('2d');
  ctx.translate(24, 24);
  ctx.scale(20, 20);
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.bezierCurveTo(0.35, 0.75, 0.78, 0.05, 0.62, -0.62);
  ctx.quadraticCurveTo(0.45, -1.02, 0.16, -0.98);
  ctx.lineTo(0, -0.66);
  ctx.lineTo(-0.16, -0.98);
  ctx.quadraticCurveTo(-0.45, -1.02, -0.62, -0.62);
  ctx.bezierCurveTo(-0.78, 0.05, -0.35, 0.75, 0, 1);
  const g = ctx.createLinearGradient(0, 1, 0, -1);
  g.addColorStop(0, 'rgb(236,128,165)');
  g.addColorStop(0.35, 'rgb(250,185,205)');
  g.addColorStop(1, 'rgb(255,236,242)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(225,120,160,0.35)';
  ctx.lineWidth = 0.12;
  ctx.beginPath();
  ctx.moveTo(0, 0.8);
  ctx.lineTo(0, -0.55);
  ctx.stroke();
  return petalSprite;
}

function measureRoute(points) {
  let length = 0;
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i - 1];
    const [endX, endY] = points[i];
    const size = Math.hypot(endX - x, endY - y);
    if (!size) continue;
    length += size;
    segments.push({x, y, endX, endY, dx: (endX - x) / size, dy: (endY - y) / size, start: length - size, end: length});
  }
  return {length, segments};
}

function pointAt(segments, distance) {
  const s = segments.find(s => distance <= s.end) || segments.at(-1);
  const offset = distance - s.start;
  return [s.x + s.dx * offset, s.y + s.dy * offset, s.dx, s.dy];
}

export function createLinkFx(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return {play() {}, dispose() {}};

  const board = canvas.parentElement;
  const area = board.parentElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const power = board.closest('.game').querySelector('#power');
  const waves = [];
  const counts = {puffs: 0, petals: 0, sparks: 0};
  let frameId, previousTime, width, height, padX, padY, dpr, pitchX, pitchY;

  function resize() {
    const boardWidth = board.clientWidth;
    const boardHeight = board.clientHeight;
    pitchX = (boardWidth + 3) / 7;
    pitchY = (boardHeight + 3) / 8;
    // Include the visible gutter used by routes outside the tile grid.
    const marginX = Math.min(Math.max(0, (area.clientWidth - boardWidth) / 2), (boardWidth + 3) / 14 + 8);
    const marginY = Math.min(Math.max(0, (area.clientHeight - boardHeight) / 2), (boardHeight + 3) / 16 + 8);
    const nextWidth = boardWidth + marginX * 2;
    const nextHeight = boardHeight + marginY * 2;
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    if (width === nextWidth && height === nextHeight && dpr === pixelRatio && padX === marginX && padY === marginY) return;
    [width, height, padX, padY, dpr] = [nextWidth, nextHeight, marginX, marginY, pixelRatio];
    canvas.style.left = `-${padX}px`;
    canvas.style.top = `-${padY}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  function clear() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function stop() {
    if (frameId !== undefined) cancelAnimationFrame(frameId);
    frameId = previousTime = undefined;
    waves.length = 0;
    counts.puffs = counts.petals = counts.sparks = 0;
    clear();
  }

  function push(wave, kind, particle) {
    wave[kind].push(particle);
    counts[kind]++;
  }

  function puff(wave, x, y, dx, dy, big) {
    if (counts.puffs >= LIMITS.puffs) return;
    const {lv, theme, unit} = wave;
    const side = random() < 0.5 ? -1 : 1;
    const nx = -dy * side, ny = dx * side;
    const r0 = unit * (0.12 + random() * 0.10) * (big ? 1.3 : 1) * (1 + lv * 0.15);
    push(wave, 'puffs', {
      x: x + nx * r0 * 0.6, y: y + ny * r0 * 0.6,
      vx: nx * (0.25 + random() * 0.35) + dx * 0.3,
      vy: ny * (0.25 + random() * 0.35) + dy * 0.3 - 0.08,
      r0, spread: 1.2 + random() * 1.2 + (big ? 0.8 : 0),
      amax: (big ? 0.14 : 0.19) + random() * 0.10, age: 0, life: 34 + random() * 22,
      image: glowSprite(theme.smoke[Math.floor(random() * theme.smoke.length)]),
      spin: (random() - 0.5) * 0.08, ang: random() * 6
    });
  }

  function petal(wave, x, y, dx, dy, index) {
    if (counts.petals >= LIMITS.petals) return;
    const side = index % 2 ? 1 : -1;
    const speed = (0.18 + random() * 0.32) * (1 + wave.lv * 0.1);
    push(wave, 'petals', {
      x, y, vx: -dy * side * speed + (random() - 0.5) * 0.2,
      vy: dx * side * speed + (random() - 0.5) * 0.2 - 0.15,
      rot: random() * 6.3, vr: (random() - 0.5) * 0.05, flip: random() * 6.3,
      fs: 0.04 + random() * 0.04, sway: 0.12 + random() * 0.18, ph: random() * 6.3,
      size: wave.unit * (0.075 + random() * 0.05), age: 0, delay: random() * 8, life: 110 + random() * 60
    });
  }

  function burst(wave) {
    const {points, segments, length, lv} = wave;
    if (!length) {
      const referenceLength = 2 * wave.unit;
      const n = Math.max(1, Math.round(referenceLength / (18 - lv * 3) / 3));
      for (let i = 0; i < n; i++) {
        const [x, y] = points[i % points.length];
        const angle = random() * Math.PI * 2;
        petal(wave, x, y, Math.cos(angle), Math.sin(angle), i);
      }
      return;
    }
    for (const [x, y] of [points[0], points.at(-1)]) {
      for (let i = 0; i < 5 + lv * 3; i++) {
        const angle = random() * 7;
        puff(wave, x, y, Math.cos(angle), Math.sin(angle), true);
      }
    }
    const n = Math.round(length / (18 - lv * 3));
    for (let i = 0; i < n && counts.petals < LIMITS.petals; i++) {
      const [x, y, dx, dy] = pointAt(segments, random() * length);
      petal(wave, x, y, dx, dy, i);
    }
    for (const p of wave.puffs) {
      p.vx *= 1.8;
      p.vy *= 1.8;
      p.spread += 0.6;
    }
  }

  function blob(image, x, y, r, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(image, x - r, y - r, 2 * r, 2 * r);
  }

  function particles(wave, kind, step, draw) {
    const list = wave[kind];
    let live = 0;
    for (const p of list) {
      p.age += step;
      if (p.age < p.life) {
        draw(p, p.age / p.life);
        list[live++] = p;
      }
    }
    counts[kind] -= list.length - live;
    list.length = live;
  }

  function line(wave, head, alpha) {
    const {segments, theme, simple} = wave;
    ctx.beginPath();
    ctx.moveTo(segments[0].x, segments[0].y);
    for (const s of segments) {
      if (head <= s.end) {
        ctx.lineTo(s.x + s.dx * (head - s.start), s.y + s.dy * (head - s.start));
        break;
      }
      ctx.lineTo(s.endX, s.endY);
    }
    ctx.lineJoin = ctx.lineCap = 'round';
    if (!simple) {
      ctx.globalAlpha = 0.18 * alpha;
      ctx.lineWidth = 6;
      ctx.strokeStyle = `rgb(${theme.smoke[0]})`;
      ctx.stroke();
    }
    ctx.globalAlpha = 0.95 * alpha;
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgb(${theme.core})`;
    ctx.stroke();
  }

  function drawWave(wave, elapsed, step) {
    const {length, segments, theme, unit, simple} = wave;
    ctx.globalCompositeOperation = 'lighter';
    if (simple) {
      if (elapsed < 200) line(wave, length, Math.min(1, (200 - elapsed) / 80));
      return elapsed < 200;
    }

    const progress = Math.min(1, elapsed / RUN);
    const head = (1 - (1 - progress) ** 2) * length;
    while (wave.nextPuff < head && counts.puffs < LIMITS.puffs) {
      const [x, y, dx, dy] = pointAt(segments, wave.nextPuff);
      puff(wave, x, y, dx, dy, false);
      if (wave.lv === 2) puff(wave, x, y, dx, dy, false);
      wave.nextPuff += 5;
    }
    // Drop emissions that exceeded the frame budget instead of replaying them later.
    if (wave.nextPuff < head) wave.nextPuff = Math.ceil(head / 5) * 5;

    const puffDrag = 0.965 ** step;
    particles(wave, 'puffs', step, (p, t) => {
      const alpha = p.amax * (t < 0.15 ? t / 0.15 : ((1 - t) / 0.85) ** 1.6);
      p.ang += p.spin * step;
      p.vx *= puffDrag;
      p.vy *= puffDrag;
      p.x += (p.vx + Math.cos(p.ang) * 0.25) * step;
      p.y += (p.vy + Math.sin(p.ang) * 0.25) * step;
      const radius = p.r0 * (1 + p.spread * (1 - (1 - t) ** 2));
      blob(p.image, p.x, p.y, radius, alpha);
    });

    const lineAlpha = Math.min(1, (RUN + LINGER + FADE - elapsed) / FADE);
    if (length && lineAlpha > 0) {
      line(wave, head, lineAlpha);
      if (progress < 1) {
        const [x, y] = pointAt(segments, head);
        blob(glowSprite(theme.smoke[1]), x, y, unit * 0.22, 0.55);
        blob(glowSprite(theme.core), x, y, unit * 0.08, 1);
      }
    }
    if (head && progress < 1 && counts.sparks < LIMITS.sparks && random() < 1 - 0.2 ** step) {
      const [x, y] = pointAt(segments, random() * head);
      push(wave, 'sparks', {x, y, vx: (random() - 0.5) * 0.8, vy: (random() - 0.5) * 0.8 - 0.3, age: 0, life: 22});
    }
    particles(wave, 'sparks', step, (s, t) => {
      s.x += s.vx * step;
      s.y += s.vy * step;
      blob(glowSprite(SPARK), s.x, s.y, 2.6, 0.9 * (1 - t));
    });

    if (!wave.burst && (!length || progress === 1)) {
      wave.burst = true;
      burst(wave);
    }
    ctx.globalCompositeOperation = 'source-over';
    const petalDrag = 0.93 ** step;
    particles(wave, 'petals', step, (q, t) => {
      if (q.age < q.delay) return;
      q.vx *= petalDrag;
      q.vy = Math.min(0.45, q.vy * petalDrag + 0.006 * (1 - petalDrag) / 0.07);
      const phase = q.age * 0.05 + q.ph;
      q.x += (q.vx + Math.sin(phase) * q.sway) * step;
      q.y += q.vy * step;
      q.rot += (q.vr + Math.cos(phase) * 0.015) * step;
      q.flip += q.fs * step;
      const alpha = Math.min(t / 0.1, 1, (1 - t) / 0.35);
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.rot);
      ctx.scale(1, Math.abs(Math.cos(q.flip)) * 0.75 + 0.25);
      blob(cherryPetal(), 0, 0, q.size * 1.2, 0.92 * alpha);
      ctx.restore();
    });

    return (length && lineAlpha > 0) || wave.puffs.length || wave.petals.length || wave.sparks.length;
  }

  function frame(time) {
    if (dpr !== Math.min(2, window.devicePixelRatio || 1)) resize();
    clear();
    const step = previousTime === undefined ? 1 : (time - previousTime) / FRAME;
    previousTime = time;
    let live = 0;
    for (const wave of waves) {
      wave.start ??= time;
      const scaleX = pitchX / wave.pitchX, scaleY = pitchY / wave.pitchY;
      // The grid starts half a gap before the board's first tile.
      ctx.setTransform(dpr * scaleX, 0, 0, dpr * scaleY,
        dpr * (padX + 1.5 * (scaleX - 1)), dpr * (padY + 1.5 * (scaleY - 1)));
      if (drawWave(wave, time - wave.start, step)) waves[live++] = wave;
    }
    waves.length = live;
    if (live) frameId = requestAnimationFrame(frame);
    else {
      frameId = previousTime = undefined;
      clear();
    }
  }

  function visibility() {
    if (document.hidden) stop();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(board);
  observer.observe(area);
  document.addEventListener('visibilitychange', visibility);
  motion.addEventListener('change', stop);
  power.addEventListener('click', stop);

  return {
    play(route, cells, {w, h, gap}, combo) {
      if (document.hidden || w <= 0 || h <= 0) return;
      const hasRoute = route?.length > 1;
      const simple = motion.matches || power.getAttribute('aria-pressed') === 'true';
      if (!hasRoute && (simple || !cells.length)) return;
      const points = (hasRoute ? route : cells)
        .map(([x, y]) => [x * (w + gap) + w / 2, y * (h + gap) + h / 2]);
      const {segments, length} = hasRoute ? measureRoute(points) : {segments: [], length: 0};
      if (simple && !length) return;
      const lv = combo >= 10 ? 2 : combo >= 5 ? 1 : 0;
      waves.push({points, segments, length, lv, simple, theme: THEMES[lv], unit: w + gap,
        pitchX: w + gap, pitchY: h + gap, nextPuff: 0, burst: false, puffs: [], petals: [], sparks: []});
      if (frameId === undefined) frameId = requestAnimationFrame(frame);
    },
    dispose() {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', stop);
      power.removeEventListener('click', stop);
    }
  };
}

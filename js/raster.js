// 채우기(영역 → 벡터 외곽선)와 흐림에 쓰는 픽셀 연산
window.Raster = (() => {
  'use strict';

  /**
   * 벽(wall)이 아닌 칸을 시작점부터 채움 (스캔라인 방식)
   * @returns {{mask:Uint8Array, touchesEdge:boolean, count:number}|null}
   */
  function flood(wall, W, H, sx, sy) {
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return null;
    if (wall[sy * W + sx]) return null;
    const mask = new Uint8Array(W * H);
    const stack = [sy * W + sx];
    let touchesEdge = false;
    let count = 0;
    const open = i => !wall[i] && !mask[i];
    while (stack.length) {
      const i = stack.pop();
      if (!open(i)) continue;
      const y = (i / W) | 0;
      let xl = i - y * W, xr = xl;
      while (xl > 0 && open(y * W + xl - 1)) xl--;
      while (xr < W - 1 && open(y * W + xr + 1)) xr++;
      if (xl === 0 || xr === W - 1 || y === 0 || y === H - 1) touchesEdge = true;
      for (let x = xl; x <= xr; x++) mask[y * W + x] = 1;
      count += xr - xl + 1;
      for (const ny of [y - 1, y + 1]) {
        if (ny < 0 || ny >= H) continue;
        let inRun = false;
        for (let x = xl; x <= xr; x++) {
          const j = ny * W + x;
          if (open(j)) {
            if (!inRun) { stack.push(j); inRun = true; }
          } else {
            inRun = false;
          }
        }
      }
    }
    return { mask, touchesEdge, count };
  }

  // 한 칸씩 넓힘 (선 밑으로 살짝 들어가서 빈틈이 안 보이게)
  function dilate(mask, W, H) {
    const out = new Uint8Array(mask);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (mask[y * W + x]) continue;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= H) continue;
          let hit = false;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx >= 0 && xx < W && mask[yy * W + xx]) { hit = true; break; }
          }
          if (hit) { out[y * W + x] = 1; break; }
        }
      }
    }
    return out;
  }

  /**
   * 채워진 영역의 외곽선(구멍 포함)을 닫힌 다각형들로 추출
   * @returns {number[][]} 각 다각형은 [x0,y0,x1,y1,...] (픽셀 꼭짓점 좌표)
   */
  function trace(mask, W, H) {
    const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1;
    const VW = W + 1;
    const out = new Map();
    const add = (x0, y0, x1, y1) => {
      const k = y0 * VW + x0, v = y1 * VW + x1;
      const e = out.get(k);
      if (e === undefined) out.set(k, v);
      else if (Array.isArray(e)) e.push(v);
      else out.set(k, [e, v]);
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!mask[y * W + x]) continue;
        if (!inside(x, y - 1)) add(x, y, x + 1, y);
        if (!inside(x + 1, y)) add(x + 1, y, x + 1, y + 1);
        if (!inside(x, y + 1)) add(x + 1, y + 1, x, y + 1);
        if (!inside(x - 1, y)) add(x, y + 1, x, y);
      }
    }
    const take = k => {
      const e = out.get(k);
      if (e === undefined) return -1;
      if (Array.isArray(e)) {
        const v = e.pop();
        if (e.length === 1) out.set(k, e[0]);
        return v;
      }
      out.delete(k);
      return e;
    };
    const loops = [];
    for (const start of [...out.keys()]) {
      while (out.has(start)) {
        const loop = [];
        let cur = start;
        let guard = 0;
        do {
          loop.push(cur % VW, (cur / VW) | 0);
          cur = take(cur);
          if (++guard > 5e6) break;
        } while (cur !== -1 && cur !== start);
        if (loop.length >= 6) loops.push(loop);
      }
    }
    return loops;
  }

  function polyArea(p) {
    let a = 0;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) a += p[j] * p[i + 1] - p[i] * p[j + 1];
    return a / 2;
  }

  function distPtSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }

  function rdp(pts, eps) {
    const n = pts.length / 2;
    if (n < 3) return pts.slice();
    const keep = new Uint8Array(n);
    keep[0] = keep[n - 1] = 1;
    const stack = [[0, n - 1]];
    while (stack.length) {
      const [i0, i1] = stack.pop();
      let best = -1, bi = -1;
      for (let i = i0 + 1; i < i1; i++) {
        const d = distPtSeg(pts[i * 2], pts[i * 2 + 1], pts[i0 * 2], pts[i0 * 2 + 1], pts[i1 * 2], pts[i1 * 2 + 1]);
        if (d > best) { best = d; bi = i; }
      }
      if (best > eps) {
        keep[bi] = 1;
        stack.push([i0, bi], [bi, i1]);
      }
    }
    const out = [];
    for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
    return out;
  }

  // 계단 모양 외곽선을 단순화하고 한 번 부드럽게
  function simplify(loop, eps) {
    const n = loop.length / 2;
    // 시작점에서 가장 먼 점으로 나눠 두 조각을 각각 단순화
    let far = 0, fd = -1;
    for (let i = 1; i < n; i++) {
      const d = Math.hypot(loop[i * 2] - loop[0], loop[i * 2 + 1] - loop[1]);
      if (d > fd) { fd = d; far = i; }
    }
    const a = rdp(loop.slice(0, far * 2 + 2), eps);
    const b = rdp([...loop.slice(far * 2), loop[0], loop[1]], eps);
    const pts = [...a.slice(0, -2), ...b.slice(0, -2)];
    // Chaikin 한 번
    const out = [];
    const m = pts.length / 2;
    for (let i = 0; i < m; i++) {
      const x0 = pts[i * 2], y0 = pts[i * 2 + 1];
      const x1 = pts[((i + 1) % m) * 2], y1 = pts[((i + 1) % m) * 2 + 1];
      out.push(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1, 0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1);
    }
    return out;
  }

  // ----- 흐림 (canvas filter 를 지원하지 않는 브라우저용) -----
  function boxesForGauss(sigma, n) {
    const wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1);
    let wl = Math.floor(wIdeal);
    if (wl % 2 === 0) wl--;
    const wu = wl + 2;
    const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
    const m = Math.round(mIdeal);
    const sizes = [];
    for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu);
    return sizes;
  }

  function boxPass(src, dst, W, H, r, horizontal) {
    const len = horizontal ? W : H;
    const lines = horizontal ? H : W;
    const step = horizontal ? 4 : W * 4;
    const inv = 1 / (r + r + 1);
    for (let l = 0; l < lines; l++) {
      const base = horizontal ? l * W * 4 : l * 4;
      for (let c = 0; c < 4; c++) {
        const first = src[base + c], last = src[base + (len - 1) * step + c];
        let acc = (r + 1) * first;
        for (let i = 0; i < r; i++) acc += src[base + Math.min(i, len - 1) * step + c];
        for (let i = 0; i < len; i++) {
          const addI = i + r, subI = i - r - 1;
          acc += addI < len ? src[base + addI * step + c] : last;
          acc -= subI >= 0 ? src[base + subI * step + c] : first;
          dst[base + i * step + c] = acc * inv;
        }
      }
    }
  }

  function blurImageData(img, sigma) {
    if (sigma < 0.5) return img;
    const { width: W, height: H, data } = img;
    let a = new Float32Array(data.length);
    let b = new Float32Array(data.length);
    // 미리 곱한 알파 (투명한 곳이 검게 번지지 않도록)
    for (let i = 0; i < data.length; i += 4) {
      const al = data[i + 3] / 255;
      a[i] = data[i] * al; a[i + 1] = data[i + 1] * al; a[i + 2] = data[i + 2] * al; a[i + 3] = data[i + 3];
    }
    for (const size of boxesForGauss(sigma, 3)) {
      const r = (size - 1) / 2;
      boxPass(a, b, W, H, r, true);
      boxPass(b, a, W, H, r, false);
    }
    for (let i = 0; i < data.length; i += 4) {
      const al = a[i + 3];
      const k = al > 0 ? 255 / al : 0;
      data[i] = a[i] * k; data[i + 1] = a[i + 1] * k; data[i + 2] = a[i + 2] * k; data[i + 3] = al;
    }
    return img;
  }

  return { flood, dilate, trace, simplify, polyArea, blurImageData };
})();

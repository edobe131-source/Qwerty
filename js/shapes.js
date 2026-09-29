// 매직 펜용 도형 인식기
// 손으로 그린 점들을 받아 직선·호·곡선·원·타원·다각형 같은 깔끔한 형태로 바꿔 줍니다.
window.Shapes = (() => {
  'use strict';

  const P = (x, y) => ({ x, y });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const round1 = v => Math.round(v * 10) / 10;
  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;

  function fromFlat(f) {
    const a = [];
    for (let i = 0; i < f.length; i += 2) a.push(P(f[i], f[i + 1]));
    return a;
  }

  function toFlat(a) {
    const f = [];
    for (const p of a) f.push(round1(p.x), round1(p.y));
    return f;
  }

  function pathLength(a) {
    let L = 0;
    for (let i = 1; i < a.length; i++) L += dist(a[i - 1], a[i]);
    return L;
  }

  function bbox(a) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of a) {
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    }
    return { x0, y0, x1, y1, diag: Math.hypot(x1 - x0, y1 - y0) };
  }

  // 경로를 같은 간격의 n개 점으로 다시 샘플링
  function resample(a, n) {
    const L = pathLength(a);
    const step = L / (n - 1);
    const out = [P(a[0].x, a[0].y)];
    let prev = a[0];
    let acc = 0;
    for (let i = 1; i < a.length; i++) {
      let cur = a[i];
      let d = dist(prev, cur);
      while (acc + d >= step && d > 0) {
        const t = (step - acc) / d;
        const q = P(prev.x + t * (cur.x - prev.x), prev.y + t * (cur.y - prev.y));
        out.push(q);
        prev = q;
        d = dist(prev, cur);
        acc = 0;
      }
      acc += d;
      prev = cur;
    }
    const last = a[a.length - 1];
    while (out.length < n) out.push(P(last.x, last.y));
    out.length = n;
    return out;
  }

  function distPtSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }

  function maxDeviation(seg) {
    const a = seg[0], b = seg[seg.length - 1];
    let m = 0;
    for (let i = 1; i < seg.length - 1; i++) m = Math.max(m, distPtSeg(seg[i], a, b));
    return m;
  }

  function isStraight(seg, tol = 0.065) {
    const chord = dist(seg[0], seg[seg.length - 1]);
    return chord > 0 && maxDeviation(seg) <= tol * chord;
  }

  // Ramer–Douglas–Peucker 단순화
  function rdp(a, eps) {
    if (a.length < 3) return a.slice();
    const keep = new Uint8Array(a.length);
    keep[0] = keep[a.length - 1] = 1;
    const stack = [[0, a.length - 1]];
    while (stack.length) {
      const [i0, i1] = stack.pop();
      let best = -1, bi = -1;
      for (let i = i0 + 1; i < i1; i++) {
        const d = distPtSeg(a[i], a[i0], a[i1]);
        if (d > best) { best = d; bi = i; }
      }
      if (best > eps) {
        keep[bi] = 1;
        stack.push([i0, bi], [bi, i1]);
      }
    }
    return a.filter((_, i) => keep[i]);
  }

  function lineFit(seg) {
    let mx = 0, my = 0;
    for (const p of seg) { mx += p.x; my += p.y; }
    mx /= seg.length; my /= seg.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of seg) {
      const dx = p.x - mx, dy = p.y - my;
      sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
    }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    return { x: mx, y: my, dx: Math.cos(th), dy: Math.sin(th) };
  }

  function intersect(l1, l2) {
    const det = l2.dx * l1.dy - l1.dx * l2.dy;
    if (Math.abs(det) < 1e-6) return null;
    const t = (l2.dx * (l2.y - l1.y) - l2.dy * (l2.x - l1.x)) / det;
    return P(l1.x + t * l1.dx, l1.y + t * l1.dy);
  }

  // 최소제곱 원 맞춤 (Kåsa)
  function circleFit(seg) {
    const n = seg.length;
    let mx = 0, my = 0;
    for (const p of seg) { mx += p.x; my += p.y; }
    mx /= n; my /= n;
    let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
    for (const p of seg) {
      const u = p.x - mx, v = p.y - my;
      suu += u * u; svv += v * v; suv += u * v;
      suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u;
    }
    const det = suu * svv - suv * suv;
    if (Math.abs(det) < 1e-9) return null;
    const bu = (suuu + suvv) / 2, bv = (svvv + svuu) / 2;
    const uc = (bu * svv - bv * suv) / det;
    const vc = (suu * bv - suv * bu) / det;
    const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
    const c = P(uc + mx, vc + my);
    let err = 0;
    for (const p of seg) err += Math.abs(dist(p, c) - r);
    return { c, r, err: err / n };
  }

  // 꺾이는 지점 찾기
  function detectCorners(r, closed) {
    const n = r.length;
    const k = Math.max(2, Math.round(n / 24));
    const ang = new Float64Array(n);
    const at = i => r[((i % n) + n) % n];
    for (let i = 0; i < n; i++) {
      if (!closed && (i < k || i > n - 1 - k)) continue;
      const a = at(i - k), b = at(i), c = at(i + k);
      const v1x = b.x - a.x, v1y = b.y - a.y, v2x = c.x - b.x, v2y = c.y - b.y;
      const l = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
      if (!l) continue;
      ang[i] = Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / l)));
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      if (ang[i] < 0.95) continue;
      let isMax = true;
      for (let j = -k; j <= k && isMax; j++) {
        if (!j) continue;
        const idx = i + j;
        if (!closed && (idx < 0 || idx >= n)) continue;
        const v = ang[((idx % n) + n) % n];
        if (v > ang[i] || (j < 0 && v === ang[i])) isMax = false;
      }
      if (isMax) out.push(i);
    }
    return out;
  }

  // 직선 구간을 촘촘하게 (부드럽게 그리기 처리에도 모서리가 살아 있도록)
  function densify(pts, step = 3) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const n = Math.max(1, Math.ceil(dist(a, b) / step));
      for (let s = 1; s <= n; s++) out.push(P(a.x + (b.x - a.x) * s / n, a.y + (b.y - a.y) * s / n));
    }
    return out;
  }

  function catmull(pts, closed) {
    const n = pts.length;
    if (n < 3 && !closed) return densify(pts);
    const get = i => closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    const out = [];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      const steps = Math.max(2, Math.ceil(dist(p1, p2) / 3));
      for (let s = 0; s < steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push(P(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y)));
      }
    }
    const end = closed ? pts[0] : pts[n - 1];
    out.push(P(end.x, end.y));
    return out;
  }

  function arcPoints(c, r, a0, sweep) {
    const n = Math.max(8, Math.ceil(Math.abs(sweep) * r / 3));
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + sweep * i / n;
      out.push(P(c.x + r * Math.cos(a), c.y + r * Math.sin(a)));
    }
    return out;
  }

  function sweepAround(seg, c) {
    let prev = Math.atan2(seg[0].y - c.y, seg[0].x - c.x);
    const a0 = prev;
    let sweep = 0;
    for (let i = 1; i < seg.length; i++) {
      const a = Math.atan2(seg[i].y - c.y, seg[i].x - c.x);
      let d = a - prev;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      sweep += d;
      prev = a;
    }
    return { a0, sweep };
  }

  function snapAngle(a, step, tol) {
    const s = Math.round(a / step) * step;
    return Math.abs(a - s) < tol ? s : a;
  }

  // ----- 열린 선 -----
  function fitPiece(seg) {
    if (isStraight(seg)) return { kind: 'line', pts: [seg[0], seg[seg.length - 1]] };
    const circ = circleFit(seg);
    if (circ && circ.err < 0.035 * circ.r) {
      const { a0, sweep } = sweepAround(seg, circ.c);
      if (Math.abs(sweep) > 0.4 && Math.abs(sweep) < TAU * 1.02) {
        return { kind: 'arc', pts: arcPoints(circ.c, circ.r, a0, sweep) };
      }
    }
    const bb = bbox(seg);
    return { kind: 'curve', pts: catmull(rdp(seg, Math.max(0.5, bb.diag * 0.02)), false) };
  }

  function classifyOpen(r) {
    const cs = detectCorners(r, false);
    const idx = [0, ...cs, r.length - 1];
    const kinds = [];
    let out = [];
    for (let s = 0; s < idx.length - 1; s++) {
      const piece = fitPiece(r.slice(idx[s], idx[s + 1] + 1));
      kinds.push(piece.kind);
      let pts = piece.kind === 'line' ? piece.pts : piece.pts;
      if (out.length) pts = pts.slice(1);
      out = out.concat(pts);
    }
    if (kinds.length === 1 && kinds[0] === 'line') {
      // 거의 수평·수직·45°면 딱 맞춤
      const a = out[0], b = out[out.length - 1];
      const len = dist(a, b);
      const ang = snapAngle(Math.atan2(b.y - a.y, b.x - a.x), Math.PI / 4, 5 * DEG);
      out = [a, P(a.x + len * Math.cos(ang), a.y + len * Math.sin(ang))];
      return { points: out, label: '직선' };
    }
    const label = kinds.length === 1
      ? ({ arc: '호', curve: '곡선' })[kinds[0]]
      : (kinds.every(k => k === 'line') ? '꺾은선' : '곡선');
    return { points: out, label };
  }

  // ----- 닫힌 도형 -----
  function cyclicSlice(r, i0, i1) {
    const out = [];
    const n = r.length;
    for (let i = i0; ; i = (i + 1) % n) {
      out.push(r[i]);
      if (i === i1) break;
    }
    return out;
  }

  function tryPolygon(r, bb) {
    const cs = detectCorners(r, true);
    const m = cs.length;
    if (m < 3 || m > 8) return null;
    const segs = cs.map((c, j) => cyclicSlice(r, c, cs[(j + 1) % m]));
    if (!segs.every(s => isStraight(s, 0.08))) return null;
    const lines = segs.map(lineFit);
    let verts = cs.map((c, j) => {
      const p = intersect(lines[(j - 1 + m) % m], lines[j]);
      return p && dist(p, r[c]) < bb.diag * 0.25 ? p : r[c];
    });

    let label = m === 3 ? '삼각형' : m === 4 ? '사각형' : '다각형';
    if (m === 4) {
      const rect = tryRectangle(verts);
      if (rect) verts = rect;
    }
    return { points: densify([...verts, verts[0]]), label };
  }

  function tryRectangle(v) {
    for (let i = 0; i < 4; i++) {
      const a = v[(i + 3) % 4], b = v[i], c = v[(i + 1) % 4];
      const ang = Math.abs(Math.atan2(a.y - b.y, a.x - b.x) - Math.atan2(c.y - b.y, c.x - b.x));
      const inner = ang > Math.PI ? TAU - ang : ang;
      if (Math.abs(inner - Math.PI / 2) > 16 * DEG) return null;
    }
    // 네 변의 방향 평균 (90° 주기)
    let sx = 0, sy = 0;
    for (let i = 0; i < 4; i++) {
      const a = v[i], b = v[(i + 1) % 4];
      const phi = Math.atan2(b.y - a.y, b.x - a.x) * 4;
      sx += Math.cos(phi); sy += Math.sin(phi);
    }
    let th = Math.atan2(sy, sx) / 4;
    th = snapAngle(th, Math.PI / 2, 6 * DEG);
    const co = Math.cos(th), si = Math.sin(th);
    const loc = v.map(p => P(p.x * co + p.y * si, -p.x * si + p.y * co));
    const us = loc.map(p => p.x).sort((a, b) => a - b);
    const vs = loc.map(p => p.y).sort((a, b) => a - b);
    const l = (us[0] + us[1]) / 2, rgt = (us[2] + us[3]) / 2;
    const t = (vs[0] + vs[1]) / 2, btm = (vs[2] + vs[3]) / 2;
    return [P(l, t), P(rgt, t), P(rgt, btm), P(l, btm)].map(p => P(p.x * co - p.y * si, p.x * si + p.y * co));
  }

  function tryEllipse(r) {
    const n = r.length;
    let mx = 0, my = 0;
    for (const p of r) { mx += p.x; my += p.y; }
    mx /= n; my /= n;
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of r) {
      const dx = p.x - mx, dy = p.y - my;
      sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
    }
    let th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    th = snapAngle(th, Math.PI / 2, 8 * DEG);
    const co = Math.cos(th), si = Math.sin(th);
    const loc = r.map(p => {
      const dx = p.x - mx, dy = p.y - my;
      return P(dx * co + dy * si, -dx * si + dy * co);
    });
    const b0 = bbox(loc);
    let a = (b0.x1 - b0.x0) / 2, b = (b0.y1 - b0.y0) / 2;
    if (a < 1 || b < 1) return null;
    const cu = (b0.x1 + b0.x0) / 2, cv = (b0.y1 + b0.y0) / 2;
    let err = 0;
    for (const p of loc) err += Math.abs(Math.hypot((p.x - cu) / a, (p.y - cv) / b) - 1);
    err /= n;
    if (err > 0.1) return null;

    let label = '타원';
    if (Math.min(a, b) / Math.max(a, b) > 0.82) {
      a = b = (a + b) / 2;
      label = '원';
    }
    // 그린 방향과 시작점을 유지
    let area = 0;
    for (let i = 0; i < n; i++) {
      const p = loc[i], q = loc[(i + 1) % n];
      area += p.x * q.y - q.x * p.y;
    }
    const dir = area >= 0 ? 1 : -1;
    const t0 = Math.atan2((loc[0].y - cv) / b, (loc[0].x - cu) / a);
    const perim = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    const N = Math.max(36, Math.min(900, Math.ceil(perim / 3)));
    const out = [];
    for (let i = 0; i <= N; i++) {
      const t = t0 + dir * TAU * i / N;
      const u = cu + a * Math.cos(t), v = cv + b * Math.sin(t);
      out.push(P(mx + u * co - v * si, my + u * si + v * co));
    }
    return { points: out, label };
  }

  function classifyClosed(r, bb) {
    const poly = tryPolygon(r, bb);
    if (poly) return poly;
    const ell = tryEllipse(r);
    if (ell) return ell;
    const simple = rdp([...r, r[0]], Math.max(0.5, bb.diag * 0.015));
    simple.pop();
    return { points: catmull(simple, true), label: '도형' };
  }

  /**
   * @param {number[]} flat [x0, y0, x1, y1, ...]
   * @returns {{points:number[], label:string}|null}
   */
  function recognize(flat) {
    const a = fromFlat(flat);
    if (a.length < 3) return null;
    const L = pathLength(a);
    const bb = bbox(a);
    if (L < 2 || bb.diag < 2) return null;
    const gap = dist(a[0], a[a.length - 1]);
    const closed = gap < 0.22 * bb.diag && L > 1.5 * bb.diag;
    const res = closed
      ? classifyClosed(resample([...a, a[0]], 97).slice(0, 96), bb)
      : classifyOpen(resample(a, 96));
    return res ? { points: toFlat(res.points), label: res.label } : null;
  }

  return { recognize };
})();

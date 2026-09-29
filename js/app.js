(() => {
  'use strict';

  // ================= 저장소 =================
  const INDEX_KEY = 'qwerty.projects';
  const TOOL_KEY = 'qwerty.tool';
  const CLIP_KEY = 'qwerty.clipboard';
  const projectKey = id => 'qwerty.project.' + id;

  const storage = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch { /* 무시 */ }
    },
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const round1 = v => Math.round(v * 10) / 10;
  const round2 = v => Math.round(v * 100) / 100;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const $ = sel => document.querySelector(sel);
  const deepCopy = v => JSON.parse(JSON.stringify(v));

  const ICONS = {
    x: '<svg class="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    plus: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    trash: '<svg class="ico" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    eye: '<svg class="ico" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg class="ico" viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    caret: '<svg class="ico" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    folder: '<svg class="ico" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  };

  // ================= 비율 프리셋 =================
  const RATIOS = [
    { id: '1:1', label: '1:1', w: 1, h: 1 },
    { id: '4:3', label: '4:3', w: 4, h: 3 },
    { id: '3:4', label: '3:4', w: 3, h: 4 },
    { id: '16:9', label: '16:9', w: 16, h: 9 },
    { id: '9:16', label: '9:16', w: 9, h: 16 },
    { id: '3:2', label: '3:2', w: 3, h: 2 },
    { id: '2:3', label: '2:3', w: 2, h: 3 },
    { id: 'a4p', label: 'A4 세로', w: 210, h: 297 },
    { id: 'a4l', label: 'A4 가로', w: 297, h: 210 },
    { id: 'custom', label: '커스텀' },
  ];

  function sizeFor(rw, rh, longSide) {
    if (rw >= rh) return [longSide, Math.max(1, Math.round(longSide * rh / rw))];
    return [Math.max(1, Math.round(longSide * rw / rh)), longSide];
  }

  // ================= 펜 종류 =================
  const PENS = [
    { id: 'basic', label: '기본 펜', size: 8 },
    { id: 'brush', label: '붓펜', size: 16 },
    { id: 'calligraphy', label: '캘리그라피', size: 18 },
    { id: 'pencil', label: '연필', size: 5 },
    { id: 'marker', label: '마커', size: 22, alpha: 0.55 },
    { id: 'highlighter', label: '형광펜', size: 34, alpha: 0.38, blend: 'multiply' },
  ];
  const PEN = Object.fromEntries(PENS.map(p => [p.id, p]));
  const NIB_ANGLE = -Math.PI / 4;

  const TOOLS = {
    pen: '펜',
    magic: '매직 펜',
    eraser: '지우개',
    select: '영역 선택',
    paste: '붙여넣기',
  };

  // ================= 홈 화면 =================
  const home = $('#home');
  const editor = $('#editor');
  const grid = $('#project-grid');

  function showScreen(name) {
    home.hidden = name !== 'home';
    editor.hidden = name !== 'editor';
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function renderHome() {
    const list = storage.get(INDEX_KEY, []).sort((a, b) => b.updatedAt - a.updatedAt);
    grid.innerHTML = '';
    $('#empty').hidden = list.length > 0;
    for (const meta of list) {
      const card = document.createElement('div');
      card.className = 'card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');

      const thumb = document.createElement('div');
      thumb.className = 'card-thumb';
      if (meta.thumb) {
        const img = document.createElement('img');
        img.src = meta.thumb;
        img.alt = '';
        thumb.appendChild(img);
      }

      const body = document.createElement('div');
      body.className = 'card-body';
      const name = document.createElement('div');
      name.className = 'card-name';
      name.textContent = meta.name;
      const info = document.createElement('div');
      info.className = 'card-meta';
      info.textContent = `${meta.width} × ${meta.height} · ${formatDate(meta.updatedAt)}`;
      body.append(name, info);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'icon-btn card-del';
      del.title = '삭제';
      del.innerHTML = ICONS.trash;
      del.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm(`'${meta.name}' 프로젝트를 삭제할까요? 되돌릴 수 없어요.`)) return;
        deleteProject(meta.id);
        renderHome();
      });

      card.append(thumb, body, del);
      card.addEventListener('click', () => openProject(meta.id));
      card.addEventListener('keydown', e => { if (e.key === 'Enter') openProject(meta.id); });
      grid.appendChild(card);
    }
  }

  function deleteProject(id) {
    storage.remove(projectKey(id));
    storage.set(INDEX_KEY, storage.get(INDEX_KEY, []).filter(m => m.id !== id));
  }

  // ================= 새 프로젝트 대화상자 =================
  const modal = $('#modal-new');
  const ratioGrid = $('#ratio-grid');
  const newDlg = { ratio: '4:3', res: 2048 };

  function buildRatioGrid() {
    ratioGrid.innerHTML = '';
    for (const r of RATIOS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ratio';
      b.dataset.id = r.id;
      const shape = document.createElement('span');
      shape.className = 'ratio-shape';
      const inner = document.createElement('span');
      if (r.id === 'custom') {
        inner.className = 'custom-shape';
      } else {
        const [w, h] = sizeFor(r.w, r.h, 32);
        inner.style.width = w + 'px';
        inner.style.height = h + 'px';
      }
      shape.appendChild(inner);
      const label = document.createElement('span');
      label.textContent = r.label;
      b.append(shape, label);
      b.addEventListener('click', () => { newDlg.ratio = r.id; syncNewDialog(); });
      ratioGrid.appendChild(b);
    }
  }

  function newDialogSize() {
    let rw, rh;
    if (newDlg.ratio === 'custom') {
      rw = parseFloat($('#custom-w').value);
      rh = parseFloat($('#custom-h').value);
      if (!(rw > 0) || !(rh > 0)) return null;
    } else {
      const r = RATIOS.find(x => x.id === newDlg.ratio);
      rw = r.w; rh = r.h;
    }
    const [w, h] = sizeFor(rw, rh, newDlg.res);
    if (w < 16 || h < 16) return null;
    return [w, h];
  }

  function syncNewDialog() {
    for (const b of ratioGrid.children) b.classList.toggle('active', b.dataset.id === newDlg.ratio);
    for (const b of $('#res-group').children) b.classList.toggle('active', Number(b.dataset.res) === newDlg.res);
    $('#custom-fields').hidden = newDlg.ratio !== 'custom';
    const size = newDialogSize();
    $('#size-preview').textContent = size ? `${size[0]} × ${size[1]} px` : '비율 값을 확인해 주세요';
  }

  function openNewDialog() {
    const count = storage.get(INDEX_KEY, []).length;
    $('#new-name').value = `제목 없음 ${count + 1}`;
    syncNewDialog();
    modal.hidden = false;
  }

  function closeNewDialog() { modal.hidden = true; }

  buildRatioGrid();
  $('#btn-new').addEventListener('click', openNewDialog);
  $('#btn-new-close').addEventListener('click', closeNewDialog);
  $('#btn-new-cancel').addEventListener('click', closeNewDialog);
  modal.addEventListener('pointerdown', e => { if (e.target === modal) closeNewDialog(); });
  $('#custom-w').addEventListener('input', syncNewDialog);
  $('#custom-h').addEventListener('input', syncNewDialog);
  for (const b of $('#res-group').children) {
    b.addEventListener('click', () => { newDlg.res = Number(b.dataset.res); syncNewDialog(); });
  }

  $('#form-new').addEventListener('submit', e => {
    e.preventDefault();
    const size = newDialogSize();
    if (!size) { toast('비율 값을 확인해 주세요'); return; }
    const name = $('#new-name').value.trim() || '제목 없음';
    const now = Date.now();
    const p = {
      id: uid(),
      version: 2,
      name,
      width: size[0],
      height: size[1],
      createdAt: now,
      updatedAt: now,
      auxCounter: 0,
      boards: [newBoard('main', 'main', '기본 캔버스')],
    };
    if (!storage.set(projectKey(p.id), p)) { toast('저장 공간이 부족해 프로젝트를 만들 수 없어요'); return; }
    writeIndex(p, null);
    closeNewDialog();
    openProject(p.id);
  });

  function newBoard(id, type, name) {
    return { id, type, name, layers: [], nextNum: 1, nextGroup: 1, view: null };
  }

  // 예전 형식(선 목록) 프로젝트를 레이어 트리 형식으로 바꿈
  function migrate(p) {
    for (const b of p.boards) {
      if (!b.layers) {
        b.layers = (b.strokes || []).map(s => ({ ...s, kind: 'stroke', pen: s.pen || 'basic' }));
        delete b.strokes;
      }
      if (!b.nextGroup) b.nextGroup = 1;
    }
    p.version = 2;
    return p;
  }

  // ================= 작업 화면 상태 =================
  const stage = $('#stage');
  const canvas = $('#board');
  const ctx = canvas.getContext('2d');
  const cache = document.createElement('canvas');
  const cctx = cache.getContext('2d');
  const scratch = document.createElement('canvas');
  const sctx = scratch.getContext('2d');

  const PAGE_BG = '#e4e4e9';
  const AUX_BG = '#f7f7f4';
  const ACCENT = '#4f5bd5';
  const MIN_ZOOM = 0.02;
  const MAX_ZOOM = 40;

  const penDefaults = Object.fromEntries(PENS.map(p => [p.id, p.size]));
  const savedTool = storage.get(TOOL_KEY, {});
  const tool = {
    current: 'pen',
    color: '#1b1b1f',
    pen: 'basic',
    eraserMode: 'area',
    eraserSize: 30,
    selectMode: 'lasso',
    ...savedTool,
    penSizes: { ...penDefaults, ...(savedTool.penSizes || {}) },
  };
  if (!TOOLS[tool.current]) tool.current = 'pen';
  if (!PEN[tool.pen]) tool.pen = 'basic';

  let project = null;
  let board = null;
  let dpr = 1, cw = 0, ch = 0;
  let cacheDirty = true;
  let rafId = 0;
  let penSeen = false;
  let layersOpen = false;
  let histories = new Map();
  let expanded = new Set();

  // 선택 상태
  let selection = new Set();
  let selBox = null; // { cx, cy, hw, hh, angle }

  // 그리는 중에만 쓰는 임시 상태
  const live = { hidden: new Set(), erase: null, transform: null };

  // 저장하지 않는 런타임 캐시 (선 객체는 바뀌지 않으므로 객체 기준으로 캐시)
  const bboxCache = new WeakMap();
  const thumbCache = new WeakMap();

  let clipboard = storage.get(CLIP_KEY, []);

  // ================= 레이어 트리 도우미 =================
  // 노드: { kind:'stroke', ... } 또는 { kind:'group', children:[...] }
  // 선 노드는 한 번 만들어지면 바꾸지 않고 새 객체로 교체한다 (실행 취소 스냅샷 공유를 위해)

  function locate(id, list = board.layers, parent = null) {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n.id === id) return { node: n, list, index: i, parent };
      if (n.kind === 'group') {
        const r = locate(id, n.children, n);
        if (r) return r;
      }
    }
    return null;
  }

  function pathTo(id, list = board.layers, trail = []) {
    for (const n of list) {
      if (n.id === id) return [...trail, n];
      if (n.kind === 'group') {
        const r = pathTo(id, n.children, [...trail, n]);
        if (r) return r;
      }
    }
    return null;
  }

  function strokesOf(node, out = [], visibleOnly = false) {
    if (visibleOnly && !node.visible) return out;
    if (node.kind === 'group') for (const c of node.children) strokesOf(c, out, visibleOnly);
    else out.push(node);
    return out;
  }

  function allStrokes(visibleOnly = true) {
    const out = [];
    for (const n of board.layers) strokesOf(n, out, visibleOnly);
    return out;
  }

  function countNodes(list) {
    let n = 0;
    for (const x of list) n += x.kind === 'group' ? countNodes(x.children) : 1;
    return n;
  }

  function orderIndex() {
    const map = new Map();
    let i = 0;
    const walk = list => {
      for (const n of list) {
        map.set(n.id, i++);
        if (n.kind === 'group') walk(n.children);
      }
    };
    walk(board.layers);
    return map;
  }

  function cloneTree(list) {
    return list.map(n => n.kind === 'group' ? { ...n, children: cloneTree(n.children) } : n);
  }

  function replaceNode(id, fn) {
    const loc = locate(id);
    if (loc) loc.list[loc.index] = fn(loc.node);
  }

  function removeNodes(ids) {
    const prune = list => {
      for (let i = list.length - 1; i >= 0; i--) {
        const n = list[i];
        if (ids.has(n.id)) { list.splice(i, 1); continue; }
        if (n.kind === 'group') {
          prune(n.children);
          if (!n.children.length) list.splice(i, 1);
        }
      }
    };
    prune(board.layers);
  }

  function nodeBBox(node) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of strokesOf(node)) {
      const b = strokeBBox(s);
      x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]);
      x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
    }
    return [x0, y0, x1, y1];
  }

  function nodesBBox(nodes) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) {
      const b = nodeBBox(n);
      x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]);
      x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
    }
    return [x0, y0, x1, y1];
  }

  function strokeBBox(s) {
    let bb = bboxCache.get(s);
    if (bb) return bb;
    const p = s.points;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < p.length; i += 2) {
      if (p[i] < x0) x0 = p[i];
      if (p[i] > x1) x1 = p[i];
      if (p[i + 1] < y0) y0 = p[i + 1];
      if (p[i + 1] > y1) y1 = p[i + 1];
    }
    const h = s.size / 2 + 1;
    bb = [x0 - h, y0 - h, x1 + h, y1 + h];
    bboxCache.set(s, bb);
    return bb;
  }

  // ================= 기하 도우미 =================
  function distPtSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }

  function segsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
    const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }

  function segSegDist(ax, ay, bx, by, cx, cy, dx, dy) {
    if (segsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
    return Math.min(
      distPtSeg(ax, ay, cx, cy, dx, dy), distPtSeg(bx, by, cx, cy, dx, dy),
      distPtSeg(cx, cy, ax, ay, bx, by), distPtSeg(dx, dy, ax, ay, bx, by),
    );
  }

  // 선(stroke)이 선분 a-b에서 tol 거리 안에 있는가
  function strokeNearSegment(s, ax, ay, bx, by, tol) {
    const bb = strokeBBox(s);
    if (Math.max(ax, bx) < bb[0] - tol || Math.min(ax, bx) > bb[2] + tol ||
        Math.max(ay, by) < bb[1] - tol || Math.min(ay, by) > bb[3] + tol) return false;
    const p = s.points;
    if (p.length === 2) return distPtSeg(p[0], p[1], ax, ay, bx, by) <= tol;
    for (let i = 0; i < p.length - 2; i += 2) {
      if (segSegDist(p[i], p[i + 1], p[i + 2], p[i + 3], ax, ay, bx, by) <= tol) return true;
    }
    return false;
  }

  function pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
      const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function strokeInPoly(s, poly, pb) {
    const bb = strokeBBox(s);
    if (bb[2] < pb[0] || bb[0] > pb[2] || bb[3] < pb[1] || bb[1] > pb[3]) return false;
    const p = s.points;
    for (let i = 0; i < p.length; i += 2) if (pointInPoly(p[i], p[i + 1], poly)) return true;
    for (let i = 0; i < p.length - 2; i += 2) {
      for (let j = 0, k = poly.length - 2; j < poly.length; k = j, j += 2) {
        if (segsIntersect(p[i], p[i + 1], p[i + 2], p[i + 3], poly[k], poly[k + 1], poly[j], poly[j + 1])) return true;
      }
    }
    return false;
  }

  // 2D 행렬 [a, b, c, d, e, f] (canvas transform 과 같은 순서)
  const Mat = {
    identity: () => [1, 0, 0, 1, 0, 0],
    translate: (tx, ty) => [1, 0, 0, 1, tx, ty],
    rotateAbout(a, cx, cy) {
      const co = Math.cos(a), si = Math.sin(a);
      return [co, si, -si, co, cx - co * cx + si * cy, cy - si * cx - co * cy];
    },
    scaleAbout: (k, cx, cy) => [k, 0, 0, k, cx - k * cx, cy - k * cy],
    apply: (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]],
  };

  function transformPoints(p, m) {
    const out = new Array(p.length);
    for (let i = 0; i < p.length; i += 2) {
      out[i] = round1(m[0] * p[i] + m[2] * p[i + 1] + m[4]);
      out[i + 1] = round1(m[1] * p[i] + m[3] * p[i + 1] + m[5]);
    }
    return out;
  }

  function transformNode(n, m) {
    const k = Math.hypot(m[0], m[1]);
    const rot = Math.atan2(m[1], m[0]);
    if (n.kind === 'group') {
      n.children = n.children.map(c => transformNode(c, m));
      return n;
    }
    const s = { ...n, points: transformPoints(n.points, m), size: round2(n.size * k) };
    if (n.erase) s.erase = n.erase.map(e => ({ size: round2(e.size * k), points: transformPoints(e.points, m) }));
    if (n.pen === 'calligraphy') s.nib = round2((n.nib ?? NIB_ANGLE) + rot);
    return s;
  }

  function withNewIds(n) {
    n.id = uid();
    if (n.kind === 'group') n.children.forEach(withNewIds);
    return n;
  }

  // ================= 프로젝트 열기/저장 =================
  function openProject(id) {
    const data = storage.get(projectKey(id), null);
    if (!data) { toast('프로젝트를 불러오지 못했어요'); renderHome(); return; }
    project = migrate(data);
    histories = new Map();
    expanded = new Set();
    showScreen('editor');
    $('#project-name').textContent = project.name;
    resize();
    setBoard(project.boards[0]);
    syncToolUI();
  }

  function closeProject() {
    cancelActive();
    closePopups();
    saveProject();
    project = null;
    board = null;
    showScreen('home');
    renderHome();
  }

  let saveTimer = 0;
  function markChanged() {
    project.updatedAt = Date.now();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProject, 700);
  }

  function saveProject() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    if (!project) return;
    const ok = storage.set(projectKey(project.id), project);
    writeIndex(project, makeProjectThumb());
    if (!ok) toast('저장 공간이 부족해 저장하지 못했어요');
  }

  function writeIndex(p, thumb) {
    const list = storage.get(INDEX_KEY, []);
    const meta = { id: p.id, name: p.name, width: p.width, height: p.height, createdAt: p.createdAt, updatedAt: p.updatedAt, thumb };
    const i = list.findIndex(m => m.id === p.id);
    if (i >= 0) list[i] = meta; else list.push(meta);
    storage.set(INDEX_KEY, list);
  }

  function makeProjectThumb() {
    const main = project.boards[0];
    const scale = 320 / Math.max(project.width, project.height);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(project.width * scale));
    c.height = Math.max(1, Math.round(project.height * scale));
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    x.scale(scale, scale);
    drawNodes(x, main.layers, null);
    try { return c.toDataURL('image/jpeg', 0.8); } catch { return null; }
  }

  window.addEventListener('pagehide', () => { if (project) saveProject(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && project) saveProject(); });

  $('#btn-home').addEventListener('click', closeProject);
  $('#project-name').addEventListener('click', () => {
    const name = prompt('프로젝트 이름', project.name);
    if (name == null) return;
    project.name = name.trim() || project.name;
    $('#project-name').textContent = project.name;
    markChanged();
  });

  // ================= 캔버스(보드) =================
  function setBoard(b) {
    cancelActive();
    closePopups();
    board = b;
    selection = new Set();
    selBox = null;
    if (!board.view) board.view = defaultView(board);
    cacheDirty = true;
    renderTabs();
    renderLayers();
    updateHistoryButtons();
    updateSelectionUI();
    updateZoomLabel();
    $('#board-badge').textContent = board.type === 'main'
      ? `기본 캔버스 · ${project.width} × ${project.height}`
      : '보조 캔버스 · 무한';
    requestRender();
  }

  function defaultView(b) {
    if (b.type === 'main') {
      const m = Math.min(56, Math.min(cw, ch) * 0.08);
      const s = clamp(Math.min((cw - m * 2) / project.width, (ch - m * 2) / project.height), MIN_ZOOM, MAX_ZOOM);
      return { x: (cw - project.width * s) / 2, y: (ch - project.height * s) / 2, s };
    }
    return { x: cw / 2, y: ch / 2, s: 1 };
  }

  function addAuxBoard() {
    project.auxCounter = (project.auxCounter || 0) + 1;
    const b = newBoard(uid(), 'aux', '보조 캔버스 ' + project.auxCounter);
    project.boards.push(b);
    markChanged();
    setBoard(b);
  }

  function removeAuxBoard(b) {
    if (b.layers.length && !confirm(`'${b.name}'을(를) 삭제할까요? 그린 선도 함께 사라져요.`)) return;
    project.boards = project.boards.filter(x => x !== b);
    histories.delete(b.id);
    markChanged();
    if (board === b) setBoard(project.boards[0]);
    else renderTabs();
  }

  function renderTabs() {
    const tabs = $('#tabs');
    tabs.innerHTML = '';
    for (const b of project.boards) {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'tab ' + b.type + (b === board ? ' active' : '');
      const kind = document.createElement('span');
      kind.className = 'tab-kind';
      const label = document.createElement('span');
      label.textContent = b.name;
      t.append(kind, label);
      if (b.type === 'aux') {
        const close = document.createElement('span');
        close.className = 'tab-close';
        close.title = '보조 캔버스 삭제';
        close.innerHTML = ICONS.x;
        close.addEventListener('click', e => { e.stopPropagation(); removeAuxBoard(b); });
        t.appendChild(close);
      }
      t.addEventListener('click', () => { if (b !== board) setBoard(b); });
      tabs.appendChild(t);
    }
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'tab tab-add';
    add.innerHTML = ICONS.plus + '<span>보조 캔버스</span>';
    add.addEventListener('click', addAuxBoard);
    tabs.appendChild(add);
    tabs.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ================= 선 그리기 (펜 종류별) =================
  const patternCache = new Map();

  // 연필 질감: 색마다 한 번 만든 노이즈 무늬
  function pencilTexture(color) {
    let c = patternCache.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const img = x.createImageData(64, 64);
    const hex = color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    let seed = 1234567;
    const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b;
      img.data[i + 3] = rand() < 0.62 ? 150 + rand() * 105 : rand() * 50;
    }
    x.putImageData(img, 0, 0);
    patternCache.set(color, c);
    return c;
  }

  // 중점을 잇는 2차 곡선으로 부드러운 경로
  function tracePath(c, p) {
    const n = p.length / 2;
    c.moveTo(p[0], p[1]);
    if (n === 1) { c.lineTo(p[0] + 0.01, p[1]); return; }
    if (n === 2) { c.lineTo(p[2], p[3]); return; }
    for (let i = 1; i < n - 1; i++) {
      const x = p[i * 2], y = p[i * 2 + 1];
      c.quadraticCurveTo(x, y, (x + p[i * 2 + 2]) / 2, (y + p[i * 2 + 3]) / 2);
    }
    c.lineTo(p[p.length - 2], p[p.length - 1]);
  }

  // 투명도/합성 없이 선 모양만 그림
  function drawStrokeRaw(c, s) {
    const pen = s.pen || 'basic';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (pen === 'brush' && s.w) return drawVariable(c, s);
    if (pen === 'calligraphy') return drawCalligraphy(c, s);
    if (pen === 'pencil') {
      c.strokeStyle = c.createPattern(pencilTexture(s.color), 'repeat');
    } else {
      c.strokeStyle = s.color;
    }
    if (pen === 'highlighter') c.lineCap = 'square';
    c.lineWidth = s.size;
    c.beginPath();
    tracePath(c, s.points);
    c.stroke();
  }

  // 붓펜: 점마다 굵기가 다름
  function drawVariable(c, s) {
    const p = s.points, w = s.w, n = p.length / 2;
    c.strokeStyle = s.color;
    c.fillStyle = s.color;
    if (n === 1) {
      c.beginPath();
      c.arc(p[0], p[1], s.size * w[0] / 2, 0, Math.PI * 2);
      c.fill();
      return;
    }
    let px = p[0], py = p[1];
    for (let i = 1; i < n; i++) {
      const x = p[i * 2], y = p[i * 2 + 1];
      c.beginPath();
      c.moveTo(px, py);
      if (i < n - 1) {
        const ex = (x + p[i * 2 + 2]) / 2, ey = (y + p[i * 2 + 3]) / 2;
        c.quadraticCurveTo(x, y, ex, ey);
        px = ex; py = ey;
      } else {
        c.lineTo(x, y);
      }
      c.lineWidth = Math.max(0.3, s.size * ((w[i - 1] ?? 1) + (w[i] ?? 1)) / 2);
      c.stroke();
    }
  }

  // 캘리그라피: 납작한 펜촉이 지나간 자리를 채움 (방향에 따라 굵기가 달라짐)
  function drawCalligraphy(c, s) {
    const p = s.points, n = p.length / 2;
    const a = s.nib ?? NIB_ANGLE;
    const hx = Math.cos(a) * s.size / 2, hy = Math.sin(a) * s.size / 2;
    c.fillStyle = s.color;
    c.strokeStyle = s.color;
    c.lineWidth = Math.max(0.5, s.size * 0.07);
    c.beginPath();
    tracePath(c, p);
    c.stroke();
    c.beginPath();
    if (n === 1) {
      c.moveTo(p[0] - hx, p[1] - hy);
      c.lineTo(p[0] + hx, p[1] + hy);
      c.stroke();
      return;
    }
    for (let i = 0; i < n - 1; i++) {
      const x0 = p[i * 2], y0 = p[i * 2 + 1], x1 = p[i * 2 + 2], y1 = p[i * 2 + 3];
      // 모든 사각형이 같은 방향으로 감기도록 해서 nonzero 채우기에서 구멍이 안 생기게 함
      const cross = (x1 - x0) * hy - (y1 - y0) * hx;
      if (cross >= 0) {
        c.moveTo(x0 - hx, y0 - hy); c.lineTo(x0 + hx, y0 + hy); c.lineTo(x1 + hx, y1 + hy); c.lineTo(x1 - hx, y1 - hy);
      } else {
        c.moveTo(x0 - hx, y0 - hy); c.lineTo(x1 - hx, y1 - hy); c.lineTo(x1 + hx, y1 + hy); c.lineTo(x0 + hx, y0 + hy);
      }
      c.closePath();
    }
    c.fill('nonzero');
  }

  // 투명도, 합성, 영역 지우개 구멍까지 적용해서 그림
  function drawStroke(c, s, extraErase) {
    const def = PEN[s.pen] || PEN.basic;
    const erases = extraErase ? [...(s.erase || []), extraErase] : s.erase;
    if (erases && erases.length) { drawErased(c, s, def, erases); return; }
    c.save();
    if (def.alpha) c.globalAlpha *= def.alpha;
    if (def.blend) c.globalCompositeOperation = def.blend;
    drawStrokeRaw(c, s);
    c.restore();
  }

  // 지운 부분은 흰색으로 덮는 게 아니라 진짜로 투명하게 뚫음 (destination-out)
  function drawErased(c, s, def, erases) {
    const t = c.getTransform();
    const b = strokeBBox(s);
    let dx0 = Infinity, dy0 = Infinity, dx1 = -Infinity, dy1 = -Infinity;
    for (const [x, y] of [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]]) {
      const X = t.a * x + t.c * y + t.e, Y = t.b * x + t.d * y + t.f;
      dx0 = Math.min(dx0, X); dy0 = Math.min(dy0, Y); dx1 = Math.max(dx1, X); dy1 = Math.max(dy1, Y);
    }
    const rx = Math.max(0, Math.floor(dx0)), ry = Math.max(0, Math.floor(dy0));
    const rw = Math.min(c.canvas.width, Math.ceil(dx1)) - rx;
    const rh = Math.min(c.canvas.height, Math.ceil(dy1)) - ry;
    if (rw <= 0 || rh <= 0) return;
    if (scratch.width < rw || scratch.height < rh) {
      scratch.width = Math.max(scratch.width, rw);
      scratch.height = Math.max(scratch.height, rh);
    }
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = 'source-over';
    sctx.clearRect(0, 0, rw, rh);
    sctx.setTransform(t.a, t.b, t.c, t.d, t.e - rx, t.f - ry);
    drawStrokeRaw(sctx, s);
    sctx.globalCompositeOperation = 'destination-out';
    sctx.strokeStyle = '#000';
    sctx.lineCap = 'round';
    sctx.lineJoin = 'round';
    for (const e of erases) {
      sctx.lineWidth = e.size;
      sctx.beginPath();
      tracePath(sctx, e.points);
      sctx.stroke();
    }
    sctx.globalCompositeOperation = 'source-over';
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (def.alpha) c.globalAlpha *= def.alpha;
    if (def.blend) c.globalCompositeOperation = def.blend;
    c.drawImage(scratch, 0, 0, rw, rh, rx, ry, rw, rh);
    c.restore();
  }

  // 레이어 트리 그리기 (뒤 → 앞)
  function drawNodes(c, nodes, lv) {
    for (const n of nodes) {
      if (!n.visible) continue;
      if (lv && lv.hidden.has(n.id)) continue;
      const m = lv && lv.transform && lv.transform.ids.has(n.id) ? lv.transform.m : null;
      if (m) { c.save(); c.transform(...m); }
      if (n.kind === 'group') drawNodes(c, n.children, lv);
      else drawStroke(c, n, lv && lv.erase && lv.erase.strokes.has(n.id) ? lv.erase.path : null);
      if (m) c.restore();
    }
  }

  // ================= 화면 렌더링 =================
  function resize() {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const prevW = cw, prevH = ch;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    cw = r.width;
    ch = r.height;
    for (const c of [canvas, cache]) {
      c.width = Math.round(cw * dpr);
      c.height = Math.round(ch * dpr);
    }
    if (project && prevW && prevH) {
      for (const b of project.boards) {
        if (!b.view) continue;
        b.view.x += (cw - prevW) / 2;
        b.view.y += (ch - prevH) / 2;
      }
    }
    cacheDirty = true;
    requestRender();
  }

  new ResizeObserver(() => { if (project) resize(); }).observe(stage);

  function requestRender() {
    if (!rafId) rafId = requestAnimationFrame(render);
  }

  function invalidate() {
    cacheDirty = true;
    requestRender();
  }

  function applyView(c) {
    const v = board.view;
    c.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.x, dpr * v.y);
  }

  function render() {
    rafId = 0;
    if (!project || !board) return;
    if (cacheDirty) {
      drawScene(cctx);
      cacheDirty = false;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cache, 0, 0);
    drawOverlay(ctx);
  }

  function drawScene(c) {
    const v = board.view;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';

    if (board.type === 'main') {
      c.fillStyle = PAGE_BG;
      c.fillRect(0, 0, cache.width, cache.height);
      applyView(c);
      c.save();
      c.shadowColor = 'rgba(20, 20, 40, .18)';
      c.shadowBlur = 18 * dpr;
      c.shadowOffsetY = 3 * dpr;
      c.fillStyle = '#fff';
      c.fillRect(0, 0, project.width, project.height);
      c.restore();
    } else {
      c.fillStyle = AUX_BG;
      c.fillRect(0, 0, cache.width, cache.height);
      drawDotGrid(c);
      applyView(c);
    }

    drawNodes(c, board.layers, live);

    if (board.type === 'main') {
      c.strokeStyle = 'rgba(20, 20, 40, .22)';
      c.lineWidth = 1 / v.s;
      c.strokeRect(0, 0, project.width, project.height);
    }
  }

  function drawDotGrid(c) {
    const v = board.view;
    let step = 32;
    while (step * v.s < 14) step *= 2;
    while (step * v.s > 56) step /= 2;
    const sx = step * v.s;
    const ox = ((v.x % sx) + sx) % sx;
    const oy = ((v.y % sx) + sx) % sx;
    const r = Math.max(1, 1.2 * dpr);
    c.fillStyle = 'rgba(40, 40, 60, .18)';
    for (let y = oy; y < ch; y += sx) {
      for (let x = ox; x < cw; x += sx) {
        c.fillRect(x * dpr - r / 2, y * dpr - r / 2, r, r);
      }
    }
    const px = v.x * dpr, py = v.y * dpr;
    c.strokeStyle = 'rgba(79, 91, 213, .35)';
    c.lineWidth = Math.max(1, dpr);
    c.beginPath();
    c.moveTo(px - 8 * dpr, py); c.lineTo(px + 8 * dpr, py);
    c.moveTo(px, py - 8 * dpr); c.lineTo(px, py + 8 * dpr);
    c.stroke();
  }

  function drawOverlay(c) {
    const v = board.view;

    if (active && active.kind === 'draw') {
      applyView(c);
      drawStroke(c, active.stroke);
    }

    // 올가미 / 사각형 선택 영역
    if (active && active.kind === 'lasso') {
      applyView(c);
      c.save();
      c.lineWidth = 1.5 / v.s;
      c.setLineDash([6 / v.s, 5 / v.s]);
      c.strokeStyle = ACCENT;
      c.fillStyle = 'rgba(79, 91, 213, .08)';
      c.beginPath();
      const p = lassoPolygon(active);
      c.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]);
      c.closePath();
      c.fill();
      c.stroke();
      c.restore();
    }

    // 선택 상자
    if (selBox && selection.size) {
      const box = boxScreen();
      const handles = handlesActive();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.save();
      c.strokeStyle = ACCENT;
      c.lineWidth = 1.5;
      c.setLineDash([6, 4]);
      c.beginPath();
      box.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.stroke();
      c.setLineDash([]);
      if (handles) {
        const [tx, ty] = box.topMid, [rx, ry] = box.rot;
        c.beginPath();
        c.moveTo(tx, ty);
        c.lineTo(rx, ry);
        c.stroke();
        for (const [x, y, r] of [[rx, ry, 8], [box.pts[2][0], box.pts[2][1], 7]]) {
          c.beginPath();
          c.arc(x, y, r, 0, Math.PI * 2);
          c.fillStyle = '#fff';
          c.fill();
          c.stroke();
        }
        // 회전 핸들 안 작은 화살표 표시
        c.beginPath();
        c.arc(rx, ry, 3.5, -Math.PI * 0.9, Math.PI * 0.4);
        c.stroke();
      }
      c.restore();
    }

    // 지우개 커서
    const cursor = active && active.kind === 'erase' ? active.cursor : hover;
    if (tool.current === 'eraser' && cursor) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const r = Math.max(2, tool.eraserSize / 2 * v.s);
      c.save();
      c.beginPath();
      c.arc(cursor[0], cursor[1], r, 0, Math.PI * 2);
      c.lineWidth = 1.5;
      c.strokeStyle = 'rgba(255,255,255,.9)';
      c.stroke();
      c.lineWidth = 1;
      c.strokeStyle = 'rgba(20,20,40,.7)';
      c.stroke();
      c.restore();
    }
  }

  // ================= 화면 이동/확대 =================
  function toWorld(sx, sy) {
    const v = board.view;
    return [(sx - v.x) / v.s, (sy - v.y) / v.s];
  }

  function toScreen(wx, wy) {
    const v = board.view;
    return [wx * v.s + v.x, wy * v.s + v.y];
  }

  function zoomAt(sx, sy, factor) {
    const v = board.view;
    const s = clamp(v.s * factor, MIN_ZOOM, MAX_ZOOM);
    const k = s / v.s;
    v.x = sx - (sx - v.x) * k;
    v.y = sy - (sy - v.y) * k;
    v.s = s;
    viewChanged();
  }

  function viewChanged() {
    updateZoomLabel();
    closePastePopup();
    invalidate();
  }

  function updateZoomLabel() {
    $('#zoom-value').textContent = Math.round(board.view.s * 100) + '%';
  }

  $('#btn-zoom-in').addEventListener('click', () => zoomAt(cw / 2, ch / 2, 1.25));
  $('#btn-zoom-out').addEventListener('click', () => zoomAt(cw / 2, ch / 2, 0.8));
  $('#zoom-value').addEventListener('click', () => zoomAt(cw / 2, ch / 2, 1 / board.view.s));
  $('#btn-fit').addEventListener('click', () => { board.view = defaultView(board); viewChanged(); });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (!board) return;
    const r = canvas.getBoundingClientRect();
    const speed = e.ctrlKey ? 0.01 : 0.0015;
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-dy * speed));
  }, { passive: false });

  // ================= 입력 처리 =================
  // 펜 / 마우스 왼쪽: 현재 도구 사용
  // 손가락: 펜을 쓰기 전엔 도구 사용, 펜을 한 번 쓴 뒤엔 화면 이동 (손바닥 오작동 방지)
  // 두 손가락: 이동 + 확대/축소 / 마우스 가운데·오른쪽·스페이스+드래그: 이동
  const touches = new Map();
  let active = null;
  let panning = null;
  let gesture = null;
  let spaceDown = false;
  let canvasRect = null;
  let hover = null;

  function localPoint(e) {
    return [e.clientX - canvasRect.left, e.clientY - canvasRect.top];
  }

  canvas.addEventListener('pointerdown', e => {
    if (!board) return;
    e.preventDefault();
    closePopups();
    canvasRect = canvas.getBoundingClientRect();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    const [x, y] = localPoint(e);

    if (e.pointerType === 'pen') penSeen = true;

    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x, y });
      if (touches.size === 2) {
        // 두 번째 손가락: 하던 작업은 취소하고 제스처로 전환
        if (active && active.type === 'touch') cancelActive();
        panning = null;
        startGesture();
        return;
      }
      if (touches.size > 2 || active || gesture) return;
    }

    if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2 || spaceDown)) {
      startPan(e.pointerId, x, y);
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (active) return;
    beginPrimary(e, x, y, e.pointerType === 'touch' && penSeen);
  });

  function beginPrimary(e, x, y, fingerNav) {
    const t = tool.current;
    if (!fingerNav && handlesActive()) {
      const hit = hitSelection(x, y);
      if (hit) { startTransform(e, hit, x, y); return; }
    }
    if (t === 'paste') { startPress(e, x, y); return; }
    if (fingerNav) { startPan(e.pointerId, x, y); return; }
    if (t === 'pen' || t === 'magic') startDrawing(e, x, y);
    else if (t === 'eraser') startErase(e, x, y);
    else if (t === 'select') startLasso(e, x, y);
  }

  canvas.addEventListener('pointermove', e => {
    if (!board) return;
    canvasRect = canvasRect || canvas.getBoundingClientRect();
    const id = e.pointerId;
    const [x, y] = localPoint(e);
    if (e.pointerType === 'touch' && touches.has(id)) touches.set(id, { x, y });
    if (e.pointerType !== 'touch') {
      hover = [x, y];
      if (tool.current === 'eraser' && !active) requestRender();
    }

    if (gesture && touches.has(id)) { updateGesture(); return; }

    if (panning && panning.id === id) {
      board.view.x = panning.vx + (x - panning.sx);
      board.view.y = panning.vy + (y - panning.sy);
      viewChanged();
      return;
    }

    if (!active || active.id !== id) return;
    switch (active.kind) {
      case 'draw': {
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
        for (const ev of events.length ? events : [e]) addPoint(ev, ...localPoint(ev));
        requestRender();
        break;
      }
      case 'erase': {
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
        for (const ev of events.length ? events : [e]) eraseTo(...localPoint(ev));
        break;
      }
      case 'lasso': lassoTo(x, y); break;
      case 'transform': updateTransform(x, y); break;
      case 'press': pressMove(x, y); break;
    }
  });

  canvas.addEventListener('pointerleave', e => {
    if (e.pointerType !== 'touch') { hover = null; requestRender(); }
  });

  function endPointer(e) {
    const id = e.pointerId;
    touches.delete(id);
    if (gesture && touches.size < 2) gesture = null;
    if (panning && panning.id === id) {
      panning = null;
      stage.classList.remove('dragging');
    }
    if (active && active.id === id) {
      if (e.type === 'pointercancel' && active.type === 'touch') cancelActive();
      else finishActive();
    }
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());

  function finishActive() {
    const a = active;
    if (!a) return;
    switch (a.kind) {
      case 'draw': finishDrawing(); break;
      case 'erase': finishErase(); break;
      case 'lasso': finishLasso(); break;
      case 'transform': finishTransform(); break;
      case 'press': finishPress(); break;
    }
    active = null;
    requestRender();
  }

  function cancelActive() {
    const a = active;
    active = null;
    if (!a) return;
    if (a.holdTimer) clearTimeout(a.holdTimer);
    if (a.timer) clearTimeout(a.timer);
    live.hidden = new Set();
    live.erase = null;
    live.transform = null;
    invalidate();
  }

  function startPan(id, x, y) {
    panning = { id, sx: x, sy: y, vx: board.view.x, vy: board.view.y };
    stage.classList.add('dragging');
  }

  function gesturePoints() {
    const [a, b] = [...touches.values()];
    return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
  }

  function startGesture() {
    const g = gesturePoints();
    const v = board.view;
    gesture = { ...g, wx: (g.mx - v.x) / v.s, wy: (g.my - v.y) / v.s, s: v.s };
  }

  function updateGesture() {
    if (touches.size < 2) return;
    const g = gesturePoints();
    const v = board.view;
    v.s = clamp(gesture.s * g.d / gesture.d, MIN_ZOOM, MAX_ZOOM);
    v.x = g.mx - gesture.wx * v.s;
    v.y = g.my - gesture.wy * v.s;
    viewChanged();
  }

  // ================= 펜 / 매직 펜 =================
  function startDrawing(e, x, y) {
    const [wx, wy] = toWorld(x, y);
    const pen = tool.pen;
    const stroke = {
      id: uid(),
      kind: 'stroke',
      name: '',
      pen,
      color: tool.color,
      size: tool.penSizes[pen],
      visible: true,
      points: [round1(wx), round1(wy)],
    };
    active = {
      kind: 'draw',
      id: e.pointerId,
      type: e.pointerType,
      stroke,
      lastX: x,
      lastY: y,
      lastT: e.timeStamp,
      wv: 0.55,
      magic: tool.current === 'magic',
      holdX: x,
      holdY: y,
      snapped: false,
      holdTimer: 0,
    };
    if (pen === 'brush') stroke.w = [widthFactor(e, 0)];
    if (pen === 'calligraphy') stroke.nib = NIB_ANGLE;
    if (active.magic) armHold();
    requestRender();
  }

  // 붓펜 굵기: 펜이면 필압, 아니면 속도로 흉내
  function widthFactor(e, speed) {
    if (e.pointerType === 'pen' && e.pressure > 0) {
      active.wv += (0.12 + 0.88 * e.pressure - active.wv) * 0.6;
    } else {
      const target = clamp(1.05 - speed * 0.35, 0.3, 1);
      active.wv += (target - active.wv) * 0.3;
    }
    return round2(active.wv);
  }

  function addPoint(e, x, y) {
    const a = active;
    if (a.snapped) return;
    const dx = x - a.lastX, dy = y - a.lastY;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    const dt = Math.max(1, e.timeStamp - a.lastT);
    a.lastX = x;
    a.lastY = y;
    a.lastT = e.timeStamp;
    const [wx, wy] = toWorld(x, y);
    a.stroke.points.push(round1(wx), round1(wy));
    if (a.stroke.w) a.stroke.w.push(widthFactor(e, d / dt));
    if (a.magic && Math.hypot(x - a.holdX, y - a.holdY) > 5) {
      a.holdX = x;
      a.holdY = y;
      armHold();
    }
  }

  // 매직 펜: 멈추고 0.5초 누르고 있으면 도형으로 바꿈
  function armHold() {
    clearTimeout(active.holdTimer);
    const a = active;
    a.holdTimer = setTimeout(() => {
      if (active !== a || a.snapped) return;
      const pts = a.stroke.points;
      let len = 0;
      for (let i = 2; i < pts.length; i += 2) len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
      if (len * board.view.s < 16) return;
      const r = window.Shapes.recognize(pts);
      if (!r) return;
      a.stroke.points = r.points;
      delete a.stroke.w;
      a.snapped = true;
      if (navigator.vibrate) navigator.vibrate(12);
      toast(r.label, 900);
      requestRender();
    }, 500);
  }

  function finishDrawing() {
    const a = active;
    clearTimeout(a.holdTimer);
    const s = a.stroke;
    checkpoint();
    s.name = '선 ' + board.nextNum++;
    board.layers.push(s);
    strokesChanged();
  }

  // ================= 지우개 =================
  function startErase(e, x, y) {
    const [wx, wy] = toWorld(x, y);
    const path = { size: tool.eraserSize, points: [round1(wx), round1(wy)] };
    active = {
      kind: 'erase',
      id: e.pointerId,
      type: e.pointerType,
      mode: tool.eraserMode,
      path,
      last: [wx, wy],
      lastScreen: [x, y],
      cursor: [x, y],
      hits: new Set(),
    };
    if (active.mode === 'area') live.erase = { path, strokes: active.hits };
    else live.hidden = active.hits;
    eraseSegment(wx, wy, wx, wy);
    invalidate();
  }

  function eraseTo(x, y) {
    const a = active;
    a.cursor = [x, y];
    if (Math.hypot(x - a.lastScreen[0], y - a.lastScreen[1]) < 1) { requestRender(); return; }
    const [wx, wy] = toWorld(x, y);
    eraseSegment(a.last[0], a.last[1], wx, wy);
    a.path.points.push(round1(wx), round1(wy));
    a.last = [wx, wy];
    a.lastScreen = [x, y];
    if (a.mode === 'area') invalidate();
    else requestRender();
  }

  function eraseSegment(ax, ay, bx, by) {
    const a = active;
    const r = a.path.size / 2;
    let changed = false;
    for (const s of allStrokes(true)) {
      if (a.hits.has(s.id)) continue;
      if (strokeNearSegment(s, ax, ay, bx, by, r + s.size / 2)) {
        a.hits.add(s.id);
        changed = true;
      }
    }
    if (changed && a.mode === 'layer') invalidate();
  }

  function finishErase() {
    const a = active;
    live.erase = null;
    live.hidden = new Set();
    if (a.hits.size) {
      checkpoint();
      if (a.mode === 'area') {
        const path = { size: a.path.size, points: a.path.points.slice() };
        for (const id of a.hits) replaceNode(id, s => ({ ...s, erase: [...(s.erase || []), path] }));
      } else {
        removeNodes(a.hits);
        pruneSelection();
      }
      strokesChanged();
    } else {
      invalidate();
    }
  }

  // ================= 영역 선택 =================
  function startLasso(e, x, y) {
    const [wx, wy] = toWorld(x, y);
    active = {
      kind: 'lasso',
      id: e.pointerId,
      type: e.pointerType,
      mode: tool.selectMode,
      pts: [wx, wy],
      end: [wx, wy],
      screenLen: 0,
      lastScreen: [x, y],
    };
    requestRender();
  }

  function lassoTo(x, y) {
    const a = active;
    const d = Math.hypot(x - a.lastScreen[0], y - a.lastScreen[1]);
    if (d < 2) return;
    a.screenLen += d;
    a.lastScreen = [x, y];
    const [wx, wy] = toWorld(x, y);
    a.end = [wx, wy];
    if (a.mode === 'lasso') a.pts.push(wx, wy);
    requestRender();
  }

  function lassoPolygon(a) {
    if (a.mode === 'rect') {
      const [x0, y0] = [a.pts[0], a.pts[1]], [x1, y1] = a.end;
      return [x0, y0, x1, y0, x1, y1, x0, y1];
    }
    return a.pts;
  }

  function finishLasso() {
    const a = active;
    if (a.screenLen < 6) {
      // 가볍게 톡: 그 자리의 맨 앞 선을 고르거나, 빈 곳이면 선택 해제
      const [wx, wy] = a.end;
      const tol = 10 / board.view.s;
      const strokes = allStrokes(true);
      for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i];
        if (strokeNearSegment(s, wx, wy, wx, wy, s.size / 2 + tol)) {
          const top = pathTo(s.id)[0];
          setSelection([top.id]);
          return;
        }
      }
      setSelection([]);
      return;
    }
    const poly = lassoPolygon(a);
    let pb = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < poly.length; i += 2) {
      pb = [Math.min(pb[0], poly[i]), Math.min(pb[1], poly[i + 1]), Math.max(pb[2], poly[i]), Math.max(pb[3], poly[i + 1])];
    }
    const ids = [];
    for (const n of board.layers) {
      if (!n.visible) continue;
      if (strokesOf(n, [], true).some(s => strokeInPoly(s, poly, pb))) ids.push(n.id);
    }
    setSelection(ids);
  }

  // ================= 선택 상태 =================
  function normalizeSelection(ids) {
    const out = new Set();
    for (const id of ids) {
      const path = pathTo(id);
      if (!path) continue;
      if (path.slice(0, -1).some(g => ids.has(g.id))) continue;
      out.add(id);
    }
    return out;
  }

  function selectedNodes() {
    const order = orderIndex();
    return [...selection].map(id => locate(id)?.node).filter(Boolean)
      .sort((a, b) => order.get(a.id) - order.get(b.id));
  }

  function computeBox() {
    const nodes = selectedNodes();
    if (!nodes.length) return null;
    const [x0, y0, x1, y1] = nodesBBox(nodes);
    if (!isFinite(x0)) return null;
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: (x1 - x0) / 2, hh: (y1 - y0) / 2, angle: 0 };
  }

  function setSelection(ids) {
    selection = normalizeSelection(new Set(ids));
    selBox = computeBox();
    selectionChanged();
  }

  // 지워진 노드를 선택에서 빼고 상자를 다시 계산
  function pruneSelection() {
    const before = selection.size;
    selection = normalizeSelection(selection);
    if (selection.size !== before || !selBox) selBox = computeBox();
    if (!selection.size) selBox = null;
  }

  function selectionChanged() {
    updateSelectionUI();
    renderLayers();
    requestRender();
  }

  function handlesActive() {
    return !!(selBox && selection.size && (tool.current === 'select' || tool.current === 'paste'));
  }

  function boxScreen() {
    const { cx, cy, hw, hh, angle } = selBox;
    const pad = 8 / board.view.s;
    const co = Math.cos(angle), si = Math.sin(angle);
    const corner = (u, v) => toScreen(cx + u * co - v * si, cy + u * si + v * co);
    const W = hw + pad, H = hh + pad;
    const pts = [corner(-W, -H), corner(W, -H), corner(W, H), corner(-W, H)];
    const topMid = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
    let ux = pts[0][0] - pts[3][0], uy = pts[0][1] - pts[3][1];
    const ul = Math.hypot(ux, uy) || 1;
    ux /= ul; uy /= ul;
    const rot = [topMid[0] + ux * 30, topMid[1] + uy * 30];
    return { pts, topMid, rot, center: toScreen(cx, cy) };
  }

  function hitSelection(x, y) {
    if (!selBox) return null;
    const b = boxScreen();
    const R = 22;
    if (Math.hypot(x - b.rot[0], y - b.rot[1]) < R) return 'rotate';
    if (Math.hypot(x - b.pts[2][0], y - b.pts[2][1]) < R) return 'scale';
    const poly = b.pts.flat();
    if (pointInPoly(x, y, poly)) return 'move';
    return null;
  }

  // ================= 이동 / 회전 / 크기 =================
  function startTransform(e, mode, x, y) {
    const w0 = toWorld(x, y);
    const c = [selBox.cx, selBox.cy];
    active = {
      kind: 'transform',
      id: e.pointerId,
      type: e.pointerType,
      mode,
      w0,
      c,
      a0: Math.atan2(w0[1] - c[1], w0[0] - c[0]),
      d0: Math.max(1e-6, Math.hypot(w0[0] - c[0], w0[1] - c[1])),
      m: Mat.identity(),
    };
    live.transform = { ids: new Set(selection), m: active.m };
    invalidate();
  }

  function updateTransform(x, y) {
    const a = active;
    const [wx, wy] = toWorld(x, y);
    const [cx, cy] = a.c;
    if (a.mode === 'move') {
      a.m = Mat.translate(wx - a.w0[0], wy - a.w0[1]);
    } else if (a.mode === 'rotate') {
      let ang = Math.atan2(wy - cy, wx - cx) - a.a0;
      // 45° 단위 근처면 딱 맞춤
      const total = selBox.angle + ang;
      const snapped = Math.round(total / (Math.PI / 4)) * (Math.PI / 4);
      if (Math.abs(total - snapped) < 4 * Math.PI / 180) ang = snapped - selBox.angle;
      a.m = Mat.rotateAbout(ang, cx, cy);
    } else {
      const k = Math.max(0.05, Math.hypot(wx - cx, wy - cy) / a.d0);
      a.m = Mat.scaleAbout(k, cx, cy);
    }
    live.transform.m = a.m;
    invalidate();
  }

  function finishTransform() {
    const m = active.m;
    live.transform = null;
    const moved = Math.abs(m[4]) + Math.abs(m[5]) > 0.01 || Math.abs(m[0] - 1) > 1e-4 || Math.abs(m[1]) > 1e-4;
    if (!moved) { invalidate(); return; }
    applyTransform(m);
  }

  function applyTransform(m) {
    checkpoint();
    for (const id of selection) replaceNode(id, n => transformNode(n, m));
    const [cx, cy] = Mat.apply(m, selBox.cx, selBox.cy);
    const k = Math.hypot(m[0], m[1]);
    selBox = { cx, cy, hw: selBox.hw * k, hh: selBox.hh * k, angle: selBox.angle + Math.atan2(m[1], m[0]) };
    strokesChanged();
  }

  // ================= 선택한 것 다루기 =================
  function requireSelection() {
    if (selection.size) return true;
    toast('먼저 레이어를 선택하세요');
    return false;
  }

  function copySelection() {
    if (!requireSelection()) return;
    const nodes = selectedNodes().map(deepCopy);
    clipboard.unshift({ id: uid(), t: Date.now(), nodes });
    clipboard = clipboard.slice(0, 24);
    if (!storage.set(CLIP_KEY, clipboard)) toast('복사는 됐지만 저장 공간이 부족해요');
    else toast('복사했어요 · 붙여넣기 도구로 화면을 꾹 누르세요');
  }

  function deleteSelection() {
    if (!requireSelection()) return;
    checkpoint();
    removeNodes(selection);
    selection = new Set();
    selBox = null;
    strokesChanged();
  }

  function rotateSelection90() {
    if (!requireSelection()) return;
    if (!selBox) selBox = computeBox();
    applyTransform(Mat.rotateAbout(Math.PI / 2, selBox.cx, selBox.cy));
  }

  function groupSelection() {
    const nodes = selectedNodes();
    if (nodes.length < 2) { toast('두 개 이상 선택해야 묶을 수 있어요'); return; }
    checkpoint();
    const front = locate(nodes[nodes.length - 1].id);
    const g = { id: uid(), kind: 'group', name: '그룹 ' + board.nextGroup++, visible: true, children: [] };
    front.list.splice(front.index + 1, 0, g);
    for (const n of nodes) {
      const loc = locate(n.id);
      loc.list.splice(loc.index, 1);
    }
    g.children = nodes;
    removeNodes(new Set()); // 비어 버린 그룹 정리
    selection = new Set([g.id]);
    selBox = computeBox();
    strokesChanged();
  }

  function ungroupSelection() {
    const groups = selectedNodes().filter(n => n.kind === 'group');
    if (!groups.length) { toast('선택한 것 중에 그룹이 없어요'); return; }
    checkpoint();
    const next = [...selection].filter(id => !groups.some(g => g.id === id));
    for (const g of groups) {
      const loc = locate(g.id);
      const kids = g.visible ? g.children : g.children.map(c => (c.kind === 'group' ? Object.assign(c, { visible: false }) : { ...c, visible: false }));
      loc.list.splice(loc.index, 1, ...kids);
      next.push(...kids.map(k => k.id));
      expanded.delete(g.id);
    }
    selection = normalizeSelection(new Set(next));
    selBox = computeBox();
    strokesChanged();
  }

  // 앞/뒤 순서 바꾸기 (같은 그룹 안에서)
  function reorderSelection(dir) {
    if (!requireSelection()) return;
    const lists = new Set();
    for (const id of selection) {
      const loc = locate(id);
      if (loc) lists.add(loc.list);
    }
    const before = JSON.stringify(board.layers.map(function ids(n) { return n.kind === 'group' ? [n.id, n.children.map(ids)] : n.id; }));
    const snap = cloneTree(board.layers);
    const sel = n => selection.has(n.id);
    for (const list of lists) {
      if (dir === 'forward') {
        for (let i = list.length - 2; i >= 0; i--) {
          if (sel(list[i]) && !sel(list[i + 1])) [list[i], list[i + 1]] = [list[i + 1], list[i]];
        }
      } else if (dir === 'backward') {
        for (let i = 1; i < list.length; i++) {
          if (sel(list[i]) && !sel(list[i - 1])) [list[i], list[i - 1]] = [list[i - 1], list[i]];
        }
      } else {
        const picked = list.filter(sel), rest = list.filter(n => !sel(n));
        list.splice(0, list.length, ...(dir === 'front' ? [...rest, ...picked] : [...picked, ...rest]));
      }
    }
    const after = JSON.stringify(board.layers.map(function ids(n) { return n.kind === 'group' ? [n.id, n.children.map(ids)] : n.id; }));
    if (before === after) { toast(dir === 'forward' || dir === 'front' ? '이미 맨 앞이에요' : '이미 맨 뒤예요'); return; }
    pushUndo(snap);
    strokesChanged();
  }

  function toggleVisibility(id) {
    const loc = locate(id);
    if (!loc) return;
    checkpoint();
    if (loc.node.kind === 'group') loc.node.visible = !loc.node.visible;
    else loc.list[loc.index] = { ...loc.node, visible: !loc.node.visible };
    strokesChanged();
  }

  const ACTIONS = {
    copy: copySelection,
    rotate: rotateSelection90,
    group: groupSelection,
    ungroup: ungroupSelection,
    delete: deleteSelection,
    clear: () => setSelection([]),
    front: () => reorderSelection('front'),
    forward: () => reorderSelection('forward'),
    backward: () => reorderSelection('backward'),
    back: () => reorderSelection('back'),
  };

  for (const b of document.querySelectorAll('#selection-bar [data-act], #layer-actions [data-act]')) {
    b.addEventListener('click', () => { if (board && !active) ACTIONS[b.dataset.act](); });
  }

  function updateSelectionUI() {
    const bar = $('#selection-bar');
    const n = selection.size;
    bar.hidden = !n;
    if (n) {
      const nodes = selectedNodes();
      const hasGroup = nodes.some(x => x.kind === 'group');
      $('#selection-count').textContent = `${n}개 선택`;
      bar.querySelector('[data-act="group"]').disabled = n < 2;
      bar.querySelector('[data-act="ungroup"]').disabled = !hasGroup;
    }
    const la = $('#layer-actions');
    const nodes = n ? selectedNodes() : [];
    la.querySelector('[data-act="group"]').disabled = n < 2;
    la.querySelector('[data-act="ungroup"]').disabled = !nodes.some(x => x.kind === 'group');
    for (const act of ['front', 'forward', 'backward', 'back', 'delete']) la.querySelector(`[data-act="${act}"]`).disabled = !n;
  }

  // ================= 붙여넣기 =================
  function startPress(e, x, y) {
    const a = {
      kind: 'press',
      id: e.pointerId,
      type: e.pointerType,
      sx: x,
      sy: y,
      fired: false,
      timer: 0,
    };
    a.timer = setTimeout(() => {
      if (active !== a) return;
      a.fired = true;
      if (navigator.vibrate) navigator.vibrate(12);
      openPastePopup(a.sx, a.sy);
    }, 480);
    active = a;
  }

  function pressMove(x, y) {
    const a = active;
    if (a.fired) return;
    if (Math.hypot(x - a.sx, y - a.sy) > 8) {
      // 꾹 누르기가 아니라 끌기 → 화면 이동
      clearTimeout(a.timer);
      active = null;
      startPan(a.id, a.sx, a.sy);
      board.view.x += x - a.sx;
      board.view.y += y - a.sy;
      panning.vx = board.view.x - (x - a.sx);
      panning.vy = board.view.y - (y - a.sy);
      viewChanged();
    }
  }

  function finishPress() {
    clearTimeout(active.timer);
    if (!active.fired) toast('화면을 꾹 누르면 복사한 것을 붙여넣을 수 있어요');
  }

  const pastePopup = $('#paste-popup');
  let pasteAt = null;

  function openPastePopup(sx, sy) {
    if (!clipboard.length) {
      toast('복사한 것이 없어요 · 영역 선택 도구로 고른 뒤 복사하세요');
      return;
    }
    pasteAt = toWorld(sx, sy);
    const list = $('#paste-list');
    list.innerHTML = '';
    for (const clip of clipboard) {
      const item = document.createElement('div');
      item.className = 'paste-item';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'paste-pick';
      btn.appendChild(clipThumb(clip));
      const count = countNodes(clip.nodes);
      const label = document.createElement('span');
      label.textContent = `선 ${count}개`;
      btn.appendChild(label);
      btn.addEventListener('click', () => pasteClip(clip));
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'paste-del';
      del.title = '목록에서 지우기';
      del.innerHTML = ICONS.x;
      del.addEventListener('click', () => {
        clipboard = clipboard.filter(c => c !== clip);
        storage.set(CLIP_KEY, clipboard);
        item.remove();
        if (!clipboard.length) closePastePopup();
      });
      item.append(btn, del);
      list.appendChild(item);
    }
    pastePopup.hidden = false;
    const pw = pastePopup.offsetWidth, ph = pastePopup.offsetHeight;
    pastePopup.style.left = clamp(sx - pw / 2, 8, cw - pw - 8) + 'px';
    pastePopup.style.top = clamp(sy + 16, 8, ch - ph - 8) + 'px';
  }

  function closePastePopup() {
    pastePopup.hidden = true;
  }

  function pasteClip(clip) {
    const nodes = clip.nodes.map(n => withNewIds(deepCopy(n)));
    const [x0, y0, x1, y1] = nodesBBox(nodes);
    const m = Mat.translate(round1(pasteAt[0] - (x0 + x1) / 2), round1(pasteAt[1] - (y0 + y1) / 2));
    const placed = nodes.map(n => transformNode(n, m));
    checkpoint();
    board.layers.push(...placed);
    selection = new Set(placed.map(n => n.id));
    selBox = computeBox();
    closePastePopup();
    strokesChanged();
  }

  function clipThumb(clip) {
    const W = 84, H = 64, k = 2;
    const c = document.createElement('canvas');
    c.className = 'paste-thumb';
    c.width = W * k;
    c.height = H * k;
    fitAndDraw(c, clip.nodes, 6 * k);
    return c;
  }

  // 노드들을 캔버스 크기에 맞춰 그림 (썸네일)
  function fitAndDraw(c, nodes, pad, frame) {
    const x = c.getContext('2d');
    let [x0, y0, x1, y1] = nodesBBox(nodes);
    if (!isFinite(x0)) return;
    if (frame) {
      x0 = Math.min(x0, frame[0]); y0 = Math.min(y0, frame[1]);
      x1 = Math.max(x1, frame[2]); y1 = Math.max(y1, frame[3]);
    }
    const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
    const scale = Math.min((c.width - pad * 2) / bw, (c.height - pad * 2) / bh);
    const ox = (c.width - bw * scale) / 2 - x0 * scale;
    const oy = (c.height - bh * scale) / 2 - y0 * scale;
    if (frame) {
      x.fillStyle = PAGE_BG;
      x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#fff';
      x.fillRect(ox + frame[0] * scale, oy + frame[1] * scale, (frame[2] - frame[0]) * scale, (frame[3] - frame[1]) * scale);
    }
    x.setTransform(scale, 0, 0, scale, ox, oy);
    // 썸네일이 작아도 선이 보이도록 최소 굵기 보장
    const minSize = 1.6 / scale;
    const thicken = list => list.map(n => n.kind === 'group'
      ? { ...n, children: thicken(n.children) }
      : (n.size < minSize ? { ...n, size: minSize } : n));
    drawNodes(x, thicken(nodes), null);
  }

  // ================= 실행 취소 (보드별 스냅샷) =================
  function history() {
    let h = histories.get(board.id);
    if (!h) { h = { undo: [], redo: [] }; histories.set(board.id, h); }
    return h;
  }

  function pushUndo(snap) {
    const h = history();
    h.undo.push(snap);
    if (h.undo.length > 200) h.undo.shift();
    h.redo.length = 0;
    updateHistoryButtons();
  }

  function checkpoint() {
    pushUndo(cloneTree(board.layers));
  }

  function restore(from, to) {
    if (active) return;
    const h = history();
    const snap = h[from].pop();
    if (!snap) return;
    h[to].push(cloneTree(board.layers));
    board.layers = cloneTree(snap);
    selection = normalizeSelection(selection);
    selBox = computeBox();
    updateHistoryButtons();
    strokesChanged();
  }

  const undo = () => restore('undo', 'redo');
  const redo = () => restore('redo', 'undo');

  function updateHistoryButtons() {
    const h = history();
    $('#btn-undo').disabled = h.undo.length === 0;
    $('#btn-redo').disabled = h.redo.length === 0;
  }

  $('#btn-undo').addEventListener('click', undo);
  $('#btn-redo').addEventListener('click', redo);

  function strokesChanged() {
    if (!selection.size) selBox = null;
    invalidate();
    renderLayers();
    updateSelectionUI();
    markChanged();
  }

  // ================= 레이어 패널 =================
  const layersPanel = $('#layers');
  const layerList = $('#layer-list');

  $('#btn-layers').addEventListener('click', () => {
    layersOpen = !layersOpen;
    layersPanel.hidden = !layersOpen;
    $('#btn-layers').setAttribute('aria-pressed', String(layersOpen));
    renderLayers();
  });

  function renderLayers() {
    if (!layersOpen || !board) return;
    const total = countNodes(board.layers);
    $('#layer-count').textContent = total ? `선 ${total}개` : '';
    $('#layers-empty').hidden = board.layers.length > 0;
    $('#layer-hint').hidden = board.layers.length === 0;
    layerList.innerHTML = '';
    const walk = (list, depth, hiddenParent) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const n = list[i];
        layerList.appendChild(layerRow(n, depth, hiddenParent));
        if (n.kind === 'group' && expanded.has(n.id)) walk(n.children, depth + 1, hiddenParent || !n.visible);
      }
    };
    walk(board.layers, 0, false);
  }

  function toggleLayerSelection(id) {
    const next = new Set(selection);
    if (next.has(id)) {
      next.delete(id);
    } else {
      // 조상이나 자손이 이미 선택돼 있으면 그걸 빼고 이것만
      const path = pathTo(id);
      for (const g of path.slice(0, -1)) next.delete(g.id);
      const node = path[path.length - 1];
      if (node.kind === 'group') {
        const kids = new Set();
        (function walk(l) { for (const c of l) { kids.add(c.id); if (c.kind === 'group') walk(c.children); } })(node.children);
        for (const k of kids) next.delete(k);
      }
      next.add(id);
    }
    setSelection(next);
  }

  function layerRow(n, depth, hiddenParent) {
    const li = document.createElement('li');
    const isGroup = n.kind === 'group';
    li.className = 'layer' + (isGroup ? ' group' : '') + (selection.has(n.id) ? ' selected' : '') +
      (n.visible && !hiddenParent ? '' : ' hidden-layer');
    li.style.paddingLeft = (6 + depth * 18) + 'px';

    const caret = document.createElement('button');
    caret.type = 'button';
    caret.className = 'caret' + (expanded.has(n.id) ? ' open' : '');
    if (isGroup) {
      caret.innerHTML = ICONS.caret;
      caret.title = expanded.has(n.id) ? '접기' : '펼치기';
      caret.addEventListener('click', e => {
        e.stopPropagation();
        if (expanded.has(n.id)) expanded.delete(n.id); else expanded.add(n.id);
        renderLayers();
      });
    } else {
      caret.disabled = true;
      caret.tabIndex = -1;
    }

    const info = document.createElement('div');
    info.className = 'layer-info';
    const name = document.createElement('div');
    name.className = 'layer-name';
    name.textContent = n.name;
    const meta = document.createElement('div');
    meta.className = 'layer-meta';
    if (isGroup) {
      meta.innerHTML = ICONS.folder;
      meta.append(`선 ${countNodes(n.children)}개`);
    } else {
      const dot = document.createElement('span');
      dot.className = 'layer-color';
      dot.style.background = n.color;
      const label = document.createElement('span');
      label.textContent = `${(PEN[n.pen] || PEN.basic).label} · ${Math.round(n.size)}px${n.erase ? ' · 지움' : ''}`;
      meta.append(dot, label);
    }
    info.append(name, meta);

    const eye = document.createElement('button');
    eye.type = 'button';
    eye.className = 'icon-btn';
    eye.title = n.visible ? '숨기기' : '보이기';
    eye.innerHTML = n.visible ? ICONS.eye : ICONS.eyeOff;
    eye.addEventListener('click', e => { e.stopPropagation(); toggleVisibility(n.id); });

    li.append(caret, layerThumb(n), info, eye);
    li.addEventListener('click', () => toggleLayerSelection(n.id));
    return li;
  }

  function layerThumb(n) {
    let c = n.kind === 'stroke' ? thumbCache.get(n) : null;
    if (c) return c;
    const W = 48, H = 36, k = 2;
    c = document.createElement('canvas');
    c.className = 'layer-thumb';
    c.width = W * k;
    c.height = H * k;
    const frame = board.type === 'main' ? [0, 0, project.width, project.height] : null;
    fitAndDraw(c, [{ ...n, visible: true }], 3 * k, frame);
    if (n.kind === 'stroke') thumbCache.set(n, c);
    return c;
  }

  // ================= 도구 막대 =================
  const SWATCHES = ['#1b1b1f', '#ffffff', '#e5484d', '#f5a524', '#30a46c', '#0090ff', '#4f5bd5', '#8e4ec6'];
  const swatchBox = $('#swatches');
  const contextBar = $('#context-bar');

  for (const color of SWATCHES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.background = color;
    b.dataset.color = color;
    b.title = color;
    b.addEventListener('click', () => { tool.color = color; syncToolUI(); });
    swatchBox.appendChild(b);
  }

  for (const b of document.querySelectorAll('#toolbar .tool')) {
    b.addEventListener('click', () => setTool(b.dataset.tool));
  }

  function setTool(t) {
    if (!TOOLS[t] || active) return;
    tool.current = t;
    closePopups();
    syncToolUI();
    requestRender();
  }

  $('#color-input').addEventListener('input', e => { tool.color = e.target.value; syncToolUI(); });
  $('#size-input').addEventListener('input', e => {
    const v = Number(e.target.value);
    if (tool.current === 'eraser') tool.eraserSize = v;
    else tool.penSizes[tool.pen] = v;
    syncToolUI(false);
    requestRender();
  });

  function currentSize() {
    return tool.current === 'eraser' ? tool.eraserSize : tool.penSizes[tool.pen];
  }

  function syncToolUI(rebuildContext = true) {
    const t = tool.current;
    for (const b of document.querySelectorAll('#toolbar .tool')) b.classList.toggle('active', b.dataset.tool === t);
    const drawing = t === 'pen' || t === 'magic';
    const sized = drawing || t === 'eraser';
    $('#color-group').hidden = !drawing;
    $('#sep-color').hidden = !drawing;
    $('#size-group').hidden = !sized;
    $('#sep-size').hidden = !sized;
    for (const b of swatchBox.children) b.classList.toggle('active', b.dataset.color.toLowerCase() === tool.color.toLowerCase());
    $('#color-input').value = tool.color;
    document.documentElement.style.setProperty('--current', t === 'eraser' ? '#9a9aa6' : tool.color);
    const size = currentSize();
    $('#size-input').value = size;
    $('#size-value').textContent = size;
    $('#size-dot').style.setProperty('--dot', clamp(size, 2, 32) + 'px');
    stage.dataset.tool = t;
    if (rebuildContext) buildContextBar();
    else updatePenPreviews();
    updateSelectionUI();
    storage.set(TOOL_KEY, tool);
  }

  function chip(label, activeNow, onClick, extra) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (activeNow ? ' active' : '');
    if (extra) b.appendChild(extra);
    const s = document.createElement('span');
    s.textContent = label;
    b.appendChild(s);
    b.addEventListener('click', onClick);
    return b;
  }

  function hint(text) {
    const p = document.createElement('span');
    p.className = 'ctx-hint';
    p.textContent = text;
    return p;
  }

  function penPreview(penId) {
    const c = document.createElement('canvas');
    c.className = 'pen-preview';
    c.dataset.pen = penId;
    c.width = 88;
    c.height = 36;
    drawPenPreview(c);
    return c;
  }

  function drawPenPreview(c) {
    const penId = c.dataset.pen;
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    const pts = [], w = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      pts.push(8 + t * 72, 18 + Math.sin(t * Math.PI * 2) * 8);
      w.push(0.35 + 0.65 * Math.sin(t * Math.PI));
    }
    const size = Math.min(PEN[penId].size, 12) * (penId === 'pencil' ? 0.8 : 0.7);
    const s = { pen: penId, color: tool.color, size, points: pts, w: penId === 'brush' ? w : undefined };
    drawStroke(x, s);
  }

  function updatePenPreviews() {
    for (const c of contextBar.querySelectorAll('.pen-preview')) drawPenPreview(c);
  }

  function buildContextBar() {
    contextBar.innerHTML = '';
    const t = tool.current;
    const title = document.createElement('span');
    title.className = 'ctx-title';
    title.textContent = TOOLS[t];
    contextBar.appendChild(title);

    if (t === 'pen' || t === 'magic') {
      for (const p of PENS) {
        contextBar.appendChild(chip(p.label, tool.pen === p.id, () => { tool.pen = p.id; syncToolUI(); }, penPreview(p.id)));
      }
      if (t === 'magic') contextBar.appendChild(hint('그은 뒤 멈추고 꾹 누르고 있으면 원·타원·직선·곡선 등으로 바뀌어요'));
    } else if (t === 'eraser') {
      contextBar.appendChild(chip('레이어 지우개', tool.eraserMode === 'layer', () => { tool.eraserMode = 'layer'; syncToolUI(); }));
      contextBar.appendChild(chip('영역 지우개', tool.eraserMode === 'area', () => { tool.eraserMode = 'area'; syncToolUI(); }));
      contextBar.appendChild(hint(tool.eraserMode === 'layer'
        ? '닿은 선(레이어)을 통째로 지워요'
        : '문지른 부분만 투명하게 지워요 (흰색으로 칠하는 게 아니에요)'));
    } else if (t === 'select') {
      contextBar.appendChild(chip('올가미', tool.selectMode === 'lasso', () => { tool.selectMode = 'lasso'; syncToolUI(); }));
      contextBar.appendChild(chip('사각형', tool.selectMode === 'rect', () => { tool.selectMode = 'rect'; syncToolUI(); }));
      contextBar.appendChild(hint('영역에 걸친 레이어가 잡혀요 · 상자를 끌어 이동, ↻ 로 회전, 모서리로 크기'));
    } else if (t === 'paste') {
      contextBar.appendChild(hint('화면을 꾹 누르면 복사한 목록이 나와요'));
    }
  }

  // ================= 이미지 다운로드 =================
  const downloadMenu = $('#download-menu');
  $('#btn-download').addEventListener('click', e => {
    e.stopPropagation();
    downloadMenu.hidden = !downloadMenu.hidden;
  });
  for (const b of downloadMenu.querySelectorAll('[data-bg]')) {
    b.addEventListener('click', () => { downloadMenu.hidden = true; exportPNG(b.dataset.bg === 'transparent'); });
  }
  document.addEventListener('pointerdown', e => {
    if (!downloadMenu.hidden && !e.target.closest('.menu-wrap')) downloadMenu.hidden = true;
    if (!pastePopup.hidden && !e.target.closest('#paste-popup') && e.target !== canvas) closePastePopup();
  });

  function closePopups() {
    downloadMenu.hidden = true;
    closePastePopup();
  }

  // 기본 캔버스 영역 안에 그려진 부분만 저장 (밖으로 나간 선은 잘림)
  function exportPNG(transparent) {
    if (!project) return;
    const main = project.boards[0];
    const c = document.createElement('canvas');
    c.width = project.width;
    c.height = project.height;
    const x = c.getContext('2d');
    if (!transparent) {
      x.fillStyle = '#fff';
      x.fillRect(0, 0, c.width, c.height);
    }
    drawNodes(x, main.layers, null);
    const fileName = (project.name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'drawing') + '.png';
    c.toBlob(blob => {
      if (!blob) { toast('이미지를 만들지 못했어요'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast(`${fileName} 저장됨 (${project.width} × ${project.height}${transparent ? ', 투명 배경' : ''})`);
    }, 'image/png');
  }

  // ================= 키보드 =================
  window.addEventListener('keydown', e => {
    if (!project || editor.hidden) return;
    if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && key === 'y') { e.preventDefault(); redo(); }
    else if (mod && key === 'c') { e.preventDefault(); copySelection(); }
    else if (mod && key === 'g') { e.preventDefault(); e.shiftKey ? ungroupSelection() : groupSelection(); }
    else if (mod && key === 'v') {
      e.preventDefault();
      if (clipboard.length) { pasteAt = toWorld(cw / 2, ch / 2); pasteClip(clipboard[0]); }
    }
    else if (mod) return;
    else if (e.code === 'Space' && !e.repeat) { spaceDown = true; stage.classList.add('panning'); e.preventDefault(); }
    else if (key === 'escape') { closePopups(); if (selection.size) setSelection([]); }
    else if ((key === 'delete' || key === 'backspace') && selection.size) { e.preventDefault(); deleteSelection(); }
    else if (!e.repeat && { p: 1, m: 1, e: 1, s: 1, v: 1 }[key]) {
      setTool({ p: 'pen', m: 'magic', e: 'eraser', s: 'select', v: 'paste' }[key]);
    }
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Space') { spaceDown = false; stage.classList.remove('panning'); }
  });

  // ================= 토스트 =================
  let toastTimer = 0;
  function toast(msg, ms = 2400) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  // ================= 시작 =================
  showScreen('home');
  renderHome();
})();

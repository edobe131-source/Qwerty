(() => {
  'use strict';

  // ================= 저장소 =================
  const INDEX_KEY = 'qwerty.projects';
  const TOOL_KEY = 'qwerty.tool';
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
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const $ = sel => document.querySelector(sel);

  const ICONS = {
    x: '<svg class="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    plus: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    trash: '<svg class="ico" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    eye: '<svg class="ico" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg class="ico" viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
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
      name,
      width: size[0],
      height: size[1],
      createdAt: now,
      updatedAt: now,
      auxCounter: 0,
      boards: [{ id: 'main', type: 'main', name: '기본 캔버스', strokes: [], nextNum: 1, view: null }],
    };
    if (!storage.set(projectKey(p.id), p)) { toast('저장 공간이 부족해 프로젝트를 만들 수 없어요'); return; }
    writeIndex(p, null);
    closeNewDialog();
    openProject(p.id);
  });

  // ================= 작업 화면 상태 =================
  const stage = $('#stage');
  const canvas = $('#board');
  const ctx = canvas.getContext('2d');
  const cache = document.createElement('canvas');
  const cctx = cache.getContext('2d');

  const PAGE_BG = '#e4e4e9';
  const AUX_BG = '#f7f7f4';
  const MIN_ZOOM = 0.02;
  const MAX_ZOOM = 40;

  const tool = Object.assign({ color: '#1b1b1f', size: 8 }, storage.get(TOOL_KEY, {}));

  let project = null;
  let board = null;
  let dpr = 1, cw = 0, ch = 0;
  let cacheDirty = true;
  let rafId = 0;
  let selectedId = null;
  let penSeen = false;
  let layersOpen = false;
  let histories = new Map();

  // 저장하지 않는 런타임 캐시
  const bboxCache = new WeakMap();
  const thumbCache = new WeakMap();

  // ================= 프로젝트 열기/저장 =================
  function openProject(id) {
    const data = storage.get(projectKey(id), null);
    if (!data) { toast('프로젝트를 불러오지 못했어요'); renderHome(); return; }
    project = data;
    histories = new Map();
    selectedId = null;
    showScreen('editor');
    $('#project-name').textContent = project.name;
    resize();
    setBoard(project.boards[0]);
  }

  function closeProject() {
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
    for (const s of main.strokes) if (s.visible) drawStroke(x, s);
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
    board = b;
    selectedId = null;
    cancelInteractions();
    if (!board.view) board.view = defaultView(board);
    cacheDirty = true;
    renderTabs();
    renderLayers();
    updateHistoryButtons();
    updateZoomLabel();
    $('#board-badge').textContent = board.type === 'main'
      ? `기본 캔버스 · ${project.width} × ${project.height}`
      : '보조 캔버스 · 무한';
    requestRender();
  }

  function defaultView(b) {
    if (b.type === 'main') {
      const m = Math.min(48, Math.min(cw, ch) * 0.08);
      const s = clamp(Math.min((cw - m * 2) / project.width, (ch - m * 2) / project.height), MIN_ZOOM, MAX_ZOOM);
      return { x: (cw - project.width * s) / 2, y: (ch - project.height * s) / 2, s };
    }
    return { x: cw / 2, y: ch / 2, s: 1 };
  }

  function addAuxBoard() {
    project.auxCounter = (project.auxCounter || 0) + 1;
    const b = { id: uid(), type: 'aux', name: '보조 캔버스 ' + project.auxCounter, strokes: [], nextNum: 1, view: null };
    project.boards.push(b);
    markChanged();
    setBoard(b);
  }

  function removeAuxBoard(b) {
    if (b.strokes.length && !confirm(`'${b.name}'을(를) 삭제할까요? 그린 선도 함께 사라져요.`)) return;
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
    add.innerHTML = ICONS.plus.replace('class="ico"', 'class="ico" style="width:16px;height:16px"') + '<span>보조 캔버스</span>';
    add.addEventListener('click', addAuxBoard);
    tabs.appendChild(add);
    tabs.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ================= 렌더링 =================
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
    // 화면 크기가 바뀌어도 중심이 유지되게
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
    if (drawing) {
      applyView(ctx);
      drawStroke(ctx, drawing.stroke);
    }
  }

  function drawScene(c) {
    const v = board.view;
    c.setTransform(1, 0, 0, 1, 0, 0);

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

    for (const s of board.strokes) if (s.visible) drawStroke(c, s);

    if (board.type === 'main') {
      // 선이 캔버스 밖으로 나가도 경계가 보이도록 테두리를 위에 한 번 더 그림
      c.strokeStyle = 'rgba(20, 20, 40, .22)';
      c.lineWidth = 1 / v.s;
      c.strokeRect(0, 0, project.width, project.height);
    }

    const sel = selectedId && board.strokes.find(s => s.id === selectedId);
    if (sel) {
      const [x0, y0, x1, y1] = strokeBBox(sel);
      const pad = 6 / v.s;
      c.save();
      c.strokeStyle = '#4f5bd5';
      c.lineWidth = 1.5 / v.s;
      c.setLineDash([6 / v.s, 4 / v.s]);
      c.strokeRect(x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2);
      c.restore();
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
    // 원점 표시
    const px = v.x * dpr, py = v.y * dpr;
    c.strokeStyle = 'rgba(79, 91, 213, .35)';
    c.lineWidth = Math.max(1, dpr);
    c.beginPath();
    c.moveTo(px - 8 * dpr, py); c.lineTo(px + 8 * dpr, py);
    c.moveTo(px, py - 8 * dpr); c.lineTo(px, py + 8 * dpr);
    c.stroke();
  }

  function drawStroke(c, s) {
    const p = s.points;
    const n = p.length / 2;
    if (n === 0) return;
    c.fillStyle = s.color;
    if (n === 1) {
      c.beginPath();
      c.arc(p[0], p[1], s.size / 2, 0, Math.PI * 2);
      c.fill();
      return;
    }
    c.strokeStyle = s.color;
    c.lineWidth = s.size;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(p[0], p[1]);
    if (n === 2) {
      c.lineTo(p[2], p[3]);
    } else {
      // 중점을 잇는 2차 곡선으로 부드럽게
      for (let i = 1; i < n - 1; i++) {
        const x = p[i * 2], y = p[i * 2 + 1];
        const nx = p[i * 2 + 2], ny = p[i * 2 + 3];
        c.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
      }
      c.lineTo(p[p.length - 2], p[p.length - 1]);
    }
    c.stroke();
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
    const h = s.size / 2;
    bb = [x0 - h, y0 - h, x1 + h, y1 + h];
    bboxCache.set(s, bb);
    return bb;
  }

  // ================= 화면 이동/확대 =================
  function toWorld(sx, sy) {
    const v = board.view;
    return [(sx - v.x) / v.s, (sy - v.y) / v.s];
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
  // 펜: 그리기 / 손가락: 펜을 쓰기 전엔 한 손가락 그리기, 펜을 쓴 뒤엔 한 손가락 이동
  // 두 손가락: 이동 + 확대/축소 / 마우스: 왼쪽 그리기, 가운데·오른쪽·스페이스+드래그 이동
  const touches = new Map();
  let drawing = null;
  let panning = null;
  let gesture = null;
  let spaceDown = false;
  let canvasRect = null;

  function localPoint(e) {
    return [e.clientX - canvasRect.left, e.clientY - canvasRect.top];
  }

  function cancelInteractions() {
    drawing = null;
    panning = null;
    gesture = null;
    touches.clear();
    stage.classList.remove('dragging');
  }

  canvas.addEventListener('pointerdown', e => {
    if (!board) return;
    e.preventDefault();
    canvasRect = canvas.getBoundingClientRect();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    const [x, y] = localPoint(e);

    if (e.pointerType === 'pen') penSeen = true;

    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x, y });
      if (touches.size === 2) {
        // 두 번째 손가락: 그리던 선은 취소하고 제스처로 전환
        if (drawing && drawing.type === 'touch') drawing = null;
        panning = null;
        startGesture();
        requestRender();
        return;
      }
      if (touches.size > 2 || drawing || gesture) return;
      if (penSeen) { startPan(e.pointerId, x, y); return; }
      startDrawing(e, x, y);
      return;
    }

    if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2 || spaceDown)) {
      startPan(e.pointerId, x, y);
      return;
    }
    if (e.button !== 0 || drawing) return;
    startDrawing(e, x, y);
  });

  canvas.addEventListener('pointermove', e => {
    if (!board || !canvasRect) return;
    const id = e.pointerId;
    if (e.pointerType === 'touch' && touches.has(id)) touches.set(id, pointFrom(e));

    if (gesture && touches.has(id)) { updateGesture(); return; }

    if (panning && panning.id === id) {
      const [x, y] = localPoint(e);
      board.view.x = panning.vx + (x - panning.sx);
      board.view.y = panning.vy + (y - panning.sy);
      viewChanged();
      return;
    }

    if (drawing && drawing.id === id) {
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ev of events.length ? events : [e]) addPoint(...localPoint(ev));
      requestRender();
    }
  });

  function pointFrom(e) {
    const [x, y] = localPoint(e);
    return { x, y };
  }

  function endPointer(e) {
    const id = e.pointerId;
    touches.delete(id);
    if (gesture && touches.size < 2) gesture = null;
    if (panning && panning.id === id) {
      panning = null;
      stage.classList.remove('dragging');
    }
    if (drawing && drawing.id === id) {
      if (e.type === 'pointercancel' && drawing.type === 'touch') {
        drawing = null;
        requestRender();
      } else {
        finishDrawing();
      }
    }
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());

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

  // ================= 그리기 =================
  function startDrawing(e, x, y) {
    const [wx, wy] = toWorld(x, y);
    drawing = {
      id: e.pointerId,
      type: e.pointerType,
      lastX: x,
      lastY: y,
      stroke: { id: uid(), name: '', color: tool.color, size: tool.size, visible: true, points: [round1(wx), round1(wy)] },
    };
    requestRender();
  }

  function addPoint(x, y) {
    const dx = x - drawing.lastX, dy = y - drawing.lastY;
    if (dx * dx + dy * dy < 1) return;
    drawing.lastX = x;
    drawing.lastY = y;
    const [wx, wy] = toWorld(x, y);
    drawing.stroke.points.push(round1(wx), round1(wy));
  }

  function finishDrawing() {
    const s = drawing.stroke;
    drawing = null;
    s.name = '선 ' + board.nextNum++;
    board.strokes.push(s);
    record({ type: 'add', stroke: s, index: board.strokes.length - 1 });
    strokesChanged();
  }

  function strokesChanged() {
    invalidate();
    renderLayers();
    markChanged();
  }

  // ================= 실행 취소 =================
  function history() {
    let h = histories.get(board.id);
    if (!h) { h = { undo: [], redo: [] }; histories.set(board.id, h); }
    return h;
  }

  function record(action) {
    const h = history();
    h.undo.push(action);
    if (h.undo.length > 300) h.undo.shift();
    h.redo.length = 0;
    updateHistoryButtons();
  }

  function applyAction(a, reverse) {
    const list = board.strokes;
    const add = (a.type === 'add') !== reverse;
    if (a.type === 'toggle') {
      a.stroke.visible = !a.stroke.visible;
    } else if (add) {
      list.splice(Math.min(a.index, list.length), 0, a.stroke);
    } else {
      const i = list.indexOf(a.stroke);
      if (i >= 0) list.splice(i, 1);
      if (selectedId === a.stroke.id) selectedId = null;
    }
  }

  function undo() {
    if (drawing) return;
    const h = history();
    const a = h.undo.pop();
    if (!a) return;
    applyAction(a, true);
    h.redo.push(a);
    updateHistoryButtons();
    strokesChanged();
  }

  function redo() {
    if (drawing) return;
    const h = history();
    const a = h.redo.pop();
    if (!a) return;
    applyAction(a, false);
    h.undo.push(a);
    updateHistoryButtons();
    strokesChanged();
  }

  function updateHistoryButtons() {
    const h = history();
    $('#btn-undo').disabled = h.undo.length === 0;
    $('#btn-redo').disabled = h.redo.length === 0;
  }

  $('#btn-undo').addEventListener('click', undo);
  $('#btn-redo').addEventListener('click', redo);

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
    const strokes = board.strokes;
    $('#layer-count').textContent = strokes.length ? `${strokes.length}개` : '';
    $('#layers-empty').hidden = strokes.length > 0;
    layerList.innerHTML = '';
    for (let i = strokes.length - 1; i >= 0; i--) layerList.appendChild(layerRow(strokes[i]));
  }

  function layerRow(s) {
    const li = document.createElement('li');
    li.className = 'layer' + (s.id === selectedId ? ' selected' : '') + (s.visible ? '' : ' hidden-layer');

    const info = document.createElement('div');
    info.className = 'layer-info';
    const name = document.createElement('div');
    name.className = 'layer-name';
    name.textContent = s.name;
    const meta = document.createElement('div');
    meta.className = 'layer-meta';
    const dot = document.createElement('span');
    dot.className = 'layer-color';
    dot.style.background = s.color;
    const size = document.createElement('span');
    size.textContent = `${s.size}px`;
    meta.append(dot, size);
    info.append(name, meta);

    const eye = document.createElement('button');
    eye.type = 'button';
    eye.className = 'icon-btn';
    eye.title = s.visible ? '숨기기' : '보이기';
    eye.innerHTML = s.visible ? ICONS.eye : ICONS.eyeOff;
    eye.addEventListener('click', e => {
      e.stopPropagation();
      s.visible = !s.visible;
      record({ type: 'toggle', stroke: s });
      strokesChanged();
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'icon-btn del';
    del.title = '삭제';
    del.innerHTML = ICONS.trash;
    del.addEventListener('click', e => {
      e.stopPropagation();
      const index = board.strokes.indexOf(s);
      if (index < 0) return;
      board.strokes.splice(index, 1);
      if (selectedId === s.id) selectedId = null;
      record({ type: 'remove', stroke: s, index });
      strokesChanged();
    });

    li.append(layerThumb(s), info, eye, del);
    li.addEventListener('click', () => {
      selectedId = selectedId === s.id ? null : s.id;
      invalidate();
      renderLayers();
    });
    return li;
  }

  function layerThumb(s) {
    let c = thumbCache.get(s);
    if (c) return c;
    const W = 56, H = 42, k = 2;
    c = document.createElement('canvas');
    c.className = 'layer-thumb';
    c.width = W * k;
    c.height = H * k;
    const x = c.getContext('2d');

    let [x0, y0, x1, y1] = strokeBBox(s);
    const isMain = board.type === 'main';
    if (isMain) {
      // 기본 캔버스는 페이지 전체 안에서 선의 위치를 보여줌
      x0 = Math.min(x0, 0); y0 = Math.min(y0, 0);
      x1 = Math.max(x1, project.width); y1 = Math.max(y1, project.height);
    }
    const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
    const pad = 4 * k;
    const scale = Math.min((c.width - pad * 2) / bw, (c.height - pad * 2) / bh);
    const ox = (c.width - bw * scale) / 2 - x0 * scale;
    const oy = (c.height - bh * scale) / 2 - y0 * scale;

    if (isMain) {
      x.fillStyle = PAGE_BG;
      x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#fff';
      x.fillRect(ox, oy, project.width * scale, project.height * scale);
    }
    x.setTransform(scale, 0, 0, scale, ox, oy);
    // 썸네일이 작아도 선이 보이도록 최소 굵기 보장
    drawStroke(x, { ...s, size: Math.max(s.size, 1.5 * k / scale) });
    thumbCache.set(s, c);
    return c;
  }

  // ================= 펜 도구 =================
  const SWATCHES = ['#1b1b1f', '#ffffff', '#e5484d', '#f5a524', '#30a46c', '#0090ff', '#4f5bd5', '#8e4ec6'];
  const swatchBox = $('#swatches');

  function buildSwatches() {
    swatchBox.innerHTML = '';
    for (const color of SWATCHES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.background = color;
      b.dataset.color = color;
      b.title = color;
      b.addEventListener('click', () => setColor(color));
      swatchBox.appendChild(b);
    }
  }

  function setColor(color) {
    tool.color = color;
    $('#color-input').value = color;
    syncTool();
  }

  function syncTool() {
    for (const b of swatchBox.children) b.classList.toggle('active', b.dataset.color.toLowerCase() === tool.color.toLowerCase());
    document.documentElement.style.setProperty('--current', tool.color);
    $('#size-input').value = tool.size;
    $('#size-value').textContent = tool.size;
    $('#size-dot').style.setProperty('--dot', clamp(tool.size, 2, 32) + 'px');
    storage.set(TOOL_KEY, tool);
  }

  $('#color-input').addEventListener('input', e => { tool.color = e.target.value; syncTool(); });
  $('#size-input').addEventListener('input', e => { tool.size = Number(e.target.value); syncTool(); });
  buildSwatches();
  $('#color-input').value = tool.color;
  syncTool();

  // ================= 이미지 다운로드 =================
  // 기본 캔버스 영역 안에 그려진 부분만 저장 (밖으로 나간 선은 잘림)
  $('#btn-download').addEventListener('click', () => {
    if (!project) return;
    const main = project.boards[0];
    const c = document.createElement('canvas');
    c.width = project.width;
    c.height = project.height;
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    for (const s of main.strokes) if (s.visible) drawStroke(x, s);
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
      toast(`${fileName} 저장됨 (${project.width} × ${project.height})`);
    }, 'image/png');
  });

  // ================= 키보드 =================
  window.addEventListener('keydown', e => {
    if (!project || editor.hidden) return;
    if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (e.code === 'Space' && !e.repeat) { spaceDown = true; stage.classList.add('panning'); e.preventDefault(); }
    else if (e.key === 'Escape' && selectedId) { selectedId = null; invalidate(); renderLayers(); }
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Space') { spaceDown = false; stage.classList.remove('panning'); }
  });

  // ================= 토스트 =================
  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
  }

  // ================= 시작 =================
  showScreen('home');
  renderHome();
})();

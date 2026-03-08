/* ═══════════════════════════════════════════════════════════
   FILE NEST – app.js  (v3 – robust context menu)
═══════════════════════════════════════════════════════════ */
'use strict';

/* ── Constants ──────────────────────────────────────────── */
const FOLDER_TYPES = [
  { key: 'photos', label: 'Photos', icon: '📷', accept: 'image/*' },
  { key: 'videos', label: 'Videos', icon: '🎬', accept: 'video/*' },
  { key: 'documents', label: 'Documents', icon: '📄', accept: '.doc,.docx,.txt,.odt' },
  { key: 'pdfs', label: 'PDFs', icon: '📑', accept: '.pdf' },
  { key: 'certificates', label: 'Certificates', icon: '🏅', accept: 'image/*,.pdf' },
  { key: 'audio', label: 'Audio', icon: '🎵', accept: 'audio/*' },
  { key: 'spreadsheets', label: 'Spreadsheets', icon: '📊', accept: '.xls,.xlsx,.csv,.ods' },
  { key: 'archives', label: 'Archives', icon: '🗜️', accept: '.zip,.rar,.7z,.tar,.gz' },
  { key: 'private', label: 'Private', icon: '🔒', accept: '*' },
  { key: 'other', label: 'Other', icon: '📁', accept: '*' },
];
const FOLDER_EMOJIS = ['📁', '🗂️', '📂', '🏅', '📷', '🎬', '📄', '📑', '🎵', '📊', '🔒', '🗃️', '💼', '🏠', '✈️', '🌟', '💡', '🎓', '❤️', '🔑'];
const DEFAULT_FOLDERS = [
  { id: 'df1', name: 'Photos', type: 'photos', icon: '📷', createdAt: Date.now() - 864000000 },
  { id: 'df2', name: 'Documents', type: 'documents', icon: '📄', createdAt: Date.now() - 720000000 },
  { id: 'df3', name: 'Certificates', type: 'certificates', icon: '🏅', createdAt: Date.now() - 600000000 },
  { id: 'df4', name: 'Private Vault', type: 'private', icon: '🔒', createdAt: Date.now() - 500000000 },
  { id: 'df5', name: 'Videos', type: 'videos', icon: '🎬', createdAt: Date.now() - 400000000 },
  { id: 'df6', name: 'Important PDFs', type: 'pdfs', icon: '📑', createdAt: Date.now() - 300000000 },
];
const STORAGE_KEY = 'filenest_state';
const MAX_STORAGE = 50 * 1024 * 1024;

/* ── State ──────────────────────────────────────────────── */
let state = { folders: [], files: {}, currentView: 'home', viewMode: 'large', sortField: 'name', sortDir: 'asc' };
let folderModalMode = 'create', editFolderId = null, selectedType = 'other', selectedEmoji = '📁';
let renameTarget = null, deleteTarget = null, currentFileForLightbox = null, searchQuery = '', deferredInstall = null;

window._ctx = null;

/* ═══════════════════ PERSISTENCE ═══════════════════════ */
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { showToast('Storage quota exceeded.', 'warning'); }
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      state = { ...state, ...p };
      state.folders.forEach(f => { if (!state.files[f.id]) state.files[f.id] = []; });
    } else {
      state.folders = DEFAULT_FOLDERS.map(f => ({ ...f, favorite: false }));
      state.folders.forEach(f => { state.files[f.id] = []; });
      saveState();
    }
  } catch (e) {
    state.folders = DEFAULT_FOLDERS.map(f => ({ ...f, favorite: false }));
    state.folders.forEach(f => { state.files[f.id] = []; });
  }
}

/* ═══════════════════ UTILITY ══════════════════════════ */
function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function formatBytes(b) {
  if (!b) return '0 B';
  const k = 1024, s = ['B', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
}
function formatDate(ts) { return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fileTypeIcon(n) {
  const e = (n || '').split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(e)) return '🖼️';
  if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(e)) return '🎬';
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(e)) return '🎵';
  if (e === 'pdf') return '📑';
  if (['doc', 'docx', 'odt', 'txt', 'rtf'].includes(e)) return '📄';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(e)) return '📊';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return '🗜️';
  return '📎';
}
function isImage(n) { return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(n); }
function isVideo(n) { return /\.(mp4|webm|mov|avi|mkv)$/i.test(n); }
function isAudio(n) { return /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(n); }
function isPdf(n) { return /\.pdf$/i.test(n); }
function totalStorageUsed() { return Object.values(state.files).flat().reduce((s, f) => s + (f.size || 0), 0); }
function totalFileCount() { return Object.values(state.files).reduce((s, a) => s + a.length, 0); }

/* ═══════════════════ SORT & FILTER ════════════════════ */
function sortItems(arr) {
  const d = state.sortDir === 'asc' ? 1 : -1;
  return [...arr].sort((a, b) => {
    if (state.sortField === 'name') return d * a.name.localeCompare(b.name);
    if (state.sortField === 'date') return d * ((a.createdAt || 0) - (b.createdAt || 0));
    if (state.sortField === 'size') return d * ((a.size || 0) - (b.size || 0));
    if (state.sortField === 'type') return d * a.name.split('.').pop().localeCompare(b.name.split('.').pop());
    return 0;
  });
}
function filterFolders(f) { return searchQuery ? f.filter(x => x.name.toLowerCase().includes(searchQuery)) : f; }
function filterFiles(f) { return searchQuery ? f.filter(x => x.name.toLowerCase().includes(searchQuery)) : f; }

/* ═══════════════════ RENDER ═══════════════════════════ */
function render() {
  updateSidebarFolders(); updateStorageBar(); updateBreadcrumb(); updateUploadBtn();
  const C = document.getElementById('content');
  if (state.currentView === 'home') renderHome(C);
  else if (state.currentView === 'recent') renderRecent(C);
  else if (state.currentView === 'favorites') renderFavorites(C);
  else renderFolder(C, state.currentView);

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const nb = { home: 'navHome', recent: 'navRecent', favorites: 'navFavorites' }[state.currentView];
  if (nb) document.getElementById(nb)?.classList.add('active');
  document.querySelectorAll('.sidebar-folder-item').forEach(el => {
    el.classList.toggle('active', el.dataset.fid === state.currentView);
  });
}

function renderHome(C) {
  const folders = sortItems(filterFolders(state.folders));
  const fav = state.folders.filter(f => f.favorite).length + Object.values(state.files).flat().filter(f => f.favorite).length;
  C.innerHTML = `
    <div class="hero">
      <div class="hero-emoji">🪺</div>
      <div>
        <div class="hero-title">Welcome to File Nest</div>
        <div class="hero-sub">Your personal vault for certificates, photos, documents, and everything important.</div>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-card"><span class="stat-icon">📁</span><div><div class="stat-val">${state.folders.length}</div><div class="stat-lbl">Folders</div></div></div>
      <div class="stat-card"><span class="stat-icon">📎</span><div><div class="stat-val">${totalFileCount()}</div><div class="stat-lbl">Files</div></div></div>
      <div class="stat-card"><span class="stat-icon">💾</span><div><div class="stat-val">${formatBytes(totalStorageUsed())}</div><div class="stat-lbl">Used</div></div></div>
      <div class="stat-card"><span class="stat-icon">⭐</span><div><div class="stat-val">${fav}</div><div class="stat-lbl">Favorites</div></div></div>
    </div>
    <div class="section-header">
      <span class="section-title">📂 All Folders</span>
      <span class="section-count">${folders.length}</span>
    </div>
    ${folders.length
      ? `<div class="items-grid view-${state.viewMode}">${folders.map(folderCard).join('')}</div>`
      : `<div class="empty-state"><div class="empty-icon">📂</div><div class="empty-title">No folders yet</div><div class="empty-sub">Create your first folder to get started.</div><button class="btn-primary" onclick="openCreateFolderModal()">＋ New Folder</button></div>`}`;
}

function renderFolder(C, fid) {
  const folder = state.folders.find(f => f.id === fid); if (!folder) { navigateTo('home'); return; }
  const files = sortItems(filterFiles(state.files[fid] || []));
  const ti = FOLDER_TYPES.find(t => t.key === folder.type) || FOLDER_TYPES[9];
  C.innerHTML = `
    <div class="drop-zone" id="dropZone"
      ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event,'${fid}')">
      <div class="drop-zone-icon">⬆</div>
      <div>Drag &amp; drop files here, or <strong style="color:var(--accent2);cursor:pointer" onclick="triggerUpload()">browse</strong></div>
      <div style="font-size:.75rem;margin-top:4px;color:var(--text3)">Accepted: ${ti.accept === '*' ? 'all files' : ti.accept}</div>
    </div>
    <div class="section-header">
      <span class="section-title">${folder.icon} ${folder.name}</span>
      <span class="section-count">${files.length} file${files.length !== 1 ? 's' : ''}</span>
    </div>
    ${files.length
      ? `<div class="items-grid view-${state.viewMode}">${files.map(f => fileCard(f, fid)).join('')}</div>`
      : `<div class="empty-state"><div class="empty-icon">${folder.icon}</div><div class="empty-title">This folder is empty</div><div class="empty-sub">Upload files to "${folder.name}".</div><button class="btn-primary" onclick="triggerUpload()">⬆ Upload Files</button></div>`}`;
  document.getElementById('fileInput').accept = ti.accept;
}

function renderRecent(C) {
  const all = Object.entries(state.files).flatMap(([fid, arr]) => arr.map(f => ({ ...f, _folderId: fid })));
  all.sort((a, b) => b.createdAt - a.createdAt);
  const recent = filterFiles(all).slice(0, 60);
  C.innerHTML = `
    <div class="section-header"><span class="section-title">🕐 Recent Files</span><span class="section-count">${recent.length}</span></div>
    ${recent.length
      ? `<div class="items-grid view-${state.viewMode}">${recent.map(f => fileCard(f, f._folderId)).join('')}</div>`
      : `<div class="empty-state"><div class="empty-icon">🕐</div><div class="empty-title">No recent files</div><div class="empty-sub">Upload files to folders to see them here.</div></div>`}`;
}

function renderFavorites(C) {
  const ff = sortItems(filterFolders(state.folders.filter(f => f.favorite)));
  const fi = Object.entries(state.files).flatMap(([fid, arr]) => arr.filter(f => f.favorite).map(f => ({ ...f, _folderId: fid })));
  C.innerHTML = `
    <div class="section-header"><span class="section-title">⭐ Favorite Folders</span><span class="section-count">${ff.length}</span></div>
    ${ff.length ? `<div class="items-grid view-${state.viewMode}" style="margin-bottom:28px">${ff.map(folderCard).join('')}</div>`
      : `<div style="color:var(--text3);font-size:.85rem;margin-bottom:24px;padding:12px 0">No favorite folders yet.</div>`}
    <div class="section-header"><span class="section-title">⭐ Favorite Files</span><span class="section-count">${fi.length}</span></div>
    ${fi.length ? `<div class="items-grid view-${state.viewMode}">${fi.map(f => fileCard(f, f._folderId)).join('')}</div>`
      : `<div style="color:var(--text3);font-size:.85rem;padding:12px 0">No favorite files yet.</div>`}`;
}

/* ── Cards ──────────────────────────────────────────────── */
function folderCard(f) {
  const fc = (state.files[f.id] || []).length;
  const fsz = (state.files[f.id] || []).reduce((s, x) => s + (x.size || 0), 0);
  return `<div class="item-card"
       onclick="navigateTo('${f.id}')"
       oncontextmenu="showCtxMenu(event,'folder','${f.id}',null)">
    ${f.favorite ? '<span class="fav-badge">⭐</span>' : ''}
    <div class="item-icon-wrap"><div class="item-icon">${f.icon}</div></div>
    <div class="item-info">
      <div class="item-name" title="${f.name}">${f.name}</div>
      <div class="item-meta">${fc} item${fc !== 1 ? 's' : ''} · ${formatBytes(fsz)}</div>
    </div>
    <button class="item-menu-btn"
      onclick="event.stopPropagation();showCtxMenu(event,'folder','${f.id}',null)">⋯</button>
  </div>`;
}

function fileCard(f, folderId) {
  const isImg = isImage(f.name);
  const icon = isImg && f.dataUrl
    ? `<img class="item-thumbnail" src="${f.dataUrl}" alt="${f.name}" loading="lazy"/>`
    : `<div class="item-icon">${fileTypeIcon(f.name)}</div>`;
  const ext = f.name.split('.').pop().toUpperCase();
  return `<div class="item-card"
       onclick="openFile('${folderId}','${f.id}')"
       oncontextmenu="showCtxMenu(event,'file','${folderId}','${f.id}')">
    ${!isImg ? `<span class="item-type-badge">${ext}</span>` : ''}
    ${f.favorite ? '<span class="fav-badge">⭐</span>' : ''}
    <div class="item-icon-wrap">${icon}</div>
    <div class="item-info">
      <div class="item-name" title="${f.name}">${f.name}</div>
      <div class="item-meta">${formatBytes(f.size)} · ${formatDate(f.createdAt)}</div>
    </div>
    <button class="item-menu-btn"
      onclick="event.stopPropagation();showCtxMenu(event,'file','${folderId}','${f.id}')">⋯</button>
  </div>`;
}

function updateSidebarFolders() {
  const list = document.getElementById('s

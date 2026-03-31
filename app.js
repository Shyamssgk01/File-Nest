/* ═══════════════════════════════════════════════════════════
   FILE NEST – AUTH GUARD + OPFS STORAGE LAYER (v4 addition)
═══════════════════════════════════════════════════════ */

/* ─── Auth Guard (runs before anything else) ─────────── */
(function checkAuth() {
  const user = localStorage.getItem('filenest_user');
  const pref = localStorage.getItem('filenest_storage_pref');
  if (!user || !pref) { window.location.href = 'auth.html'; }
})();

/* ─── OPFS Storage Layer ─────────────────────────────── */
const opfsEnabled = localStorage.getItem('filenest_storage_pref') === 'opfs';

async function opfsSaveState(data) {
  try {
    const root = await navigator.storage.getDirectory();
    const fh   = await root.getFileHandle('filenest_state.json', { create: true });
    const ws   = await fh.createWritable();
    await ws.write(JSON.stringify(data));
    await ws.close();
  } catch (e) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}
async function opfsLoadState() {
  try {
    const root = await navigator.storage.getDirectory();
    const fh   = await root.getFileHandle('filenest_state.json');
    const file = await fh.getFile();
    return JSON.parse(await file.text());
  } catch (e) { return null; }
}
async function opfsSaveFile(fileId, dataUrl) {
  try {
    const root = await navigator.storage.getDirectory();
    const dir  = await root.getDirectoryHandle('files', { create: true });
    const fh   = await dir.getFileHandle(fileId, { create: true });
    const ws   = await fh.createWritable();
    await ws.write(dataUrl);
    await ws.close();
    return true;
  } catch (e) { return false; }
}
async function opfsReadFile(fileId) {
  try {
    const root = await navigator.storage.getDirectory();
    const dir  = await root.getDirectoryHandle('files');
    const fh   = await dir.getFileHandle(fileId);
    const file = await fh.getFile();
    return await file.text();
  } catch (e) { return null; }
}
async function opfsDeleteFile(fileId) {
  try {
    const root = await navigator.storage.getDirectory();
    const dir  = await root.getDirectoryHandle('files');
    await dir.removeEntry(fileId);
  } catch (e) { /* ignore */ }
}

/* ─── User Menu ──────────────────────────────────────── */
function initUserMenu() {
  const raw = localStorage.getItem('filenest_user');
  if (!raw) return;
  const user = JSON.parse(raw);
  const av = document.getElementById('userAvatar');
  const initials = (user.displayName || user.email || '?')
    .split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  if (av) {
    if (user.photoURL) {
      av.style.backgroundImage = 'url(' + user.photoURL + ')';
      av.style.backgroundSize = 'cover';
      av.style.backgroundPosition = 'center';
    } else {
      av.textContent = initials;
    }
  }
  const nm = document.getElementById('userMenuName');
  const em = document.getElementById('userMenuEmail');
  const st = document.getElementById('userMenuStorage');
  if (nm) nm.textContent = user.displayName || 'File Nest User';
  if (em) em.textContent = user.email || '';
  const pref = localStorage.getItem('filenest_storage_pref') || 'localstorage';
  const prefLabel = { opfs: '🖥️ Device Storage', localstorage: '📦 Browser Storage', cloud: '☁️ Cloud Backup' };
  if (st) st.textContent = 'Storage: ' + (prefLabel[pref] || pref);
}
function toggleUserMenu() {
  document.getElementById('userMenu')?.classList.toggle('open');
}
document.addEventListener('click', e => {
  const menu = document.getElementById('userMenu');
  const av   = document.getElementById('userAvatar');
  if (menu && menu.classList.contains('open') && !menu.contains(e.target) && e.target !== av) {
    menu.classList.remove('open');
  }
});
function signOutUser() {
  if (!confirm('Sign out of File Nest?')) return;
  localStorage.removeItem('filenest_user');
  window.location.href = 'auth.html';
}


/* ═══════════════════════════════════════════════════════════
   FILE NEST – app.js  (v3 – robust context menu)
═══════════════════════════════════════════════════════════ */
'use strict';

/* ── Constants ──────────────────────────────────────────── */
const FOLDER_TYPES = [
  { key: 'photos', label: 'Photos', icon: '📷', accept: 'image/*' },
  { key: 'documents', label: 'Documents', icon: '📄', accept: '.doc,.docx,.txt,.odt' },
  { key: 'pdfs', label: 'PDFs', icon: '📑', accept: '.pdf' },
  { key: 'certificates', label: 'Certificates', icon: '🏅', accept: 'image/*,.pdf' },
  { key: 'audio', label: 'Audio', icon: '🎵', accept: 'audio/*' },
  { key: 'spreadsheets', label: 'Spreadsheets', icon: '📊', accept: '.xls,.xlsx,.csv,.ods' },
  { key: 'archives', label: 'Archives', icon: '🗜️', accept: '.zip,.rar,.7z,.tar,.gz' },
  { key: 'links', label: 'Links', icon: '🔗', accept: 'url' },
  { key: 'private', label: 'Private', icon: '🔒', accept: '*' },
  { key: 'other', label: 'Other', icon: '📁', accept: '*' },
];
const FOLDER_EMOJIS = ['📁', '🗂️', '📂', '🏅', '📷', '📄', '📑', '🎵', '📊', '🔒', '🗃️', '💼', '🏠', '✈️', '🌟', '💡', '🎓', '❤️', '🔑'];
const DEFAULT_FOLDERS = [
  { id: 'df1', name: 'Photos', type: 'photos', icon: '📷', createdAt: Date.now() - 864000000 },
  { id: 'df2', name: 'Documents', type: 'documents', icon: '📄', createdAt: Date.now() - 720000000 },
  { id: 'df3', name: 'Certificates', type: 'certificates', icon: '🏅', createdAt: Date.now() - 600000000 },
  { id: 'df6', name: 'Important PDFs', type: 'pdfs', icon: '📑', createdAt: Date.now() - 300000000 },
  { id: 'df5', name: 'Saved Links', type: 'links', icon: '🔗', createdAt: Date.now() - 400000000 },
  { id: 'df4', name: 'Private Vault', type: 'private', icon: '🔒', createdAt: Date.now() - 500000000 },
];
const STORAGE_KEY = 'filenest_state';
const MAX_STORAGE = 50 * 1024 * 1024; // 50MB UI limit

let vaultUnlocked = false;
let pendingVaultTarget = null;

/* ── State ──────────────────────────────────────────────── */
let state = { folders: [], files: {}, currentView: 'home', viewMode: 'large', sortField: 'name', sortDir: 'asc' };
let folderModalMode = 'create', editFolderId = null, selectedType = 'other', selectedEmoji = '📁';
let renameTarget = null, deleteTarget = null, currentFileForLightbox = null, searchQuery = '', deferredInstall = null;

// The ONLY context-menu target store — written atomically, read in the same tick
// by onFnAction() which is called inline from onclick attributes on each menu item.
window._ctx = null;

/* ═══════════════════ PERSISTENCE ═══════════════════════ */
function saveState() {
  if (opfsEnabled) {
    // Save metadata (no dataUrls) to OPFS state file
    const meta = { ...state, files: {} };
    Object.entries(state.files).forEach(([fid, arr]) => {
      meta.files[fid] = arr.map(f => ({ ...f, dataUrl: opfsEnabled ? '__opfs__' : f.dataUrl }));
    });
    opfsSaveState(meta);
  } else {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { showToast('Storage quota exceeded.', 'warning'); }
  }
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
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(e)) return '🎵';
  if (e === 'pdf') return '📑';
  if (['doc', 'docx', 'odt', 'txt', 'rtf'].includes(e)) return '📄';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(e)) return '📊';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return '🗜️';
  return '📎';
}
function isImage(n) { return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(n); }
function isAudio(n) { return /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(n); }
function isPdf(n) { return /\.pdf$/i.test(n); }

function getVisibleFolders() {
  if (vaultUnlocked) return state.folders;
  return state.folders.filter(f => f.type !== 'private');
}
function getVisibleFilesList() {
  const privateFolderIds = new Set(state.folders.filter(f => f.type === 'private').map(f => f.id));
  return Object.entries(state.files).flatMap(([fid, arr]) => {
    if (!vaultUnlocked && privateFolderIds.has(fid)) return [];
    return arr.map(f => ({ ...f, _folderId: fid }));
  });
}

function totalStorageUsed() { return getVisibleFilesList().reduce((s, f) => s + (f.size || 0), 0); }
function totalFileCount() { return getVisibleFilesList().length; }

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
  const fav = getVisibleFolders().filter(f => f.favorite).length + getVisibleFilesList().filter(f => f.favorite).length;
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
    ${ti.key === 'links' ? '' : `<div class="drop-zone" id="dropZone"
      ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event,'${fid}')">
      <div class="drop-zone-icon">⬆</div>
      <div>Drag &amp; drop files here, or <strong style="color:var(--accent2);cursor:pointer" onclick="triggerUpload()">browse</strong></div>
      <div style="font-size:.75rem;margin-top:4px;color:var(--text3)">Accepted: ${ti.accept === '*' ? 'all files' : ti.accept}</div>
    </div>`}
    <div class="section-header">
      <span class="section-title">${folder.icon} ${folder.name}</span>
      <span class="section-count">${files.length} item${files.length !== 1 ? 's' : ''}</span>
    </div>
    ${files.length
      ? `<div class="items-grid view-${state.viewMode}">${files.map(f => fileCard(f, fid)).join('')}</div>`
      : `<div class="empty-state"><div class="empty-icon">${folder.icon}</div><div class="empty-title">This folder is empty</div><div class="empty-sub">${ti.key === 'links' ? 'Add links to "' + folder.name + '".' : 'Upload files to "' + folder.name + '".'}</div><button class="btn-primary" onclick="${ti.key === 'links' ? 'openAddLinkModal()' : 'triggerUpload()'}">${ti.key === 'links' ? '🔗 Add Link' : '⬆ Upload Files'}</button></div>`}`;
  if (ti.key !== 'links') document.getElementById('fileInput').accept = ti.accept;
}

function renderRecent(C) {
  const all = getVisibleFilesList();
  all.sort((a, b) => b.createdAt - a.createdAt);
  const recent = filterFiles(all).slice(0, 60);
  C.innerHTML = `
    <div class="section-header"><span class="section-title">🕐 Recent Files</span><span class="section-count">${recent.length}</span></div>
    ${recent.length
      ? `<div class="items-grid view-${state.viewMode}">${recent.map(f => fileCard(f, f._folderId)).join('')}</div>`
      : `<div class="empty-state"><div class="empty-icon">🕐</div><div class="empty-title">No recent files</div><div class="empty-sub">Upload files to folders to see them here.</div></div>`}`;
}

function renderFavorites(C) {
  const ff = sortItems(filterFolders(getVisibleFolders().filter(f => f.favorite)));
  const fi = getVisibleFilesList().filter(f => f.favorite);
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
  // The card click opens the folder. The ⋯ button calls showCtxMenu with folder data.
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
  const isImg = isImage(f.name) && !f.isLink;
  const icon = isImg && f.dataUrl
    ? `<img class="item-thumbnail" src="${f.dataUrl}" alt="${f.name}" loading="lazy"/>`
    : `<div class="item-icon">${f.isLink ? '🔗' : fileTypeIcon(f.name)}</div>`;
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
  const list = document.getElementById('sidebarFolderList'); if (!list) return;
  list.innerHTML = state.folders.map(f => `
    <div class="sidebar-folder-item" data-fid="${f.id}" onclick="navigateTo('${f.id}')">
      <span>${f.icon}</span>
      <span class="nav-label" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.name}</span>
    </div>`).join('');
}
function updateBreadcrumb() {
  const bc = document.getElementById('breadcrumb'); if (!bc) return;
  const backBtn = document.getElementById('backBtn');
  const isHome = state.currentView === 'home';

  // Show back button when not on home
  if (backBtn) backBtn.style.display = isHome ? 'none' : 'flex';

  const lbl = { home: null, recent: '🕐 Recent', favorites: '⭐ Favorites' }[state.currentView];
  if (state.currentView === 'home') {
    bc.innerHTML = `<span class="bc-home" onclick="navigateTo('home')">🏠 Home</span>`;
  } else if (lbl) {
    bc.innerHTML = `<span onclick="navigateTo('home')" style="cursor:pointer">🏠 Home</span><span class="bc-sep">›</span><span class="bc-home">${lbl}</span>`;
  } else {
    const folder = state.folders.find(f => f.id === state.currentView);
    bc.innerHTML = `<span onclick="navigateTo('home')" style="cursor:pointer">🏠 Home</span><span class="bc-sep">›</span><span class="bc-home">${folder ? folder.icon + ' ' + folder.name : ''}</span>`;
  }
}
function updateStorageBar() {
  const used = totalStorageUsed(), pct = Math.min((used / MAX_STORAGE) * 100, 100).toFixed(1);
  const fill = document.getElementById('storageFill'), label = document.getElementById('storageUsedLabel');
  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = formatBytes(used);
}
function updateUploadBtn() {
  const btn = document.getElementById('uploadBtnTop');
  const linkBtn = document.getElementById('addLinkBtnTop');
  const fab = document.getElementById('mobileFab');
  const folder = state.folders.find(f => f.id === state.currentView);

  if (folder) {
    if (fab) fab.classList.add('show-fab');
    if (folder.type === 'links') {
      if (btn) btn.style.display = 'none';
      if (linkBtn) linkBtn.style.display = 'flex';
    } else {
      if (btn) btn.style.display = 'flex';
      if (linkBtn) linkBtn.style.display = 'none';
    }
  } else {
    if (btn) btn.style.display = 'none';
    if (linkBtn) linkBtn.style.display = 'none';
    if (fab) fab.classList.remove('show-fab');
  }
}

/* ═══════════════════ NAVIGATION ══════════════════════ */

// Track whether we're handling a popstate to avoid double-pushing history
let _handlingPopState = false;

function navigateTo(view, fromPopState = false) {
  // If we are currently inside a private vault and navigating somewhere else, lock it.
  const currentFolder = state.folders.find(f => f.id === state.currentView);
  if (currentFolder && currentFolder.type === 'private' && view !== state.currentView) {
    vaultUnlocked = false; 
  }

  if (view !== 'home' && view !== 'recent' && view !== 'favorites') {
    const folder = state.folders.find(f => f.id === view);
    if (folder && folder.type === 'private' && !vaultUnlocked) {
      pendingVaultTarget = view;
      if (localStorage.getItem('filenest_vault_pin')) openModal('authPinModal');
      else openModal('setupPinModal');
      return;
    }
  }

  // Push browser history entry so back button works
  if (!fromPopState) {
    const url = '#' + view;
    if (state.currentView !== view) {
      history.pushState({ view }, '', url);
    }
  }

  state.currentView = view; searchQuery = '';
  const si = document.getElementById('searchInput'); if (si) si.value = '';
  const scb = document.getElementById('searchClearBtn'); if (scb) scb.style.display = 'none';

  // Close sidebar on mobile after navigation
  if (window.innerWidth <= 768) {
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.remove('mobile-open');
    // Remove overlay if present
    const ov = document.getElementById('sidebarOverlay');
    if (ov) ov.classList.remove('active');
  }

  render();
}

// Handle browser back / forward buttons
window.addEventListener('popstate', (e) => {
  const view = (e.state && e.state.view) ? e.state.view : 'home';
  navigateTo(view, true);
});
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    sb.classList.toggle('mobile-open');
    // Toggle overlay
    let ov = document.getElementById('sidebarOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'sidebarOverlay';
      ov.className = 'sidebar-overlay';
      ov.onclick = () => { sb.classList.remove('mobile-open'); ov.classList.remove('active'); };
      document.body.appendChild(ov);
    }
    ov.classList.toggle('active', sb.classList.contains('mobile-open'));
  } else {
    sb.classList.toggle('collapsed');
  }
}

/* ═══════════════════ VIEW / SORT ══════════════════════ */
function setView(mode) {
  state.viewMode = mode;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  document.getElementById({ large: 'viewLarge', medium: 'viewMedium', small: 'viewSmall' }[mode])?.classList.add('active');
  saveState(); render();
}
function applySort() { state.sortField = document.getElementById('sortField').value; saveState(); render(); }
function toggleSortDir() {
  state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  const btn = document.getElementById('sortDirBtn');
  btn.classList.toggle('desc', state.sortDir === 'desc');
  saveState(); render();
}

/* ═══════════════════ SEARCH ══════════════════════════ */
function handleSearch(val) {
  searchQuery = val.trim().toLowerCase();
  const cb = document.getElementById('searchClearBtn'); if (cb) cb.style.display = searchQuery ? 'flex' : 'none';
  render();
}
function clearSearch() {
  searchQuery = '';
  const si = document.getElementById('searchInput'); if (si) si.value = '';
  const cb = document.getElementById('searchClearBtn'); if (cb) cb.style.display = 'none';
  render();
}

/* ═══════════════════ FOLDER MODAL ════════════════════ */
function openCreateFolderModal() {
  folderModalMode = 'create'; editFolderId = null; selectedType = 'other'; selectedEmoji = '📁';
  document.getElementById('folderModalTitle').textContent = 'New Folder';
  document.getElementById('folderNameInput').value = '';
  buildTypeGrid(); buildEmojiPicker(); openModal('folderModal');
  setTimeout(() => document.getElementById('folderNameInput').focus(), 180);
}
function openEditFolderModal(folderId) {
  const folder = state.folders.find(f => f.id === folderId); if (!folder) return;
  folderModalMode = 'edit'; editFolderId = folderId; selectedType = folder.type; selectedEmoji = folder.icon;
  document.getElementById('folderModalTitle').textContent = 'Edit Folder';
  document.getElementById('folderNameInput').value = folder.name;
  buildTypeGrid(); buildEmojiPicker(); openModal('folderModal');
  setTimeout(() => document.getElementById('folderNameInput').focus(), 180);
}
function buildTypeGrid() {
  document.getElementById('typeGrid').innerHTML = FOLDER_TYPES.map(t => `
    <div class="type-chip ${t.key === selectedType ? 'selected' : ''}" onclick="selectType('${t.key}')">
      <span>${t.icon}</span><span>${t.label}</span></div>`).join('');
}
function buildEmojiPicker() {
  document.getElementById('emojiPicker').innerHTML = FOLDER_EMOJIS.map(e => `
    <span class="emoji-choice ${e === selectedEmoji ? 'selected' : ''}" onclick="selectEmoji('${e}')">${e}</span>`).join('');
}
function selectType(key) {
  selectedType = key; buildTypeGrid();
  const t = FOLDER_TYPES.find(x => x.key === key);
  if (t && FOLDER_EMOJIS.includes(t.icon)) { selectedEmoji = t.icon; buildEmojiPicker(); }
}
function selectEmoji(e) { selectedEmoji = e; buildEmojiPicker(); }
function saveFolderModal() {
  const name = document.getElementById('folderNameInput').value.trim();
  if (!name) { showToast('Please enter a folder name.', 'warning'); return; }
  if (folderModalMode === 'create') {
    const nf = { id: genId(), name, type: selectedType, icon: selectedEmoji, createdAt: Date.now(), favorite: false };
    state.folders.push(nf); state.files[nf.id] = [];
    showToast(`Folder "${name}" created!`, 'success');
  } else {
    const f = state.folders.find(x => x.id === editFolderId);
    if (f) { f.name = name; f.type = selectedType; f.icon = selectedEmoji; }
    showToast('Folder updated.', 'success');
  }
  saveState(); closeFolderModal(); render();
}
function closeFolderModal() { closeModal('folderModal'); }

/* ═══════════════════ RENAME MODAL ════════════════════ */
function openRenameModal(kind, folderId, fileId) {
  renameTarget = { kind, folderId, fileId };
  let cur = kind === 'folder'
    ? (state.folders.find(f => f.id === folderId)?.name || '')
    : ((state.files[folderId] || []).find(f => f.id === fileId)?.name || '');
  document.getElementById('renameInput').value = cur;
  openModal('renameModal');
  setTimeout(() => {
    const ri = document.getElementById('renameInput'); ri.focus();
    const dot = cur.lastIndexOf('.'); ri.setSelectionRange(0, dot > 0 ? dot : cur.length);
  }, 180);
}
function confirmRename() {
  const n = document.getElementById('renameInput').value.trim();
  if (!n) { showToast('Name cannot be empty.', 'warning'); return; }
  if (!renameTarget) return;
  const { kind, folderId, fileId } = renameTarget;
  if (kind === 'folder') { const f = state.folders.find(x => x.id === folderId); if (f) f.name = n; }
  else { const f = (state.files[folderId] || []).find(x => x.id === fileId); if (f) f.name = n; }
  saveState(); closeRenameModal(); render(); showToast(`Renamed to "${n}".`, 'success');
}
function closeRenameModal() { renameTarget = null; closeModal('renameModal'); }

/* ═══════════════════ DELETE MODAL ════════════════════ */
function openDeleteModal(kind, folderId, fileId) {
  deleteTarget = { kind, folderId, fileId };
  let msg = '';
  if (kind === 'folder') {
    const f = state.folders.find(x => x.id === folderId);
    const cnt = (state.files[folderId] || []).length;
    msg = `Delete folder "<strong>${f?.name}</strong>"? This will also delete ${cnt} file${cnt !== 1 ? 's' : ''} inside it.`;
  } else {
    const f = (state.files[folderId] || []).find(x => x.id === fileId);
    msg = `Delete file "<strong>${f?.name}</strong>"? This cannot be undone.`;
  }
  document.getElementById('deleteModalMsg').innerHTML = msg;
  openModal('deleteModal');
}
function confirmDelete() {
  if (!deleteTarget) return;
  const { kind, folderId, fileId } = deleteTarget;
  if (kind === 'folder') {
    state.folders = state.folders.filter(f => f.id !== folderId);
    delete state.files[folderId];
    if (state.currentView === folderId) navigateTo('home');
    showToast('Folder deleted.', 'success');
  } else {
    if (opfsEnabled) opfsDeleteFile(fileId);
    state.files[folderId] = (state.files[folderId] || []).filter(f => f.id !== fileId);
    showToast('File deleted.', 'success');
  }
  saveState(); closeDeleteModal(); render();
}
function closeDeleteModal() { deleteTarget = null; closeModal('deleteModal'); }

/* ═══════════════════ ADD LINK MODAL ═══════════════════ */
function openAddLinkModal() {
  document.getElementById('linkUrlInput').value = '';
  document.getElementById('linkTitleInput').value = '';
  openModal('linkModal');
  setTimeout(() => document.getElementById('linkUrlInput').focus(), 180);
}
function closeLinkModal() { closeModal('linkModal'); }
function saveLinkModal() {
  let url = document.getElementById('linkUrlInput').value.trim();
  const title = document.getElementById('linkTitleInput').value.trim() || url;
  if (!url) { showToast('Please enter a URL.', 'warning'); return; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const fid = state.currentView;
  if (!state.files[fid]) state.files[fid] = [];
  state.files[fid].push({
    id: genId(), name: title, size: 0, type: 'url',
    dataUrl: url, createdAt: Date.now(), favorite: false, isLink: true
  });
  saveState(); closeLinkModal(); render(); showToast('Link added!', 'success');
}

/* ═══════════════════ PRIVATE VAULT MODALS ═════════════ */
function closeSetupPinModal() {
  pendingVaultTarget = null;
  document.getElementById('newPinInput').value = '';
  document.getElementById('confirmPinInput').value = '';
  closeModal('setupPinModal');
}
function saveNewPin() {
  const p1 = document.getElementById('newPinInput').value;
  const p2 = document.getElementById('confirmPinInput').value;
  if (!p1 || p1.length < 4) return showToast('PIN must be at least 4 characters.', 'warning');
  if (p1 !== p2) return showToast('PINs do not match.', 'error');
  
  localStorage.setItem('filenest_vault_pin', p1);
  vaultUnlocked = true;
  document.getElementById('newPinInput').value = '';
  document.getElementById('confirmPinInput').value = '';
  showToast('Vault secured & unlocked!', 'success');
  closeModal('setupPinModal');
  if (pendingVaultTarget) {
    const t = pendingVaultTarget;
    pendingVaultTarget = null;
    navigateTo(t);
  }
}

function closeAuthPinModal() {
  pendingVaultTarget = null;
  document.getElementById('authPinInput').value = '';
  closeModal('authPinModal');
}
function unlockVault() {
  const p = document.getElementById('authPinInput').value;
  const saved = localStorage.getItem('filenest_vault_pin');
  if (p === saved) {
    vaultUnlocked = true;
    showToast('Vault unlocked!', 'success');
    document.getElementById('authPinInput').value = '';
    closeModal('authPinModal');
    if (pendingVaultTarget) {
      const t = pendingVaultTarget;
      pendingVaultTarget = null;
      navigateTo(t);
    }
  } else {
    showToast('Incorrect PIN.', 'error');
  }
}

/* ═══════════════════════════════════════════════════════
   CONTEXT MENU  — v3 robust implementation
   
   Strategy: 
   1. showCtxMenu() stores the target in window._ctx AND rebuilds
      the menu innerHTML with fresh onclick="onCtxAction('...')" 
      handlers baked into each item.
   2. onCtxAction() reads window._ctx synchronously in the same
      call stack as the user's click — no async race possible.
   3. The menu div uses z-index:900 and pointer-events:all so 
      clicks always land on it, not the card underneath.
═══════════════════════════════════════════════════════ */
function showCtxMenu(e, kind, folderId, fileId) {
  e.preventDefault();
  e.stopPropagation();

  // Store target synchronously
  window._ctx = { kind, folderId, fileId };

  const isFolder = kind === 'folder';
  const isFile = kind === 'file';

  // Rebuild menu HTML inline so each item's onclick is self-contained
  const menu = document.getElementById('ctxMenu');
  let isPrivate = false;
  if (isFolder) {
    const f = state.folders.find(x => x.id === folderId);
    if (f && f.type === 'private') isPrivate = true;
  }

  menu.innerHTML = `
    ${isFolder ? `<div class="ctx-item" id="ctxOpen"   onclick="onCtxAction('open')">   📂 Open</div>` : ''}
    <div class="ctx-item" id="ctxRename"   onclick="onCtxAction('rename')">  ✏️ Rename</div>
    <div class="ctx-item" id="ctxFav"      onclick="onCtxAction('favorite')">⭐ Favorite</div>
    ${isFile ? `<div class="ctx-item" id="ctxShare"    onclick="onCtxAction('share')">🔗 Share</div>` : ''}
    ${isFile ? `<div class="ctx-item" id="ctxDownload" onclick="onCtxAction('download')">⬇ Download</div>` : ''}
    ${!isPrivate ? `<div class="ctx-item ctx-danger" id="ctxDelete" onclick="onCtxAction('delete')">   🗑 Delete</div>` : ''}
  `;

  // Position and show
  let x = e.clientX, y = e.clientY;
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
  menu.classList.add('open');

  // Clamp after paint
  requestAnimationFrame(() => {
    const r = menu.getBoundingClientRect();
    if (x + r.width > window.innerWidth) x -= r.width;
    if (y + r.height > window.innerHeight) y -= r.height;
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
  });
}

function onCtxAction(action) {
  // Read synchronously — this is called directly from onclick
  const ctx = window._ctx;
  closeCtxMenu();
  if (!ctx) { console.warn('No ctx target for action:', action); return; }
  const { kind, folderId, fileId } = ctx;
  console.log('[CTX]', action, kind, folderId, fileId);
  if (action === 'open') navigateTo(folderId);
  else if (action === 'view') openFile(folderId, fileId);
  else if (action === 'rename') openRenameModal(kind, folderId, fileId);
  else if (action === 'favorite') toggleFavorite(kind, folderId, fileId);
  else if (action === 'share') shareFile(folderId, fileId);
  else if (action === 'download') downloadFile(folderId, fileId);
  else if (action === 'delete') openDeleteModal(kind, folderId, fileId);
}

function closeCtxMenu() {
  const m = document.getElementById('ctxMenu');
  if (m) m.classList.remove('open');
}

function toggleFavorite(kind, folderId, fileId) {
  if (kind === 'folder') {
    const f = state.folders.find(x => x.id === folderId);
    if (f) { f.favorite = !f.favorite; showToast(f.favorite ? '⭐ Added to favorites' : 'Removed from favorites'); }
  } else {
    const f = (state.files[folderId] || []).find(x => x.id === fileId);
    if (f) { f.favorite = !f.favorite; showToast(f.favorite ? '⭐ Added to favorites' : 'Removed from favorites'); }
  }
  saveState(); render();
}

/* Close menu when clicking outside */
document.addEventListener('click', e => {
  const m = document.getElementById('ctxMenu');
  if (m && m.classList.contains('open') && !m.contains(e.target)) {
    closeCtxMenu();
  }
});

/* ═══════════════════ FILE UPLOAD ══════════════════════ */
function triggerUpload() { document.getElementById('fileInput').click(); }
function handleFileUpload(e) {
  const fid = state.currentView;
  if (!state.folders.some(f => f.id === fid)) { showToast('Open a folder first.', 'warning'); return; }
  processFiles(Array.from(e.target.files), fid); e.target.value = '';
}
function handleDragOver(e) { e.preventDefault(); document.getElementById('dropZone')?.classList.add('drag-over'); }
function handleDragLeave() { document.getElementById('dropZone')?.classList.remove('drag-over'); }
function handleDrop(e, fid) {
  e.preventDefault(); document.getElementById('dropZone')?.classList.remove('drag-over');
  processFiles(Array.from(e.dataTransfer.files), fid);
}
function processFiles(fileList, folderId) {
  const arr = Array.from(fileList);
  const allowed = arr.filter(f => !f.type.startsWith('video/') && !/\.(mp4|webm|mov|avi|mkv)$/i.test(f.name));

  if (allowed.length < arr.length) {
    showToast('Video files are not supported in File Nest.', 'error');
  }

  if (!allowed.length) return;

  showToast(`Uploading ${allowed.length} file${allowed.length !== 1 ? 's' : ''}…`);
  let done = 0;
  allowed.forEach(file => {
    const reader = new FileReader();
    reader.onload = async ev => {
      if (!state.files[folderId]) state.files[folderId] = [];
      const fileId = genId();
      const dataUrl = ev.target.result;
      if (opfsEnabled) {
        await opfsSaveFile(fileId, dataUrl);
        state.files[folderId].push({
          id: fileId, name: file.name, size: file.size, type: file.type,
          dataUrl: '__opfs__', createdAt: Date.now(), favorite: false
        });
      } else {
        state.files[folderId].push({
          id: fileId, name: file.name, size: file.size, type: file.type,
          dataUrl: dataUrl, createdAt: Date.now(), favorite: false
        });
      }
      if (++done === allowed.length) { saveState(); render(); showToast(`${done} file${done !== 1 ? 's' : ''} uploaded!`, 'success'); }
    };
    reader.readAsDataURL(file);
  });
}
function handleMobileFabClick() {
  const folder = state.folders.find(f => f.id === state.currentView);
  if (folder && folder.type === 'links') openAddLinkModal();
  else triggerUpload();
}

/* ═══════════════════ FILE VIEWER ══════════════════════ */
async function openFile(folderId, fileId) {
  let file = (state.files[folderId] || []).find(f => f.id === fileId); if (!file) return;
  if (file.isLink) {
    window.open(file.dataUrl, '_blank');
    return;
  }
  if (file.dataUrl === '__opfs__') {
    const data = await opfsReadFile(fileId);
    if (!data) { showToast('Could not read file from device storage.', 'error'); return; }
    file = { ...file, dataUrl: data };
  }
  currentFileForLightbox = { file, folderId };
  document.getElementById('lightboxFileName').textContent = file.name;
  const body = document.getElementById('lightboxBody');
  if (isImage(file.name)) body.innerHTML = `<img src="${file.dataUrl}" alt="${file.name}"/>`;
  else if (isAudio(file.name)) body.innerHTML = `<div class="lb-generic"><div class="lb-generic-icon">🎵</div><div class="lb-generic-name">${file.name}</div><audio controls src="${file.dataUrl}" style="margin-top:16px;width:100%"></audio></div>`;
  else if (isPdf(file.name)) body.innerHTML = `<iframe src="${file.dataUrl}" title="${file.name}"></iframe>`;
  else body.innerHTML = `<div class="lb-generic"><div class="lb-generic-icon">${fileTypeIcon(file.name)}</div><div class="lb-generic-name">${file.name}</div><div class="lb-generic-size">${formatBytes(file.size)}</div><div style="margin-top:12px;color:var(--text3);font-size:.8rem">Preview not available for this file type.</div><button class="btn-primary" style="margin-top:16px" onclick="downloadCurrentFile()">⬇ Download</button></div>`;
  openModal('lightbox');
}
function closeLightbox() { closeModal('lightbox'); currentFileForLightbox = null; }
function downloadCurrentFile() { if (currentFileForLightbox) downloadFile(currentFileForLightbox.folderId, currentFileForLightbox.file.id); }
function shareCurrentFile() { if (currentFileForLightbox) shareFile(currentFileForLightbox.folderId, currentFileForLightbox.file.id); }

async function shareFile(folderId, fileId) {
  const file = (state.files[folderId] || []).find(f => f.id === fileId); if (!file) return;
  try {
    const response = await fetch(file.dataUrl);
    const blob = await response.blob();
    const shareObj = new File([blob], file.name, { type: file.type || '' });
    if (navigator.canShare && navigator.canShare({ files: [shareObj] })) {
      await navigator.share({ title: file.name, files: [shareObj] });
    } else {
      showToast('Native sharing not supported for this file.', 'warning');
    }
  } catch (err) {
    console.error('Share error:', err);
    showToast('Failed to share file.', 'warning');
  }
}

async function downloadFile(folderId, fileId) {
  let file = (state.files[folderId] || []).find(f => f.id === fileId); if (!file) return;
  if (file.dataUrl === '__opfs__') {
    const data = await opfsReadFile(fileId);
    if (!data) { showToast('Could not read file.', 'error'); return; }
    file = { ...file, dataUrl: data };
  }
  const a = document.createElement('a'); a.href = file.dataUrl; a.download = file.name; a.click();
  showToast(`Downloading "${file.name}"…`);
}

/* ═══════════════════ MODAL HELPERS ════════════════════ */
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

/* ═══════════════════ TOAST ════════════════════════════ */
function showToast(msg, type = '') {
  const c = document.getElementById('toastContainer'); if (!c) return;
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; c.appendChild(t);
  setTimeout(() => { t.style.animation = 'slideOut .25s ease forwards'; setTimeout(() => t.remove(), 260); }, 3000);
}

/* ═══════════════════ KEYBOARD ═════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeLightbox(); closeModal('folderModal'); closeModal('renameModal'); closeModal('deleteModal'); closeModal('linkModal'); closeModal('setupPinModal'); closeModal('authPinModal'); closeCtxMenu(); }
  if (e.key === 'Enter') {
    if (document.getElementById('folderModal')?.classList.contains('open')) saveFolderModal();
    if (document.getElementById('renameModal')?.classList.contains('open')) confirmRename();
    if (document.getElementById('linkModal')?.classList.contains('open')) saveLinkModal();
    if (document.getElementById('setupPinModal')?.classList.contains('open')) saveNewPin();
    if (document.getElementById('authPinModal')?.classList.contains('open')) unlockVault();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openCreateFolderModal(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); triggerUpload(); }
});

['folderModal', 'renameModal', 'deleteModal', 'linkModal', 'setupPinModal', 'authPinModal'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', e => { if (e.target.id === id) closeModal(id); });
});
document.getElementById('lightbox')?.addEventListener('click', e => { if (e.target.id === 'lightbox') closeLightbox(); });

/* ═══════════════════ PWA ══════════════════════════════ */
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredInstall = e;
  document.getElementById('installBanner')?.classList.add('show');
});
window.addEventListener('appinstalled', () => {
  document.getElementById('installBanner')?.classList.remove('show');
  showToast('🪺 File Nest installed!', 'success');
});
function installApp() {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  deferredInstall.userChoice.then(r => {
    if (r.outcome === 'accepted') showToast('Installing File Nest…', 'success');
    deferredInstall = null; document.getElementById('installBanner')?.classList.remove('show');
  });
}
function dismissInstall() { document.getElementById('installBanner')?.classList.remove('show'); }
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}

/* ═══════════════════ INIT ════════════════════════════ */
function syncUIControls() {
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  document.getElementById({ large: 'viewLarge', medium: 'viewMedium', small: 'viewSmall' }[state.viewMode])?.classList.add('active');
  const sf = document.getElementById('sortField'); if (sf) sf.value = state.sortField;
  const sd = document.getElementById('sortDirBtn');
  if (sd) { sd.classList.toggle('desc', state.sortDir === 'desc'); }
}

let currentTheme = localStorage.getItem('theme') || 'light';

function initTheme() {
  if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.innerHTML = '☀️';
  }
}

function toggleTheme() {
  const btn = document.getElementById('themeToggleBtn');
  if (document.body.classList.contains('light-theme')) {
    document.body.classList.remove('light-theme');
    currentTheme = 'dark';
    if (btn) btn.innerHTML = '🌙';
  } else {
    document.body.classList.add('light-theme');
    currentTheme = 'light';
    if (btn) btn.innerHTML = '☀️';
  }
  localStorage.setItem('theme', currentTheme);
}

async function init() {
  if (opfsEnabled) {
    const saved = await opfsLoadState();
    if (saved) {
      state = { ...state, ...saved };
      state.folders.forEach(f => { if (!state.files[f.id]) state.files[f.id] = []; });
    } else {
      state.folders = DEFAULT_FOLDERS.map(f => ({ ...f, favorite: false }));
      state.folders.forEach(f => { state.files[f.id] = []; });
      saveState();
    }
  } else {
    loadState();
  }
  initUserMenu();
  initTheme();
  syncUIControls();

  // Seed initial history state so back button always has a 'home' to return to
  const initView = location.hash ? location.hash.slice(1) : 'home';
  history.replaceState({ view: 'home' }, '', '#home');
  state.currentView = 'home';

  render(); 
}
init();

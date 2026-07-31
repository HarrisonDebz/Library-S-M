/**
 * LSM — Admin Dashboard
 * Drives all dynamic content on ui/admin.html.
 * Sections: Dashboard | History | Settings
 */

'use strict';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const ADMIN_STATE = {
  capacity:         600,
  currentOccupancy: 482,
  avgVisitMinutes:  105, // 1h 45m

  /** Hourly occupancy counts — index 0 = 8 AM, each step = 1 hour */
  hourlyData: [120, 195, 290, 360, 455, 482, 440, 370, 280],
  hourLabels: ['8a','9a','10a','11a','12p','1p','2p','3p','4p'],

  alerts: [
    {
      type: 'warning',
      title: 'Capacity Warning: Study Room B',
      desc: 'Occupancy has exceeded 90% threshold.',
      time: '10 mins ago',
    },
    {
      type: 'info',
      title: 'Scanner Offline: Main Entrance',
      desc: 'Scanner #04 failed to ping in last cycle.',
      time: '45 mins ago',
    },
    {
      type: 'success',
      title: 'Weekly Report Generated',
      desc: 'The automated weekly usage report is ready.',
      time: '2 hours ago',
    },
  ],

  peakHour: '2:00 PM',
  peakHoursAway: 3,
};

// History mock entries (1 page = 5 rows, 1452 total represented)
const HISTORY_ENTRIES = [
  { name: 'Sarah Jenkins',  id: 'STU-88219', zone: 'Main Floor',    zoneKey: 'main',  event: 'entry', time: 'Oct 24, 09:15 AM', method: 'RFID Scan' },
  { name: 'Michael Chang',  id: 'FAC-11024', zone: 'Quiet Study B', zoneKey: 'quiet', event: 'exit',  time: 'Oct 24, 09:10 AM', method: 'App Tap' },
  { name: 'Guest User',     id: 'GST-9921',  zone: 'Lobby',         zoneKey: 'main',  event: 'entry', time: 'Oct 24, 08:55 AM', method: 'Manual Entry' },
  { name: 'Emily Chen',     id: 'STU-44122', zone: 'Group Room 4',  zoneKey: 'group', event: 'entry', time: 'Oct 24, 08:30 AM', method: 'RFID Scan' },
  { name: 'David Miller',   id: 'STU-77531', zone: 'Main Floor',    zoneKey: 'main',  event: 'exit',  time: 'Oct 24, 08:15 AM', method: 'Turnstile' },
  { name: 'Priya Nair',     id: 'STU-33901', zone: 'Quiet Study A', zoneKey: 'quiet', event: 'entry', time: 'Oct 23, 05:40 PM', method: 'RFID Scan' },
  { name: 'Tom Bradley',    id: 'STU-55812', zone: 'Group Room 2',  zoneKey: 'group', event: 'exit',  time: 'Oct 23, 05:20 PM', method: 'App Tap' },
  { name: 'Lena Koch',      id: 'FAC-29901', zone: 'Main Floor',    zoneKey: 'main',  event: 'entry', time: 'Oct 23, 04:55 PM', method: 'RFID Scan' },
  { name: 'James Wu',       id: 'STU-61700', zone: 'Quiet Study C', zoneKey: 'quiet', event: 'exit',  time: 'Oct 23, 04:30 PM', method: 'Turnstile' },
  { name: 'Aisha Kamara',   id: 'STU-90042', zone: 'Group Room 1',  zoneKey: 'group', event: 'entry', time: 'Oct 23, 04:15 PM', method: 'Manual Entry' },
  { name: 'Carlos Diaz',    id: 'STU-10293', zone: 'Main Floor',    zoneKey: 'main',  event: 'entry', time: 'Oct 23, 03:50 PM', method: 'RFID Scan' },
  { name: 'Hannah Lee',     id: 'STU-48833', zone: 'Quiet Study B', zoneKey: 'quiet', event: 'entry', time: 'Oct 23, 03:30 PM', method: 'App Tap' },
];

// Settings: admin list
const SETTINGS_ADMINS = [
  { initials: 'SA', color: '#1e7fc4', name: 'System Admin', email: 'admin@lsm.edu', role: 'super',   lastActive: 'Active now' },
  { initials: 'JD', color: '#2a7a55', name: 'Jane Doe',     email: 'j.doe@lsm.edu', role: 'manager', lastActive: '2 hours ago' },
];

// ─── History State ────────────────────────────────────────────────────────────

const histState = {
  page:    0,
  perPage: 5,
  zone:    'all',
  query:   '',
  period:  7,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

function fmtDuration(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── SPA Section Router ───────────────────────────────────────────────────────

const SECTIONS = {
  dashboard: {
    id:       'section-dashboard',
    title:    'Overview',
    subtitle: 'Real-time facility status and metrics.',
    topbarAction: 'btn-generate-report',
  },
  history: {
    id:       'section-history',
    title:    'Visit History',
    subtitle: 'Review entry and exit logs for all facility zones.',
    topbarAction: 'history-topbar-actions',
  },
  settings: {
    id:       'section-settings',
    title:    'Settings',
    subtitle: 'Manage global configuration and operational parameters for LSM.',
    topbarAction: 'settings-topbar-actions',
  },
};

let currentSection = 'dashboard';

function navigateTo(section) {
  if (!SECTIONS[section]) return;

  // Hide all sections
  document.querySelectorAll('.section').forEach(el => el.classList.add('section--hidden'));

  // Show target
  const target = $(SECTIONS[section].id);
  if (target) target.classList.remove('section--hidden');

  // Update title/subtitle
  $('topbar-title').textContent    = SECTIONS[section].title;
  $('topbar-subtitle').textContent = SECTIONS[section].subtitle;

  // Show/hide topbar action areas
  const actionIds = ['btn-generate-report', 'history-topbar-actions', 'settings-topbar-actions'];
  actionIds.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.style.display = 'none';
  });
  const active = $(SECTIONS[section].topbarAction);
  if (active) active.style.display = 'flex';

  // Update sidebar active state
  document.querySelectorAll('.sidebar__link[data-section]').forEach(link => {
    const isActive = link.dataset.section === section;
    link.classList.toggle('sidebar__link--active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else          link.removeAttribute('aria-current');
  });

  // Update page title
  document.title = `${SECTIONS[section].title} — LSM Admin`;

  currentSection = section;

  // Section-specific on-enter logic
  if (section === 'history') {
    histState.page = 0;
    renderHistoryTable();
  }
  if (section === 'settings') {
    renderSettingsAdmins();
  }
}

function setupSidebarNav() {
  document.querySelectorAll('.sidebar__link[data-section]').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      navigateTo(this.dataset.section);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // Quick-card in dashboard (Manage Scanners → Spaces)
  const quickCard = $('quick-scanners');
  if (quickCard) {
    quickCard.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('spaces');
    });
  }
}

// ─── Stat Cards (Dashboard) ───────────────────────────────────────────────────

function renderStats(state) {
  const pct = Math.min(100, Math.round((state.currentOccupancy / state.capacity) * 100));

  $('stat-occupancy').textContent     = state.currentOccupancy.toLocaleString();
  $('stat-occupancy-cap').textContent = `/ ${state.capacity.toLocaleString()}`;

  const bar   = $('stat-occupancy-bar');
  const track = bar.closest('[role="progressbar"]');
  track.setAttribute('aria-valuenow', pct);
  setTimeout(() => { bar.style.width = pct + '%'; }, 200);

  $('stat-capacity-pct').textContent = pct + '%';
  $('stat-avg-duration').textContent = fmtDuration(state.avgVisitMinutes);
  $('stat-peak-hour').textContent    = state.peakHour;
  $('stat-peak-sub').textContent     =
    state.peakHoursAway > 0 ? `Expected in ${state.peakHoursAway} hours` : 'Happening now';
}

// ─── Trend Chart ──────────────────────────────────────────────────────────────

function currentHourIndex() {
  const h    = new Date().getHours();
  const base = 8;
  return Math.max(0, Math.min(ADMIN_STATE.hourlyData.length - 1, h - base));
}

function renderTrendChart(state) {
  const data    = state.hourlyData;
  const labels  = state.hourLabels;
  const nowIdx  = currentHourIndex();
  const maxVal  = Math.max(...data);

  const barsEl   = $('trend-bars');
  const labelsEl = $('trend-x-labels');

  barsEl.innerHTML = data.map((val, i) => {
    const cls = i < nowIdx ? 'trend-bar--past' : i === nowIdx ? 'trend-bar--current' : 'trend-bar--future';
    return `<div class="trend-bar-col">
      <div class="trend-bar ${cls}" data-val="${val}" style="height:0%" data-pct="${Math.round((val/maxVal)*100)}"></div>
    </div>`;
  }).join('');

  labelsEl.innerHTML = labels.map((lbl, i) =>
    `<div class="trend-chart__x-label ${i === nowIdx ? 'trend-chart__x-label--current' : ''}">${lbl}</div>`
  ).join('');

  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('.trend-bar').forEach((bar, i) => {
      const pct = Math.round((data[i] / maxVal) * 100);
      bar.style.height = pct + '%';
    });
  }));
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

const ALERT_ICONS = {
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>`,
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>`,
  error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
  </svg>`,
};

function renderAlerts(alerts) {
  const list = $('alert-list');
  list.innerHTML = alerts.map((a) => `
    <li class="alert-item" tabindex="0" role="listitem" aria-label="${a.title}">
      <div class="alert-item__icon alert-item__icon--${a.type}" aria-hidden="true">
        ${ALERT_ICONS[a.type] ?? ALERT_ICONS.info}
      </div>
      <div class="alert-item__body">
        <div class="alert-item__title">${a.title}</div>
        <div class="alert-item__desc">${a.desc}</div>
        <div class="alert-item__time">${a.time}</div>
      </div>
    </li>
  `).join('');
}

// ─── Visitors Badge ───────────────────────────────────────────────────────────

function renderVisitorsBadge(count) {
  const badge = $('nav-visitors-badge');
  if (!badge) return;
  badge.textContent    = count;
  badge.style.display  = count > 0 ? '' : 'none';
}

// ─── Notice Banner ────────────────────────────────────────────────────────────

function setupNoticeBanner() {
  const btn    = $('notice-banner-dismiss');
  const banner = $('notice-banner');
  if (!btn || !banner) return;
  btn.addEventListener('click', () => {
    banner.style.transition = 'opacity 0.3s, transform 0.3s';
    banner.style.opacity    = '0';
    banner.style.transform  = 'translateY(8px)';
    setTimeout(() => { banner.style.display = 'none'; }, 320);
  });
}

// ─── Generate Report Button ───────────────────────────────────────────────────

function setupReportButton() {
  const btn = $('btn-generate-report');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const original = btn.innerHTML;
    btn.disabled   = true;
    btn.innerHTML  = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="animation:spin 0.8s linear infinite">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Generating…`;

    if (!document.getElementById('spin-style')) {
      const s = document.createElement('style');
      s.id    = 'spin-style';
      s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(s);
    }

    setTimeout(() => {
      btn.disabled  = false;
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        Report Ready`;
      setTimeout(() => { btn.innerHTML = original; }, 2200);
    }, 1800);
  });
}

// ─── Live Update Simulation ───────────────────────────────────────────────────

function simulateLiveUpdate() {
  const delta = Math.floor(Math.random() * 14) - 5;
  ADMIN_STATE.currentOccupancy = Math.min(
    ADMIN_STATE.capacity,
    Math.max(0, ADMIN_STATE.currentOccupancy + delta)
  );
  renderStats(ADMIN_STATE);
}

// ─── History Section ──────────────────────────────────────────────────────────

const ENTRY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`;
const EXIT_ICON  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
const DOTS_ICON  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>`;

function getFilteredEntries() {
  let list = HISTORY_ENTRIES;

  // Zone filter
  if (histState.zone !== 'all') {
    list = list.filter(e => e.zoneKey === histState.zone);
  }

  // Search filter
  const q = histState.query.toLowerCase().trim();
  if (q) {
    list = list.filter(e =>
      e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)
    );
  }

  return list;
}

function renderHistoryTable() {
  const filtered  = getFilteredEntries();
  const total     = filtered.length;
  const totalFake = histState.zone === 'all' && !histState.query ? 1452 : total;
  const start     = histState.page * histState.perPage;
  const page      = filtered.slice(start, start + histState.perPage);

  const tbody = $('hist-tbody');
  if (!tbody) return;

  tbody.innerHTML = page.map(e => `
    <tr>
      <td>
        <div class="hist-user-name">${e.name}</div>
        <div class="hist-user-id">${e.id}</div>
      </td>
      <td>${e.zone}</td>
      <td>
        <span class="hist-badge hist-badge--${e.event}">
          ${e.event === 'entry' ? ENTRY_ICON : EXIT_ICON}
          ${e.event.charAt(0).toUpperCase() + e.event.slice(1)}
        </span>
      </td>
      <td>${e.time}</td>
      <td>${e.method}</td>
      <td>
        <button class="hist-action-btn" type="button" aria-label="More actions for ${e.name}">${DOTS_ICON}</button>
      </td>
    </tr>
  `).join('');

  // Showing label
  const from = total === 0 ? 0 : start + 1;
  const to   = Math.min(start + histState.perPage, total);
  $('hist-showing').textContent = total === 0
    ? 'No matching entries'
    : `Showing ${from}–${to} of ${totalFake.toLocaleString()} entries`;

  // Pagination buttons
  const prevBtn = $('hist-prev');
  const nextBtn = $('hist-next');
  if (prevBtn) prevBtn.disabled = histState.page === 0;
  if (nextBtn) nextBtn.disabled = start + histState.perPage >= total;
}

function setupHistory() {
  // Period toggle
  document.querySelectorAll('.hist-period-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.hist-period-btn').forEach(b => b.classList.remove('hist-period-btn--active'));
      this.classList.add('hist-period-btn--active');
      histState.period = parseInt(this.dataset.period, 10);
      histState.page   = 0;
      renderHistoryTable();
    });
  });

  // Zone filter
  document.querySelectorAll('.hist-zone-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.hist-zone-btn').forEach(b => b.classList.remove('hist-zone-btn--active'));
      this.classList.add('hist-zone-btn--active');
      histState.zone = this.dataset.zone;
      histState.page = 0;
      renderHistoryTable();
    });
  });

  // Search
  const searchEl = $('hist-search');
  if (searchEl) {
    searchEl.addEventListener('input', function() {
      histState.query = this.value;
      histState.page  = 0;
      renderHistoryTable();
    });
  }

  // Pagination
  const prevBtn = $('hist-prev');
  const nextBtn = $('hist-next');
  if (prevBtn) prevBtn.addEventListener('click', () => { histState.page--; renderHistoryTable(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { histState.page++; renderHistoryTable(); });

  // Export CSV
  const exportBtn = $('btn-export-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const rows  = ['User,ID,Zone,Event,Time,Method', ...HISTORY_ENTRIES.map(e =>
        `"${e.name}","${e.id}","${e.zone}","${e.event}","${e.time}","${e.method}"`)];
      const blob  = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement('a');
      a.href      = url;
      a.download  = `visit-history-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}

// ─── Settings Section ─────────────────────────────────────────────────────────

function renderSettingsAdmins() {
  const tbody = $('settings-admin-tbody');
  if (!tbody) return;

  const EDIT_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

  tbody.innerHTML = SETTINGS_ADMINS.map(a => `
    <tr>
      <td>
        <div class="settings-admin-user">
          <div class="settings-admin-avatar" style="background:${a.color}">${a.initials}</div>
          <div>
            <div class="settings-admin-name">${a.name}</div>
            <div class="settings-admin-email">${a.email}</div>
          </div>
        </div>
      </td>
      <td><span class="settings-role-badge settings-role-badge--${a.role}">${a.role === 'super' ? 'Super Admin' : 'Manager'}</span></td>
      <td>${a.lastActive}</td>
      <td><button class="settings-edit-btn" type="button" aria-label="Edit ${a.name}">${EDIT_SVG}</button></td>
    </tr>
  `).join('');
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.settings-toast');
  if (existing) existing.remove();

  const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
  const toast = document.createElement('div');
  toast.className = `settings-toast settings-toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `${CHECK_SVG} ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity    = '0';
    toast.style.transform  = 'translateY(8px)';
    setTimeout(() => toast.remove(), 320);
  }, 2600);
}

function setupSettings() {
  const saveBtn   = $('btn-settings-save');
  const cancelBtn = $('btn-settings-cancel');
  const addBtn    = $('btn-add-admin');

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      // Brief loading state
      const orig = saveBtn.innerHTML;
      saveBtn.disabled  = true;
      saveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 0.8s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Saving…`;
      setTimeout(() => {
        saveBtn.disabled  = false;
        saveBtn.innerHTML = orig;
        showToast('Settings saved successfully.');
      }, 900);
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      // Reset inputs to original values
      const el = (id, val) => { const e = $(id); if (e) e.value = val; };
      el('set-max-capacity', '1200');
      el('set-thr-moderate', '50');
      el('set-thr-busy',     '75');
      el('set-thr-full',     '95');
      showToast('Changes discarded.', 'neutral');
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      alert('Add Administrator dialog — coming soon.');
    });
  }
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

function setupSignOut() {
  const btn = $('btn-signout');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Sign out of LSM Admin?')) {
      window.location.href = 'index.html';
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  // Dashboard
  renderStats(ADMIN_STATE);
  renderTrendChart(ADMIN_STATE);
  renderAlerts(ADMIN_STATE.alerts);
  renderVisitorsBadge(3);
  setupNoticeBanner();
  setupReportButton();

  // Navigation
  setupSidebarNav();

  // History
  setupHistory();
  renderHistoryTable();

  // Settings
  setupSettings();
  renderSettingsAdmins();

  // Sign Out
  setupSignOut();

  // Ensure dashboard action is visible on load
  const histActions = $('history-topbar-actions');
  const setActions  = $('settings-topbar-actions');
  if (histActions) histActions.style.display = 'none';
  if (setActions)  setActions.style.display  = 'none';
  const reportBtn = $('btn-generate-report');
  if (reportBtn)  reportBtn.style.display    = '';

  // Simulated live updates every 20 s
  setInterval(simulateLiveUpdate, 20_000);
}

document.addEventListener('DOMContentLoaded', init);


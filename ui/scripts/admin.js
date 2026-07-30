/**
 * LSM — Admin Dashboard
 * Drives all dynamic content on ui/admin.html.
 */

'use strict';

// ─── Mock Data ───────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

function fmtDuration(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Stat Cards ───────────────────────────────────────────────────────────────

function renderStats(state) {
  const pct = Math.min(100, Math.round((state.currentOccupancy / state.capacity) * 100));

  // Occupancy
  $('stat-occupancy').textContent     = state.currentOccupancy.toLocaleString();
  $('stat-occupancy-cap').textContent = `/ ${state.capacity.toLocaleString()}`;

  const bar = $('stat-occupancy-bar');
  const track = bar.closest('[role="progressbar"]');
  track.setAttribute('aria-valuenow', pct);

  // Animate bar after short delay
  setTimeout(() => { bar.style.width = pct + '%'; }, 200);

  // Capacity %
  $('stat-capacity-pct').textContent = pct + '%';

  // Avg duration
  $('stat-avg-duration').textContent = fmtDuration(state.avgVisitMinutes);

  // Peak hour
  $('stat-peak-hour').textContent = state.peakHour;
  $('stat-peak-sub').textContent  =
    state.peakHoursAway > 0 ? `Expected in ${state.peakHoursAway} hours` : 'Happening now';
}

// ─── Trend Chart ──────────────────────────────────────────────────────────────

function currentHourIndex() {
  // Map current real hour to the nearest slot (8–16)
  const h = new Date().getHours();
  const base = 8;
  const idx  = Math.max(0, Math.min(ADMIN_STATE.hourlyData.length - 1, h - base));
  return idx;
}

function renderTrendChart(state) {
  const data    = state.hourlyData;
  const labels  = state.hourLabels;
  const nowIdx  = currentHourIndex();
  const maxVal  = Math.max(...data);

  const barsEl   = $('trend-bars');
  const labelsEl = $('trend-x-labels');

  // Bars
  barsEl.innerHTML = data.map((val, i) => {
    const cls = i < nowIdx ? 'trend-bar--past' : i === nowIdx ? 'trend-bar--current' : 'trend-bar--future';
    return `<div class="trend-bar-col">
      <div class="trend-bar ${cls}" data-val="${val}" style="height:0%" data-pct="${Math.round((val/maxVal)*100)}"></div>
    </div>`;
  }).join('');

  // X labels
  labelsEl.innerHTML = labels.map((lbl, i) =>
    `<div class="trend-chart__x-label ${i === nowIdx ? 'trend-chart__x-label--current' : ''}">${lbl}</div>`
  ).join('');

  // Animate bars in
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
  list.innerHTML = alerts.map((a, i) => `
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

// ─── Visitors Badge (sidebar) ─────────────────────────────────────────────────

function renderVisitorsBadge(count) {
  const badge = $('nav-visitors-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// ─── Notice Banner ────────────────────────────────────────────────────────────

function setupNoticeBanner() {
  const btn = $('notice-banner-dismiss');
  const banner = $('notice-banner');
  if (!btn || !banner) return;
  btn.addEventListener('click', () => {
    banner.style.transition = 'opacity 0.3s, transform 0.3s';
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(8px)';
    setTimeout(() => { banner.style.display = 'none'; }, 320);
  });
}

// ─── Generate Report Button ───────────────────────────────────────────────────

function setupReportButton() {
  const btn = $('btn-generate-report');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="animation:spin 0.8s linear infinite">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Generating…`;

    // Inject spin keyframes once
    if (!document.getElementById('spin-style')) {
      const s = document.createElement('style');
      s.id = 'spin-style';
      s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(s);
    }

    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        Report Ready`;

      setTimeout(() => {
        btn.innerHTML = original;
      }, 2200);
    }, 1800);
  });
}

// ─── Simulated Live Update ────────────────────────────────────────────────────

function simulateLiveUpdate() {
  const delta = Math.floor(Math.random() * 14) - 5; // ±
  ADMIN_STATE.currentOccupancy = Math.min(
    ADMIN_STATE.capacity,
    Math.max(0, ADMIN_STATE.currentOccupancy + delta)
  );
  renderStats(ADMIN_STATE);
}

// ─── Sidebar Nav Click (SPA-style active state) ───────────────────────────────

function setupSidebarNav() {
  document.querySelectorAll('.sidebar__link').forEach(link => {
    link.addEventListener('click', function(e) {
      // Only handle hash links (not real page links)
      if (!this.getAttribute('href')?.startsWith('#')) return;
      e.preventDefault();
      document.querySelectorAll('.sidebar__link').forEach(l => {
        l.classList.remove('sidebar__link--active');
        l.removeAttribute('aria-current');
      });
      this.classList.add('sidebar__link--active');
      this.setAttribute('aria-current', 'page');
    });
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  renderStats(ADMIN_STATE);
  renderTrendChart(ADMIN_STATE);
  renderAlerts(ADMIN_STATE.alerts);
  renderVisitorsBadge(3);
  setupNoticeBanner();
  setupReportButton();
  setupSidebarNav();

  // Simulated live updates every 20 s
  setInterval(simulateLiveUpdate, 20_000);
}

document.addEventListener('DOMContentLoaded', init);

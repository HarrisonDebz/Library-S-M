/**
 * LSM — Public Status Page
 * Drives all dynamic content on ui/index.html.
 *
 * Data strategy: realistic mock data with a simulated live-update tick.
 * When a real API is available, replace `fetchStatus()` with an actual fetch().
 */

'use strict';

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_STATE = {
  capacity: 1200,
  currentOccupancy: 942,

  notice: {
    title: 'High Priority Notice',
    body: 'The 3rd-floor silent study area is temporarily closed for maintenance until 2:00 PM. Please use the 4th-floor overflow spaces.',
  },

  hours: [
    { name: 'Main Floors',        time: '8:00 AM – 11:00 PM', closed: false },
    { name: 'Special Collections', time: '10:00 AM – 5:00 PM', closed: false },
    { name: 'Cafe',               time: 'Closed',              closed: true  },
  ],

  /** Predicted traffic for each slot (0–100 %) — index 0 = 8 AM */
  trafficToday:    [8, 18, 52, 70, 85, 88, 75, 48, 30, 20],
  trafficTomorrow: [6, 14, 45, 62, 78, 80, 68, 42, 25, 16],
  timeSlots: ['8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p'],
};

// Current hour slot index for "now" highlighting (8a=0, 10a=1, 12p=2 …)
function currentSlotIndex() {
  const h = new Date().getHours();
  // slots: 8,10,12,14,16,18,20,22
  const slotHours = [8, 10, 12, 14, 16, 18, 20, 22];
  for (let i = slotHours.length - 1; i >= 0; i--) {
    if (h >= slotHours[i]) return i;
  }
  return 0;
}

// ─── DOM References ───────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const els = {
  badge:        $('occupancy-badge'),
  pct:          $('occupancy-pct'),
  pctLabel:     $('occupancy-pct-label'),
  bar:          $('occupancy-bar'),
  barTrack:     document.querySelector('[role="progressbar"]'),
  diamondBg:    $('diamond-bg'),
  diamondCount: $('diamond-count'),
  lastUpdated:  $('last-updated'),
  noticeBody:   $('notice-body'),
  hoursList:    $('hours-list'),
  chartBars:    $('chart-bars'),
  chartXLabels: $('chart-x-labels'),
  btnToday:     $('chart-btn-today'),
  btnTomorrow:  $('chart-btn-tomorrow'),
};

// ─── Occupancy Logic ──────────────────────────────────────────────────────────

function getOccupancyLevel(pct) {
  if (pct >= 95) return { label: 'FULL',     cls: 'badge--full'     };
  if (pct >= 75) return { label: 'BUSY',     cls: 'badge--busy'     };
  if (pct >= 40) return { label: 'MODERATE', cls: 'badge--moderate' };
  return              { label: 'QUIET',    cls: 'badge--quiet'    };
}

function getPctLabel(pct) {
  if (pct >= 95) return 'At Full Capacity';
  if (pct >= 75) return 'Capacity Reached';
  if (pct >= 40) return 'Moderately Busy';
  return              'Plenty of Space';
}

function getDiamondColor(pct) {
  if (pct >= 95) return { border: '#e8524a', glow: 'rgba(232,82,74,0.14)' };
  if (pct >= 75) return { border: '#5bb3e8', glow: 'rgba(30,144,212,0.18)' };
  if (pct >= 40) return { border: '#f5a623', glow: 'rgba(245,166,35,0.14)' };
  return              { border: '#2dce89', glow: 'rgba(45,206,137,0.14)' };
}

function renderOccupancy(state) {
  const { capacity, currentOccupancy } = state;
  const pct = Math.min(100, Math.round((currentOccupancy / capacity) * 100));
  const level = getOccupancyLevel(pct);
  const colors = getDiamondColor(pct);

  // Badge
  els.badge.textContent = level.label;
  els.badge.className = 'badge ' + level.cls;

  // Percentage
  els.pct.textContent = pct + '%';
  els.pctLabel.textContent = getPctLabel(pct);

  // Progress bar
  els.bar.style.width = pct + '%';
  els.barTrack.setAttribute('aria-valuenow', pct);

  // Diamond
  els.diamondCount.textContent = `${currentOccupancy.toLocaleString()} / ${capacity.toLocaleString()}`;
  els.diamondBg.style.borderColor = colors.border;
  els.diamondBg.style.background  = colors.glow;
}

// ─── Hours ────────────────────────────────────────────────────────────────────

function renderHours(hours) {
  els.hoursList.innerHTML = hours.map(row => `
    <li class="hours-row">
      <span class="hours-row__name">${row.name}</span>
      <span class="hours-row__time ${row.closed ? 'hours-row__time--closed' : ''}">${row.time}</span>
    </li>
  `).join('');
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

let activeDay = 'today';

function renderChart(day) {
  activeDay = day;
  const data    = day === 'today' ? MOCK_STATE.trafficToday : MOCK_STATE.trafficTomorrow;
  const slots   = MOCK_STATE.timeSlots;
  const nowIdx  = day === 'today' ? currentSlotIndex() : -1;
  const maxData = Math.max(...data);
  const scale   = maxData > 0 ? (100 / maxData) : 1; // normalise to fill chart height

  // Toggle button states
  els.btnToday.classList.toggle('chart-toggle__btn--active', day === 'today');
  els.btnToday.setAttribute('aria-pressed', String(day === 'today'));
  els.btnTomorrow.classList.toggle('chart-toggle__btn--active', day === 'tomorrow');
  els.btnTomorrow.setAttribute('aria-pressed', String(day === 'tomorrow'));

  // Bars
  els.chartBars.innerHTML = data.map((val, i) => {
    let cls;
    if (day === 'tomorrow') {
      cls = 'bar-chart__bar--tomorrow';
    } else if (i < nowIdx) {
      cls = 'bar-chart__bar--past';
    } else if (i === nowIdx) {
      cls = 'bar-chart__bar--current';
    } else {
      cls = 'bar-chart__bar--future';
    }
    const pctHeight = Math.round(val * scale);
    const label = slots[i] ?? '';
    return `
      <div class="bar-chart__bar-col">
        <div
          class="bar-chart__bar ${cls}"
          data-pct="${val}%"
          data-slot="${label}"
          style="height: 0%"
          role="presentation"
        ></div>
      </div>`;
  }).join('');

  // X-axis labels
  els.chartXLabels.innerHTML = slots.map(s => `
    <div class="bar-chart__x-label">${s}</div>
  `).join('');

  // Animate bars in on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll('.bar-chart__bar').forEach((bar, i) => {
        const val = data[i] ?? 0;
        bar.style.height = Math.round(val * scale) + '%';
      });
    });
  });
}

// ─── Last Updated Ticker ──────────────────────────────────────────────────────

let secondsAgo = 0;

function updateTimestamp() {
  secondsAgo++;
  if (secondsAgo < 60) {
    els.lastUpdated.textContent = secondsAgo <= 5 ? 'Just now' : `${secondsAgo}s ago`;
  } else {
    const m = Math.floor(secondsAgo / 60);
    els.lastUpdated.textContent = `${m}m ago`;
  }
}

// ─── Simulated Live Update ────────────────────────────────────────────────────

/** Nudge occupancy ±3–12 students every 30 s to simulate live data */
function simulateLiveUpdate() {
  const delta = Math.floor(Math.random() * 16) - 6; // -6 to +9
  MOCK_STATE.currentOccupancy = Math.min(
    MOCK_STATE.capacity,
    Math.max(0, MOCK_STATE.currentOccupancy + delta)
  );
  secondsAgo = 0;
  renderOccupancy(MOCK_STATE);
  els.lastUpdated.textContent = 'Just now';
}

// ─── Notice Details Modal (simple inline expand) ──────────────────────────────

function setupNoticeButton() {
  const btn = $('notice-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('data-expanded') === 'true';
    if (!expanded) {
      btn.textContent = 'Hide Details';
      btn.setAttribute('data-expanded', 'true');
      const extra = document.createElement('p');
      extra.id = 'notice-extra';
      extra.style.cssText = 'margin-top:12px;font-size:13px;color:rgba(255,255,255,0.82);line-height:1.6;';
      extra.textContent = 'Maintenance crews are replacing carpet tiles. Expected completion: 2:00 PM today. The 4th-floor east wing has 80+ additional seats available. Librarians on-site can assist with locating overflow resources.';
      $('notice-card').insertBefore(extra, btn);
    } else {
      btn.textContent = 'View Details';
      btn.removeAttribute('data-expanded');
      const extra = $('notice-extra');
      if (extra) extra.remove();
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  // Occupancy
  renderOccupancy(MOCK_STATE);

  // Hours
  renderHours(MOCK_STATE.hours);

  // Chart
  renderChart('today');

  // Chart toggle
  els.btnToday.addEventListener('click',    () => renderChart('today'));
  els.btnTomorrow.addEventListener('click', () => renderChart('tomorrow'));

  // Timestamp ticker — every second
  setInterval(updateTimestamp, 1000);

  // Simulated live data — every 30 s
  setInterval(simulateLiveUpdate, 30_000);

  // Notice button
  setupNoticeButton();

  // Animate progress bar on load (slight delay for visual effect)
  setTimeout(() => {
    const pct = Math.min(100, Math.round(
      (MOCK_STATE.currentOccupancy / MOCK_STATE.capacity) * 100
    ));
    els.bar.style.width = pct + '%';
  }, 300);
}

document.addEventListener('DOMContentLoaded', init);

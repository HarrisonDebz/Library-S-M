/**
 * LSM — Scan Terminal Controller
 * Drives all interactive behavior on ui/scan.html.
 */

'use strict';

import { lsmStore } from './store.js';

let activeMode = 'auto';

const $ = (id) => document.getElementById(id);

const els = {
  form:          $('scan-form'),
  input:         $('scan-input'),
  resultCard:    $('scan-result-card'),
  resultTitle:   $('scan-result-title'),
  resultTime:    $('scan-result-time'),
  resultDetails: $('scan-result-details'),
  occupancyVal:  $('sidebar-occupancy-val'),
  occupancyLbl:  $('sidebar-occupancy-lbl'),
  barFill:       $('sidebar-bar-fill'),
  statusLbl:     $('sidebar-status-lbl'),
  logList:       $('scan-log-list'),
  modeAuto:      $('mode-btn-auto'),
  modeIn:        $('mode-btn-in'),
  modeOut:       $('mode-btn-out'),
  chipsContainer:$('scan-chips'),
};

function setupModeToggle() {
  const modeBtns = [els.modeAuto, els.modeIn, els.modeOut];
  modeBtns.forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('scan-mode-btn--active'));
      btn.classList.add('scan-mode-btn--active');
      activeMode = btn.dataset.mode;
      els.input.focus();
    });
  });
}

function renderSidebar(state) {
  const { currentOccupancy, capacity, recentScans } = state;
  const pct = Math.min(100, Math.round((currentOccupancy / capacity) * 100));

  if (els.occupancyVal) els.occupancyVal.textContent = currentOccupancy.toLocaleString();
  if (els.occupancyLbl) els.occupancyLbl.textContent = `out of ${capacity.toLocaleString()} capacity (${pct}%)`;

  if (els.barFill) {
    els.barFill.style.width = pct + '%';
  }

  if (els.statusLbl) {
    if (pct >= 95) {
      els.statusLbl.textContent = 'FULL';
      els.statusLbl.style.color = 'var(--color-danger)';
    } else if (pct >= 75) {
      els.statusLbl.textContent = 'BUSY';
      els.statusLbl.style.color = 'var(--color-primary)';
    } else if (pct >= 40) {
      els.statusLbl.textContent = 'MODERATE';
      els.statusLbl.style.color = 'var(--color-warning)';
    } else {
      els.statusLbl.textContent = 'QUIET';
      els.statusLbl.style.color = 'var(--color-success)';
    }
  }

  // Render recent scans
  if (els.logList) {
    const scans = recentScans || [];
    if (scans.length === 0) {
      els.logList.innerHTML = '<div style="font-size:12px; color:var(--color-text-muted); text-align:center; padding:12px 0;">No scans logged yet.</div>';
    } else {
      els.logList.innerHTML = scans.slice(0, 8).map(s => `
        <div class="scan-log-item">
          <div>
            <div class="scan-log-item__name">${s.studentName}</div>
            <div style="font-size:10px; color:var(--color-text-muted);">${s.barcode} • ${s.time}</div>
          </div>
          <span class="scan-log-item__badge ${s.action === 'CHECK_IN' ? 'scan-log-item__badge--in' : 'scan-log-item__badge--out'}">
            ${s.action === 'CHECK_IN' ? 'In' : 'Out'}
          </span>
        </div>
      `).join('');
    }
  }
}

function showResultCard(isSuccess, title, message, time) {
  if (!els.resultCard) return;

  els.resultCard.className = `scan-result-card scan-result-card--show ${
    isSuccess
      ? (title.includes('CHECK_IN') || title.includes('In') ? 'scan-result-card--checkin' : 'scan-result-card--checkout')
      : 'scan-result-card--error'
  }`;

  els.resultTitle.innerHTML = isSuccess
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: ${title.includes('Check-in') ? '#128256' : '#1e7fc4'};"><polyline points="20 6 9 17 5 12"/></svg> ${title}`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-danger);"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${title}`;

  els.resultTime.textContent = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  els.resultDetails.textContent = message;
}

function handleScan(barcodeValue) {
  const code = (barcodeValue || els.input.value).trim();
  if (!code) return;

  try {
    const res = lsmStore.processScan(code, activeMode);
    const actionLabel = res.action === 'CHECK_IN' ? 'Check-in Successful' : 'Check-out Successful';
    showResultCard(true, actionLabel, res.message, res.timestamp);
    els.input.value = '';
  } catch (err) {
    showResultCard(false, 'Scan Error', err.message || 'Failed to process barcode.', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }

  els.input.focus();
}

function setupChips() {
  if (!els.chipsContainer) return;
  els.chipsContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.scan-chip');
    if (!chip) return;
    const code = chip.dataset.code;
    if (code) {
      els.input.value = code;
      handleScan(code);
    }
  });
}

function init() {
  setupModeToggle();
  setupChips();

  if (els.form) {
    els.form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleScan();
    });
  }

  // Subscribe to store updates
  lsmStore.subscribe((state) => {
    renderSidebar(state);
  });

  // Initial render
  renderSidebar(lsmStore.getState());
  if (els.input) els.input.focus();
}

document.addEventListener('DOMContentLoaded', init);

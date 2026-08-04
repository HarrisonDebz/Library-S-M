/**
 * LSM Store — Centralized State Management for Library Space Monitor
 * Synchronizes Public Status, Scan Terminal, and Admin Dashboard via LocalStorage and Events.
 */

'use strict';

const STORAGE_KEY = 'LSM_STATE_V1';

const INITIAL_STUDENTS = {
  'STU-88219': { name: 'Sarah Jenkins', role: 'Student', barcode: 'STU-88219', active: true },
  'FAC-11024': { name: 'Michael Chang', role: 'Faculty', barcode: 'FAC-11024', active: true },
  'GST-9921':  { name: 'Guest User',    role: 'Guest',   barcode: 'GST-9921',  active: true },
  'STU-44122': { name: 'Emily Chen',    role: 'Student', barcode: 'STU-44122', active: true },
  'STU-77531': { name: 'David Miller',  role: 'Student', barcode: 'STU-77531', active: true },
  'STU-33901': { name: 'Priya Nair',    role: 'Student', barcode: 'STU-33901', active: true },
  'STU-55812': { name: 'Tom Bradley',   role: 'Student', barcode: 'STU-55812', active: true },
  'FAC-29901': { name: 'Lena Koch',     role: 'Faculty', barcode: 'FAC-29901', active: true },
  'STU-61700': { name: 'James Wu',      role: 'Student', barcode: 'STU-61700', active: true },
  'STU-90042': { name: 'Aisha Kamara',  role: 'Student', barcode: 'STU-90042', active: true },
  'STU-10293': { name: 'Carlos Diaz',   role: 'Student', barcode: 'STU-10293', active: true },
  'STU-48833': { name: 'Hannah Lee',    role: 'Student', barcode: 'STU-48833', active: true },
};

const INITIAL_HISTORY = [
  { name: 'Sarah Jenkins',  id: 'STU-88219', zone: 'Main Floor',    zoneKey: 'main',  event: 'entry', time: 'Just now',            method: 'RFID Scan' },
  { name: 'Michael Chang',  id: 'FAC-11024', zone: 'Quiet Study B', zoneKey: 'quiet', event: 'exit',  time: '10 mins ago',          method: 'App Tap' },
  { name: 'Guest User',     id: 'GST-9921',  zone: 'Lobby',         zoneKey: 'main',  event: 'entry', time: '25 mins ago',          method: 'Manual Entry' },
  { name: 'Emily Chen',     id: 'STU-44122', zone: 'Group Room 4',  zoneKey: 'group', event: 'entry', time: '45 mins ago',          method: 'RFID Scan' },
  { name: 'David Miller',   id: 'STU-77531', zone: 'Main Floor',    zoneKey: 'main',  event: 'exit',  time: '1 hour ago',           method: 'Turnstile' },
  { name: 'Priya Nair',     id: 'STU-33901', zone: 'Quiet Study A', zoneKey: 'quiet', event: 'entry', time: '1 hour 20 mins ago',  method: 'RFID Scan' },
  { name: 'Tom Bradley',    id: 'STU-55812', zone: 'Group Room 2',  zoneKey: 'group', event: 'exit',  time: '2 hours ago',          method: 'App Tap' },
  { name: 'Lena Koch',      id: 'FAC-29901', zone: 'Main Floor',    zoneKey: 'main',  event: 'entry', time: '3 hours ago',          method: 'RFID Scan' },
];

function getDefaultState() {
  return {
    capacity: 1200,
    currentOccupancy: 482,
    avgVisitMinutes: 105,
    hourlyData: [120, 195, 290, 360, 455, 482, 440, 370, 280],
    hourLabels: ['8a','9a','10a','11a','12p','1p','2p','3p','4p'],
    students: INITIAL_STUDENTS,
    activeVisits: {
      'STU-88219': { visitId: 'v-101', studentName: 'Sarah Jenkins', barcode: 'STU-88219', checkInTime: Date.now() - 600000 },
      'GST-9921':  { visitId: 'v-102', studentName: 'Guest User',    barcode: 'GST-9921',  checkInTime: Date.now() - 1500000 },
      'STU-44122': { visitId: 'v-103', studentName: 'Emily Chen',    barcode: 'STU-44122', checkInTime: Date.now() - 2700000 },
      'STU-33901': { visitId: 'v-104', studentName: 'Priya Nair',    barcode: 'STU-33901', checkInTime: Date.now() - 4800000 },
      'FAC-29901': { visitId: 'v-105', studentName: 'Lena Koch',     barcode: 'FAC-29901', checkInTime: Date.now() - 10800000 },
    },
    history: INITIAL_HISTORY,
    recentScans: [],
    alerts: [
      { type: 'warning', title: 'Capacity Warning: Study Room B', desc: 'Occupancy exceeded 90% threshold.', time: '10 mins ago' },
      { type: 'info', title: 'Scanner Terminal Active', desc: 'Entry terminal ready for scans.', time: 'Just now' },
    ],
  };
}

class Store {
  constructor() {
    this.state = this.loadState();
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        this.state = this.loadState();
        this.notifyListeners();
      }
    });
  }

  loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const initialState = getDefaultState();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
        return initialState;
      }
      const parsed = JSON.parse(raw);
      return { ...getDefaultState(), ...parsed };
    } catch (err) {
      console.warn('Failed to parse LSM state from LocalStorage, resetting:', err);
      const initialState = getDefaultState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
      return initialState;
    }
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.notifyListeners();
    } catch (err) {
      console.error('Failed to save LSM state:', err);
    }
  }

  notifyListeners() {
    window.dispatchEvent(new CustomEvent('lsm-state-changed', { detail: this.state }));
  }

  getState() {
    return this.state;
  }

  subscribe(callback) {
    const handler = (e) => callback(e.detail);
    window.addEventListener('lsm-state-changed', handler);
    return () => window.removeEventListener('lsm-state-changed', handler);
  }

  /**
   * Process a barcode scan.
   * @param {string} rawBarcode
   * @param {'auto'|'check_in'|'check_out'} mode
   */
  processScan(rawBarcode, mode = 'auto') {
    const barcode = String(rawBarcode || '').trim().toUpperCase();
    if (!barcode) {
      throw new Error('Please enter or scan a valid barcode.');
    }

    let student = this.state.students[barcode];
    if (!student) {
      student = {
        name: `Student (${barcode})`,
        role: 'Student',
        barcode: barcode,
        active: true,
      };
      this.state.students[barcode] = student;
    }

    const isInside = Boolean(this.state.activeVisits[barcode]);
    let action = '';

    if (mode === 'check_in') {
      if (isInside) {
        throw new Error(`${student.name} is already checked in.`);
      }
      action = 'CHECK_IN';
    } else if (mode === 'check_out') {
      if (!isInside) {
        throw new Error(`${student.name} is not currently checked in.`);
      }
      action = 'CHECK_OUT';
    } else {
      action = isInside ? 'CHECK_OUT' : 'CHECK_IN';
    }

    const nowFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (action === 'CHECK_IN') {
      if (this.state.currentOccupancy >= this.state.capacity) {
        throw new Error(`Library capacity limit (${this.state.capacity}) reached. Check-in blocked.`);
      }

      this.state.currentOccupancy += 1;
      this.state.activeVisits[barcode] = {
        visitId: 'v-' + Date.now(),
        studentName: student.name,
        barcode: barcode,
        checkInTime: Date.now(),
      };

      const historyEntry = {
        name: student.name,
        id: barcode,
        zone: 'Main Entrance',
        zoneKey: 'main',
        event: 'entry',
        time: nowFormatted,
        method: 'Barcode Scan',
      };

      this.state.history.unshift(historyEntry);

      const scanRecord = {
        id: 'scan-' + Date.now(),
        action: 'CHECK_IN',
        studentName: student.name,
        barcode: barcode,
        time: nowFormatted,
        occupancyAfter: this.state.currentOccupancy,
      };

      if (!this.state.recentScans) this.state.recentScans = [];
      this.state.recentScans.unshift(scanRecord);
      if (this.state.recentScans.length > 20) this.state.recentScans.pop();

      if (this.state.hourlyData && this.state.hourlyData.length > 0) {
        const lastIdx = this.state.hourlyData.length - 1;
        this.state.hourlyData[lastIdx] = this.state.currentOccupancy;
      }

      this.saveState();

      return {
        success: true,
        action: 'CHECK_IN',
        student,
        currentOccupancy: this.state.currentOccupancy,
        capacity: this.state.capacity,
        timestamp: nowFormatted,
        message: `Check-in successful: ${student.name} (${barcode})`,
      };

    } else {
      // CHECK_OUT
      this.state.currentOccupancy = Math.max(0, this.state.currentOccupancy - 1);
      delete this.state.activeVisits[barcode];

      const historyEntry = {
        name: student.name,
        id: barcode,
        zone: 'Main Exit',
        zoneKey: 'main',
        event: 'exit',
        time: nowFormatted,
        method: 'Barcode Scan',
      };

      this.state.history.unshift(historyEntry);

      const scanRecord = {
        id: 'scan-' + Date.now(),
        action: 'CHECK_OUT',
        studentName: student.name,
        barcode: barcode,
        time: nowFormatted,
        occupancyAfter: this.state.currentOccupancy,
      };

      if (!this.state.recentScans) this.state.recentScans = [];
      this.state.recentScans.unshift(scanRecord);
      if (this.state.recentScans.length > 20) this.state.recentScans.pop();

      if (this.state.hourlyData && this.state.hourlyData.length > 0) {
        const lastIdx = this.state.hourlyData.length - 1;
        this.state.hourlyData[lastIdx] = this.state.currentOccupancy;
      }

      this.saveState();

      return {
        success: true,
        action: 'CHECK_OUT',
        student,
        currentOccupancy: this.state.currentOccupancy,
        capacity: this.state.capacity,
        timestamp: nowFormatted,
        message: `Check-out successful: ${student.name} (${barcode})`,
      };
    }
  }

  updateCapacity(newCap) {
    const cap = parseInt(newCap, 10);
    if (isNaN(cap) || cap <= 0) return;
    this.state.capacity = cap;
    this.saveState();
  }

  resetDemoState() {
    this.state = getDefaultState();
    this.saveState();
  }
}

export const lsmStore = new Store();

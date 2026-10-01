import { fetchLiveCrossingStatus, fetchHistoricalReports, THRESHOLDS, setSimulatedStage, SIMULATED_STAGE } from './api.js';

let hydrographChart = null;
let historicalData = [];
let currentRange = '24h';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  setupEventListeners();
  await refreshData();

  setInterval(() => {
    refreshData(false);
  }, 60000);
}

function setupEventListeners() {
  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.addEventListener('click', () => {
    refreshData(true);
  });

  // Footer toggle link for Test Simulator
  const toggleSimBtn = document.getElementById('toggle-sim-btn');
  const simPanel = document.getElementById('sim-panel');
  toggleSimBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    simPanel?.classList.toggle('hidden');
    if (!simPanel?.classList.contains('hidden')) {
      simPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // Simulation State Buttons
  const simBtns = document.querySelectorAll('.sim-btn');
  const simLabel = document.getElementById('sim-active-label');

  simBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      simBtns.forEach(b => b.classList.remove('active', 'bg-amber-500/30', 'bg-rose-500/30', 'bg-red-600/40', 'bg-sky-500/30'));
      e.target.classList.add('active');

      const simVal = e.target.getAttribute('data-sim');
      if (simVal === 'live') {
        setSimulatedStage(null);
        if (simLabel) {
          simLabel.textContent = 'Mode: Live Data';
          simLabel.className = 'text-sky-400 font-bold';
        }
      } else {
        const val = parseFloat(simVal);
        setSimulatedStage(val);
        if (simLabel) {
          if (val > 4.0) {
            simLabel.textContent = `Mode: Extreme Flood (${val.toFixed(2)}')`;
            simLabel.className = 'text-red-400 font-bold animate-pulse';
          } else if (val >= THRESHOLDS.ROAD_DECK) {
            simLabel.textContent = `Mode: Water @ Road (${val.toFixed(2)}')`;
            simLabel.className = 'text-rose-400 font-bold';
          } else {
            simLabel.textContent = `Mode: Normal (${val.toFixed(2)}')`;
            simLabel.className = 'text-emerald-400 font-bold';
          }
        }
      }

      refreshData(true);
    });
  });

  const rangeBtns = document.querySelectorAll('.range-btn');
  rangeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      rangeBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentRange = e.target.getAttribute('data-range');
      updateHydrographChart();
    });
  });

  const alertDismiss = document.getElementById('alert-dismiss');
  alertDismiss?.addEventListener('click', () => {
    document.getElementById('status-alert').classList.add('hidden');
  });
}

async function refreshData(userInitiated = false) {
  const refreshIcon = document.getElementById('refresh-icon');
  if (userInitiated) {
    refreshIcon?.classList.add('animate-spin');
  }

  try {
    const [status, history] = await Promise.all([
      fetchLiveCrossingStatus(),
      fetchHistoricalReports(300),
    ]);

    historicalData = history;

    updateMainStatusCard(status);
    updateMetricsGrid(status, history);
    updateRainfallCard(status.rain);
    updateHydrographChart();
    updateHistoryTable(history);

    if (SIMULATED_STAGE !== null) {
      if (status.stage > 4.0) {
        showAlert(`🚨 EXTREME FLOOD SIMULATION: Water stage is ${status.stage.toFixed(2)} ft (${Math.abs(status.clearanceToRoad).toFixed(2)} ft over road)!`, 'rose');
      } else {
        showAlert(`Simulated Mode Active: Water stage set to ${status.stage.toFixed(2)} ft.`, 'amber');
      }
    } else if (status.isFallback) {
      showAlert('Notice: Showing cached offline preview data.', 'amber');
    }

  } catch (err) {
    console.error('Error refreshing app data:', err);
    showAlert('Error loading live data. Please check connection.', 'rose');
  } finally {
    if (userInitiated) {
      setTimeout(() => {
        refreshIcon?.classList.remove('animate-spin');
      }, 500);
    }
  }
}

function updateMainStatusCard(status) {
  const card = document.getElementById('main-status-card');
  const glow = document.getElementById('status-glow');
  const badge = document.getElementById('status-badge');
  const badgeText = document.getElementById('status-badge-text');
  const clearanceVal = document.getElementById('clearance-val');
  const clearanceDesc = document.getElementById('clearance-desc');
  const lastUpdatedText = document.getElementById('last-updated-text');

  const vGaugeFill = document.getElementById('v-gauge-fill');
  const vStageVal = document.getElementById('v-stage-val');

  const labelTop = document.getElementById('v-label-top');
  const lineRoad = document.getElementById('v-line-road');
  const lineClosed = document.getElementById('v-line-closed');
  const labelRoad = document.getElementById('v-label-road');
  const labelClosed = document.getElementById('v-label-closed');

  const { stage, clearanceToRoad, statusState, lastRpt } = status;

  lastUpdatedText.textContent = `Updated ${formatReportTime(lastRpt)}`;
  clearanceVal.textContent = Math.abs(clearanceToRoad).toFixed(2);
  vStageVal.textContent = `${stage.toFixed(2)} ft`;

  let maxStaffHeight = 4.00;
  if (stage > 4.00) {
    maxStaffHeight = Math.ceil(stage + 1.0);
  }

  const roadDeckPct = (THRESHOLDS.ROAD_DECK / maxStaffHeight) * 100;
  const roadClosedPct = (THRESHOLDS.ROAD_CLOSED / maxStaffHeight) * 100;
  const heightPercentage = Math.min(Math.max((stage / maxStaffHeight) * 100, 2), 100);

  if (labelTop) labelTop.textContent = `${maxStaffHeight.toFixed(1)}'`;
  if (lineRoad) lineRoad.style.bottom = `${roadDeckPct}%`;
  if (lineClosed) lineClosed.style.bottom = `${roadClosedPct}%`;
  if (labelRoad) labelRoad.style.bottom = `${roadDeckPct}%`;
  if (labelClosed) labelClosed.style.bottom = `${roadClosedPct}%`;

  vGaugeFill.style.height = `${heightPercentage}%`;

  card.className = 'rounded-2xl border p-5 relative overflow-hidden transition-all duration-500 ';

  if (statusState === 'CLOSED') {
    card.classList.add('bg-slate-800/80', 'border-rose-500/50');
    glow.className = 'absolute -top-24 -left-24 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none';
    badge.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center space-x-1.5';
    
    if (clearanceToRoad < 0) {
      badgeText.textContent = 'EXTREME FLOOD';
      clearanceDesc.textContent = `🚨 Water is ${Math.abs(clearanceToRoad).toFixed(2)} ft OVER road deck (3.37 ft)!`;
    } else {
      badgeText.textContent = 'ROAD CLOSED';
      clearanceDesc.textContent = `⚠️ Water touches road deck level (3.37 ft)!`;
    }
  } else if (statusState === 'CAUTION') {
    card.classList.add('bg-slate-800/80', 'border-amber-500/50');
    glow.className = 'absolute -top-24 -left-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none';
    badge.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center space-x-1.5';
    badgeText.textContent = 'WATER RISING / CAUTION';
    clearanceDesc.textContent = `Water is ${clearanceToRoad.toFixed(2)} ft below road deck`;
  } else {
    card.classList.add('bg-slate-800/70', 'border-emerald-500/30');
    glow.className = 'absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none';
    badge.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1.5';
    badgeText.textContent = 'ROAD OPEN';
    clearanceDesc.textContent = `Water is ${clearanceToRoad.toFixed(2)} ft below road deck`;
  }

  if (stage >= THRESHOLDS.ROAD_DECK) {
    vGaugeFill.className = 'w-full bg-gradient-to-t from-rose-600 via-rose-500 to-red-400 rounded-b-xl transition-all duration-700 relative';
  } else if (stage >= THRESHOLDS.PRELIMINARY_ALARM) {
    vGaugeFill.className = 'w-full bg-gradient-to-t from-amber-600 via-amber-500 to-yellow-400 rounded-b-xl transition-all duration-700 relative';
  } else {
    vGaugeFill.className = 'w-full bg-gradient-to-t from-sky-600 via-sky-500 to-cyan-400 rounded-b-xl transition-all duration-700 relative';
  }
}

function updateMetricsGrid(status, history) {
  document.getElementById('stage-val').textContent = status.stage.toFixed(2);
  document.getElementById('flow-val').textContent = `Flow: ${status.flow.toFixed(1)} cfs`;

  const trend = calculateTrend(history);
  document.getElementById('trend-icon').textContent = trend.icon;
  document.getElementById('trend-val').textContent = trend.label;
  document.getElementById('trend-rate').textContent = trend.detail;

  const flasherVal = document.getElementById('flasher-val');
  const flasherDot = document.getElementById('flasher-dot');
  const flasherDesc = document.getElementById('flasher-desc');

  if (status.flasher.active) {
    flasherVal.textContent = 'FLASHING';
    flasherVal.className = 'text-sm font-bold text-rose-400';
    flasherDot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0';
    flasherDesc.textContent = `Status: ${status.flasher.masterStatus}`;
  } else {
    flasherVal.textContent = 'OFF';
    flasherVal.className = 'text-sm font-bold text-emerald-400';
    flasherDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0';
    flasherDesc.textContent = 'Inactive';
  }
}

function updateRainfallCard(rain) {
  document.getElementById('rain-15m').textContent = `${rain.min15}"`;
  document.getElementById('rain-1h').textContent = `${rain.hour1}"`;
  document.getElementById('rain-24h').textContent = `${rain.hour24}"`;
  document.getElementById('rain-7d').textContent = `${rain.day7}"`;
}

function calculateTrend(history) {
  if (!history || history.length < 2) {
    return { icon: '➡️', label: 'Stable', detail: 'No change' };
  }

  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  const diff = latest.stage - previous.stage;

  if (diff > 0.02) {
    return { icon: '⬆️', label: 'Rising', detail: `+${diff.toFixed(2)} ft` };
  } else if (diff < -0.02) {
    return { icon: '⬇️', label: 'Falling', detail: `${diff.toFixed(2)} ft` };
  } else {
    return { icon: '➡️', label: 'Stable', detail: 'No change' };
  }
}

function updateHydrographChart() {
  const ctx = document.getElementById('hydrograph-chart')?.getContext('2d');
  if (!ctx) return;

  const now = Date.now();
  let maxAgeMs = 24 * 3600 * 1000;

  if (currentRange === '3d') {
    maxAgeMs = 3 * 24 * 3600 * 1000;
  } else if (currentRange === '7d') {
    maxAgeMs = 7 * 24 * 3600 * 1000;
  }

  const filteredHistory = historicalData.filter(r => (now - r.timestamp) <= maxAgeMs);
  const labels = filteredHistory.map(r => r.displayTime);
  const stageData = filteredHistory.map(r => r.stage);

  const maxStage = Math.max(...stageData, 4.0);

  if (hydrographChart) {
    hydrographChart.destroy();
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(244, 63, 94, 0.35)');
  gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

  hydrographChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Water Stage (ft)',
          data: stageData,
          borderColor: maxStage > 3.37 ? '#f43f5e' : '#38bdf8',
          borderWidth: 2.5,
          backgroundColor: gradient,
          fill: true,
          tension: 0.3,
          pointRadius: 1,
          pointHoverRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#94a3b8',
          bodyColor: '#38bdf8',
          borderColor: '#334155',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => `Stage: ${ctx.parsed.y} ft (${(THRESHOLDS.ROAD_DECK - ctx.parsed.y).toFixed(2)}' clearance)`
          }
        },
        annotation: {
          annotations: {
            roadDeckLine: {
              type: 'line',
              yMin: THRESHOLDS.ROAD_DECK,
              yMax: THRESHOLDS.ROAD_DECK,
              borderColor: '#f59e0b',
              borderWidth: 2,
              borderDash: [4, 4],
              label: {
                display: true,
                content: 'Road Deck (3.37\')',
                position: 'end',
                backgroundColor: 'rgba(245, 158, 11, 0.8)',
                color: '#fff',
                font: { size: 10, weight: 'bold' }
              }
            },
            roadClosedLine: {
              type: 'line',
              yMin: THRESHOLDS.ROAD_CLOSED,
              yMax: THRESHOLDS.ROAD_CLOSED,
              borderColor: '#f43f5e',
              borderWidth: 2,
              borderDash: [2, 2],
              label: {
                display: true,
                content: 'Closed (3.77\')',
                position: 'end',
                backgroundColor: 'rgba(244, 63, 94, 0.8)',
                color: '#fff',
                font: { size: 10, weight: 'bold' }
              }
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(51, 65, 85, 0.3)' },
          ticks: { color: '#64748b', maxTicksLimit: 6, font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(51, 65, 85, 0.3)' },
          ticks: { color: '#64748b', font: { size: 10 } },
          min: 0,
          suggestedMax: Math.ceil(maxStage + 0.5),
        }
      }
    }
  });
}

function updateHistoryTable(history) {
  const tbody = document.getElementById('history-table-body');
  if (!tbody) return;

  if (!history || history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-500">No recent reports available</td></tr>`;
    return;
  }

  const recent = [...history].reverse().slice(0, 10);

  tbody.innerHTML = recent.map(r => {
    let badgeClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    let badgeText = 'OPEN';

    if (r.stage >= THRESHOLDS.ROAD_DECK) {
      badgeClass = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      badgeText = 'CLOSED';
    } else if (r.stage >= THRESHOLDS.PRELIMINARY_ALARM) {
      badgeClass = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      badgeText = 'CAUTION';
    }

    return `
      <tr class="hover:bg-slate-700/20 transition">
        <td class="py-2 font-medium text-slate-300">${r.displayTime}</td>
        <td class="py-2 font-bold text-sky-400">${r.stage.toFixed(2)} ft</td>
        <td class="py-2 text-slate-400">${r.clearance} ft</td>
        <td class="py-2 text-right">
          <span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded border ${badgeClass}">
            ${badgeText}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function formatReportTime(isoStr) {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return isoStr;
  }
}

function showAlert(message, theme = 'amber') {
  const alert = document.getElementById('status-alert');
  const alertText = document.getElementById('status-alert-text');
  if (!alert || !alertText) return;

  alertText.textContent = message;
  alert.className = `p-3 rounded-xl border text-xs font-medium flex items-center justify-between transition-all duration-300 bg-${theme}-500/10 text-${theme}-400 border-${theme}-500/30`;
  alert.classList.remove('hidden');
}

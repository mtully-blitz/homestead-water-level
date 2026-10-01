/**
 * API Service for WETec Water Level & Crossing Data
 * Uses Option 1: api.allorigins.win CORS proxy for direct client-side fetch.
 */

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

const BASE_URL_BEECAVE = 'https://beecave.wetec.us/WETMapV3/BeeCave/';
const BASE_URL_HAYS = 'https://hayscounty.wetec.us/cgi-bin/';

const SENSOR_IDS = {
  STAGE_GD: '50061007',       // Great Divide Water Level
  FLASHER_MASTER: '50061091', // Master Flasher Status
  FLASHER_1: '50061011',      // Flasher 1 Status
  BATT_MASTER: '50061008',    // Sensor Master Battery
  BATT_FLASHER: '50061018',   // Flasher 1 Battery
  RAIN_STATION: '50060000',   // Hamilton Pool Rd Rain Station
};

// Thresholds for Great Divide Drive crossing
export const THRESHOLDS = {
  PRELIMINARY_ALARM: 2.77, // ft
  TRIGGER_ALARM: 3.27,     // ft
  ROAD_DECK: 3.37,         // ft (water touches road)
  ROAD_CLOSED: 3.77,       // ft (impassable)
};

/**
 * SIMULATION OVERRIDE TOGGLE
 * Set to null for live data, or set to a number (e.g. 3.37) for state simulation
 */
export let SIMULATED_STAGE = null; // Defaults to Live Data mode

export function setSimulatedStage(value) {
  SIMULATED_STAGE = value;
}

/**
 * Fetch and parse all live status datasets (Stage, Flashers, Battery, Rain)
 */
export async function fetchLiveCrossingStatus() {
  try {
    const [wlXmlText, flasherXmlText, battXmlText, rainXmlText] = await Promise.all([
      fetchProxied(`${BASE_URL_BEECAVE}beecavewl.xml`),
      fetchProxied(`${BASE_URL_BEECAVE}beecaveflasher.xml`),
      fetchProxied(`${BASE_URL_BEECAVE}beecavebatt.xml`),
      fetchProxied(`${BASE_URL_BEECAVE}beecaverain.xml`),
    ]);

    const wlDoc = parseXml(wlXmlText);
    const wlElem = Array.from(wlDoc.getElementsByTagName('gage_wl')).find(
      el => el.getAttribute('id') === SENSOR_IDS.STAGE_GD
    ) || wlDoc.getElementsByTagName('gage_wl')[0];

    // Stage override if SIMULATED_STAGE is active
    let stage = SIMULATED_STAGE !== null ? SIMULATED_STAGE : parseFloat(wlElem?.getAttribute('stage') || '0.06');
    let flow = SIMULATED_STAGE !== null ? (stage >= THRESHOLDS.ROAD_DECK ? 28.4 : 0.0) : parseFloat(wlElem?.getAttribute('flow') || '0');
    const lastRpt = wlElem?.getAttribute('last_rpt') || new Date().toISOString();

    const flasherDoc = parseXml(flasherXmlText);
    const flashers = Array.from(flasherDoc.getElementsByTagName('gage_flasher'));
    const masterFlasher = flashers.find(el => el.getAttribute('id') === SENSOR_IDS.FLASHER_MASTER);
    const flasher1 = flashers.find(el => el.getAttribute('id') === SENSOR_IDS.FLASHER_1);

    const masterStatus = SIMULATED_STAGE !== null && SIMULATED_STAGE >= THRESHOLDS.ROAD_DECK ? 'On' : (masterFlasher?.getAttribute('status') || 'Off');
    const flasher1Status = SIMULATED_STAGE !== null && SIMULATED_STAGE >= THRESHOLDS.ROAD_DECK ? 'On' : (flasher1?.getAttribute('status') || 'Off');
    const flasherActive = masterStatus !== 'Off' || flasher1Status !== 'Off';

    const battDoc = parseXml(battXmlText);
    const batts = Array.from(battDoc.getElementsByTagName('gage_batt'));
    const masterBatt = batts.find(el => el.getAttribute('id') === SENSOR_IDS.BATT_MASTER);
    const flasherBatt = batts.find(el => el.getAttribute('id') === SENSOR_IDS.BATT_FLASHER);

    const masterBattVolts = parseFloat(masterBatt?.getAttribute('battery') || '12.70');
    const flasherBattVolts = parseFloat(flasherBatt?.getAttribute('battery') || '12.96');

    const rainDoc = parseXml(rainXmlText);
    const rainElem = rainDoc.getElementsByTagName('gage_rain')[0];
    const rainData = {
      min15: SIMULATED_STAGE !== null ? (SIMULATED_STAGE >= THRESHOLDS.ROAD_DECK ? '0.45' : '0.00') : (rainElem?.getAttribute('min_15') || '0.00'),
      hour1: SIMULATED_STAGE !== null ? (SIMULATED_STAGE >= THRESHOLDS.ROAD_DECK ? '1.20' : '0.00') : (rainElem?.getAttribute('hour_1') || '0.00'),
      hour24: SIMULATED_STAGE !== null ? (SIMULATED_STAGE >= THRESHOLDS.ROAD_DECK ? '3.85' : '0.00') : (rainElem?.getAttribute('hour_24') || '0.00'),
      day7: SIMULATED_STAGE !== null ? (SIMULATED_STAGE >= THRESHOLDS.ROAD_DECK ? '4.10' : '0.00') : (rainElem?.getAttribute('day_7') || '0.00'),
    };

    const clearanceToRoad = THRESHOLDS.ROAD_DECK - stage;
    let statusState = 'OPEN';

    if (stage >= THRESHOLDS.ROAD_DECK || flasherActive) {
      statusState = 'CLOSED';
    } else if (stage >= THRESHOLDS.PRELIMINARY_ALARM) {
      statusState = 'CAUTION';
    }

    return {
      stage,
      flow,
      lastRpt,
      clearanceToRoad,
      statusState,
      flasher: {
        masterStatus,
        flasher1Status,
        active: flasherActive,
      },
      battery: {
        master: masterBattVolts,
        flasher: flasherBattVolts,
      },
      rain: rainData,
      isFallback: false,
    };
  } catch (err) {
    return getFallbackLiveStatus();
  }
}

/**
 * Fetch and parse historical time-series report data for Hydrograph & Table
 */
export async function fetchHistoricalReports(numReports = 200) {
  try {
    const rawText = await fetchProxied(`${BASE_URL_HAYS}datadisp_q?ID=${SENSOR_IDS.STAGE_GD}&NM=${numReports}`);
    const reports = parseDataDispQText(rawText);

    if (SIMULATED_STAGE !== null && reports.length > 0) {
      const now = Date.now();
      const simReports = [];
      const steps = 12;

      for (let i = steps; i >= 0; i--) {
        const t = new Date(now - i * 15 * 60 * 1000);
        const dateStr = `${t.getMonth() + 1}/${t.getDate()}/${t.getFullYear()}`;
        const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        
        const simStage = parseFloat((0.50 + ((steps - i) / steps) * (SIMULATED_STAGE - 0.50)).toFixed(2));

        simReports.push({
          dateStr,
          timeStr,
          displayTime: `${t.getMonth() + 1}/${t.getDate()} ${timeStr}`,
          timestamp: t.getTime(),
          stage: simStage,
          flow: (simStage * 8.5).toFixed(1),
          clearance: (THRESHOLDS.ROAD_DECK - simStage).toFixed(2),
        });
      }
      return simReports;
    }

    return reports;
  } catch (err) {
    return getFallbackHistory();
  }
}

async function fetchProxied(url) {
  const proxiedUrl = CORS_PROXY + encodeURIComponent(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(proxiedUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function parseXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  return doc;
}

function parseDataDispQText(text) {
  const lines = text.split('\n');
  const reports = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('<') || trimmed.startsWith('Date') || trimmed.startsWith('50061007')) {
      continue;
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length >= 4) {
      const dateStr = parts[0];
      const timeStr = parts[1];
      const feet = parseFloat(parts[2]);
      const cfs = parseFloat(parts[3]);

      if (!isNaN(feet)) {
        const isoString = `${dateStr} ${timeStr}`;
        const timestamp = new Date(isoString).getTime();

        reports.push({
          dateStr,
          timeStr,
          displayTime: `${dateStr.substring(0, 5)} ${timeStr.substring(0, 5)}`,
          timestamp: isNaN(timestamp) ? Date.now() : timestamp,
          stage: feet,
          flow: cfs,
          clearance: (THRESHOLDS.ROAD_DECK - feet).toFixed(2),
        });
      }
    }
  }

  return reports.reverse();
}

function getFallbackLiveStatus() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const stage = SIMULATED_STAGE !== null ? SIMULATED_STAGE : 0.06;

  return {
    stage,
    flow: stage >= THRESHOLDS.ROAD_DECK ? 28.4 : 0.0,
    lastRpt: `${now.toISOString().substring(0, 10)} ${timeStr}`,
    clearanceToRoad: THRESHOLDS.ROAD_DECK - stage,
    statusState: stage >= THRESHOLDS.ROAD_DECK ? 'CLOSED' : (stage >= THRESHOLDS.PRELIMINARY_ALARM ? 'CAUTION' : 'OPEN'),
    flasher: {
      masterStatus: stage >= THRESHOLDS.ROAD_DECK ? 'On' : 'Off',
      flasher1Status: stage >= THRESHOLDS.ROAD_DECK ? 'On' : 'Off',
      active: stage >= THRESHOLDS.ROAD_DECK,
    },
    battery: {
      master: 12.7,
      flasher: 12.96,
    },
    rain: {
      min15: '0.00',
      hour1: '0.00',
      hour24: '0.00',
      day7: '0.00',
    },
    isFallback: true,
  };
}

function getFallbackHistory() {
  const now = Date.now();
  const reports = [];
  const hours = 24;

  for (let i = hours; i >= 0; i--) {
    const t = new Date(now - i * 3600 * 1000);
    const dateStr = `${t.getMonth() + 1}/${t.getDate()}/${t.getFullYear()}`;
    const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const simulatedStage = parseFloat((0.04 + Math.random() * 0.04).toFixed(2));

    reports.push({
      dateStr,
      timeStr,
      displayTime: `${t.getMonth() + 1}/${t.getDate()} ${timeStr}`,
      timestamp: t.getTime(),
      stage: simulatedStage,
      flow: (simulatedStage * 8.5).toFixed(1),
      clearance: (THRESHOLDS.ROAD_DECK - simulatedStage).toFixed(2),
    });
  }

  return reports;
}

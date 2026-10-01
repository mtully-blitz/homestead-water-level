# 🌊 Great Divide Crossing — Low-Water Crossing Monitor

A modern, mobile-first web application for monitoring the real-time water level, road deck clearance, and closure status of the **Great Divide Drive at Little Barton Creek** low-water crossing (`Sensor 50061007`) in Bee Cave, Texas.

---

## ✨ Features

* **📱 Mobile-First Design**: Optimized for quick, high-visibility viewing on mobile phone screens when checking road conditions on the go.
* **📏 Vertical Staff Gauge**: Dynamic vertical stream gauge meter (0.0' to 4.0'+) showing the rising water column relative to key road thresholds with external scale labels.
* **🟢/🟡/🔴 At-a-Glance Status Header**: Immediate status badge (`ROAD OPEN`, `WATER RISING / CAUTION`, `ROAD CLOSED`, or `EXTREME FLOOD`) and exact clearance to the road deck (e.g. `3.31 ft clearance`).
* **📈 Interactive Hydrograph**: Chart.js stage height history with threshold lines for **Road Deck (3.37')** and **Road Closed (3.77')**, supporting 24h, 3d, and 7d time ranges.
* **🔄 Rate of Change & Flashers**: Calculates real-time water trends (`Rising`, `Falling`, `Stable`) and displays low-water warning flasher activity (`OFF` vs `FLASHING`).
* **🌧️ Rainfall Accumulation**: 15m, 1h, 24h, and 7d rain accumulators from the nearby Hamilton Pool Rd station.
* **📋 Recent Reports Table**: Tabular history of the last 10 station reports with status badges.
* **🧪 Test State Simulator**: Hidden developer simulation bar (toggleable via footer link) for testing app responses to dry, at-road-level (`3.37'`), closed (`3.85'`), and extreme flood (`5.20'`) conditions.

---

## 📐 Crossing Threshold Reference (`Sensor 50061007`)

| Elevation / Threshold | Stage (ft) | Description |
| :--- | :--- | :--- |
| **Preliminary Alarm** | `2.77 ft` | Water level approaching crossing advisory stage |
| **Trigger Alarm** | `3.27 ft` | High water warning trigger |
| **Road Deck Elevation** | `3.37 ft` | Water touches the low-water crossing road deck |
| **Road Closed Level** | `3.77 ft` | Crossing is completely impassable / closed |

---

## 🛰️ Live Data Feeds & CORS Strategy

Data is fetched directly from WETec and Hays County Emergency Management endpoints:

* **Water Level & Flow**: `https://beecave.wetec.us/WETMapV3/BeeCave/beecavewl.xml`
* **Flasher Status**: `https://beecave.wetec.us/WETMapV3/BeeCave/beecaveflasher.xml`
* **Rainfall Data**: `https://beecave.wetec.us/WETMapV3/BeeCave/beecaverain.xml`
* **Historical Time-Series Log**: `https://hayscounty.wetec.us/cgi-bin/datadisp_q?ID=50061007&NM=200`

> **CORS Proxy**: To allow direct client-side fetching from custom web domains without Same-Origin Policy blocks, requests are routed through `api.allorigins.win`.

---

## 📁 Project Structure

```
Water Level/
├── index.html       # Mobile-first semantic HTML5 layout (Tailwind CSS & Chart.js)
├── css/
│   └── style.css    # Custom styles, animations, and active state highlights
├── js/
│   ├── api.js       # Data fetching & parsing for XML & ASCII datadisp_q logs
│   └── app.js       # Main application controller, Chart.js hydrograph, & staff gauge
└── README.md        # Project documentation
```

---

## 🚀 Local Development

Since this application is 100% static HTML, CSS, and JavaScript (ES Modules), you can serve it with any local HTTP server:

### Option 1: Python
```bash
python3 -m http.server 8080
```

### Option 2: Node.js / npx
```bash
npx serve
```

Then open `http://localhost:8080` in your browser.

---

## 📜 License & Credits

* Licensed under the [MIT License](LICENSE).
* Data provided by **City of Bee Cave WETMap** & **Hays County OEM**.

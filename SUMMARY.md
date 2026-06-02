# 🗺️ IIT Madras Navigation PWA - Project Summary & Architectural Log

An offline-first, high-performance, mobile-optimized Progressive Web Application (PWA) designed for seamless campus navigation within IIT Madras. This project is built using a strict **Two-File Architecture** (`index.html` and `sw.js`), running entirely client-side without any external backend requirements.

---

## 🏗️ Core Architecture & Tech Stack

### 1. Two-File PWA Architecture
*   **`index.html`:** The entire frontend application shell, containing:
    *   Responsive, Google Maps inspired modern UI/UX styles.
    *   **Dynamic Data Engine:** Direct client-side integration with the **Overpass API** to fetch the latest campus buildings, paths, and boundaries.
    *   **Offline Cache:** Utilizes **IndexedDB** (v4) to store the processed routing graph and POI data locally for instant offline loading and periodic 3-month background updates.
    *   Leaflet.js map layer initialization with strict boundary enforcement and high-zoom level support (up to 22).
    *   High-accuracy client-side pathfinding engine (Custom Dijkstra) with "Virtual Building Nodes" for multi-entrance buildings.
    *   Live GPS tracking with geofencing and movement-based heading calculation.
*   **`sw.js` (Service Worker):** The offline engine:
    *   Handles aggressive caching of local assets and CDNs.
    *   Performs automated, rate-limited batch caching of map tiles.
    *   **Tile-Sync:** Automatically refreshes the map tile cache when the routing data is updated from Overpass.

---

## 📦 What Was Done & How

### Phase 1: Dynamic Data & Graph Processing
*   **Overpass Fetching:** Replaced massive hardcoded datasets with a dynamic fetcher. The app queries Overpass for `building`, `highway`, `amenity`, and `leisure` tags within the IIT Madras area.
*   **Client-Side Graph Formulation:** The browser now processes raw OSM GeoJSON on-the-fly to build a routable graph. 
*   **Complex Building Topology:** Implemented "Virtual Nodes" for buildings. Every building center is connected to all its detected entrances with 0-weight edges, allowing the routing engine to automatically find the most optimal entrance door based on the user's location.

### Phase 2: Map Rendering & Strict Geofencing
*   **Leaflet.js Integration:** Configured with `maxBoundsViscosity = 1.0` to strictly lock the user inside the campus boundary.
*   **Dynamic Boundary Extraction:** The app extracts the official campus polygon from OSM data to define strict geofencing.
*   **GPS Validation:** If a user's GPS position is detected outside the campus boundary, the app shows an "Invalid Location" notification and refuses to start navigation to ensure campus-exclusive reliability.

### Phase 3: Robust Search & POI Discovery
*   **Fuzzy Alphanumeric Search:** The search engine ignores punctuation, spaces, and casing. Searching for "ICSR" correctly finds "IC&SR Building".
*   **Alias Support:** Extracts `short_name`, `alt_name`, and `name:en` tags. The system correctly identifies common acronyms like **CLT** for Central Lecture Theatre.
*   **Formatted UI:** Automatically cleans raw OSM tags (e.g., "student_accommodation" -> "Student Accommodation") and replaces generic "yes" labels with "Building".

### Phase 4: User-Friendly Turn-by-Turn Navigation
*   **Compass Field-of-View:** Replaced simple arrows with a modern, semi-transparent **blue FOV cone** on the user dot, indicating the physical direction the user is facing.
*   **Turn Smoothing:** The engine now ignores path curves smaller than 25 degrees, only prompting for structural turns to reduce instruction "noise".
*   **Wrong-Way Detection:** Compares movement bearing with the planned route. If the user walks in the opposite direction, the HUD explicitly prompts them to **"Turn around"**.
*   **Aggressive Rerouting:** Reduced the off-route threshold to **12 meters**. If a turn is missed, the system recalculates almost instantly to get the user back on track.

---

## ⚡ Service Worker precaching & Offline Strategy
1.  **Tile Bounding Box Math:** Identifies tiles required across **Zoom levels 13 to 19**.
2.  **Rate-Limited Batch Caching:** Fetches tiles in small batches (15 tiles) with throttle delays to comply with OSM usage policies.
3.  **Tile Cache Invalidation:** When fresh Overpass data is fetched (every 3 months), the client triggers a `REFRESH_TILES` message to the Service Worker to synchronize the visual map with any new road/building changes.

---

## 🛠️ Major Debugging & Refactoring Milestones

### 1. Overpass GET vs POST (404/504 Fix)
*   **Issue:** Long queries caused 404 errors due to URL length limits, and large area requests timed out.
*   **Resolution:** Switched to **POST** requests with a **900s timeout**, ensuring reliable data retrieval for the massive IITM campus area.

### 2. Boundary Segment Merging
*   **Issue:** The campus boundary failed to render because relations consisted of multiple disjointed ways.
*   **Resolution:** Implemented a robust segment merger that combines all "outer" ways into a single continuous polygon for Leaflet geofencing.

---

## 📈 Current Project State & Verification Status
*   **Offline Capability:** 100% Functional.
*   **Navigation Stability:** High (includes segment-distance math and path smoothing).
*   **Search Robustness:** Excellent (supports abbreviations and fuzzy matching).
*   **UI/UX Aesthetic:** Modern, high-performance, Google Maps inspired.

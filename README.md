# IIT Madras Offline Navigation PWA

A high-performance, mobile-optimized, offline-first navigation application for the IIT Madras campus.

## 🚀 Key Features

- **Offline-First:** All rendering, searching, and routing works 100% offline once the initial campus data and map tiles are cached.
- **Dynamic OSM Fetching:** Uses the Overpass API to pull the latest buildings, walkable paths, and amenities directly from OpenStreetMap.
- **Intelligent Routing:** Features a custom Dijkstra pathfinding engine with "Virtual Building Nodes" to find the most optimal entrance for complex buildings.
- **Turn-by-Turn Guidance:** Includes movement-based bearing calculation, turn smoothing (ignoring minor road curves), and "Wrong Way" detection.
- **Modern UI:** Responsive, Google Maps inspired interface with fuzzy alphanumeric search and a live compass FOV indicator.
- **Strict Geofencing:** Locked map viewport and GPS validation to keep the experience focused strictly on the IIT Madras campus.

## 🏗️ Architecture

The app follows a strict **Two-File Architecture**:
- `index.html`: Contains all application logic, styles, and the client-side data engine.
- `sw.js`: A robust Service Worker that handles asset caching and automated map tile pre-caching.

## 🛠️ Data Management

- **Storage:** Uses IndexedDB to cache the processed routing graph and POI catalog.
- **Refresh:** Automatically updates campus data in the background every 3 months when an internet connection is available.
- **Tiles:** Synchronizes visual map tiles with routing data updates.

## 📱 Mobile Setup

For the best experience:
1. Open the URL in your mobile browser.
2. Select "Add to Home Screen" to install it as a PWA.
3. Allow location access when prompted.
4. Wait for the "Caching map..." progress bar to finish for full offline reliability.

---
*Built with Leaflet.js, OpenStreetMap, and Overpass API.*

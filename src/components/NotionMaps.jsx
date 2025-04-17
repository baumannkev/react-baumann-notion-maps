"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet icon URLs under Next.js
import markerRetina from "leaflet/dist/images/marker-icon-2x.png";
import markerDefault from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerRetina.src,
  iconUrl:      markerDefault.src,
  shadowUrl:    markerShadow.src,
});

export default function NotionMaps({ embedDbId }) {
  const mapRef = useRef(null);
  const markerGroupRef = useRef(null);

  useEffect(() => {
    async function init() {
      let currentDbId = embedDbId || null;
      let embedSpots = [];
      let embedMarkers = [];

      // ─── Helpers ────────────────────────────────────────────────
      const dedupe = (dbs) => {
        const seen = new Set();
        return dbs.filter((d) => (seen.has(d.id) ? false : seen.add(d.id)));
      };
      const getPageTitle = (page) =>
        page.properties[
          Object.keys(page.properties).find((k) => page.properties[k].type === "title")
        ]?.title[0]?.plain_text || "No title";
      const getAddress = (page) => getPageTitle(page);
      const geocodeAddress = async (addr) => {
        try {
          const base = `/api/geocode?address=${encodeURIComponent(addr)}`;
          let res = await fetch(base), j = await res.json();
          if (j.success) return { lat: +j.lat, lon: +j.lon };
          if (!/\b(CA|USA)\b/.test(addr)) {
            res = await fetch(base + `, CA, USA`);
            j = await res.json();
            if (j.success) return { lat: +j.lat, lon: +j.lon };
          }
        } catch (e) {
          console.error("geocodeAddress error", e);
        }
        return null;
      };

      // ─── Initialize Leaflet once ────────────────────────────────
      function initMap() {
        if (mapRef.current) return;
        mapRef.current = L.map("map", { zoomControl: false }).setView(
          [37.7749, -122.4194],
          12
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(mapRef.current);
        markerGroupRef.current = L.featureGroup().addTo(mapRef.current);
      }

      // ─── Fetch pages from Notion ─────────────────────────────────
      async function fetchSpots(dbId) {
        try {
          const res = await fetch(`/api/databases/${dbId}/pages`);
          if (!res.ok) throw new Error(res.statusText);
          const { results } = await res.json();
          const spots = [];
          for (const page of results) {
            const addr = getAddress(page);
            let lat = page.properties.Latitude?.rich_text[0]?.plain_text;
            let lon = page.properties.Longitude?.rich_text[0]?.plain_text;
            if (!lat || !lon) {
              const g = await geocodeAddress(addr);
              if (g) ({ lat, lon } = g);
            }
            if (lat && lon) spots.push({ page, addr, lat: +lat, lon: +lon });
          }
          return spots;
        } catch (e) {
          console.error("fetchSpots error", e);
          return [];
        }
      }

      // ─── Render markers on the map ──────────────────────────────
      function renderMarkers(spots) {
        markerGroupRef.current.clearLayers();
        spots.forEach((s) =>
          L.marker([s.lat, s.lon])
            .addTo(markerGroupRef.current)
            .bindPopup(`<strong>${s.addr}</strong>`)
        );
        setTimeout(() => {
          mapRef.current.invalidateSize();
          if (markerGroupRef.current.getLayers().length) {
            mapRef.current.fitBounds(markerGroupRef.current.getBounds(), {
              padding: [20, 20],
            });
          }
        }, 100);
      }

      // ─── Render embed‐mode sidebar list ─────────────────────────
      function renderEmbedList() {
        const list = document.getElementById("markerList");
        list.innerHTML = "";
        embedSpots.forEach((s, i) => {
          const item = document.createElement("div");
          item.className = "marker-item";
          item.innerHTML = `<div class="marker-title">${s.addr}</div>`;
          item.onclick = () => {
            const m = embedMarkers[i];
            mapRef.current.setView(m.getLatLng(), 16);
            m.openPopup();
          };
          list.appendChild(item);
        });
      }

      // ─── Embed sidebar toggle ──────────────────────────────────
      document.getElementById("toggleListBtn").onclick = () => {
        const sb = document.querySelector(".embedSidebar");
        if (sb.style.display === "block") sb.style.display = "none";
        else {
          sb.style.display = "block";
          renderEmbedList();
        }
      };

      // ─── Load “My maps” in main mode ─────────────────────────────
      async function loadDatabases() {
        try {
          const res = await fetch("/api/databases");
          if (!res.ok) throw new Error(res.statusText);
          const data = await res.json();
          if (!data.success || !Array.isArray(data.results)) {
            console.error("Bad API response", data);
            return;
          }
          const unique = dedupe(data.results);
          const mapList = document.getElementById("mapList");
          mapList.innerHTML = "";
          unique.forEach((db) => {
            const card = document.createElement("div");
            card.className = "map-card";
            card.innerHTML = `
              <div class="map-title">${
                db.title[0]?.plain_text || "Untitled"
              }</div>
              <div class="map-subtitle">Configure & copy link</div>`;
            card.onclick = () =>
              openEditView(db.id, db.title[0]?.plain_text);
            mapList.appendChild(card);
          });
        } catch (e) {
          console.error("loadDatabases error", e);
        }
      }

      // ─── Show edit sidebar for a chosen map ─────────────────────
      async function openEditView(dbId, dbName) {
        document.getElementById("mapListView").style.display = "none";
        document.getElementById("mapEditView").style.display = "block";

        document.getElementById("dbSelect").innerHTML = `<option>${dbName}</option>`;
        document.getElementById("mapName").value = dbName;
        document.getElementById(
          "mapUrl"
        ).value = `${window.location.origin}/map/${dbId}`;
        document.getElementById("locationCount").textContent = "…";

        document.getElementById("copyBtn").onclick = () => {
          const urlBox = document.getElementById("mapUrl");
          urlBox.select();
          document.execCommand("copy");
          alert("Copied!");
        };

        const spots = await fetchSpots(dbId);
        renderMarkers(spots);
        document.getElementById("locationCount").textContent = spots.length;
      }

      // ─── Kick it all off ────────────────────────────────────────
      initMap();
      if (currentDbId) {
        // embed mode
        embedSpots = await fetchSpots(currentDbId);
        renderMarkers(embedSpots);
        embedMarkers = markerGroupRef.current.getLayers();

        document.querySelector(".sidebar").style.display = "none";
        document.querySelector(".topbar").style.display = "none";
        document.querySelector(".embedToolbar").style.display = "flex";
      } else {
        // main mode
        await loadDatabases();
      }
    }

    init();
  }, [embedDbId]);

  return (
    <div id="app" className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="topbar">
        <div className="logo">📍 Notion Maps</div>
        <div className="menu">
          <button id="menuBtn">☰</button>
          <div id="dropdown" className="dropdown">
            <a>🗺️ My maps</a>
            <a>👤 Account</a>
            <a>🚪 Logout</a>
          </div>
        </div>
      </header>  
      
      <div className="container flex flex-1">
        {/* Main-site sidebar */}
        <aside className="sidebar w-80 bg-[#282e3f] p-5 overflow-y-auto">
          <div id="mapListView">
            <h2 className="text-xl mb-4">My maps</h2>
            <div id="mapList"></div>
          </div>
          <div id="mapEditView" style={{ display: "none" }}>
            <a href="#" id="goBack" className="text-[#8fa6ff] mb-3 inline-block">
              ← Go back
            </a>
            <h3 className="text-lg mb-2">Editing map</h3>
            <div className="form-group mb-4">
              <label className="block text-[#c7c7d7] mb-1">Select a database</label>
              <select id="dbSelect" disabled className="w-full p-2 rounded bg-[#39405c] text-white"></select>
            </div>
            <div className="form-group mb-4">
              <label className="block text-[#c7c7d7] mb-1">Pick a name</label>
              <input type="text" id="mapName" className="w-full p-2 rounded bg-[#39405c] text-white"/>
            </div>
            <div className="form-group mb-4">
              <label className="block text-[#c7c7d7] mb-1">Unique map address</label>
              <div className="url-box flex">
                <input type="text" id="mapUrl" readOnly className="flex-1 p-2 rounded bg-[#39405c] text-white" />
                <button id="copyBtn" className="ml-2 px-4 rounded bg-[#475073] text-white">📋</button>
              </div>
            </div>
            <div className="form-group mb-4">
              <label className="block text-[#c7c7d7] mb-1">Locations count</label>
              <div id="locationCount" className="p-2 bg-[#39405c] rounded text-center">0</div>
            </div>
            <div className="form-group mb-4">
              <label className="block text-[#c7c7d7] mb-1">Select marker color column</label>
              <select id="markerColorSelect" className="w-full p-2 rounded bg-[#39405c] text-white"><option value="">None</option></select>
            </div>
            <div className="form-group mb-4">
              <label className="block text-[#c7c7d7] mb-1">Visible columns</label>
              <div id="visibleColumns"></div>
            </div>
            <button id="saveMap" className="w-full py-2 bg-[#3cb371] rounded font-bold text-white">Save map</button>
          </div>
        </aside>

        {/* Embed-mode sidebar */}
        <aside className="embedSidebar w-80 bg-[#202942] p-5 overflow-y-auto" style={{ display: "none" }}>
          <h2 className="text-xl mb-2">Map markers</h2>
          <div className="embed-subtitle text-[#c7c7d7] mb-4">List of all the map markers</div>
          <div id="markerList"></div>
        </aside>

        {/* Map panel */}
        <main className="map-panel flex-1 relative">
          <div className="embedToolbar absolute top-4 left-4 flex flex-col gap-2" style={{ display: "none" }}>
            <button id="toggleListBtn" className="p-2 bg-[#39405c] rounded text-white">≡</button>
            <button className="p-2 bg-[#39405c] rounded text-white">🔍</button>
            <button className="p-2 bg-[#39405c] rounded text-white">⚙️</button>
            <button className="p-2 bg-[#39405c] rounded text-white">🗺️</button>
          </div>
          <div id="map" className="w-full h-full"></div>
        </main>
      </div>
    </div>
  );
}

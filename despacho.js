(function () {
  const config = window.RapidPackConfig;
  const utils = window.RapidPackUtils;
  const db = utils.createClient();
  
  let map, markerChofer, markersClientes = [];
  let currentPos = null;

  function toggleTheme() {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('rp-theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
    location.reload(); 
  }
  window.toggleTheme = toggleTheme;

  function initMap() {
    const isLight = localStorage.getItem('rp-theme') === 'light';
    if(isLight) document.body.classList.add('light-mode');

    map = L.map('map', { zoomControl: false }).setView(config.defaultCenter, 13);
    const tileURL = isLight 
        ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    L.tileLayer(tileURL).addTo(map);

    const iconChofer = L.divIcon({
        className: 'chofer-icon',
        html: `<div style="background:#ff3d00; width:14px; height:14px; border-radius:50%; border:3px solid #fff;"></div>`,
        iconSize: [20, 20]
    });
    markerChofer = L.marker(config.defaultCenter, { icon: iconChofer }).addTo(map);
    setTimeout(() => map.invalidateSize(), 500);
  }

  function actualizarDistancias() {
    if (!currentPos) return;

    const items = document.querySelectorAll('.cliente-item');
    items.forEach(item => {
      const lat = parseFloat(item.dataset.lat);
      const lng = parseFloat(item.dataset.lng);
      const distEl = item.querySelector('.distancia-valor');

      if (!isNaN(lat) && !isNaN(lng) && distEl) {
        const metros = utils.haversineMeters(currentPos.lat, currentPos.lng, lat, lng);
        distEl.innerText = utils.formatDistance(metros);
      }
    });
  }

  // FUNCIÓN GPS MEJORADA
  function iniciarSeguimientoGPS() {
    if (!navigator.geolocation) {
        document.getElementById('status-gps').innerText = "GPS No soportado";
        return;
    }

    // Usamos watchPosition para que responda INSTANTÁNEAMENTE al movimiento
    navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        currentPos = { lat: latitude, lng: longitude };
        
        document.getElementById('status-gps').innerText = "GPS: Conectado";
        document.getElementById('status-gps').style.color = "#00c853";

        markerChofer.setLatLng([latitude, longitude]);
        actualizarDistancias();

        // Enviar a base de datos de forma asíncrona
        db.from(config.tables.driverTracking).upsert({
          driver_id: config.driverId,
          lat: latitude,
          lng: longitude,
          recorded_at: new Date()
        }).then();
      },
      (err) => {
        document.getElementById('status-gps').innerText = "Error GPS: " + err.message;
        document.getElementById('status-gps').style.color = "#ff3d00";
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function loadRoute() {
    const { data } = await db.from(config.tables.activeRoute).select('*').order('orden');
    const lista = document.getElementById('lista');
    lista.innerHTML = '';
    
    markersClientes.forEach(m => map.removeLayer(m));
    markersClientes = [];

    if (!data || data.length === 0) {
        lista.innerHTML = '<p style="padding:20px; opacity:0.5;">No hay entregas pendientes.</p>';
        return;
    }

    data.forEach(c => {
      const item = document.createElement('div');
      item.className = 'cliente-item';
      item.dataset.lat = c.lat;
      item.dataset.lng = c.lng;

      item.innerHTML = `
        <div class="info-entrega">
            <span class="nombre-cliente">${c.orden}. ${c.nombre}</span>
            <span class="distancia-valor">Buscando señal...</span>
        </div>
        <button class="btn-check" onclick="entregado('${c.id}')">OK</button>
      `;
      lista.appendChild(item);

      if (c.lat && c.lng) {
        const m = L.circleMarker([c.lat, c.lng], { 
          color: '#00c853', fillColor: '#00c853', fillOpacity: 0.4, radius: 10 
        }).addTo(map);
        markersClientes.push(m);
      }
    });
    actualizarDistancias();
  }

  window.entregado = async (id) => {
    const { error } = await db.from(config.tables.activeRoute).delete().eq('id', id);
    if (!error) loadRoute();
  };

  window.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadRoute();
    iniciarSeguimientoGPS();
  });
})();

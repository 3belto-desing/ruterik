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
        html: `<div style="background:#ff3d00; width:14px; height:14px; border-radius:50%; border:3px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
        iconSize: [20, 20]
    });

    markerChofer = L.marker(config.defaultCenter, { icon: iconChofer }).addTo(map);
    setTimeout(() => map.invalidateSize(), 500);
  }

  // Actualiza los textos de distancia en la barra lateral
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

  // RASTREO GPS
  setInterval(() => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      currentPos = { lat: latitude, lng: longitude };
      
      markerChofer.setLatLng([latitude, longitude]);
      document.getElementById('status').innerText = `GPS Activo: ${new Date().toLocaleTimeString()}`;
      
      // Actualizar distancias visuales
      actualizarDistancias();

      // Enviar a Supabase
      await db.from(config.tables.driverTracking).upsert({
        driver_id: config.driverId,
        lat: latitude,
        lng: longitude,
        recorded_at: new Date()
      });
    }, null, { enableHighAccuracy: true });
  }, 5000);

  async function loadRoute() {
    const { data } = await db.from(config.tables.activeRoute).select('*').order('orden');
    const lista = document.getElementById('lista');
    lista.innerHTML = '';
    
    markersClientes.forEach(m => map.removeLayer(m));
    markersClientes = [];

    data.forEach(c => {
      const item = document.createElement('div');
      item.className = 'cliente-item';
      item.dataset.lat = c.lat;
      item.dataset.lng = c.lng;

      item.innerHTML = `
        <div class="info-entrega">
            <span class="nombre-cliente">${c.orden}. ${c.nombre}</span>
            <span class="distancia-valor">Calculando...</span>
        </div>
        <button class="btn-check" onclick="entregado('${c.id}')">ENTREGAR</button>
      `;
      lista.appendChild(item);

      if (c.lat && c.lng) {
        const m = L.circleMarker([c.lat, c.lng], { 
          color: '#00c853', fillColor: '#00c853', fillOpacity: 0.4, radius: 10 
        }).addTo(map).bindPopup(c.nombre);
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
  });
})();

(function () {
  const config = window.RapidPackConfig;
  const db = window.RapidPackUtils.createClient();
  let map, markerChofer, markersClientes = [];

  function toggleTheme() {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('rp-theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
    location.reload(); 
  }
  window.toggleTheme = toggleTheme;

  function initMap() {
    const isLight = localStorage.getItem('rp-theme') === 'light';
    if(isLight) document.body.classList.add('light-mode');

    // Inicializar mapa
    map = L.map('map', { zoomControl: false }).setView(config.defaultCenter, 13);
    
    // Capas de mapa (OpenStreetMap para claro, CartoDB para oscuro)
    const tileURL = isLight 
        ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        
    L.tileLayer(tileURL, {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Marcador del chofer (RapidPack Red)
    const iconChofer = L.divIcon({
        className: 'custom-div-icon',
        html: "<div style='background-color:#ff3d00; width:15px; height:15px; border-radius:50%; border:3px solid white;'></div>",
        iconSize: [15, 15],
        iconAnchor: [7, 7]
    });

    markerChofer = L.marker(config.defaultCenter, { icon: iconChofer }).addTo(map);

    // Forzar redibujado para evitar áreas grises
    setTimeout(() => { map.invalidateSize(); }, 500);
  }

  // GPS EN VIVO
  setInterval(() => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const newPos = [latitude, longitude];
      
      markerChofer.setLatLng(newPos);
      
      await db.from(config.tables.driverTracking).upsert({
        driver_id: config.driverId,
        lat: latitude,
        lng: longitude,
        recorded_at: new Date()
      });
    }, (err) => console.error("Error GPS:", err), { enableHighAccuracy: true });
  }, 5000);

  async function loadRoute() {
    const { data, error } = await db.from(config.tables.activeRoute).select('*').order('orden');
    if (error) return;

    const lista = document.getElementById('lista');
    lista.innerHTML = '';
    
    // Limpiar marcadores viejos
    markersClientes.forEach(m => map.removeLayer(m));
    markersClientes = [];

    data.forEach(c => {
      const item = document.createElement('div');
      item.className = 'cliente-item';
      item.innerHTML = `
        <div style="display:flex; flex-direction:column;">
            <b style="font-size:14px;">${c.orden}. ${c.nombre}</b>
            <span style="font-size:11px; opacity:0.7;">Pendiente</span>
        </div>
        <button class="btn-check" onclick="entregado('${c.id}')">ENTREGAR</button>
      `;
      lista.appendChild(item);

      if (c.lat && c.lng) {
        const m = L.circleMarker([c.lat, c.lng], { 
            color: '#00c853', 
            fillColor: '#00c853', 
            fillOpacity: 0.5, 
            radius: 8 
        }).addTo(map).bindPopup(`<b>${c.nombre}</b>`);
        markersClientes.push(m);
      }
    });
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

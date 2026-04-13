(function () {
  const config = window.RapidPackConfig;
  const db = window.RapidPackUtils.createClient();
  let map, markerChofer, markersClientes = [];

  function toggleTheme() {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('rp-theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
    location.reload(); // Recargamos para actualizar el estilo del mapa
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
    markerChofer = L.marker(config.defaultCenter).addTo(map);
  }

  // RASTREO GPS CONSTANTE
  setInterval(() => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      markerChofer.setLatLng([latitude, longitude]);
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

    data.forEach(c => {
      const item = document.createElement('div');
      item.className = 'cliente-item';
      item.innerHTML = `<span>${c.orden}. ${c.nombre}</span> <button class="btn-check" onclick="entregado('${c.id}')">OK</button>`;
      lista.appendChild(item);

      if (c.lat && c.lng) {
        const m = L.circleMarker([c.lat, c.lng], { color: 'red' }).addTo(map).bindPopup(c.nombre);
        markersClientes.push(m);
      }
    });
  }

  window.entregado = async (id) => {
    await db.from(config.tables.activeRoute).delete().eq('id', id);
    loadRoute();
  };

  window.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadRoute();
  });
})();

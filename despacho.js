(function () {
  const config = window.RapidPackConfig;
  const utils = window.RapidPackUtils;
  const db = utils.createClient();

  let map;
  let markerChofer;
  let clientes = [];
  let markersClientes = [];

  // --- RASTREO GPS EN TIEMPO REAL ---
  setInterval(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const coords = {
          driver_id: config.driverId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          recorded_at: new Date().toISOString()
        };
        
        // Actualiza la posición en la tabla de rastreo
        await db.from(config.tables.driverTracking).upsert(coords);
        
        // Mover marcador en el mapa localmente para suavidad
        if (markerChofer) {
            markerChofer.setLatLng([coords.lat, coords.lng]);
        }
      }, (err) => console.error("Error GPS:", err), { enableHighAccuracy: true });
    }
  }, 5000);

  function initMap() {
    map = L.map('map', { zoomControl: false }).setView(config.defaultCenter, 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
    
    const iconoCamion = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/1048/1048329.png',
      iconSize: [35, 35]
    });
    markerChofer = L.marker(config.defaultCenter, { icon: iconoCamion }).addTo(map);
  }

  async function loadRoute() {
    const { data } = await db.from(config.tables.activeRoute).select('*').order('orden', { ascending: true });
    clientes = data || [];
    renderRoute();
  }

  function renderRoute() {
    const listaDiv = document.getElementById('lista');
    listaDiv.innerHTML = '';
    
    markersClientes.forEach(m => map.removeLayer(m));
    markersClientes = [];

    clientes.forEach(c => {
      const isDone = c.estado === 'Entregado';
      const card = document.createElement('div');
      card.className = `client-card ${isDone ? 'completed' : ''}`;
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center">
            <b>${c.orden}. ${c.nombre}</b>
            ${isDone ? '✅' : `<button class="btn-confirm" onclick="confirmar('${c.id}')">OK</button>`}
        </div>
      `;
      listaDiv.appendChild(card);

      if (c.lat && c.lng) {
        const m = L.circleMarker([c.lat, c.lng], { color: isDone ? '#00c853' : '#ff3d00', radius: 7 }).addTo(map);
        markersClientes.push(m);
      }
    });
  }

  window.confirmar = async (id) => {
    await db.from(config.tables.activeRoute).update({ estado: 'Entregado' }).eq('id', id);
    loadRoute();
  };

  window.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadRoute();
    
    // Escuchar cambios en tiempo real
    db.channel('cambios-ruta').on('postgres_changes', { event: '*', schema: 'public', table: config.tables.activeRoute }, loadRoute).subscribe();
  });
})();
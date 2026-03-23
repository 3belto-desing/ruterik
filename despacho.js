(function () {
  const config = window.RapidPackConfig;
  const utils = window.RapidPackUtils;
  const db = utils.createClient();

  let map;
  let currentTileLayer;
  let markerChofer;
  let clientes = [];
  let markersClientes = [];
  let latestDriverPosition = null;
  const realtimeChannels = [];
  const tableAliases = {
    activeRoute: [...new Set([config.tables.activeRoute, 'active_route', 'ruta_activa'])],
    driverTracking: [...new Set([config.tables.driverTracking, 'driver_tracking', 'rastreo_chofer'])],
    driverCurrentStatus: [...new Set([config.tables.driverCurrentStatus, 'driver_current_status'])]
  };

  const darkMap = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const lightMap = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  function setStatus(message, tone) {
    const statusEl = document.getElementById('status');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.dataset.tone = tone || 'neutral';
  }

  function setMonitorError(message) {
    const el = document.getElementById('monitor-error');
    if (!el) return;

    if (!message) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }

    el.style.display = 'block';
    el.textContent = message;
  }

  function setLastSeen(record) {
    const lastSeenEl = document.getElementById('last-seen');
    const accuracyEl = document.getElementById('gps-accuracy');
    if (!lastSeenEl || !accuracyEl) return;

    const lastConnection = record?.ultima_conexion ?? record?.last_connection ?? record?.recorded_at ?? null;
    lastSeenEl.textContent = utils.formatLastSeen(lastConnection);

    const accuracy = utils.toNumber(record?.accuracy_m);
    accuracyEl.textContent = accuracy !== null ? `${accuracy.toFixed(0)} m` : 'N/D';
  }

  function fitMapToData() {
    if (!map) return;

    const bounds = [];
    markersClientes.forEach(marker => bounds.push(marker.getLatLng()));

    if (latestDriverPosition) {
      bounds.push(L.latLng(latestDriverPosition.lat, latestDriverPosition.lng));
    }

    if (bounds.length === 0) return;
    if (bounds.length === 1) {
      map.setView(bounds[0], 16);
      return;
    }

    map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });
  }

  function scheduleMapResize() {
    if (!map) return;

    [0, 150, 500].forEach(delay => {
      window.setTimeout(() => {
        if (map) map.invalidateSize();
      }, delay);
    });
  }

  async function pickFirstResult(buildAttempt) {
    let lastError = null;

    for (const attempt of buildAttempt()) {
      const result = await attempt.run();
      const hasData = Array.isArray(result.data) ? result.data.length > 0 : Boolean(result.data);

      if (!result.error && (hasData || attempt.acceptEmpty)) {
        return { ...result, table: attempt.table, meta: attempt.meta || null };
      }

      if (result.error) {
        lastError = result.error;
      }
    }

    return { data: null, error: lastError, table: null, meta: null };
  }

  function updateDistances(lat, lng) {
    clientes.forEach(cliente => {
      const coords = utils.readLatLng(cliente);
      const distanceEl = document.getElementById(`dist-${cliente.id}`);
      if (!coords || !distanceEl) return;

      const distance = utils.haversineMeters(lat, lng, coords.lat, coords.lng);
      const isDone = cliente.estado === 'Entregado' || cliente.status === 'completed';
      if (isDone) {
        distanceEl.textContent = 'Entregado';
        return;
      }

      const ready = distance <= config.thresholds.confirmDistanceMeters;
      distanceEl.textContent = ready
        ? `Listo para confirmar (${utils.formatDistance(distance)})`
        : utils.formatDistance(distance);
    });
  }

  function updateDriverMarker(record) {
    const coords = utils.readLatLng(record);
    if (!coords || !markerChofer) return;

    latestDriverPosition = coords;
    markerChofer.setLatLng([coords.lat, coords.lng]);
    setLastSeen(record);

    const lastConnection = record?.ultima_conexion ?? record?.last_connection ?? record?.recorded_at ?? null;
    setStatus(
      utils.isDriverStale(lastConnection)
        ? 'Unidad conectada pero sin movimiento reciente'
        : 'Unidad en linea',
      utils.isDriverStale(lastConnection) ? 'warning' : 'success'
    );

    updateDistances(coords.lat, coords.lng);
    fitMapToData();
  }

  function initMap() {
    try {
      const isLight = localStorage.getItem('rp-theme') === 'light';
      if (isLight) document.body.classList.add('light-mode');

      map = L.map('map', { zoomControl: false }).setView(config.defaultCenter, 13);
      currentTileLayer = L.tileLayer(isLight ? lightMap : darkMap).addTo(map);
      map.whenReady(scheduleMapResize);
      window.addEventListener('resize', scheduleMapResize);

      const iconoCamion = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/1048/1048329.png',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      markerChofer = L.marker(config.defaultCenter, { icon: iconoCamion }).addTo(map);
    } catch (error) {
      console.error('Error al cargar el mapa:', error);
      setMonitorError(`No se pudo inicializar el mapa: ${error.message}`);
      setStatus('Error cargando mapa', 'danger');
    }
  }

  function renderRoute() {
    const listaDiv = document.getElementById('lista');
    if (!listaDiv) return;

    listaDiv.innerHTML = clientes.length
      ? ''
      : '<p style="text-align:center; color:#666;">No hay ruta activa</p>';

    markersClientes.forEach(marker => {
      if (map) map.removeLayer(marker);
    });
    markersClientes = [];

    clientes.forEach(cliente => {
      const isDone = cliente.estado === 'Entregado' || cliente.status === 'completed';
      const stopOrder = cliente.orden ?? cliente.stop_order ?? '-';
      const stopName = cliente.nombre ?? cliente.customer_name ?? 'Parada';
      const card = document.createElement('div');
      card.className = `client-card ${isDone ? 'completed' : ''}`;

      const coords = utils.readLatLng(cliente);
      const controlHtml = isDone
        ? '<div class="check"></div>'
        : `<button class="btn-confirm" data-stop-id="${cliente.id}">Confirmar</button>`;

      card.innerHTML = `
        <div>
          <b style="font-size:14px;">${stopOrder}. ${stopName}</b>
          <span class="dist" id="dist-${cliente.id}">${isDone ? 'Entregado' : 'Esperando posicion del chofer'}</span>
        </div>
        <div>${controlHtml}</div>
      `;

      listaDiv.appendChild(card);

      if (coords && map) {
        const marker = L.circleMarker([coords.lat, coords.lng], {
          color: isDone ? '#00c853' : '#ff9800',
          radius: 8,
          fillOpacity: 0.8
        }).addTo(map).bindTooltip(stopName);
        markersClientes.push(marker);
      }
    });

    listaDiv.querySelectorAll('.btn-confirm').forEach(button => {
      button.addEventListener('click', () => confirmStop(button.dataset.stopId));
    });

    if (latestDriverPosition) {
      updateDistances(latestDriverPosition.lat, latestDriverPosition.lng);
    } else {
      fitMapToData();
    }
  }

  async function loadRoute() {
    setMonitorError('');
    const { data, error } = await pickFirstResult(() =>
      tableAliases.activeRoute.map(table => ({
        table,
        acceptEmpty: true,
        run: () => db.from(table).select('*')
      }))
    );

    if (error) {
      console.error('Error cargando ruta:', error);
      setMonitorError(`No se pudo cargar la ruta activa: ${error.message}`);
      throw error;
    }

    clientes = (data || []).slice().sort((a, b) => {
      const left = utils.toNumber(a.orden ?? a.stop_order) ?? Number.MAX_SAFE_INTEGER;
      const right = utils.toNumber(b.orden ?? b.stop_order) ?? Number.MAX_SAFE_INTEGER;
      return left - right;
    });
    renderRoute();
  }

  async function loadInitialDriverPosition() {
    let snapshot = null;

    const currentStatusAttempt = await pickFirstResult(() =>
      tableAliases.driverCurrentStatus.map(table => ({
        table,
        acceptEmpty: false,
        run: () => db
          .from(table)
          .select('*')
          .eq('driver_id', config.driverId)
          .order('recorded_at', { ascending: false })
          .limit(1)
      }))
    );

    if (!currentStatusAttempt.error && currentStatusAttempt.data?.length) {
      snapshot = currentStatusAttempt.data[0];
    } else {
      const trackingAttempt = await pickFirstResult(() => {
        const attempts = [];

        tableAliases.driverTracking.forEach(table => {
          attempts.push({
            table,
            meta: { key: 'id' },
            acceptEmpty: false,
            run: () => db.from(table).select('*').eq('id', config.driverId).maybeSingle()
          });
          attempts.push({
            table,
            meta: { key: 'driver_id' },
            acceptEmpty: false,
            run: () => db.from(table).select('*').eq('driver_id', config.driverId).order('recorded_at', { ascending: false }).limit(1)
          });
        });

        return attempts;
      });

      if (trackingAttempt.error) {
        console.warn('No se pudo obtener el estado inicial del chofer:', trackingAttempt.error.message);
      } else if (Array.isArray(trackingAttempt.data)) {
        snapshot = trackingAttempt.data[0] || null;
      } else {
        snapshot = trackingAttempt.data;
      }
    }

    if (snapshot) {
      updateDriverMarker(snapshot);
      return;
    }

    setStatus('Sin posicion inicial del chofer', 'warning');
    setLastSeen(null);
  }

  async function confirmStop(stopId) {
    const stop = clientes.find(cliente => String(cliente.id) === String(stopId));
    if (!stop) return;

    if (!latestDriverPosition) {
      setMonitorError('No hay posicion del chofer para validar esta entrega.');
      return;
    }

    const stopCoords = utils.readLatLng(stop);
    if (!stopCoords) {
      setMonitorError('La parada no tiene coordenadas validas.');
      return;
    }

    const distance = utils.haversineMeters(
      latestDriverPosition.lat,
      latestDriverPosition.lng,
      stopCoords.lat,
      stopCoords.lng
    );

    if (distance > config.thresholds.confirmDistanceMeters) {
      setMonitorError(`La unidad aun esta a ${distance.toFixed(0)} metros. Acercate para confirmar.`);
      return;
    }

    setMonitorError('');

    const rpcResult = await db.rpc('complete_stop', {
      p_driver_id: config.driverId,
      p_stop_id: stop.id,
      p_lat: latestDriverPosition.lat,
      p_lng: latestDriverPosition.lng,
      p_accuracy_m: null,
      p_proof: null
    });

    if (!rpcResult.error) {
      await loadRoute();
      return;
    }

    console.warn('complete_stop RPC no disponible, usando compatibilidad temporal:', rpcResult.error.message);
    const fallback = await db
      .from(config.tables.activeRoute)
      .update({ estado: 'Entregado' })
      .eq('id', stop.id);

    if (fallback.error) {
      setMonitorError(`No se pudo confirmar la entrega: ${fallback.error.message}`);
      return;
    }

    await loadRoute();
  }

  async function clearRoute() {
    setMonitorError('');

    const rpcResult = await db.rpc('clear_active_route');
    if (!rpcResult.error) {
      await loadRoute();
      return;
    }

    const fallback = await db
      .from(config.tables.activeRoute)
      .delete()
      .not('nombre', 'is', null);

    if (fallback.error) {
      setMonitorError(`No se pudo borrar la ruta actual: ${fallback.error.message}`);
      return;
    }

    await loadRoute();
  }

  function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('rp-theme', isLight ? 'light' : 'dark');

    if (map) {
      map.removeLayer(currentTileLayer);
      currentTileLayer = L.tileLayer(isLight ? lightMap : darkMap).addTo(map);
    }
  }

  function bindRealtime() {
    tableAliases.activeRoute.forEach(table => {
      const channel = db.channel(`monitor_ruta_${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, async () => {
          await loadRoute();
        })
        .subscribe();

      realtimeChannels.push(channel);
    });

    tableAliases.driverTracking.forEach(table => {
      const channel = db.channel(`monitor_gps_${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
          if (
            payload.new?.id === config.driverId ||
            payload.new?.driver_id === config.driverId
          ) {
            updateDriverMarker(payload.new);
          }
        })
        .subscribe();

      realtimeChannels.push(channel);
    });

    tableAliases.driverCurrentStatus.forEach(table => {
      const channel = db.channel(`monitor_driver_current_status_${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
          if (payload.new?.driver_id === config.driverId) {
            updateDriverMarker(payload.new);
          }
        })
        .subscribe();

      realtimeChannels.push(channel);
    });
  }

  async function bootstrap() {
    initMap();
    setStatus('Cargando monitor operativo', 'neutral');

    try {
      await loadRoute();
      await loadInitialDriverPosition();
      bindRealtime();
      fitMapToData();
    } catch (error) {
      setStatus('Monitor con errores', 'danger');
    }
  }

  window.toggleTheme = toggleTheme;
  window.solicitarPinBorrado = clearRoute;
  window.addEventListener('DOMContentLoaded', bootstrap);
})();

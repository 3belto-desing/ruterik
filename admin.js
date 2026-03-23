(function () {
  const config = window.RapidPackConfig;
  const utils = window.RapidPackUtils;
  const db = utils.createClient();

  let clientesRaw = [];
  let borrador = [];
  let clienteActivo = null;

  function toggleTheme() {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('rp-theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
  }

  async function init() {
    const { data, error } = await db.from(config.tables.customers).select('*');
    if (error) {
      alert(`No se pudieron cargar los clientes: ${error.message}`);
      return;
    }
    clientesRaw = data || [];
  }

  function getSaludo() {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos dias' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
  }

  function buscar() {
    const txt = document.getElementById('buscador').value.toLowerCase();
    const display = document.getElementById('cliente-seleccionado');

    if (txt.length < 2) {
      display.style.display = 'none';
      return;
    }

    clienteActivo = clientesRaw.find(c => c.nombre && c.nombre.toLowerCase().includes(txt));
    if (!clienteActivo) {
      display.style.display = 'none';
      return;
    }

    display.style.display = 'block';
    document.getElementById('view-nombre').innerText = clienteActivo.nombre;
    document.getElementById('btn-casa').disabled = !clienteActivo.lat;
    document.getElementById('btn-trabajo').disabled = !clienteActivo.lat_2;
    document.getElementById('btn-temp').disabled = !clienteActivo.lat_temp;
  }

  function addParada(tipo) {
    if (!clienteActivo) return;

    let lat;
    let lng;

    if (tipo === 'CASA') {
      lat = clienteActivo.lat;
      lng = clienteActivo.lng;
    } else if (tipo === 'TRABAJO') {
      lat = clienteActivo.lat_2;
      lng = clienteActivo.lng_2;
    } else {
      lat = clienteActivo.lat_temp;
      lng = clienteActivo.lng_temp;
    }

    borrador.push({ nombre: clienteActivo.nombre, ubi: tipo, lat, lng });
    actualizarBorradorUI();
  }

  function removeDraftStop(index) {
    borrador.splice(index, 1);
    actualizarBorradorUI();
  }

  function actualizarBorradorUI() {
    document.getElementById('card-borrador').style.display = borrador.length > 0 ? 'block' : 'none';
    document.getElementById('lista-borrador').innerHTML = borrador
      .map((item, i) => `<div class="item-draft"><span><b>${i + 1}.</b> ${item.nombre}</span><button style="background:none; border:none; color:#ff5555;" onclick="removeDraftStop(${i})">X</button></div>`)
      .join('');

    let texto = `${getSaludo()}, ruta para hoy:\n\n`;
    borrador.forEach((p, i) => {
      texto += `${i + 1}. ${p.nombre}\n`;
    });
    document.getElementById('reporte-texto').value = texto;
  }

  async function lanzarRuta() {
    const btn = document.getElementById('btn-lanzar');
    btn.innerText = 'PROCESANDO...';
    btn.disabled = true;

    try {
      await db.from(config.tables.activeRoute).delete().not('nombre', 'is', null);

      const paradas = borrador.map((p, i) => ({
        nombre: `${p.nombre} (${p.ubi})`,
        lat: p.lat,
        lng: p.lng,
        orden: i + 1,
        estado: 'Pendiente'
      }));

      const { error } = await db.from(config.tables.activeRoute).insert(paradas);
      if (error) throw error;

      alert('Ruta cargada con exito');
      window.location.href = 'despacho.html';
    } catch (err) {
      alert(`Error: ${err.message}`);
      btn.innerText = 'LANZAR RUTA';
      btn.disabled = false;
    }
  }

  async function guardarCliente() {
    const idEdit = document.getElementById('edit-id').value;
    const datos = {
      nombre: document.getElementById('n-nombre').value,
      codigo_rp: document.getElementById('n-codigo').value,
      lat: document.getElementById('n-lat').value || null,
      lng: document.getElementById('n-lng').value || null,
      lat_2: document.getElementById('n-lat-2').value || null,
      lng_2: document.getElementById('n-lng-2').value || null,
      lat_temp: document.getElementById('n-lat-temp').value || null,
      lng_temp: document.getElementById('n-lng-temp').value || null
    };

    const query = idEdit
      ? db.from(config.tables.customers).update(datos).eq('id', idEdit)
      : db.from(config.tables.customers).insert([datos]);

    const { error } = await query;
    if (error) {
      alert(`No se pudo guardar el cliente: ${error.message}`);
      return;
    }

    location.reload();
  }

  function cargarEdicion() {
    if (!clienteActivo) return;

    document.getElementById('edit-id').value = clienteActivo.id;
    document.getElementById('n-nombre').value = clienteActivo.nombre;
    document.getElementById('n-codigo').value = clienteActivo.codigo_rp || '';
    document.getElementById('n-lat').value = clienteActivo.lat;
    document.getElementById('n-lng').value = clienteActivo.lng;
    document.getElementById('n-lat-2').value = clienteActivo.lat_2;
    document.getElementById('n-lng-2').value = clienteActivo.lng_2;
    document.getElementById('n-lat-temp').value = clienteActivo.lat_temp;
    document.getElementById('n-lng-temp').value = clienteActivo.lng_temp;
    document.getElementById('btn-save').innerText = 'ACTUALIZAR';
    document.getElementById('btn-cancel').style.display = 'block';
  }

  if (localStorage.getItem('rp-theme') === 'light') {
    document.body.classList.add('light-mode');
  }

  window.toggleTheme = toggleTheme;
  window.buscar = buscar;
  window.addParada = addParada;
  window.lanzarRuta = lanzarRuta;
  window.guardarCliente = guardarCliente;
  window.cargarEdicion = cargarEdicion;
  window.removeDraftStop = removeDraftStop;

  window.addEventListener('DOMContentLoaded', init);
})();

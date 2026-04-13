(function () {
  const config = window.RapidPackConfig;
  const utils = window.RapidPackUtils;
  const db = utils.createClient();

  let clientesRaw = [];
  let borrador = [];
  let clienteActivo = null;

  // TEMA OSCURO/CLARO
  function toggleTheme() {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('rp-theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
  }

  if (localStorage.getItem('rp-theme') === 'light') {
    document.body.classList.add('light-mode');
  }

  // AUTENTICACIÓN
  async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) return alert("Error: " + error.message);
    checkAuth();
  }

  async function checkAuth() {
    const { data } = await db.auth.getSession();
    const loginBox = document.getElementById('login-box');
    const content = document.getElementById('admin-content');
    if (data.session) {
      loginBox.style.display = 'none';
      content.style.display = 'block';
      initData();
    }
  }

  async function initData() {
    const { data } = await db.from(config.tables.customers).select('*');
    clientesRaw = data || [];
  }

  // BUSCADOR
  function buscar() {
    const txt = document.getElementById('buscador').value.toLowerCase();
    const display = document.getElementById('cliente-seleccionado');
    if (txt.length < 2) { display.style.display = 'none'; return; }
    
    clienteActivo = clientesRaw.find(c => c.nombre && c.nombre.toLowerCase().includes(txt));
    if (clienteActivo) {
      display.style.display = 'block';
      document.getElementById('view-nombre').innerText = clienteActivo.nombre;
    }
  }

  // AGREGAR A RUTA
  function addParada(tipo) {
    if (!clienteActivo) return;
    let lat, lng;
    if (tipo === 'CASA') { lat = clienteActivo.lat; lng = clienteActivo.lng; }
    else if (tipo === 'TRABAJO') { lat = clienteActivo.lat_2; lng = clienteActivo.lng_2; }
    else { lat = clienteActivo.lat_temp; lng = clienteActivo.lng_temp; }

    borrador.push({ nombre: clienteActivo.nombre, ubi: tipo, lat, lng });
    actualizarBorradorUI();
  }

  function actualizarBorradorUI() {
    document.getElementById('card-borrador').style.display = 'block';
    let txt = "Ruta Ruterik:\n";
    borrador.forEach((p, i) => txt += `${i+1}. ${p.nombre} (${p.ubi})\n`);
    document.getElementById('reporte-texto').value = txt;
  }

  async function lanzarRuta() {
    await db.from(config.tables.activeRoute).delete().not('nombre', 'is', null);
    const paradas = borrador.map((p, i) => ({
      nombre: p.nombre, lat: p.lat, lng: p.lng, orden: i + 1, estado: 'Pendiente'
    }));
    await db.from(config.tables.activeRoute).insert(paradas);
    window.location.href = 'despacho.html';
  }

  // GUARDAR CLIENTE (IMPORTANTE: parseFloat para números)
  async function guardarCliente() {
    const datos = {
      nombre: document.getElementById('n-nombre').value,
      codigo_rp: document.getElementById('n-codigo').value,
      lat: parseFloat(document.getElementById('n-lat').value) || null,
      lng: parseFloat(document.getElementById('n-lng').value) || null,
      lat_2: parseFloat(document.getElementById('n-lat-2').value) || null,
      lng_2: parseFloat(document.getElementById('n-lng-2').value) || null,
      lat_temp: parseFloat(document.getElementById('n-lat-temp').value) || null,
      lng_temp: parseFloat(document.getElementById('n-lng-temp').value) || null
    };
    const { error } = await db.from(config.tables.customers).insert([datos]);
    if (error) alert(error.message);
    else location.reload();
  }

  // EXPORTAR FUNCIONES AL HTML
  window.toggleTheme = toggleTheme;
  window.login = login;
  window.buscar = buscar;
  window.addParada = addParada;
  window.lanzarRuta = lanzarRuta;
  window.guardarCliente = guardarCliente;

  window.addEventListener('DOMContentLoaded', checkAuth);
})();

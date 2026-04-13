(function () {
  const config = window.RapidPackConfig;
  const utils = window.RapidPackUtils;
  const db = utils.createClient();

  let clientesRaw = [];
  let borrador = [];
  let clienteActivo = null;

  async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { error } = await db.auth.signInWithPassword({ email, password });

    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }
    checkAuth();
  }

  async function checkAuth() {
    const { data } = await db.auth.getSession();
    const loginBox = document.getElementById('login-box');
    const adminContent = document.getElementById('admin-content');

    if (!data.session) {
      loginBox.style.display = 'block';
      adminContent.style.display = 'none';
    } else {
      loginBox.style.display = 'none';
      adminContent.style.display = 'block';
      initData();
    }
  }

  async function initData() {
    const { data, error } = await db.from(config.tables.customers).select('*');
    if (error) {
      alert(`Error al cargar clientes: ${error.message}`);
      return;
    }
    clientesRaw = data || [];
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
    let lat, lng;

    if (tipo === 'CASA') {
      lat = clienteActivo.lat; lng = clienteActivo.lng;
    } else if (tipo === 'TRABAJO') {
      lat = clienteActivo.lat_2; lng = clienteActivo.lng_2;
    } else {
      lat = clienteActivo.lat_temp; lng = clienteActivo.lng_temp;
    }

    borrador.push({ nombre: clienteActivo.nombre, ubi: tipo, lat, lng });
    actualizarBorradorUI();
  }

  function actualizarBorradorUI() {
    const container = document.getElementById('card-borrador');
    container.style.display = borrador.length > 0 ? 'block' : 'none';
    
    document.getElementById('lista-borrador').innerHTML = borrador
      .map((item, i) => `<div class="item-draft"><span><b>${i + 1}.</b> ${item.nombre}</span></div>`)
      .join('');

    let texto = `Ruta Ruterik para hoy:\n\n`;
    borrador.forEach((p, i) => { texto += `${i + 1}. ${p.nombre}\n`; });
    document.getElementById('reporte-texto').value = texto;
  }

  async function lanzarRuta() {
    const btn = document.getElementById('btn-lanzar');
    btn.innerText = 'PROCESANDO...';
    
    await db.from(config.tables.activeRoute).delete().not('nombre', 'is', null);

    const paradas = borrador.map((p, i) => ({
      nombre: `${p.nombre} (${p.ubi})`,
      lat: p.lat,
      lng: p.lng,
      orden: i + 1,
      estado: 'Pendiente'
    }));

    const { error } = await db.from(config.tables.activeRoute).insert(paradas);
    if (!error) window.location.href = 'despacho.html';
    else alert(error.message);
  }

  async function guardarCliente() {
    const idEdit = document.getElementById('edit-id').value;
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

    const query = idEdit 
      ? db.from(config.tables.customers).update(datos).eq('id', idEdit)
      : db.from(config.tables.customers).insert([datos]);

    const { error } = await query;
    if (error) alert(error.message);
    else location.reload();
  }

  window.login = login;
  window.buscar = buscar;
  window.addParada = addParada;
  window.lanzarRuta = lanzarRuta;
  window.guardarCliente = guardarCliente;
  window.addEventListener('DOMContentLoaded', checkAuth);
})();
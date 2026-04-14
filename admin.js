// admin.js

// Configuración de la ubicación base (Base RapidPack)
const PUNTO_PARTIDA = { lat: 18.4861, lng: -69.9312 }; 
let clienteActual = null; 
let borradorRuta = []; 

// Función para calcular distancia entre dos coordenadas (Km)
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Algoritmo de optimización: Vecino más cercano
function optimizarRuta(paradas) {
    let pendientes = [...paradas];
    let actual = PUNTO_PARTIDA;
    let rutaOrdenada = [];

    while (pendientes.length > 0) {
        let masCercano = null;
        let dMinima = Infinity;
        let indice = -1;

        for (let i = 0; i < pendientes.length; i++) {
            let d = calcularDistancia(actual.lat, actual.lng, pendientes[i].lat, pendientes[i].lng);
            if (d < dMinima) {
                dMinima = d;
                masCercano = pendientes[i];
                indice = i;
            }
        }
        rutaOrdenada.push(masCercano);
        actual = masCercano; 
        pendientes.splice(indice, 1);
    }
    return rutaOrdenada;
}

// Generar el mensaje final de WhatsApp
function ejecutarOptimizacion() {
    if (borradorRuta.length === 0) return alert("Añade entregas primero.");

    const listaOrdenada = optimizarRuta(borradorRuta);
    const ahora = new Date();
    const hora = ahora.getHours();
    
    let saludo = hora < 12 ? "Buenos días" : (hora < 18 ? "Buenas tardes" : "Buenas noches");
    const fecha = ahora.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });

    let mensaje = `${saludo}\nruta para hoy ${fecha}:\n\n`;
    listaOrdenada.forEach((entrega, i) => {
        mensaje += `${i + 1}. ${entrega.nombre} - ${entrega.codigo}\n`;
    });

    document.getElementById('reporte-texto').value = mensaje;
}

// Buscar cliente en tiempo real en Supabase
async function buscar() {
    const query = document.getElementById('buscador').value;
    if (query.length > 2) {
        const { data, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .ilike('nombre', `%${query}%`)
            .limit(1);

        if (data && data.length > 0) {
            const c = data[0];
            clienteActual = {
                nombre: c.nombre,
                codigo: c.codigo,
                casa: { lat: c.lat_casa, lng: c.lng_casa },
                trabajo: { lat: c.lat_trabajo, lng: c.lng_trabajo },
                temporal: { lat: c.lat_temp, lng: c.lng_temp }
            };
            document.getElementById('view-nombre').innerText = `${clienteActual.nombre} (${clienteActual.codigo})`;
            document.getElementById('cliente-seleccionado').style.display = 'block';
            document.getElementById('card-borrador').style.display = 'block';
        }
    }
}

// Guardar nuevo cliente en Supabase
async function guardarCliente() {
    const btn = document.getElementById('btn-save');
    const nombre = document.getElementById('n-nombre').value;
    const codigo = document.getElementById('n-codigo').value;

    if (!nombre || !codigo) return alert("Faltan datos obligatorios.");

    btn.disabled = true;
    btn.innerText = "GUARDANDO...";

    const datos = {
        nombre: nombre.toUpperCase(),
        codigo: codigo.toUpperCase(),
        lat_casa: parseFloat(document.getElementById('n-lat').value) || 0,
        lng_casa: parseFloat(document.getElementById('n-lng').value) || 0,
        lat_trabajo: parseFloat(document.getElementById('n-lat-2').value) || 0,
        lng_trabajo: parseFloat(document.getElementById('n-lng-2').value) || 0,
        lat_temp: parseFloat(document.getElementById('n-lat-temp').value) || 0,
        lng_temp: parseFloat(document.getElementById('n-lng-temp').value) || 0
    };

    try {
        const { error } = await supabaseClient.from('clientes').insert([datos]);
        if (error) throw error;
        alert("Cliente guardado con éxito.");
        location.reload();
    } catch (err) {
        alert("Error al guardar: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "GUARDAR EN SUPABASE";
    }
}

// Gestión de la lista de paradas
function addParada(tipo) {
    let c = tipo === 'CASA' ? clienteActual.casa : (tipo === 'TRABAJO' ? clienteActual.trabajo : clienteActual.temporal);
    borradorRuta.push({
        nombre: clienteActual.nombre,
        codigo: clienteActual.codigo,
        lat: c.lat,
        lng: c.lng
    });
    actualizarVista();
}

function actualizarVista() {
    const lista = document.getElementById('lista-borrador');
    lista.innerHTML = borradorRuta.map((p, i) => `
        <div class="item-draft">
            <div><strong>${p.nombre}</strong></div>
            <button onclick="borrar(${i})" style="color:red; background:none; border:none; cursor:pointer; font-weight:bold;">X</button>
        </div>
    `).join('');
}

function borrar(i) {
    borradorRuta.splice(i, 1);
    actualizarVista();
}

function login() {
    document.getElementById('login-box').style.display = 'none';
    document.getElementById('admin-content').style.display = 'block';
}

function toggleTheme() { document.body.classList.toggle('light-mode'); }
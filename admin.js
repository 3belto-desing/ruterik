// admin.js

// 1. CONFIGURACIÓN: Punto de partida (Base Rapid Pack)
const PUNTO_PARTIDA = { lat: 18.4861, lng: -69.9312 }; 
let clienteActual = null; 
let borradorRuta = []; 

// 2. LÓGICA DE OPTIMIZACIÓN (Matemática de distancias)
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

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

// 3. GENERACIÓN DEL MENSAJE DE WHATSAPP
function ejecutarOptimizacion() {
    if (borradorRuta.length === 0) {
        alert("Agrega clientes a la ruta primero.");
        return;
    }

    const listaOrdenada = optimizarRuta(borradorRuta);
    const ahora = new Date();
    const hora = ahora.getHours();
    
    let saludo = "Buenos días";
    if (hora >= 12 && hora < 18) saludo = "Buenas tardes";
    else if (hora >= 18) saludo = "Buenas noches";

    const fecha = ahora.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });

    let mensaje = `${saludo}\nruta para hoy ${fecha}:\n\n`;
    listaOrdenada.forEach((entrega, i) => {
        mensaje += `${i + 1}.\n`; // Siguiendo tu formato exacto del prompt
    });

    // Si prefieres que incluya el nombre/código en la lista:
    // listaOrdenada.forEach((e, i) => { mensaje += `${i + 1}. ${e.nombre} - ${e.codigo}\n`; });

    document.getElementById('reporte-texto').value = mensaje;
}

// 4. INTEGRACIÓN CON SUPABASE (Guardar cliente)
async function guardarCliente() {
    const btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.innerText = "PROCESANDO...";

    const nuevoCliente = {
        nombre: document.getElementById('n-nombre').value,
        codigo: document.getElementById('n-codigo').value,
        lat_casa: parseFloat(document.getElementById('n-lat').value),
        lng_casa: parseFloat(document.getElementById('n-lng').value),
        lat_trabajo: parseFloat(document.getElementById('n-lat-2').value),
        lng_trabajo: parseFloat(document.getElementById('n-lng-2').value),
        lat_temp: parseFloat(document.getElementById('n-lat-temp').value),
        lng_temp: parseFloat(document.getElementById('n-lng-temp').value)
    };

    try {
        const { error } = await supabase.from('clientes').insert([nuevoCliente]);
        if (error) throw error;
        alert("¡Cliente registrado en Supabase!");
        location.reload();
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "GUARDAR EN SUPABASE";
    }
}

// 5. MANEJO DE INTERFAZ
function login() {
    document.getElementById('login-box').style.display = 'none';
    document.getElementById('admin-content').style.display = 'block';
}

function toggleTheme() { document.body.classList.toggle('light-mode'); }

function buscar() {
    const query = document.getElementById('buscador').value;
    if (query.length > 2) {
        // Mockup de datos (Esto lo cambiarás por un SELECT de Supabase)
        clienteActual = {
            nombre: query.toUpperCase(),
            codigo: "RP-" + Math.floor(Math.random() * 5000),
            casa: { lat: 18.49, lng: -69.91 },
            trabajo: { lat: 18.46, lng: -69.94 },
            temporal: { lat: 18.47, lng: -69.92 }
        };
        document.getElementById('view-nombre').innerText = `${clienteActual.nombre} (${clienteActual.codigo})`;
        document.getElementById('cliente-seleccionado').style.display = 'block';
        document.getElementById('card-borrador').style.display = 'block';
    }
}

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
            <button onclick="borrar(${i})" style="color:red; background:none; border:none; cursor:pointer;">X</button>
        </div>
    `).join('');
}

function borrar(i) {
    borradorRuta.splice(i, 1);
    actualizarVista();
}

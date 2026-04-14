// admin.js

// --- CONFIGURACIÓN ---
const PUNTO_PARTIDA = { lat: 18.4861, lng: -69.9312 }; // Reemplaza por tu base real
let clienteActual = null; 
let borradorRuta = []; 

// --- CÁLCULOS MATEMÁTICOS ---
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function optimizarRuta(paradas) {
    let noVisitados = [...paradas];
    let actual = PUNTO_PARTIDA;
    let rutaOptimizada = [];

    while (noVisitados.length > 0) {
        let paradaMasCercana = null;
        let distanciaMinima = Infinity;
        let indiceMasCercano = -1;

        for (let i = 0; i < noVisitados.length; i++) {
            let d = calcularDistancia(actual.lat, actual.lng, noVisitados[i].lat, noVisitados[i].lng);
            if (d < distanciaMinima) {
                distanciaMinima = d;
                paradaMasCercana = noVisitados[i];
                indiceMasCercano = i;
            }
        }
        rutaOptimizada.push(paradaMasCercana);
        actual = paradaMasCercana; 
        noVisitados.splice(indiceMasCercano, 1);
    }
    return rutaOptimizada;
}

// --- GENERADOR DE TEXTO ---
function actualizarReporteRuta() {
    if (borradorRuta.length === 0) return;

    const rutaOptimizada = optimizarRuta(borradorRuta);
    const ahora = new Date();
    const hora = ahora.getHours();
    
    let saludo = hora < 12 ? "Buenos días" : (hora < 18 ? "Buenas tardes" : "Buenas noches");
    const fecha = ahora.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });

    let mensaje = `${saludo}\nRuta para hoy ${fecha}:\n\n`;
    rutaOptimizada.forEach((p, i) => {
        mensaje += `${i + 1}. ${p.nombre} - ${p.codigo}\n`;
    });

    document.getElementById('reporte-texto').value = mensaje;
}

// --- CONEXIÓN REAL CON SUPABASE ---
async function guardarCliente() {
    const btnSave = document.getElementById('btn-save');
    btnSave.disabled = true;
    btnSave.innerText = "GUARDANDO...";

    const datos = {
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
        // Asumiendo que tu tabla en Supabase se llama 'clientes'
        const { error } = await supabase.from('clientes').insert([datos]);

        if (error) throw error;

        alert("¡Cliente guardado con éxito!");
        location.reload(); 
    } catch (err) {
        console.error("Error al guardar:", err.message);
        alert("Error al guardar: " + err.message);
    } finally {
        btnSave.disabled = false;
        btnSave.innerText = "GUARDAR EN SUPABASE";
    }
}

// --- INTERFAZ ---
function login() {
    document.getElementById('login-box').style.display = 'none';
    document.getElementById('admin-content').style.display = 'block';
}

function toggleTheme() { document.body.classList.toggle('light-mode'); }

async function buscar() {
    const query = document.getElementById('buscador').value;
    if (query.length > 2) {
        // Aquí podrías hacer un fetch real a Supabase:
        // const { data } = await supabase.from('clientes').select('*').ilike('nombre', `%${query}%`);
        
        // Simulación para visualización:
        clienteActual = {
            nombre: query.toUpperCase(),
            codigo: "RP-8822",
            casa: { lat: 18.50, lng: -69.90 },
            trabajo: { lat: 18.45, lng: -69.95 },
            temporal: { lat: 18.48, lng: -69.92 }
        };
        
        document.getElementById('view-nombre').innerText = `${clienteActual.nombre} (${clienteActual.codigo})`;
        document.getElementById('cliente-seleccionado').style.display = 'block';
        document.getElementById('card-borrador').style.display = 'block';
    }
}

function addParada(tipo) {
    let coords = tipo === 'CASA' ? clienteActual.casa : (tipo === 'TRABAJO' ? clienteActual.trabajo : clienteActual.temporal);
    
    borradorRuta.push({
        nombre: clienteActual.nombre,
        codigo: clienteActual.codigo,
        lat: coords.lat,
        lng: coords.lng
    });

    actualizarVistaLista();
    actualizarReporteRuta(); // Se optimiza y escribe el texto al instante
}

function actualizarVistaLista() {
    const lista = document.getElementById('lista-borrador');
    lista.innerHTML = borradorRuta.map(p => `
        <div class="item-draft">
            <div><strong>${p.nombre}</strong><br><small>${p.codigo}</small></div>
            <button onclick="borrarDeRuta('${p.codigo}')" style="background:none; border:none; color:red; cursor:pointer;">X</button>
        </div>
    `).join('');
}

function borrarDeRuta(codigo) {
    borradorRuta = borradorRuta.filter(p => p.codigo !== codigo);
    actualizarVistaLista();
    actualizarReporteRuta();
}
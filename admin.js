// admin.js - RUTERIK ADMIN LOGIC

// 1. CONFIGURACIÓN INICIAL
const PUNTO_PARTIDA = { lat: 18.4861, lng: -69.9312 }; // Base RapidPack
let clienteActual = null; 
let borradorRuta = []; 

// 2. ALGORITMO DE OPTIMIZACIÓN (Matemática de Ruta)
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
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

// 3. ACCIONES DE LA RUTA (Generar Mensaje)
function ejecutarOptimizacion() {
    if (borradorRuta.length === 0) {
        alert("Agrega entregas a la lista antes de optimizar.");
        return;
    }

    const listaOrdenada = optimizarRuta(borradorRuta);
    const ahora = new Date();
    const hora = ahora.getHours();
    
    // Saludo dinámico según la hora dominicana
    let saludo = "Buenos días";
    if (hora >= 12 && hora < 18) saludo = "Buenas tardes";
    else if (hora >= 18) saludo = "Buenas noches";

    const fecha = ahora.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });

    let mensaje = `${saludo}\nruta para hoy ${fecha}:\n\n`;
    listaOrdenada.forEach((entrega, i) => {
        // Formato solicitado para el mensaje de WhatsApp
        mensaje += `${i + 1}. ${entrega.nombre} - ${entrega.codigo}\n`;
    });

    document.getElementById('reporte-texto').value = mensaje;
}

// 4. SUPABASE: BUSCAR CLIENTE (Real)
async function buscar() {
    const buscador = document.getElementById('buscador');
    const query = buscador.value.trim();

    if (query.length > 2) {
        try {
            const { data, error } = await supabaseClient
                .from('clientes')
                .select('*')
                .ilike('nombre', `%${query}%`)
                .limit(1);

            if (error) throw error;

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
            } else {
                document.getElementById('cliente-seleccionado').style.display = 'none';
            }
        } catch (err) {
            console.error("Error en búsqueda:", err.message);
        }
    }
}

// 5. SUPABASE: GUARDAR NUEVO CLIENTE
async function guardarCliente() {
    const btn = document.getElementById('btn-save');
    const nombre = document.getElementById('n-nombre').value.trim();
    const codigo = document.getElementById('n-codigo').value.trim();

    if (!nombre || !codigo) {
        alert("Nombre y Código son obligatorios para registrar en RapidPack.");
        return;
    }

    btn.disabled = true;
    btn.innerText = "REGISTRANDO...";

    // Mapeo exacto a las columnas de la tabla en Supabase
    const nuevoRegistro = {
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
        const { error } = await supabaseClient.from('clientes').insert([nuevoRegistro]);
        
        if (error) throw error;
        
        alert("Cliente guardado exitosamente.");
        location.reload();
    } catch (err) {
        console.error("Error al guardar:", err);
        alert("Error de Supabase: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "GUARDAR EN SUPABASE";
    }
}

// 6. GESTIÓN DE LA LISTA TEMPORAL (FRONTEND)
function addParada(tipo) {
    if (!clienteActual) return;

    let coords;
    if (tipo === 'CASA') coords = clienteActual.casa;
    else if (tipo === 'TRABAJO') coords = clienteActual.trabajo;
    else coords = clienteActual.temporal;

    borradorRuta.push({
        nombre: clienteActual.nombre,
        codigo: clienteActual.codigo,
        lat: coords.lat,
        lng: coords.lng
    });

    actualizarVista();
}

function actualizarVista() {
    const lista = document.getElementById('lista-borrador');
    lista.innerHTML = borradorRuta.map((p, i) => `
        <div class="item-draft">
            <div><strong>${p.nombre}</strong> <small>(${p.codigo})</small></div>
            <button onclick="borrar(${i})" style="color:red; background:none; border:none; cursor:pointer; font-weight:bold;">X</button>
        </div>
    `).join('');
}

function borrar(i) {
    borradorRuta.splice(i, 1);
    actualizarVista();
    document.getElementById('reporte-texto').value = ""; // Limpiar mensaje si cambia la lista
}

// 7. UTILIDADES DE INTERFAZ
function login() {
    document.getElementById('login-box').style.display = 'none';
    document.getElementById('admin-content').style.display = 'block';
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
}

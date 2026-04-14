// admin.js

// --- CONFIGURACIÓN INICIAL ---
// Coordenadas fijas del punto de partida (Reemplaza con las de Rapid Pack)
const PUNTO_PARTIDA = { lat: 18.4861, lng: -69.9312 }; 

let clienteActual = null; 
let borradorRuta = []; 

// --- LÓGICA DE OPTIMIZACIÓN (Fórmula de Haversine y Vecino más cercano) ---
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la tierra en km
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

// --- GENERADOR DE WHATSAPP ---
function generarMensajeWhatsApp(rutaOptimizada) {
    const ahora = new Date();
    const hora = ahora.getHours();
    
    let saludo = "Buenos días";
    if (hora >= 12 && hora < 18) saludo = "Buenas tardes";
    else if (hora >= 18) saludo = "Buenas noches";

    const dia = String(ahora.getDate()).padStart(2, '0');
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const anio = String(ahora.getFullYear()).slice(-2);
    const fechaActual = `${dia}/${mes}/${anio}`;

    let mensaje = `${saludo}\nRuta para hoy ${fechaActual}:\n\n`;

    rutaOptimizada.forEach((parada, index) => {
        mensaje += `${index + 1}. ${parada.nombre} - ${parada.codigo}\n`;
    });

    return mensaje;
}

// --- INTERACCIÓN CON LA INTERFAZ ---

function login() {
    // Simulación de login. Luego lo conectas con supabase.auth
    document.getElementById('login-box').style.display = 'none';
    document.getElementById('admin-content').style.display = 'block';
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
}

function buscar() {
    const query = document.getElementById('buscador').value;
    const cardBorrador = document.getElementById('card-borrador');
    
    if (query.length > 2) {
        // MOCKUP: Simulando que encuentra un cliente en Supabase
        clienteActual = {
            nombre: query.toUpperCase(),
            codigo: "RP-" + Math.floor(Math.random() * 9000 + 1000),
            casa: { lat: 18.50, lng: -69.90 },     // Ejemplo
            trabajo: { lat: 18.45, lng: -69.95 },  // Ejemplo
            temporal: { lat: 18.48, lng: -69.92 }  // Ejemplo
        };
        
        document.getElementById('view-nombre').innerText = clienteActual.nombre + " (" + clienteActual.codigo + ")";
        document.getElementById('cliente-seleccionado').style.display = 'block';
        cardBorrador.style.display = 'block';
    } else {
        document.getElementById('cliente-seleccionado').style.display = 'none';
    }
}

function addParada(tipoUbicacion) {
    if (!clienteActual) return;

    let coordenadas;
    if (tipoUbicacion === 'CASA') coordenadas = clienteActual.casa;
    else if (tipoUbicacion === 'TRABAJO') coordenadas = clienteActual.trabajo;
    else if (tipoUbicacion === 'TEMPORAL') coordenadas = clienteActual.temporal;

    borradorRuta.push({
        nombre: clienteActual.nombre,
        codigo: clienteActual.codigo,
        tipo: tipoUbicacion,
        lat: coordenadas.lat,
        lng: coordenadas.lng
    });

    actualizarVistaBorrador();
}

function actualizarVistaBorrador() {
    const contenedor = document.getElementById('lista-borrador');
    contenedor.innerHTML = ''; 

    borradorRuta.forEach((parada) => {
        contenedor.innerHTML += `
            <div class="item-draft">
                <div>
                    <strong>${parada.nombre}</strong> <span style="font-size:10px; color:gray;">(${parada.codigo})</span><br>
                    <span style="font-size:11px;">Destino: ${parada.tipo}</span>
                </div>
            </div>
        `;
    });
}

function lanzarRuta() {
    if (borradorRuta.length === 0) {
        alert("Agrega al menos un cliente a la ruta");
        return;
    }

    const rutaOptimizada = optimizarRuta(borradorRuta);
    const textoWhatsapp = generarMensajeWhatsApp(rutaOptimizada);

    // Inyecta el texto optimizado en el cuadro negro de tu UI
    document.getElementById('reporte-texto').value = textoWhatsapp;
    
    // Limpia la búsqueda para agregar más clientes si quieres
    document.getElementById('buscador').value = '';
    document.getElementById('cliente-seleccionado').style.display = 'none';
}

// Funciones base para tu registro lateral (Para conectarlas a Supabase después)
function cargarEdicion() { alert("Listo para cargar datos y editar..."); }
function guardarCliente() { alert("Lógica para insertar en Supabase aquí."); }
// admin.js - RUTERIK ADMIN LOGIC

const PUNTO_PARTIDA = { lat: 18.4861, lng: -69.9312, label: "Base RapidPack" };
let clienteActual = null;
let resultadosBusqueda = [];
let borradorRuta = [];
let ultimaRuta = null;
let origenChofer = null;

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function optimizarRuta(paradas, origen) {
    const pendientes = [...paradas];
    const rutaOrdenada = [];
    let actual = { ...origen };
    let distanciaTotal = 0;

    while (pendientes.length > 0) {
        let indiceMasCercano = -1;
        let distanciaMinima = Infinity;

        for (let i = 0; i < pendientes.length; i++) {
            const d = calcularDistancia(actual.lat, actual.lng, pendientes[i].lat, pendientes[i].lng);
            if (d < distanciaMinima) {
                distanciaMinima = d;
                indiceMasCercano = i;
            }
        }

        const parada = pendientes.splice(indiceMasCercano, 1)[0];
        distanciaTotal += distanciaMinima;
        rutaOrdenada.push({
            ...parada,
            distanciaDesdeAnterior: distanciaMinima,
            distanciaAcumulada: distanciaTotal
        });
        actual = parada;
    }

    return { rutaOrdenada, distanciaTotal };
}

function obtenerSaludo() {
    const hora = new Date().getHours();
    if (hora >= 18) return "Buenas noches";
    if (hora >= 12) return "Buenas tardes";
    return "Buenos días";
}

function formatearFecha() {
    return new Date().toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function tipoBonito(tipo) {
    if (tipo === "CASA") return "Casa";
    if (tipo === "TRABAJO") return "Trabajo";
    return "Temporal";
}

function esCoordenadaValida(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
}

function obtenerCoordsCliente(cliente, tipo) {
    if (tipo === "CASA") return cliente.casa;
    if (tipo === "TRABAJO") return cliente.trabajo;
    return cliente.temporal;
}

function actualizarEstadoOrigen() {
    const modo = document.getElementById("origen-tipo").value;
    const manual = modo === "manual";
    document.getElementById("start-lat").disabled = !manual;
    document.getElementById("start-lng").disabled = !manual;

    const status = document.getElementById("origen-status");
    if (modo === "driver") {
        status.innerText = origenChofer
            ? `Ubicación del chofer cargada: ${origenChofer.lat.toFixed(5)}, ${origenChofer.lng.toFixed(5)}`
            : "Aún no se ha capturado la ubicación del chofer.";
        return;
    }
    if (modo === "base") {
        status.innerText = `Se usará la base: ${PUNTO_PARTIDA.lat}, ${PUNTO_PARTIDA.lng}`;
        return;
    }
    status.innerText = "Introduce las coordenadas manuales del punto de salida.";
}

function obtenerOrigenRuta() {
    const modo = document.getElementById("origen-tipo").value;
    if (modo === "base") return { ...PUNTO_PARTIDA };

    if (modo === "manual") {
        const lat = parseFloat(document.getElementById("start-lat").value);
        const lng = parseFloat(document.getElementById("start-lng").value);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            throw new Error("Debes colocar una latitud y longitud válidas para el inicio manual.");
        }
        return { lat, lng, label: "Inicio manual" };
    }

    if (!origenChofer) {
        throw new Error("Primero captura la ubicación del chofer con el botón 'Usar mi ubicación'.");
    }
    return { ...origenChofer, label: "Ubicación del chofer" };
}

function generarMensajeRuta(ruta, distanciaTotal, origen) {
    let mensaje = `${obtenerSaludo()}\nRuta para hoy ${formatearFecha()}:\n\n`;
    mensaje += `Salida: ${origen.label || "Punto inicial"}\n`;
    mensaje += `Paradas: ${ruta.length}\n`;
    mensaje += `Distancia estimada: ${distanciaTotal.toFixed(1)} km\n\n`;

    ruta.forEach((entrega, i) => {
        mensaje += `${i + 1}. ${entrega.nombre} - ${entrega.codigo}\n`;
        mensaje += `   Destino: ${tipoBonito(entrega.tipo)}\n`;
        mensaje += `   Tramo aprox.: ${entrega.distanciaDesdeAnterior.toFixed(1)} km\n`;
    });

    mensaje += `\nPor favor, revisar la ruta antes de salir y avisar cualquier novedad.`;
    return mensaje;
}

async function buscar() {
    const query = document.getElementById("buscador").value.trim();
    const status = document.getElementById("search-status");

    if (query.length < 2) {
        resultadosBusqueda = [];
        renderResultados();
        status.innerText = "Escribe al menos 2 letras para buscar clientes.";
        return;
    }

    status.innerText = "Buscando clientes...";

    try {
        const { data, error } = await supabaseClient
            .from("clientes")
            .select("*")
            .or(`nombre.ilike.%${query}%,codigo.ilike.%${query}%`)
            .order("nombre", { ascending: true })
            .limit(8);

        if (error) throw error;

        resultadosBusqueda = (data || []).map(mapearCliente);
        renderResultados();
        status.innerText = resultadosBusqueda.length
            ? `${resultadosBusqueda.length} cliente(s) encontrados.`
            : "No se encontraron clientes con ese criterio.";
    } catch (err) {
        console.error("Error en búsqueda:", err.message);
        status.innerText = `Error al buscar: ${err.message}`;
    }
}

function mapearCliente(c) {
    return {
        id: c.id,
        nombre: c.nombre,
        codigo: c.codigo,
        casa: { lat: Number(c.lat_casa) || 0, lng: Number(c.lng_casa) || 0 },
        trabajo: { lat: Number(c.lat_trabajo) || 0, lng: Number(c.lng_trabajo) || 0 },
        temporal: { lat: Number(c.lat_temp) || 0, lng: Number(c.lng_temp) || 0 }
    };
}

function renderResultados() {
    const container = document.getElementById("resultados");
    if (!resultadosBusqueda.length) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = resultadosBusqueda.map((cliente) => {
        const activa = clienteActual && clienteActual.id === cliente.id ? "active" : "";
        return `
            <button class="result-item ${activa}" onclick="seleccionarCliente('${cliente.id}')">
                <strong>${cliente.nombre}</strong>
                <small>${cliente.codigo}</small>
            </button>
        `;
    }).join("");
}

function seleccionarCliente(id) {
    clienteActual = resultadosBusqueda.find((cliente) => String(cliente.id) === String(id)) || null;
    if (!clienteActual) return;

    document.getElementById("view-nombre").innerText = `${clienteActual.nombre} (${clienteActual.codigo})`;
    document.getElementById("cliente-seleccionado").style.display = "block";
    document.getElementById("card-borrador").style.display = "block";
    document.getElementById("view-detalle").innerHTML = [
        esCoordenadaValida(clienteActual.casa.lat, clienteActual.casa.lng) ? '<span class="pill">Casa lista</span>' : "",
        esCoordenadaValida(clienteActual.trabajo.lat, clienteActual.trabajo.lng) ? '<span class="pill">Trabajo listo</span>' : "",
        esCoordenadaValida(clienteActual.temporal.lat, clienteActual.temporal.lng) ? '<span class="pill">Temporal listo</span>' : ""
    ].join("") || '<span class="pill">Sin coordenadas configuradas</span>';

    renderResultados();
}

async function guardarCliente() {
    const btn = document.getElementById("btn-save");
    const id = document.getElementById("cliente-id").value;
    const nombre = document.getElementById("n-nombre").value.trim();
    const codigo = document.getElementById("n-codigo").value.trim();

    if (!nombre || !codigo) {
        alert("Nombre y código son obligatorios.");
        return;
    }

    btn.disabled = true;
    btn.innerText = id ? "ACTUALIZANDO..." : "GUARDANDO...";

    const payload = {
        nombre: nombre.toUpperCase(),
        codigo: codigo.toUpperCase(),
        lat_casa: parseFloat(document.getElementById("n-lat").value) || 0,
        lng_casa: parseFloat(document.getElementById("n-lng").value) || 0,
        lat_trabajo: parseFloat(document.getElementById("n-lat-2").value) || 0,
        lng_trabajo: parseFloat(document.getElementById("n-lng-2").value) || 0,
        lat_temp: parseFloat(document.getElementById("n-lat-temp").value) || 0,
        lng_temp: parseFloat(document.getElementById("n-lng-temp").value) || 0
    };

    try {
        let response;
        if (id) {
            response = await supabaseClient
                .from("clientes")
                .update(payload)
                .eq("id", id)
                .select()
                .single();
        } else {
            response = await supabaseClient
                .from("clientes")
                .insert([payload])
                .select()
                .single();
        }

        if (response.error) throw response.error;

        const clienteGuardado = mapearCliente(response.data);
        alert(id ? "Cliente actualizado exitosamente." : "Cliente guardado exitosamente.");
        limpiarFormulario(false);
        document.getElementById("buscador").value = clienteGuardado.codigo;
        await buscar();
        seleccionarCliente(clienteGuardado.id);
    } catch (err) {
        console.error("Error al guardar:", err);
        alert("Error de Supabase: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = document.getElementById("cliente-id").value ? "Actualizar cliente" : "Guardar cliente";
    }
}

function cargarClienteEnFormulario() {
    if (!clienteActual) return;

    document.getElementById("cliente-id").value = clienteActual.id || "";
    document.getElementById("n-nombre").value = clienteActual.nombre || "";
    document.getElementById("n-codigo").value = clienteActual.codigo || "";
    document.getElementById("n-lat").value = clienteActual.casa.lat || "";
    document.getElementById("n-lng").value = clienteActual.casa.lng || "";
    document.getElementById("n-lat-2").value = clienteActual.trabajo.lat || "";
    document.getElementById("n-lng-2").value = clienteActual.trabajo.lng || "";
    document.getElementById("n-lat-temp").value = clienteActual.temporal.lat || "";
    document.getElementById("n-lng-temp").value = clienteActual.temporal.lng || "";
    document.getElementById("form-title").innerText = "Editar cliente";
    document.getElementById("btn-save").innerText = "Actualizar cliente";
    document.getElementById("btn-cancel").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function limpiarFormulario(limpiarSeleccion = true) {
    document.getElementById("cliente-id").value = "";
    document.getElementById("n-nombre").value = "";
    document.getElementById("n-codigo").value = "";
    document.getElementById("n-lat").value = "";
    document.getElementById("n-lng").value = "";
    document.getElementById("n-lat-2").value = "";
    document.getElementById("n-lng-2").value = "";
    document.getElementById("n-lat-temp").value = "";
    document.getElementById("n-lng-temp").value = "";
    document.getElementById("form-title").innerText = "Registro de cliente";
    document.getElementById("btn-save").innerText = "Guardar cliente";
    document.getElementById("btn-cancel").classList.add("hidden");

    if (limpiarSeleccion) {
        clienteActual = null;
        document.getElementById("cliente-seleccionado").style.display = "none";
        renderResultados();
    }
}

function addParada(tipo) {
    if (!clienteActual) return;

    const coords = obtenerCoordsCliente(clienteActual, tipo);
    if (!esCoordenadaValida(coords.lat, coords.lng)) {
        alert(`Este cliente no tiene coordenadas válidas para ${tipoBonito(tipo)}.`);
        return;
    }

    borradorRuta.push({
        clienteId: clienteActual.id,
        nombre: clienteActual.nombre,
        codigo: clienteActual.codigo,
        tipo,
        lat: coords.lat,
        lng: coords.lng
    });

    actualizarVista();
}

function actualizarVista() {
    const lista = document.getElementById("lista-borrador");
    lista.innerHTML = borradorRuta.map((p, i) => `
        <div class="item-draft">
            <div>
                <strong>${p.nombre}</strong> <small>${p.codigo} · ${tipoBonito(p.tipo)}</small>
            </div>
            <button onclick="borrar(${i})" style="color:red; background:none; border:none; cursor:pointer; font-weight:bold;">X</button>
        </div>
    `).join("");
    document.getElementById("reporte-texto").value = "";
    ultimaRuta = null;
}

function borrar(i) {
    borradorRuta.splice(i, 1);
    actualizarVista();
}

async function usarUbicacionActual() {
    if (!navigator.geolocation) {
        alert("Este navegador no soporta geolocalización.");
        return;
    }

    const status = document.getElementById("origen-status");
    status.innerText = "Obteniendo ubicación actual...";

    navigator.geolocation.getCurrentPosition(
        (position) => {
            origenChofer = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            document.getElementById("start-lat").value = origenChofer.lat.toFixed(6);
            document.getElementById("start-lng").value = origenChofer.lng.toFixed(6);
            document.getElementById("origen-tipo").value = "driver";
            actualizarEstadoOrigen();
        },
        (error) => {
            status.innerText = "No fue posible obtener la ubicación del chofer.";
            alert(`Error al obtener ubicación: ${error.message}`);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function ejecutarOptimizacion() {
    if (borradorRuta.length === 0) {
        alert("Agrega entregas a la lista antes de optimizar.");
        return;
    }

    try {
        const origen = obtenerOrigenRuta();
        const { rutaOrdenada, distanciaTotal } = optimizarRuta(borradorRuta, origen);
        ultimaRuta = { rutaOrdenada, distanciaTotal, origen };
        document.getElementById("reporte-texto").value = generarMensajeRuta(rutaOrdenada, distanciaTotal, origen);
    } catch (error) {
        alert(error.message);
    }
}

function login() {
    document.getElementById("login-box").style.display = "none";
    document.getElementById("admin-content").style.display = "block";
    actualizarEstadoOrigen();
}

function toggleTheme() {
    document.body.classList.toggle("light-mode");
}

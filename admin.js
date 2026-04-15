// admin.js - RUTERIK ADMIN LOGIC

const PUNTO_PARTIDA = {
    lat: 18.4876675976609,
    lng: -69.85569844327547,
    label: "Punto fijo del chofer"
};
const SESSION_KEY = "ruterik_admin_session";

let clienteActual = null;
let resultadosBusqueda = [];
let borradorRuta = [];
let ultimaRuta = null;

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
    if (hora >= 18) return "Good evening";
    if (hora >= 12) return "Good afternoon";
    return "Good morning";
}

function formatearFecha() {
    return new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
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

function escapeHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

function actualizarEstadoOrigen() {
    const status = document.getElementById("origen-status");
    if (status) {
        status.innerText = `La ruta siempre inicia en ${PUNTO_PARTIDA.lat.toFixed(6)}, ${PUNTO_PARTIDA.lng.toFixed(6)}.`;
    }
}

function obtenerOrigenRuta() {
    return { ...PUNTO_PARTIDA };
}

function generarMensajeRuta(ruta) {
    let mensaje = `${obtenerSaludo()}. For today's route (${formatearFecha()}):\n\n`;

    ruta.forEach((entrega, i) => {
        mensaje += `${i + 1}. ${entrega.nombre}\n`;
    });

    return mensaje.trim();
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
        console.error("Error en bÃºsqueda:", err.message);
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
            <button class="result-item ${activa}" onclick="seleccionarCliente('${escapeHtml(cliente.id)}')">
                <strong>${escapeHtml(cliente.nombre)}</strong>
                <small>${escapeHtml(cliente.codigo)}</small>
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
        alert("Nombre y cÃ³digo son obligatorios.");
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

async function eliminarClienteActual() {
    if (!clienteActual) return;

    const confirmado = confirm(`¿Eliminar definitivamente a ${clienteActual.nombre}?`);
    if (!confirmado) return;

    try {
        const { error } = await supabaseClient
            .from("clientes")
            .delete()
            .eq("id", clienteActual.id);

        if (error) throw error;

        borradorRuta = borradorRuta.filter((item) => String(item.clienteId) !== String(clienteActual.id));
        resultadosBusqueda = resultadosBusqueda.filter((item) => String(item.id) !== String(clienteActual.id));
        alert("Cliente eliminado exitosamente.");
        limpiarFormulario();
        actualizarVista();
        renderResultados();
    } catch (err) {
        console.error("Error al eliminar:", err);
        alert("Error de Supabase: " + err.message);
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
        alert(`Este cliente no tiene coordenadas vÃ¡lidas para ${tipoBonito(tipo)}.`);
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
                <strong>${escapeHtml(p.nombre)}</strong> <small>${escapeHtml(p.codigo)} · ${tipoBonito(p.tipo)}</small>
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

function ejecutarOptimizacion() {
    if (borradorRuta.length === 0) {
        alert("Agrega entregas a la lista antes de optimizar.");
        return;
    }

    try {
        const origen = obtenerOrigenRuta();
        const { rutaOrdenada, distanciaTotal } = optimizarRuta(borradorRuta, origen);
        ultimaRuta = { rutaOrdenada, distanciaTotal, origen };
        document.getElementById("reporte-texto").value = generarMensajeRuta(rutaOrdenada);
    } catch (error) {
        alert(error.message);
    }
}

function mostrarAdmin() {
    document.getElementById("login-box").style.display = "none";
    document.getElementById("admin-content").style.display = "block";
    actualizarEstadoOrigen();
}

function mostrarLogin() {
    document.getElementById("login-box").style.display = "block";
    document.getElementById("admin-content").style.display = "none";
}

function login() {
    localStorage.setItem(SESSION_KEY, "active");
    mostrarAdmin();
}

function logout() {
    localStorage.removeItem(SESSION_KEY);
    mostrarLogin();
}

function toggleTheme() {
    document.body.classList.toggle("light-mode");
}

document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem(SESSION_KEY) === "active") {
        mostrarAdmin();
    } else {
        mostrarLogin();
    }
});

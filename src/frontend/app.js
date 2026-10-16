const API = 'http://localhost:8082/api/puente';
let intervalId = null;
let tiempoInicio = null;
let ultimoLogCount = 0;

const $ = (id) => document.getElementById(id);

// ============================================================
// INICIAR SIMULACIÓN
// ============================================================
$('btnIniciar').addEventListener('click', async () => {
    const body = {
        vehiculosNorte: parseInt($('norte').value),
        vehiculosSur: parseInt($('sur').value),
        tiempoMinMs: 1500,
        tiempoMaxMs: 3500
    };

    if (body.vehiculosNorte + body.vehiculosSur === 0) {
        alert('Debes tener al menos un vehículo');
        return;
    }

    $('btnIniciar').disabled = true;
    tiempoInicio = Date.now();
    ultimoLogCount = 0;

    // Limpiar carriles y colas antes de arrancar
    limpiarCarriles();
    resetColas();

    try {
        const res = await fetch(`${API}/iniciar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json();
            alert(err.error || 'Error al iniciar');
            $('btnIniciar').disabled = false;
            return;
        }

        $('logContainer').innerHTML = '';
        arrancarPolling();
    } catch (e) {
        console.error(e);
        alert('Error de conexión con el backend');
        $('btnIniciar').disabled = false;
    }
});

// ============================================================
// LIMPIAR
// ============================================================
$('btnLimpiar').addEventListener('click', async () => {
    await fetch(`${API}/limpiar`, { method: 'POST' });
    $('logContainer').innerHTML = '';
    $('logCount').textContent = '0 eventos';
    $('direccionActual').textContent = '—';
    $('direccionActual').className = 'card-value';
    $('cruzandoAhora').textContent = '0';
    $('maxSim').textContent = '0';
    $('totalCruzados').textContent = '0';
    $('progressBar').style.setProperty('--progress', '0%');
    $('progressText').textContent = '0%';
    $('countNorte').textContent = '0 cruzando';
    $('countSur').textContent = '0 cruzando';
    $('estadoNorte').classList.remove('activo');
    $('estadoSur').classList.remove('activo');
    limpiarCarriles();
    resetColas();
    setStatus('Inactivo', '');
    ultimoLogCount = 0;
});

function limpiarCarriles() {
    $('carrilNorte').querySelectorAll('.auto').forEach(a => a.remove());
    $('carrilSur').querySelectorAll('.auto').forEach(a => a.remove());
    $('carrilNorte').classList.remove('activo-norte');
    $('carrilSur').classList.remove('activo-sur');
}

function resetColas() {
    $('colaNorte').innerHTML = '<div class="cola-empty-lado">Sin vehículos esperando</div>';
    $('colaSur').innerHTML = '<div class="cola-empty-lado">Sin vehículos esperando</div>';
}

// ============================================================
// POLLING
// ============================================================
function arrancarPolling() {
    if (intervalId) clearInterval(intervalId);
    setStatus('Ejecutando…', 'running');
    intervalId = setInterval(actualizar, 500);
    actualizar();
}

async function actualizar() {
    try {
        const res = await fetch(`${API}/estado`);
        const data = await res.json();

        // === Métricas ===
        const dir = data.direccionActual;
        $('direccionActual').textContent = dir === 'NINGUNA' ? '—' : dir;
        $('direccionActual').className = 'card-value' +
            (dir === 'NORTE' ? ' direccion-norte' : dir === 'SUR' ? ' direccion-sur' : '');
        $('cruzandoAhora').textContent = data.cruzandoAhora;
        $('maxSim').textContent = data.maxSimultaneos;
        $('totalCruzados').textContent = data.totalCruzados;

        // === Carriles + autos animados ===
        actualizarCarriles(data);

        // === Cola de espera ===
        const { esperandoNorte, esperandoSur } = analizarEspera(data.eventos);
        actualizarColas(esperandoNorte, esperandoSur);

        // === Barra de progreso ===
        const total = parseInt($('norte').value) + parseInt($('sur').value);
        const pct = total > 0
            ? Math.min(100, Math.round((data.totalCruzados / total) * 100))
            : 0;
        $('progressBar').style.setProperty('--progress', pct + '%');
        $('progressText').textContent = pct + '%';

        // === Log ===
        actualizarLog(data.eventos);

        // === Estado final ===
        if (!data.ejecutando && data.totalCruzados > 0) {
            clearInterval(intervalId);
            intervalId = null;
            setStatus('Finalizado', 'finished');
            $('btnIniciar').disabled = false;
        }
    } catch (e) {
        console.error(e);
    }
}

// ============================================================
// CARRILES + AUTOS ANIMADOS
// ============================================================
function actualizarCarriles(data) {
    const dir = data.direccionActual;

    // Activar/desactivar borde del carril
    if (dir === 'NORTE') {
        $('carrilNorte').classList.add('activo-norte');
        $('carrilSur').classList.remove('activo-sur');
    } else if (dir === 'SUR') {
        $('carrilSur').classList.add('activo-sur');
        $('carrilNorte').classList.remove('activo-norte');
    } else {
        $('carrilNorte').classList.remove('activo-norte');
        $('carrilSur').classList.remove('activo-sur');
    }

    // Estado inferior
    $('countNorte').textContent = data.vehiculosNorte + ' cruzando';
    $('countSur').textContent = data.vehiculosSur + ' cruzando';

    $('estadoNorte').classList.toggle('activo', data.vehiculosNorte > 0);
    $('estadoSur').classList.toggle('activo', data.vehiculosSur > 0);

    // ★ Crear/eliminar autos según los eventos de la bitácora
    sincronizarAutosEnCarril('carrilNorte', data.eventos, 'NORTE');
    sincronizarAutosEnCarril('carrilSur', data.eventos, 'SUR');
}

// ============================================================
// Crea los .auto dentro del carril según los vehículos que
// actualmente están cruzando (parseando la bitácora).
// ============================================================
function sincronizarAutosEnCarril(carrilId, eventos, direccion) {
    const carril = $(carrilId);

    // 1. Averiguar qué vehículos están cruzando AHORA en esta dirección
    const dentro = new Set();
    eventos.forEach(ev => {
        const mEntra = ev.mensaje.match(/Vehículo (\d+) ENTRA al puente → (\w+)/);
        const mSale  = ev.mensaje.match(/Vehículo (\d+) SALE del puente ← (\w+)/);
        if (mEntra && mEntra[2] === direccion) dentro.add(mEntra[1]);
        if (mSale  && mSale[2]  === direccion) dentro.delete(mSale[1]);
    });

    // 2. IDs que ya están dibujados en este carril
    const dibujados = new Set(
        Array.from(carril.querySelectorAll('.auto')).map(a => a.dataset.id)
    );

    // 3. Añadir los que faltan (autos nuevos)
    dentro.forEach(id => {
        if (!dibujados.has(id)) {
            const auto = document.createElement('div');
            auto.className = 'auto ' + direccion.toLowerCase();
            auto.dataset.id = id;
            auto.textContent = '#' + id;
            carril.appendChild(auto);

            // Limpieza automática al terminar la animación
            auto.addEventListener('animationend', () => auto.remove(), { once: true });
        }
    });

    // 4. Eliminar los que ya no están cruzando (por si el backend se atrasó)
    carril.querySelectorAll('.auto').forEach(auto => {
        if (!dentro.has(auto.dataset.id)) {
            auto.remove();
        }
    });
}

// ============================================================
// ANÁLISIS DE COLA DE ESPERA
// ============================================================
function analizarEspera(eventos) {
    const llegaron = { norte: new Set(), sur: new Set() };
    const entraron = new Set();

    eventos.forEach(ev => {
        const mLlegaNorte = ev.mensaje.match(/Vehículo (\d+) llega al puente \(dirección NORTE\)/);
        const mLlegaSur   = ev.mensaje.match(/Vehículo (\d+) llega al puente \(dirección SUR\)/);
        const mEntra      = ev.mensaje.match(/Vehículo (\d+) ENTRA/);

        if (mLlegaNorte) llegaron.norte.add(mLlegaNorte[1]);
        if (mLlegaSur)   llegaron.sur.add(mLlegaSur[1]);
        if (mEntra)      entraron.add(mEntra[1]);
    });

    // Esperando = llegaron pero aún no entraron
    const esperandoNorte = new Set();
    const esperandoSur = new Set();

    llegaron.norte.forEach(id => {
        if (!entraron.has(id)) esperandoNorte.add(id);
    });
    llegaron.sur.forEach(id => {
        if (!entraron.has(id)) esperandoSur.add(id);
    });

    return { esperandoNorte, esperandoSur };
}

function actualizarColas(esperandoNorte, esperandoSur) {
    // Norte
    const colaN = $('colaNorte');
    if (esperandoNorte.size === 0) {
        colaN.innerHTML = '<div class="cola-empty-lado">Sin vehículos esperando</div>';
    } else {
        const ids = Array.from(esperandoNorte).sort((a, b) => a - b);
        colaN.innerHTML = ids.map(id =>
            `<div class="cola-vehiculo norte">#${id}</div>`
        ).join('');
    }

    // Sur
    const colaS = $('colaSur');
    if (esperandoSur.size === 0) {
        colaS.innerHTML = '<div class="cola-empty-lado">Sin vehículos esperando</div>';
    } else {
        const ids = Array.from(esperandoSur).sort((a, b) => a - b);
        colaS.innerHTML = ids.map(id =>
            `<div class="cola-vehiculo sur">#${id}</div>`
        ).join('');
    }
}

// ============================================================
// LOG (BITÁCORA)
// ============================================================
function actualizarLog(eventos) {
    const cont = $('logContainer');
    const count = $('logCount');

    if (eventos.length > ultimoLogCount) {
        for (let i = ultimoLogCount; i < eventos.length; i++) {
            const ev = eventos[i];
            const div = document.createElement('div');
            div.className = 'log-entry ' + clasificarEvento(ev.mensaje);
            div.innerHTML = `
                <span class="hora">[${ev.hora}]</span>
                <span class="msg">${ev.mensaje}</span>
            `;
            cont.appendChild(div);
        }
        ultimoLogCount = eventos.length;
        cont.scrollTop = cont.scrollHeight;
    }

    count.textContent = eventos.length + ' eventos';
}

function clasificarEvento(msg) {
    if (msg.includes('ENTRA')) return 'ingresa';
    if (msg.includes('SALE')) return 'sale';
    if (msg.includes('llega')) return 'llega';
    if (msg.includes('Puente libre')) return 'cambio';
    if (msg.includes('Inicio')) return 'inicio';
    if (msg.includes('finalizada')) return 'fin';
    return '';
}

// ============================================================
// STATUS BADGE
// ============================================================
function setStatus(texto, clase) {
    $('statusText').textContent = texto;
    $('statusBadge').className = 'status-badge ' + clase;
}
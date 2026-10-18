const API = 'http://localhost:8082/api/puente';
let intervalId = null;
let ultimoLogCount = 0;

// ============================================================
// MOTOR DE ANIMACIÓN Y VARIABLES GLOBALES
// ============================================================
const animaciones = {
    NORTE: { autos: [] },
    SUR: { autos: [] }
};
const VELOCIDAD = 2; // Píxeles por frame
const ESPACIADO_MINIMO = 60; // Píxeles de separación mínima entre autos
let rafId = null;
let timeoutNorte = null;
let timeoutSur = null;

function iniciarMotorAnimacion() {
    if (rafId) cancelAnimationFrame(rafId);
    function loop() {
        moverAutos('NORTE', 'carrilNorte');
        moverAutos('SUR', 'carrilSur');
        rafId = requestAnimationFrame(loop);
    }
    loop();
}

function moverAutos(direccion, carrilId) {
    const carril = document.getElementById(carrilId);
    if (!carril) return;
    const anchoCarril = carril.offsetWidth;

    const estado = animaciones[direccion];

    // Mover cada auto
    estado.autos.forEach(autoObj => {
        if (direccion === 'NORTE') {
            autoObj.x += VELOCIDAD;
            autoObj.el.style.left = autoObj.x + 'px';

            // Si sale del carril por la derecha, eliminarlo
            if (autoObj.x > anchoCarril + 20) {
                autoObj.el.remove();
                autoObj.eliminado = true;
            }
        } else {
            autoObj.x -= VELOCIDAD;
            autoObj.el.style.left = autoObj.x + 'px';

            // Si sale del carril por la izquierda, eliminarlo
            if (autoObj.x < -80) {
                autoObj.el.remove();
                autoObj.eliminado = true;
            }
        }
    });

    // Limpiar los eliminados del array
    estado.autos = estado.autos.filter(a => !a.eliminado);
}

// ============================================================
// INICIAR / LIMPIAR / POLLING
// ============================================================
const $ = (id) => document.getElementById(id);

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
    ultimoLogCount = 0;

    // Reiniciar estado del motor
    animaciones.NORTE.autos = [];
    animaciones.SUR.autos = [];
    if (timeoutNorte) clearTimeout(timeoutNorte);
    if (timeoutSur) clearTimeout(timeoutSur);

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
        iniciarMotorAnimacion();
        arrancarPolling();
    } catch (e) {
        console.error(e);
        alert('Error de conexión con el backend');
        $('btnIniciar').disabled = false;
    }
});

$('btnLimpiar').addEventListener('click', async () => {
    await fetch(`${API}/limpiar`, { method: 'POST' });
    limpiarCarriles();
    resetColas();
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
    setStatus('Inactivo', '');
    ultimoLogCount = 0;

    if (rafId) cancelAnimationFrame(rafId);
    if (timeoutNorte) clearTimeout(timeoutNorte);
    if (timeoutSur) clearTimeout(timeoutSur);
});

function limpiarCarriles() {
    document.querySelectorAll('.auto').forEach(a => a.remove());
    $('carrilNorte').classList.remove('activo-norte');
    $('carrilSur').classList.remove('activo-sur');
}

function resetColas() {
    $('colaNorte').innerHTML = '<div class="cola-empty-lado">Sin vehículos esperando</div>';
    $('colaSur').innerHTML = '<div class="cola-empty-lado">Sin vehículos esperando</div>';
}

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

        const dir = data.direccionActual;
        $('direccionActual').textContent = dir === 'NINGUNA' ? '—' : dir;
        $('direccionActual').className = 'card-value' +
            (dir === 'NORTE' ? ' direccion-norte' : dir === 'SUR' ? ' direccion-sur' : '');
        $('cruzandoAhora').textContent = data.cruzandoAhora;
        $('maxSim').textContent = data.maxSimultaneos;
        $('totalCruzados').textContent = data.totalCruzados;

        actualizarCarriles(data);

        const { esperandoNorte, esperandoSur } = analizarEspera(data.eventos);
        actualizarColas(esperandoNorte, esperandoSur);

        const total = parseInt($('norte').value) + parseInt($('sur').value);
        const pct = total > 0
            ? Math.min(100, Math.round((data.totalCruzados / total) * 100))
            : 0;
        $('progressBar').style.setProperty('--progress', pct + '%');
        $('progressText').textContent = pct + '%';

        actualizarLog(data.eventos);

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
// ACTUALIZAR VISUALIZACIÓN
// ============================================================
function actualizarCarriles(data) {
    const dir = data.direccionActual;

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

    $('countNorte').textContent = data.vehiculosNorte + ' cruzando';
    $('countSur').textContent = data.vehiculosSur + ' cruzando';

    $('estadoNorte').classList.toggle('activo', data.vehiculosNorte > 0);
    $('estadoSur').classList.toggle('activo', data.vehiculosSur > 0);

    procesarColaDeEspera('carrilNorte', data.eventos, 'NORTE');
    procesarColaDeEspera('carrilSur', data.eventos, 'SUR');
}

// ============================================================
// LÓGICA DE ENTRADA DE AUTOS (EFECTO CONVOY)
// ============================================================
function procesarColaDeEspera(carrilId, eventos, direccion) {
    const carril = document.getElementById(carrilId);
    if (!carril) return;

    const ancho = carril.offsetWidth;
    const estado = animaciones[direccion];

    // 1. Qué autos deberían estar dentro según la bitácora
    const debenEstarDentro = new Set();
    eventos.forEach(ev => {
        const mEntra = ev.mensaje.match(/Vehículo (\d+) ENTRA al puente → (\w+)/);
        const mSale  = ev.mensaje.match(/Vehículo (\d+) SALE del puente ← (\w+)/);
        if (mEntra && mEntra[2] === direccion) debenEstarDentro.add(mEntra[1]);
        if (mSale  && mSale[2]  === direccion) debenEstarDentro.delete(mSale[1]);
    });

    // 2. IDs que ya están en el carril dibujados
    const idsDibujados = new Set(estado.autos.map(a => a.id));

    // 3. Encontrar cuáles faltan
    const faltantes = Array.from(debenEstarDentro).filter(id => !idsDibujados.has(id));

    // Si no hay faltantes, no hacemos nada
    if (faltantes.length === 0) {
        if (direccion === 'NORTE' && timeoutNorte) {
            clearTimeout(timeoutNorte);
            timeoutNorte = null;
        } else if (direccion === 'SUR' && timeoutSur) {
            clearTimeout(timeoutSur);
            timeoutSur = null;
        }
        return;
    }

    // Si ya hay un temporizador corriendo, no creamos otro
    if (direccion === 'NORTE' && timeoutNorte) return;
    if (direccion === 'SUR' && timeoutSur) return;

    // 4. Función que saca un auto a la vez
    const sacarSiguienteAuto = () => {
        // Verificamos si ya no hay faltantes
        const idsDibujadosActuales = new Set(estado.autos.map(a => a.id));
        const faltantesActuales = Array.from(debenEstarDentro).filter(id => !idsDibujadosActuales.has(id));

        if (faltantesActuales.length === 0) {
            if (direccion === 'NORTE') timeoutNorte = null;
            if (direccion === 'SUR') timeoutSur = null;
            return;
        }

        // Verificamos si hay espacio en el carril
        let hayEspacio = false;
        if (estado.autos.length === 0) {
            hayEspacio = true;
        } else {
            // Ordenamos los autos por posición para saber quién es el último
            const autosOrdenados = [...estado.autos].sort((a, b) => direccion === 'NORTE' ? a.x - b.x : b.x - a.x);
            const ultimoAuto = autosOrdenados[autosOrdenados.length - 1];

            if (direccion === 'NORTE') {
                // El último auto va hacia la derecha. Si ya avanzó lo suficiente, hay espacio.
                if (ultimoAuto.x > ESPACIADO_MINIMO) hayEspacio = true;
            } else {
                // El último auto va hacia la izquierda. Si ya avanzó lo suficiente, hay espacio.
                if (ultimoAuto.x < ancho - ESPACIADO_MINIMO) hayEspacio = true;
            }
        }

        if (hayEspacio) {
            // Sacamos el primer auto de la lista de faltantes
            const id = faltantesActuales[0];

            const autoEl = document.createElement('div');
            autoEl.className = 'auto ' + direccion.toLowerCase();
            autoEl.textContent = '#' + id;

            let startX;
            if (direccion === 'NORTE') {
                startX = -80; // Aparece desde la izquierda
            } else {
                startX = ancho + 80; // Aparece desde la derecha
            }
            autoEl.style.left = startX + 'px';
            autoEl.style.top = '50%';

            carril.appendChild(autoEl);

            estado.autos.push({
                id: id,
                el: autoEl,
                x: startX,
                eliminado: false
            });
        }

        // Volvemos a intentar en 250ms (efecto uno por uno)
        if (direccion === 'NORTE') {
            timeoutNorte = setTimeout(sacarSiguienteAuto, 250);
        } else {
            timeoutSur = setTimeout(sacarSiguienteAuto, 250);
        }
    };

    // Iniciar el ciclo
    if (direccion === 'NORTE') {
        timeoutNorte = setTimeout(sacarSiguienteAuto, 250);
    } else {
        timeoutSur = setTimeout(sacarSiguienteAuto, 250);
    }
}

// ============================================================
// COLAS, LOG Y STATUS
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
    const colaN = $('colaNorte');
    if (esperandoNorte.size === 0) {
        colaN.innerHTML = '<div class="cola-empty-lado">Sin vehículos esperando</div>';
    } else {
        const ids = Array.from(esperandoNorte).sort((a, b) => a - b);
        colaN.innerHTML = ids.map(id => `<div class="cola-vehiculo norte">#${id}</div>`).join('');
    }

    const colaS = $('colaSur');
    if (esperandoSur.size === 0) {
        colaS.innerHTML = '<div class="cola-empty-lado">Sin vehículos esperando</div>';
    } else {
        const ids = Array.from(esperandoSur).sort((a, b) => a - b);
        colaS.innerHTML = ids.map(id => `<div class="cola-vehiculo sur">#${id}</div>`).join('');
    }
}

function actualizarLog(eventos) {
    const cont = $('logContainer');
    const count = $('logCount');

    if (eventos.length > ultimoLogCount) {
        for (let i = ultimoLogCount; i < eventos.length; i++) {
            const ev = eventos[i];
            const div = document.createElement('div');
            div.className = 'log-entry ' + clasificarEvento(ev.mensaje);
            div.innerHTML = `<span class="hora">[${ev.hora}]</span><span class="msg">${ev.mensaje}</span>`;
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

function setStatus(texto, clase) {
    $('statusText').textContent = texto;
    $('statusBadge').className = 'status-badge ' + clase;
}
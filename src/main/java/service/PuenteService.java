package miproyecto.puente.service;

import miproyecto.puente.dto.SimulacionRequest;
import miproyecto.puente.model.Direccion;
import miproyecto.puente.model.Vehiculo;
import miproyecto.puente.util.LogBuffer;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class PuenteService {

    private final LogBuffer log;
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Random random = new Random();

    // ===== Estado compartido del puente =====
    private final Object mutex = new Object();
    private Direccion direccionActual = Direccion.NINGUNA;
    private int vehiculosNorte = 0;
    private int vehiculosSur = 0;

    // Contadores de espera (para anti-inanición)
    private int esperandoNorte = 0;
    private int esperandoSur = 0;

    // Métricas
    private volatile boolean ejecutando = false;
    private final AtomicInteger cruzandoAhora = new AtomicInteger(0);
    private final AtomicInteger maxSimultaneos = new AtomicInteger(0);
    private final AtomicInteger totalCruzados = new AtomicInteger(0);

    public PuenteService(LogBuffer log) {
        this.log = log;
    }

    // ============================================================
    // INICIAR SIMULACIÓN
    // ============================================================
    public synchronized void iniciar(SimulacionRequest req) {
        if (ejecutando) {
            throw new IllegalStateException("Ya hay una simulación en curso");
        }

        ejecutando = true;
        log.clear();

        synchronized (mutex) {
            direccionActual = Direccion.NINGUNA;
            vehiculosNorte = 0;
            vehiculosSur = 0;
            esperandoNorte = 0;
            esperandoSur = 0;
        }

        cruzandoAhora.set(0);
        maxSimultaneos.set(0);
        totalCruzados.set(0);

        int total = req.getVehiculosNorte() + req.getVehiculosSur();
        CountDownLatch latch = new CountDownLatch(total);

        log.add("=== Inicio de simulación: " + req.getVehiculosNorte()
                + " vehículos al NORTE, " + req.getVehiculosSur()
                + " vehículos al SUR ===");

        // Crear y mezclar vehículos
        List<Vehiculo> todos = new ArrayList<>();
        int id = 1;
        for (int i = 0; i < req.getVehiculosNorte(); i++) {
            todos.add(new Vehiculo(id++, Direccion.NORTE, aleatorio(req)));
        }
        for (int i = 0; i < req.getVehiculosSur(); i++) {
            todos.add(new Vehiculo(id++, Direccion.SUR, aleatorio(req)));
        }
        Collections.shuffle(todos);

        // Enviar cada vehículo al pool de hilos
        for (Vehiculo v : todos) {
            executor.submit(new VehiculoWorker(v, this, log, latch));
        }

        // Hilo monitor: detecta cuándo terminan todos
        new Thread(() -> {
            try {
                latch.await();
                log.add("=== Simulación finalizada. Máx. simultáneos: "
                        + maxSimultaneos.get() + ", total cruzados: "
                        + totalCruzados.get() + " ===");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                ejecutando = false;
            }
        }).start();
    }

    private long aleatorio(SimulacionRequest req) {
        return req.getTiempoMinMs()
                + (long) (random.nextDouble() * (req.getTiempoMaxMs() - req.getTiempoMinMs()));
    }

    // ============================================================
    // ENTRAR AL PUENTE
    // Bloquea al hilo hasta que sea seguro cruzar en su dirección.
    // ============================================================
    public void entrar(Direccion dir, int id) throws InterruptedException {
        synchronized (mutex) {
            // Registro de espera
            if (dir == Direccion.NORTE) esperandoNorte++;
            else esperandoSur++;

            try {
                // Mientras no sea seguro entrar, esperamos
                while (!puedeEntrar(dir)) {
                    mutex.wait();
                }

                // Ocupar el puente
                direccionActual = dir;
                if (dir == Direccion.NORTE) {
                    vehiculosNorte++;
                    esperandoNorte--;
                } else {
                    vehiculosSur++;
                    esperandoSur--;
                }

                int ahora = cruzandoAhora.incrementAndGet();
                maxSimultaneos.accumulateAndGet(ahora, Math::max);

                log.add("Vehículo " + id + " ENTRA al puente → " + dir
                        + " (cruzando: " + ahora
                        + ", norte=" + vehiculosNorte
                        + ", sur=" + vehiculosSur + ")");

            } catch (InterruptedException e) {
                // Limpieza si nos interrumpen mientras esperábamos
                if (dir == Direccion.NORTE) esperandoNorte--;
                else esperandoSur--;
                throw e;
            }
        }
    }

    // ============================================================
    // CONDICIÓN DE ENTRADA (dentro de synchronized(mutex))
    // Reglas:
    //  1. Si no hay nadie cruzando → puede entrar cualquiera.
    //  2. Si la dirección actual es la misma → puede entrar.
    //  3. Si la dirección actual es la contraria → esperar.
    //  4. ANTI-INANICIÓN: si mi dirección ya tiene 0 cruzando pero
    //     la contraria está esperando, cedo el turno a la otra.
    // ============================================================
    private boolean puedeEntrar(Direccion dir) {

        // Caso 1: puente libre
        if (direccionActual == Direccion.NINGUNA) {
            return true;
        }

        if (dir == Direccion.NORTE) {
            // Hay sur cruzando → bloqueo total
            if (vehiculosSur > 0) return false;
            // Ya estamos en NORTE, no hay sur cruzando:
            // pero si ya no queda nadie de NORTE cruzando y hay SUR esperando,
            // cedemos el paso a SUR (anti-inanición)
            if (vehiculosNorte == 0 && esperandoSur > 0) return false;
            return true;
        } else {
            // dir == SUR
            if (vehiculosNorte > 0) return false;
            if (vehiculosSur == 0 && esperandoNorte > 0) return false;
            return true;
        }
    }

    // ============================================================
    // SALIR DEL PUENTE
    // ============================================================
    public void salir(Direccion dir, int id) {
        synchronized (mutex) {
            if (dir == Direccion.NORTE) vehiculosNorte--;
            else vehiculosSur--;

            int ahora = cruzandoAhora.decrementAndGet();
            totalCruzados.incrementAndGet();

            log.add("Vehículo " + id + " SALE del puente ← " + dir
                    + " (cruzando: " + ahora
                    + ", norte=" + vehiculosNorte
                    + ", sur=" + vehiculosSur + ")");

            // Si ya no queda nadie, liberar el puente
            if (vehiculosNorte == 0 && vehiculosSur == 0) {
                direccionActual = Direccion.NINGUNA;
                log.add("Puente libre · se permite cambio de dirección");
            }

            // Despertar a todos los que esperan (revaluarán la condición)
            mutex.notifyAll();
        }
    }

    // ============================================================
    // GETTERS PARA EL CONTROLLER
    // ============================================================
    public boolean isEjecutando() { return ejecutando; }

    public Direccion getDireccionActual() {
        synchronized (mutex) { return direccionActual; }
    }

    public int getVehiculosNorte() {
        synchronized (mutex) { return vehiculosNorte; }
    }

    public int getVehiculosSur() {
        synchronized (mutex) { return vehiculosSur; }
    }

    public int getCruzandoAhora() { return cruzandoAhora.get(); }
    public int getMaxSimultaneos() { return maxSimultaneos.get(); }
    public int getTotalCruzados() { return totalCruzados.get(); }
    public LogBuffer getLog() { return log; }
}
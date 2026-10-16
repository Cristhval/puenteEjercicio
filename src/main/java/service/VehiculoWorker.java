package miproyecto.puente.service;

import miproyecto.puente.model.Vehiculo;
import miproyecto.puente.util.LogBuffer;

import java.util.concurrent.CountDownLatch;

public class VehiculoWorker implements Runnable {

    private final Vehiculo vehiculo;
    private final PuenteService puente;
    private final LogBuffer log;
    private final CountDownLatch latch;

    public VehiculoWorker(Vehiculo vehiculo,
                          PuenteService puente,
                          LogBuffer log,
                          CountDownLatch latch) {
        this.vehiculo = vehiculo;
        this.puente = puente;
        this.log = log;
        this.latch = latch;
    }

    @Override
    public void run() {
        try {
            int id = vehiculo.getId();
            String dir = vehiculo.getDireccion().toString();

            log.add("Vehículo " + id + " llega al puente (dirección " + dir + ")");

            puente.entrar(vehiculo.getDireccion(), id);

            Thread.sleep(vehiculo.getTiempoCruceMs());

            puente.salir(vehiculo.getDireccion(), id);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            latch.countDown();
        }
    }
}
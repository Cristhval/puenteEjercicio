package miproyecto.puente.model;

public class Vehiculo {
    private final int id;
    private final Direccion direccion;
    private final long tiempoCruceMs;

    public Vehiculo(int id, Direccion direccion, long tiempoCruceMs) {
        this.id = id;
        this.direccion = direccion;
        this.tiempoCruceMs = tiempoCruceMs;
    }

    public int getId() { return id; }
    public Direccion getDireccion() { return direccion; }
    public long getTiempoCruceMs() { return tiempoCruceMs; }
}
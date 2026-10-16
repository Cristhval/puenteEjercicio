package miproyecto.puente.dto;

public class SimulacionRequest {

    private int vehiculosNorte = 5;
    private int vehiculosSur = 5;
    private long tiempoMinMs = 800;
    private long tiempoMaxMs = 2000;

    public int getVehiculosNorte() { return vehiculosNorte; }
    public void setVehiculosNorte(int vehiculosNorte) { this.vehiculosNorte = vehiculosNorte; }

    public int getVehiculosSur() { return vehiculosSur; }
    public void setVehiculosSur(int vehiculosSur) { this.vehiculosSur = vehiculosSur; }

    public long getTiempoMinMs() { return tiempoMinMs; }
    public void setTiempoMinMs(long tiempoMinMs) { this.tiempoMinMs = tiempoMinMs; }

    public long getTiempoMaxMs() { return tiempoMaxMs; }
    public void setTiempoMaxMs(long tiempoMaxMs) { this.tiempoMaxMs = tiempoMaxMs; }
}
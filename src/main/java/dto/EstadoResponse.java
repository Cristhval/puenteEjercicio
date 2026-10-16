package miproyecto.puente.dto;

import miproyecto.puente.model.Direccion;
import miproyecto.puente.model.EventoLog;

import java.util.List;

public class EstadoResponse {

    private boolean ejecutando;
    private Direccion direccionActual;
    private int vehiculosNorte;
    private int vehiculosSur;
    private int cruzandoAhora;
    private int maxSimultaneos;
    private int totalCruzados;
    private List<EventoLog> eventos;

    public EstadoResponse(boolean ejecutando,
                          Direccion direccionActual,
                          int vehiculosNorte,
                          int vehiculosSur,
                          int cruzandoAhora,
                          int maxSimultaneos,
                          int totalCruzados,
                          List<EventoLog> eventos) {
        this.ejecutando = ejecutando;
        this.direccionActual = direccionActual;
        this.vehiculosNorte = vehiculosNorte;
        this.vehiculosSur = vehiculosSur;
        this.cruzandoAhora = cruzandoAhora;
        this.maxSimultaneos = maxSimultaneos;
        this.totalCruzados = totalCruzados;
        this.eventos = eventos;
    }

    public boolean isEjecutando() { return ejecutando; }
    public Direccion getDireccionActual() { return direccionActual; }
    public int getVehiculosNorte() { return vehiculosNorte; }
    public int getVehiculosSur() { return vehiculosSur; }
    public int getCruzandoAhora() { return cruzandoAhora; }
    public int getMaxSimultaneos() { return maxSimultaneos; }
    public int getTotalCruzados() { return totalCruzados; }
    public List<EventoLog> getEventos() { return eventos; }
}
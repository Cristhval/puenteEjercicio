package miproyecto.puente.model;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

public class EventoLog {
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("HH:mm:ss.SSS");

    private final String hora;
    private final String mensaje;

    public EventoLog(String mensaje) {
        this.hora = LocalTime.now().format(FMT);
        this.mensaje = mensaje;
    }

    public String getHora() { return hora; }
    public String getMensaje() { return mensaje; }
}
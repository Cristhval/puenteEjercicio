package miproyecto.puente.util;

import miproyecto.puente.model.EventoLog;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Component
public class LogBuffer {

    private final List<EventoLog> eventos = Collections.synchronizedList(new ArrayList<>());

    public void add(String mensaje) {
        eventos.add(new EventoLog(mensaje));
    }

    public List<EventoLog> getEventos() {
        synchronized (eventos) {
            return new ArrayList<>(eventos);
        }
    }

    public void clear() {
        eventos.clear();
    }
}
package miproyecto.puente.controller;

import miproyecto.puente.dto.EstadoResponse;
import miproyecto.puente.dto.SimulacionRequest;
import miproyecto.puente.service.PuenteService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/puente")
public class PuenteController {

    private final PuenteService service;

    public PuenteController(PuenteService service) {
        this.service = service;
    }

    @PostMapping("/iniciar")
    public ResponseEntity<?> iniciar(@RequestBody SimulacionRequest req) {
        try {
            service.iniciar(req);
            return ResponseEntity.ok(Map.of("mensaje", "Simulación iniciada"));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/estado")
    public EstadoResponse estado() {
        return new EstadoResponse(
                service.isEjecutando(),
                service.getDireccionActual(),
                service.getVehiculosNorte(),
                service.getVehiculosSur(),
                service.getCruzandoAhora(),
                service.getMaxSimultaneos(),
                service.getTotalCruzados(),
                service.getLog().getEventos()
        );
    }

    @PostMapping("/limpiar")
    public ResponseEntity<?> limpiar() {
        service.getLog().clear();
        return ResponseEntity.ok(Map.of("mensaje", "Log limpiado"));
    }
}
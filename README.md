# Simulador de Puente de Dirección Única

## Descripción
Este proyecto simula el clásico problema de concurrencia de un **Puente de un solo carril** (o de dirección única). El puente permite el paso de vehículos en dirección Norte o Sur, pero **bajo ninguna circunstancia** puede haber vehículos cruzando en ambas direcciones al mismo tiempo.

Además, se implementa una lógica **anti-inanición**, para evitar que una dirección monopolice el puente y la otra quede esperando indefinidamente.

El sistema cuenta con un backend en **Spring Boot** que garantiza la seguridad de los hilos y un frontend web que representa visualmente el flujo de vehículos.

## Arquitectura del Sistema

Al igual que el proyecto de estacionamiento, sigue una arquitectura **Cliente-Servidor**:

### 1. Backend (Spring Boot)
Ubicación: `src/main/java/miproyecto/puente/`
- **`controller/`**: Endpoints REST (`/iniciar`, `/estado`, `/limpiar`).
- **`service/`**: El núcleo del proyecto. Contiene la lógica de exclusión mutua usando un objeto monitor (`synchronized`), métodos `wait()` y `notifyAll()`.
- **`model/`**: Entidades del dominio (`Vehiculo`, `Direccion` (enum), `EventoLog`).
- **`dto/`**: Estructuras JSON (`SimulacionRequest`, `EstadoResponse`).
- **`util/`**: `LogBuffer` (buffer de logs).
- **`config/`**: `WebConfig` (para CORS).

### 2. Frontend (Vanilla Web)
Ubicación: `src/frontend/`
- **`index.html`**: Interfaz con dos carriles (Norte y Sur) y colas laterales de espera.
- **`style.css`**: Mismo diseño que el proyecto 1 ("Editorial Oscuro").
- **`app.js`**: Polling al backend y motor de animación propio usando `requestAnimationFrame` para mover los vehículos en fila india.

---

## ¿Cómo funciona la simulación?

1. Al presionar **"Iniciar simulación"**, se envían las peticiones `POST` indicando cuántos vehículos irán al Norte y cuántos al Sur.
2. El backend mezcla los vehículos y lanza un hilo por cada uno.
3. Cada hilo intenta entrar al puente llamando al método `entrar(direccion)`.
4. Este método está protegido por un `synchronized(mutex)`. El hilo evalúa la condición:
    - Si la dirección opuesta tiene vehículos cruzando, el hilo llama a `mutex.wait()` y se suspende.
    - Si es seguro (puente libre o misma dirección), el hilo incrementa el contador, se marca a sí mismo como "cruzando" y procede.
    - **Anti-inanición:** Si un vehículo está esperando para ir al Norte, pero ya no queda nadie cruzando al Norte, el sistema le cederá el paso al Sur (y viceversa) para alternar equitativamente.
5. Una vez cruza, el vehículo llama a `salir()`, decrementa el contador y llama a `mutex.notifyAll()` para despertar a los hilos en espera.
6. El frontend dibuja los autos en su carril correspondiente simulando el paso continuo.

---

## ¿Se logró lo solicitado?

### Objetivo General
> *Coordinar procesos que comparten un recurso y evitar que dos grupos incompatibles accedan simultáneamente.*

**Sí se logró.** Gracias al uso de monitores (`wait`/`notifyAll`), el sistema garantiza la exclusión mutua entre las direcciones Norte y Sur.

### Criterios de la Rúbrica (Guía Práctica)
- **Resultado Esperado:** Solo una dirección activa a la vez.
    - **Verificación:** El backend nunca permite que `vehiculosNorte > 0` y `vehiculosSur > 0` a la vez. Si lo intentas ver en el frontend, es imposible que veas autos cruzando en ambos sentidos simultáneamente. Además, el panel indica una sola dirección activa (`NORTE`, `SUR` o `NINGUNA`).
- **Resultado Esperado:** Evitar la inanición (monopolio).
    - **Verificación:** Se incluyó el "Reto" de la guía. Si hay una cola masiva esperando al Norte y llega un vehículo al Sur, el algoritmo detecta que los del Norte ya se están moviendo y frena el flujo en cuanto el último vehículo del Norte cruza, cediéndole el paso al Sur para evitar que este muera de hambre.

---

## Cómo ejecutar el proyecto

### Requisitos
- Java 17 o superior.
- Maven.
- IDE (recomendado IntelliJ IDEA).

### Backend
1. Abre la carpeta del proyecto en tu IDE.
2. Recarga las dependencias de Maven (`pom.xml`).
3. Ejecuta la clase `PuenteApplication.java`.
4. **IMPORTANTE:** Este proyecto corre en el puerto **8082** por defecto para no chocar con el proyecto de estacionamiento. Verifica que en `application.properties` diga `server.port=8082`.

### Frontend
1. Abre el archivo `src/frontend/index.html` en tu navegador.
2. Asegúrate de que en `app.js` la variable `API` apunte a `http://localhost:8082/api/puente`.
3. Presiona **Iniciar Simulación** y observa cómo los autos se mueven en convoy, uno detrás del otro, cediendo el paso a la dirección contraria cuando corresponde.
# Contrato de la tool `flight_search`

Este documento describe, en lenguaje humano, qué hace la herramienta de búsqueda de vuelos, qué espera recibir y qué devuelve. El agente NO "ve" la API de Amadeus: solo ve este contrato a través del schema expuesto a LangChain.

---

## 1. Propósito

Permitir al agente responder preguntas sobre costos, duración y disponibilidad de vuelos reales, con datos provenientes de una API externa. El proveedor activo por defecto es **Duffel (test environment)**; **Amadeus Self-Service** queda como alternativa configurable vía la variable `FLIGHT_PROVIDER`.

## 2. Separación de responsabilidades

- **Tool (`src/agent/tools/flightSearch.ts`)**: contrato expuesto al agente (nombre, descripción, schema de input, formato de output).
- **Provider layer (`src/agent/providers/`)**: interfaz común `FlightProvider` + implementaciones intercambiables:
  - `duffel.ts` — cliente REST con Bearer token (activo por defecto).
  - `amadeus.ts` — cliente OAuth2 con caché de token (alternativa).
  - `index.ts` — factory `createFlightProvider()` que elige según `FLIGHT_PROVIDER`.
  - `types.ts` — contratos compartidos (`FlightProvider`, `FlightOffer`, `FlightSearchParams`).

La tool y el prompt NO cambian al cambiar de proveedor. Ese es el punto central del patrón.

## 3. Input esperado

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `origin` | string (3 letras) | sí | Código IATA del aeropuerto de origen (ej. BOG). |
| `destination` | string (3 letras) | sí | Código IATA del aeropuerto de destino (ej. NRT). |
| `departureDate` | string (YYYY-MM-DD) | sí | Fecha de salida. |
| `returnDate` | string (YYYY-MM-DD) | no | Fecha de regreso. Si se omite, la búsqueda es solo ida. |
| `adults` | entero (1-9) | no, default 1 | Cantidad de pasajeros adultos. |
| `currencyCode` | string (3 letras, ISO-4217) | no, default USD | Moneda de los precios (USD, EUR, COP). |

## 4. Output (JSON stringified)

Un objeto JSON con la siguiente forma:

```json
{
  "count": 3,
  "offers": [
    {
      "price": 1250.5,
      "currency": "USD",
      "airlines": ["AV", "UA"],
      "stops": 1,
      "departureAt": "2026-12-10T07:30:00",
      "arrivalAt": "2026-12-11T23:45:00",
      "duration": "PT28H15M",
      "roundTrip": false
    }
  ]
}
```

Si no se encuentran ofertas:

```json
{ "message": "No se encontraron ofertas para esos parámetros.", "offers": [] }
```

## 5. Reglas de normalización

- Se devuelven como máximo **3 ofertas** ordenadas por el propio criterio de Amadeus (típicamente precio ascendente).
- `airlines` combina `validatingAirlineCodes` y carriers de cada segmento, sin duplicados.
- `stops` = total de escalas sumando todos los itinerarios (ida + vuelta si aplica).
- `duration` se concatena con " + " cuando hay ida y vuelta (ej. "PT15H30M + PT16H10M").

## 6. Cuándo el agente debe usar esta tool

El prompt instruye al agente a invocar `flight_search` cuando la pregunta del usuario:

- Menciona costos, precios o presupuesto asociado a vuelos.
- Menciona ciudades/países origen y destino con intención de viaje.
- Pide disponibilidad, duración o aerolíneas para una ruta.

Y a **encadenar con `calculator`** cuando el usuario menciona un presupuesto a comparar contra el precio obtenido.

## 7. Manejo de errores

- **Credenciales faltantes**: la tool lanza un error descriptivo indicando qué variables configurar.
- **Fallo de autenticación Amadeus (OAuth2)**: se propaga con el código HTTP y el body.
- **Fallo en el endpoint de búsqueda**: se propaga con el código HTTP y el body.
- **Input inválido (schema)**: zod rechaza antes de llamar a la API.

## 8. Consideraciones pedagógicas

- El ambiente **test/sandbox** de cualquier proveedor retorna dataset limitado y precios sintéticos curados, no data de producción. Rutas entre hubs grandes (LHR↔JFK, LAX↔SFO, LHR↔MAD) funcionan bien; rutas menos transitadas (BOG↔NRT) pueden devolver vacío. Esto NO es un bug.
- Duffel sandbox devuelve precios típicamente en EUR. El agente debe comunicar la moneda real devuelta, no asumir la moneda que el usuario mencionó. Mejora futura: agregar una tool de conversión de moneda (ej. Open Exchange Rates).
- El schema de la tool usa descripciones claras en español porque **el LLM las lee** para decidir cuándo invocar la tool. Una descripción ambigua degrada la calidad del agente.
- La separación tool/provider demuestra **inversión de dependencias**: el agente depende de una abstracción (`FlightProvider`), no del proveedor concreto.

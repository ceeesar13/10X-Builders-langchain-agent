import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createFlightProvider, type FlightOffer, type FlightProvider } from "../providers/index.js";

const flightSearchSchema = z.object({
  origin: z.string().length(3).describe("Código IATA del aeropuerto de origen (ej. BOG, MAD)."),
  destination: z.string().length(3).describe("Código IATA del aeropuerto de destino (ej. NRT, JFK)."),
  departureDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD")
    .describe("Fecha de salida en formato YYYY-MM-DD."),
  returnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD")
    .optional()
    .describe("Fecha de regreso en formato YYYY-MM-DD. Omitir para solo ida."),
  adults: z.number().int().positive().max(9).default(1).describe("Cantidad de pasajeros adultos."),
  currencyCode: z
    .string()
    .length(3)
    .default("USD")
    .describe("Moneda ISO-4217 para los precios (USD, EUR, COP)."),
});

type FlightSearchInput = z.infer<typeof flightSearchSchema>;

export function createFlightSearchTool(provider: FlightProvider = createFlightProvider()) {
  return tool(
    async (input: FlightSearchInput) => {
      const offers = await provider.searchFlights({
        origin: input.origin,
        destination: input.destination,
        departureDate: input.departureDate,
        returnDate: input.returnDate,
        adults: input.adults,
        currencyCode: input.currencyCode,
        max: 3,
      });

      if (offers.length === 0) {
        return JSON.stringify({
          message: "No se encontraron ofertas para esos parámetros.",
          offers: [],
        });
      }

      const summary = offers.map(summarizeOffer);
      return JSON.stringify({ count: offers.length, offers: summary });
    },
    {
      name: "flight_search",
      description:
        "Busca ofertas de vuelos reales (precio, aerolínea, escalas, duración) usando códigos IATA y fecha YYYY-MM-DD. Devuelve hasta 3 ofertas ordenadas por precio.",
      schema: flightSearchSchema,
    }
  );
}

export const flightSearchTool = createFlightSearchTool();

function summarizeOffer(offer: FlightOffer) {
  return {
    price: offer.price,
    currency: offer.currency,
    airlines: offer.airlines,
    stops: offer.stops,
    departureAt: offer.departureAt,
    arrivalAt: offer.arrivalAt,
    duration: offer.duration,
    roundTrip: offer.roundTrip,
  };
}

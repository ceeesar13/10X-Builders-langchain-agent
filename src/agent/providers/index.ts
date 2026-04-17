import { getEnv } from "../../config/env.js";
import { createAmadeusClient } from "./amadeus.js";
import { createDuffelClient } from "./duffel.js";
import type { FlightProvider } from "./types.js";

export type { FlightProvider, FlightOffer, FlightSearchParams } from "./types.js";

export function createFlightProvider(): FlightProvider {
  const env = getEnv();
  switch (env.FLIGHT_PROVIDER) {
    case "amadeus":
      return createAmadeusClient();
    case "duffel":
    default:
      return createDuffelClient();
  }
}

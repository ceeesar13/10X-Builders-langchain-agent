import { getEnv } from "../../config/env.js";
import type { FlightOffer, FlightProvider, FlightSearchParams } from "./types.js";

export type { FlightOffer, FlightProvider, FlightSearchParams } from "./types.js";

interface AmadeusRawOffer {
  price: { total: string; currency: string };
  validatingAirlineCodes?: string[];
  itineraries: Array<{
    duration: string;
    segments: Array<{
      carrierCode: string;
      departure: { iataCode: string; at: string };
      arrival: { iataCode: string; at: string };
    }>;
  }>;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

export type AmadeusClient = FlightProvider;

export function createAmadeusClient(fetchImpl: typeof fetch = fetch): FlightProvider {
  async function getToken(): Promise<string> {
    if (tokenCache && tokenCache.expiresAt > Date.now() + 5_000) {
      return tokenCache.accessToken;
    }

    const env = getEnv();
    if (!env.AMADEUS_API_KEY || !env.AMADEUS_API_SECRET) {
      throw new Error(
        "Amadeus API credentials missing. Set AMADEUS_API_KEY and AMADEUS_API_SECRET in env.local."
      );
    }

    const response = await fetchImpl(`${env.AMADEUS_BASE_URL}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.AMADEUS_API_KEY,
        client_secret: env.AMADEUS_API_SECRET,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Amadeus auth failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
  }

  async function searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
    const env = getEnv();
    const token = await getToken();

    const query = new URLSearchParams({
      originLocationCode: params.origin.toUpperCase(),
      destinationLocationCode: params.destination.toUpperCase(),
      departureDate: params.departureDate,
      adults: String(params.adults ?? 1),
      currencyCode: params.currencyCode ?? "USD",
      max: String(params.max ?? 5),
    });
    if (params.returnDate) query.set("returnDate", params.returnDate);

    const response = await fetchImpl(
      `${env.AMADEUS_BASE_URL}/v2/shopping/flight-offers?${query.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Amadeus flight search failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as { data?: AmadeusRawOffer[] };
    const offers = payload.data ?? [];

    return offers.map((offer) => normalizeOffer(offer));
  }

  return { searchFlights };
}

function normalizeOffer(offer: AmadeusRawOffer): FlightOffer {
  const allSegments = offer.itineraries.flatMap((it) => it.segments);
  const airlines = Array.from(
    new Set([
      ...(offer.validatingAirlineCodes ?? []),
      ...allSegments.map((s) => s.carrierCode),
    ])
  );
  const firstSegment = offer.itineraries[0]?.segments[0];
  const lastItinerary = offer.itineraries[offer.itineraries.length - 1];
  const lastSegment = lastItinerary?.segments[lastItinerary.segments.length - 1];
  const totalStops = offer.itineraries.reduce((sum, it) => sum + (it.segments.length - 1), 0);
  const totalDuration = offer.itineraries.map((it) => it.duration).join(" + ");

  return {
    price: Number(offer.price.total),
    currency: offer.price.currency,
    airlines,
    stops: totalStops,
    departureAt: firstSegment?.departure.at ?? "",
    arrivalAt: lastSegment?.arrival.at ?? "",
    duration: totalDuration,
    roundTrip: offer.itineraries.length > 1,
  };
}

export function __resetAmadeusTokenCacheForTests(): void {
  tokenCache = null;
}

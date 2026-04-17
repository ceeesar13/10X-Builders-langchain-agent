import { getEnv } from "../../config/env.js";
import type { FlightOffer, FlightProvider, FlightSearchParams } from "./types.js";

interface DuffelSegment {
  origin: { iata_code: string };
  destination: { iata_code: string };
  departing_at: string;
  arriving_at: string;
  marketing_carrier?: { iata_code: string };
  operating_carrier?: { iata_code: string };
}

interface DuffelSlice {
  duration: string;
  segments: DuffelSegment[];
}

interface DuffelOffer {
  total_amount: string;
  total_currency: string;
  owner?: { iata_code: string };
  slices: DuffelSlice[];
}

interface DuffelOfferRequestResponse {
  data: {
    offers?: DuffelOffer[];
  };
}

export function createDuffelClient(fetchImpl: typeof fetch = fetch): FlightProvider {
  async function searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
    const env = getEnv();
    if (!env.DUFFEL_ACCESS_TOKEN) {
      throw new Error(
        "Duffel access token missing. Set DUFFEL_ACCESS_TOKEN in env.local."
      );
    }

    const slices = [
      {
        origin: params.origin.toUpperCase(),
        destination: params.destination.toUpperCase(),
        departure_date: params.departureDate,
      },
    ];
    if (params.returnDate) {
      slices.push({
        origin: params.destination.toUpperCase(),
        destination: params.origin.toUpperCase(),
        departure_date: params.returnDate,
      });
    }

    const body = {
      data: {
        slices,
        passengers: Array.from({ length: params.adults ?? 1 }, () => ({ type: "adult" })),
        cabin_class: "economy",
      },
    };

    const response = await fetchImpl(
      `${env.DUFFEL_BASE_URL}/air/offer_requests?return_offers=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.DUFFEL_ACCESS_TOKEN}`,
          "Duffel-Version": "v2",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Duffel flight search failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as DuffelOfferRequestResponse;
    const offers = payload.data.offers ?? [];

    const limit = params.max ?? 5;
    return offers.slice(0, limit).map(normalizeOffer);
  }

  return { searchFlights };
}

function normalizeOffer(offer: DuffelOffer): FlightOffer {
  const allSegments = offer.slices.flatMap((s) => s.segments);
  const airlines = Array.from(
    new Set([
      ...(offer.owner?.iata_code ? [offer.owner.iata_code] : []),
      ...allSegments.flatMap((s) =>
        [s.marketing_carrier?.iata_code, s.operating_carrier?.iata_code].filter(
          (c): c is string => Boolean(c)
        )
      ),
    ])
  );
  const firstSegment = offer.slices[0]?.segments[0];
  const lastSlice = offer.slices[offer.slices.length - 1];
  const lastSegment = lastSlice?.segments[lastSlice.segments.length - 1];
  const totalStops = offer.slices.reduce((sum, s) => sum + (s.segments.length - 1), 0);
  const totalDuration = offer.slices.map((s) => s.duration).join(" + ");

  return {
    price: Number(offer.total_amount),
    currency: offer.total_currency,
    airlines,
    stops: totalStops,
    departureAt: firstSegment?.departing_at ?? "",
    arrivalAt: lastSegment?.arriving_at ?? "",
    duration: totalDuration,
    roundTrip: offer.slices.length > 1,
  };
}

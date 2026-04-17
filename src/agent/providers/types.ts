export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults?: number;
  currencyCode?: string;
  max?: number;
}

export interface FlightOffer {
  price: number;
  currency: string;
  airlines: string[];
  stops: number;
  departureAt: string;
  arrivalAt: string;
  duration: string;
  roundTrip: boolean;
}

export interface FlightProvider {
  searchFlights(params: FlightSearchParams): Promise<FlightOffer[]>;
}

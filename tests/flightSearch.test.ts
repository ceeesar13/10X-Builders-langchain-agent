import { describe, expect, it, beforeEach } from "vitest";
import { createFlightSearchTool } from "../src/agent/tools/flightSearch.js";
import type { FlightProvider, FlightOffer } from "../src/agent/providers/types.js";

describe("flight_search tool", () => {
  let searchCalls: Array<Parameters<FlightProvider["searchFlights"]>[0]>;

  beforeEach(() => {
    searchCalls = [];
  });

  function mockClient(offers: FlightOffer[]): FlightProvider {
    return {
      async searchFlights(params) {
        searchCalls.push(params);
        return offers;
      },
    };
  }

  it("devuelve ofertas resumidas como JSON", async () => {
    const tool = createFlightSearchTool(
      mockClient([
        {
          price: 1250.5,
          currency: "USD",
          airlines: ["AV", "UA"],
          stops: 1,
          departureAt: "2026-12-10T07:30:00",
          arrivalAt: "2026-12-11T23:45:00",
          duration: "PT28H15M",
          roundTrip: false,
        },
      ])
    );

    const result = await tool.invoke({
      origin: "BOG",
      destination: "NRT",
      departureDate: "2026-12-10",
    });

    const parsed = JSON.parse(String(result));
    expect(parsed.count).toBe(1);
    expect(parsed.offers[0].price).toBe(1250.5);
    expect(parsed.offers[0].currency).toBe("USD");
    expect(parsed.offers[0].stops).toBe(1);
    expect(searchCalls[0].origin).toBe("BOG");
    expect(searchCalls[0].destination).toBe("NRT");
    expect(searchCalls[0].max).toBe(3);
  });

  it("devuelve mensaje claro cuando no hay ofertas", async () => {
    const tool = createFlightSearchTool(mockClient([]));

    const result = await tool.invoke({
      origin: "BOG",
      destination: "XXX",
      departureDate: "2026-12-10",
    });

    const parsed = JSON.parse(String(result));
    expect(parsed.offers).toEqual([]);
    expect(parsed.message).toMatch(/No se encontraron ofertas/i);
  });

  it("rechaza inputs con formato de fecha inválido", async () => {
    const tool = createFlightSearchTool(mockClient([]));

    await expect(
      tool.invoke({
        origin: "BOG",
        destination: "NRT",
        departureDate: "10/12/2026",
      })
    ).rejects.toThrow();
  });
});

# 10Xbuilder Agents

Agent with LangChain and TypeScript (ESM) that uses tools to solve calculations, return the current date/time, and search real flight offers through a swappable provider layer (Duffel by default; Amadeus available as alternative).

## Requirements

- Node.js 20+
- npm 10+
- OpenRouter API key
- Duffel Access Token (test token instant at https://app.duffel.com/) **OR** Amadeus Self-Service keys (https://developers.amadeus.com/)

## Installation

```bash
npm install
```

## Environment setup

This project loads configuration from `env.local` at the repository root.

```bash
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_TEMPERATURE=0
OPENROUTER_HTTP_REFERER=https://your-app-domain.com
OPENROUTER_APP_TITLE=10Xbuilder Agents

# Flight provider selection: "duffel" (default) or "amadeus"
FLIGHT_PROVIDER=duffel

# Duffel (active provider)
DUFFEL_ACCESS_TOKEN=duffel_test_xxx
DUFFEL_BASE_URL=https://api.duffel.com

# Amadeus (alternative; only required if FLIGHT_PROVIDER=amadeus)
# AMADEUS_API_KEY=your_amadeus_api_key
# AMADEUS_API_SECRET=your_amadeus_api_secret
AMADEUS_BASE_URL=https://test.api.amadeus.com
```

## Run in development

```bash
npm run dev
```

With a custom question:

```bash
npm run dev -- "What is 25% of 240 and what time is it now?"
npm run dev -- "¿Cuánto saldría un viaje de Londres a Nueva York el 2026-05-15 con un presupuesto de USD 500?"
```

> **Note on Duffel sandbox**: the test environment provides data mainly for routes between major international hubs (e.g. LHR↔JFK, LAX↔SFO, LHR↔MAD). Less-trafficked routes (e.g. BOG↔NRT) may return empty offers. This is expected and does not indicate a bug.

## Scripts

- `npm run dev`: runs the agent with `tsx`.
- `npm run build`: compiles to `dist/`.
- `npm run start`: runs the compiled build.
- `npm run test`: runs tests once.
- `npm run test:watch`: runs tests in watch mode.
- `npm run lint`: runs ESLint.
- `npm run typecheck`: validates types without emitting build output.

## Architecture overview

The project is organized in layers so each concern stays isolated and easy to evolve:

- **Interface layer**: `src/index.ts` provides a CLI entry point and sends user input to the agent runtime.
- **Application layer**: `src/agent/runAgent.ts` exposes a single execution function and supports dependency injection for testing.
- **Composition layer**: `src/agent/createAgent.ts` assembles model, prompt, and tools into an `AgentExecutor`.
- **Domain capabilities**: `src/agent/tools/*` defines reusable tools (`calculator`, `current_time`, `flight_search`).
- **Provider layer**: `src/agent/providers/*` isolates external API clients behind a common `FlightProvider` interface so the tool is agnostic of the backend (Duffel, Amadeus).
- **Configuration layer**: `src/config/env.ts` loads and validates environment variables with `zod`.

For a deeper architectural breakdown, see `docs/architecture.md`.

## Project structure

- `src/index.ts`: CLI entry point.
- `src/config/env.ts`: environment loading and validation.
- `src/agent`: agent setup, prompt, tools, providers, and runner.
- `src/agent/providers`: pluggable flight providers (Duffel, Amadeus) behind a shared interface.
- `tests`: Vitest test suite.
- `docs/architecture.md`: architecture documentation.
- `docs/brief-agent.md`: product brief with supported use cases.
- `docs/plan-agent.md`: phased execution plan (includes Fase 6 for the flight domain).
- `docs/flight-tool-contract.md`: functional contract for the `flight_search` tool.

## Add a new tool

1. Create a new file in `src/agent/tools`.
2. Export the tool using LangChain `tool(...)` (expose a factory if the tool depends on external state — see `flightSearch.ts`).
3. Register it in `src/agent/createAgent.ts`.
4. Update `src/agent/prompt.ts` to describe when to use it.

## Add a new flight provider

1. Create `src/agent/providers/<name>.ts` exporting `create<Name>Client(): FlightProvider`.
2. Implement `searchFlights(params)` returning normalized `FlightOffer[]`.
3. Register it in `src/agent/providers/index.ts` and add the value to `FLIGHT_PROVIDER` enum in `src/config/env.ts`.
4. The tool and prompt do not change — that's the point of the abstraction.

## Notes

The `calculator` tool currently uses `Function(...)`. For production usage, replace it with a safe parser/evaluator.

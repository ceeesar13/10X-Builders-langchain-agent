import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const currentTimeTool = tool(
  async () => {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    return `${date} ${time}`;
  },
  {
    name: "current_time",
    description: "Devuelve la fecha y hora actual en formato 'YYYY-MM-DD HH:MM:SS'. Úsala cuando necesites saber hoy, este mes, el año actual, o planear fechas futuras relativas.",
    schema: z.object({})
  }
);

import { describe, expect, it } from "vitest";
import { currentTimeTool } from "../src/agent/tools/currentTime.js";

describe("currentTimeTool", () => {
  it("devuelve fecha y hora en formato 'YYYY-MM-DD HH:MM:SS'", async () => {
    const result = await currentTimeTool.invoke({});
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });
});

import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../src/server.js";

async function callTool(name: string) {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const result = await client.callTool({ name, arguments: {} });

  await client.close();
  await server.close();

  const text = (result.content as Array<{ type: string; text: string }>)[0].text;
  return JSON.parse(text);
}

describe("get_cpu_status", () => {
  it("returns core count and model", async () => {
    const cpu = await callTool("get_cpu_status");

    expect(cpu.core_count).toBeGreaterThan(0);
    expect(typeof cpu.model).toBe("string");
    expect(cpu.model.length).toBeGreaterThan(0);
  });

  it("returns load averages as numbers", async () => {
    const cpu = await callTool("get_cpu_status");

    expect(typeof cpu.load_average_1m).toBe("number");
    expect(typeof cpu.load_average_5m).toBe("number");
    expect(typeof cpu.load_average_15m).toBe("number");
  });

  it("returns per-core speeds", async () => {
    const cpu = await callTool("get_cpu_status");

    expect(Array.isArray(cpu.per_core_speed_mhz)).toBe(true);
    expect(cpu.per_core_speed_mhz.length).toBe(cpu.core_count);
  });

  it("temperature is null on non-Pi or a valid number on Pi", async () => {
    const cpu = await callTool("get_cpu_status");

    if (cpu.temperature_celsius !== null) {
      expect(cpu.temperature_celsius).toBeGreaterThan(0);
      expect(cpu.temperature_celsius).toBeLessThan(150);
    }
  });
});

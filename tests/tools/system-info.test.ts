import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../src/server.js";

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const result = await client.callTool({ name, arguments: args });

  await client.close();
  await server.close();

  const text = (result.content as Array<{ type: string; text: string }>)[0].text;
  return JSON.parse(text);
}

describe("get_system_info", () => {
  it("returns required fields", async () => {
    const info = await callTool("get_system_info");

    expect(info).toHaveProperty("hostname");
    expect(info).toHaveProperty("platform");
    expect(info).toHaveProperty("arch");
    expect(info).toHaveProperty("kernel");
    expect(info).toHaveProperty("uptime_seconds");
    expect(info).toHaveProperty("uptime_human");
    expect(info).toHaveProperty("node_version");
    expect(info).toHaveProperty("is_raspberry_pi");
    expect(info).toHaveProperty("pi_model");
  });

  it("returns valid types", async () => {
    const info = await callTool("get_system_info");

    expect(typeof info.hostname).toBe("string");
    expect(typeof info.uptime_seconds).toBe("number");
    expect(info.uptime_seconds).toBeGreaterThan(0);
    expect(typeof info.is_raspberry_pi).toBe("boolean");
    expect(info.node_version).toMatch(/^v\d+/);
  });

  it("uptime_human is formatted correctly", async () => {
    const info = await callTool("get_system_info");
    expect(info.uptime_human).toMatch(/^\d+[dhm]/);
  });
});

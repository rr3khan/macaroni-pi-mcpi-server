import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../src/server.js";

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const server = createServer();
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const result = await client.callTool({ name, arguments: args });

  await client.close();
  await server.close();

  const text = (result.content as Array<{ type: string; text: string }>)[0]
    .text;
  return JSON.parse(text);
}

describe("list_services", () => {
  it("returns an array of services", async () => {
    const result = await callTool("list_services");

    expect(result).toHaveProperty("services");
    expect(Array.isArray(result.services)).toBe(true);
  });

  it("each service has name, status, port, and description", async () => {
    const result = await callTool("list_services");

    for (const svc of result.services) {
      expect(typeof svc.name).toBe("string");
      expect(["running", "stopped"]).toContain(svc.status);
      expect(typeof svc.port).toBe("number");
      expect(typeof svc.description).toBe("string");
    }
  });
});

describe("deploy_service", () => {
  it("rejects unknown service names", async () => {
    const result = await callTool("deploy_service", {
      service: "nonexistent-service",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown service");
  });
});

describe("stop_service", () => {
  it("returns error for a service that is not running", async () => {
    const result = await callTool("stop_service", {
      service: "weather-station",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not running");
  });
});

describe("query_service", () => {
  it("returns error when service is not running", async () => {
    const result = await callTool("query_service", {
      service: "weather-station",
    });
    expect(result.error).toContain("not running");
  });

  it("returns error for unknown service", async () => {
    const result = await callTool("query_service", {
      service: "nonexistent",
    });
    expect(result.error).toContain("Unknown service");
  });
});

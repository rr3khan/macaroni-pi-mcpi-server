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

describe("get_network_info", () => {
  it("returns at least the loopback interface", async () => {
    const net = await callTool("get_network_info");

    expect(Array.isArray(net.interfaces)).toBe(true);
    const loopback = net.interfaces.find(
      (i: { name: string }) => i.name === "lo" || i.name === "lo0",
    );
    expect(loopback).toBeDefined();
    expect(loopback.internal).toBe(true);
  });

  it("interfaces have correct shape", async () => {
    const net = await callTool("get_network_info");

    for (const iface of net.interfaces) {
      expect(typeof iface.name).toBe("string");
      expect(Array.isArray(iface.ipv4)).toBe(true);
      expect(Array.isArray(iface.ipv6)).toBe(true);
      expect(typeof iface.internal).toBe("boolean");
    }
  });

  it("primary_ipv4 is null or a valid IP", async () => {
    const net = await callTool("get_network_info");

    if (net.primary_ipv4 !== null) {
      expect(net.primary_ipv4).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    }
  });
});

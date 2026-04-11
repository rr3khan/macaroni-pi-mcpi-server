# mcpi — Macaroni Pi MCP Server

An MCP (Model Context Protocol) server for Raspberry Pi 5 that lets AI assistants
monitor system health and manage secrets through 1Password.

## What is MCP?

[Model Context Protocol](https://modelcontextprotocol.io/) is an open standard
(created by Anthropic) that defines how AI assistants communicate with external
tools. An MCP server exposes **tools** that an AI can call over JSON-RPC — think
of it as a type-safe API designed specifically for AI agents.

This project uses the **stdio transport**: the AI client spawns the server as a
child process and communicates over stdin/stdout.

## Project Stages

**Stage 1 — System Monitoring (current)**
Expose Pi hardware data (CPU temp, memory, disk, network) as MCP tools so an AI
assistant can answer questions like "How hot is my Pi?" or "How much disk space
is left?".

**Stage 2 — 1Password Security Gateway (planned)**
Integrate with 1Password Service Accounts so secrets never live as plaintext on
the Pi's disk. The AI can store, retrieve, rotate, and deploy secrets — all
backed by 1Password.

## Available Tools

| Tool | Description |
|------|-------------|
| `get_system_info` | Hostname, OS, architecture, kernel, uptime, Pi model detection |

## Quick Start

```bash
npm install
npm run build
```

## Testing with Cursor

Add the following to your Cursor MCP config (`.cursor/mcp.json` in your home directory):

```json
{
  "mcpServers": {
    "mcpi": {
      "command": "node",
      "args": ["/absolute/path/to/macaroni-pi-mcpi-server/dist/index.js"]
    }
  }
}
```

Then ask the AI: *"Use the mcpi server to get system info"* — it will call the
`get_system_info` tool and return structured data about the host.

## Tech Stack

- **TypeScript** + Node.js 20+
- **@modelcontextprotocol/sdk** — official MCP TypeScript SDK
- **zod** — runtime schema validation for tool inputs
- **stdio transport** — local process communication (no HTTP server needed)

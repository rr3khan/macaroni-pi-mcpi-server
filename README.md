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

| Tool | Description | Pi-specific |
|------|-------------|-------------|
| `get_system_info` | Hostname, OS, architecture, kernel, uptime, Pi model detection | Pi model via `/proc/device-tree/model` |
| `get_cpu_status` | Core count, model, load averages, per-core speeds | Temperature via `/sys/class/thermal`, frequency via `/sys/devices/system/cpu` |
| `get_memory_status` | RAM and swap in MB, usage percentage | Full swap info via `/proc/meminfo` |
| `get_disk_status` | All mounted filesystems: size, used, available in GB | -- |
| `get_network_info` | Interfaces with IPs/MACs, primary IPv4 | WiFi SSID and signal via `iwconfig` |

## Quick Start

**On a Raspberry Pi (first time, nothing installed):**

```bash
curl -fsSL https://raw.githubusercontent.com/rr3khan/macaroni-pi-mcpi-server/main/scripts/pi-setup.sh | bash
```

This installs git, Node.js 20, system dependencies, clones the repo, builds, and runs tests.

**Or if you already have git:**

```bash
git clone https://github.com/rr3khan/macaroni-pi-mcpi-server.git
cd macaroni-pi-mcpi-server
bash scripts/pi-setup.sh
```

**On macOS / generic Linux (already have Node.js):**

```bash
npm install
npm run build
npm test          # 19 tests across 6 files
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

## Architecture

```
src/
  index.ts                 # Entry point — connects stdio transport
  server.ts                # Creates McpServer, registers all tools
  tools/
    system-info.ts         # get_system_info
    cpu.ts                 # get_cpu_status
    memory.ts              # get_memory_status
    disk.ts                # get_disk_status
    network.ts             # get_network_info
  providers/
    pi-system.ts           # Shared abstraction for /sys, /proc, exec
tests/
  server.test.ts           # Tool registration tests
  tools/
    *.test.ts              # Per-tool integration tests via MCP client
```

Each tool is a self-contained module that registers itself on the server.
The `pi-system` provider handles all platform-specific reads so tools
degrade gracefully on non-Pi systems (macOS, generic Linux).

## Tech Stack

- **TypeScript** + Node.js 20+
- **@modelcontextprotocol/sdk** — official MCP TypeScript SDK
- **zod** — runtime schema validation for tool inputs
- **vitest** — test framework with in-memory MCP client/server pairs
- **stdio transport** — local process communication (no HTTP server needed)

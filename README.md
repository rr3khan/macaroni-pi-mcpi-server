# mcpi — Macaroni Pi MCP Server

An MCP (Model Context Protocol) server for Raspberry Pi 5 that lets AI assistants
monitor system health and securely deploy services using secrets from 1Password —
without the LLM ever seeing the secret values.

## What is MCP?

[Model Context Protocol](https://modelcontextprotocol.io/) is an open standard
(created by Anthropic) that defines how AI assistants communicate with external
tools. An MCP server exposes **tools** that an AI can call over JSON-RPC — think
of it as a type-safe API designed specifically for AI agents.

This project uses the **stdio transport**: the AI client spawns the server as a
child process and communicates over stdin/stdout. When running on a Pi, Cursor
connects over SSH — the JSON-RPC traffic flows through the tunnel transparently.

## Project Stages

**Stage 1 — System Monitoring**
Expose Pi hardware data (CPU temp, memory, disk, network) as MCP tools so an AI
assistant can answer questions like "How hot is my Pi?" or "How much disk space
is left?".

**Stage 2 — 1Password Security Gateway**
Integrate with 1Password Environments so secrets never live as plaintext on
the Pi's disk. The LLM can deploy and manage services with secrets securely
injected via `op run`, but it can never read, write, or rotate secrets.
Humans manage secrets in the 1Password desktop app.

## Available Tools

### Stage 1: System Monitoring

| Tool | Description | Pi-specific |
|------|-------------|-------------|
| `get_system_info` | Hostname, OS, architecture, kernel, uptime, Pi model detection | Pi model via `/proc/device-tree/model` |
| `get_cpu_status` | Core count, model, load averages, per-core speeds | Temperature via `/sys/class/thermal`, frequency via `/sys/devices/system/cpu` |
| `get_memory_status` | RAM and swap in MB, usage percentage | Full swap info via `/proc/meminfo` |
| `get_disk_status` | All mounted filesystems: size, used, available in GB | -- |
| `get_network_info` | Interfaces with IPs/MACs, primary IPv4 | WiFi SSID and signal via `iwconfig` |

### Stage 2: 1Password Integration

| Tool | Description | Security |
|------|-------------|----------|
| `get_op_status` | Checks if 1Password CLI is installed and authenticated | Read-only |
| `list_environments` | Lists configured environments and variable **key names** | Never returns values |
| `list_services` | Shows configured services with running/stopped status | Metadata only |
| `deploy_service` | Starts a service with secrets injected via `op run` | LLM sees only success/failure |
| `stop_service` | Stops a running service | Process management |
| `query_service` | HTTP GET to a running service's local endpoint | Returns data, not secrets |

### Diagnostics

| Tool | Description |
|------|-------------|
| `health_check` | Verifies Node.js, op CLI, authentication, services.json, SD card wear, disk usage, and runtime status |

## Security Model

The LLM is an **operator**, not a **reader**:

| Action | Allowed | Why |
|--------|---------|-----|
| List environment names and variable keys | Yes | Metadata only, no values |
| Deploy a service with secrets injected | Yes | `op run` handles injection, LLM sees only success/failure |
| Stop a service | Yes | Process management |
| Query a running service for data | Yes | Weather data is not secret |
| Read a secret value | **No** | No tool exists for this |
| Write/edit/rotate secrets | **No** | Human-only in 1Password app |

## Demo: Weather Station

A complete demo showing secrets flowing from 1Password to a service without
touching disk or the LLM:

### Setup (one time)

1. Get a free API key from [OpenWeatherMap](https://openweathermap.org/api_keys)
2. In the 1Password desktop app, go to **Developer > View Environments**
3. Create an environment called `pi-weather`
4. Add a variable: `WEATHER_API_KEY` = your key
5. Copy the environment ID and paste it in `services.json`
6. Create a [1Password Service Account](https://developer.1password.com/docs/service-accounts/)
   scoped to the `pi-weather` environment (read-only)
7. On the Pi, set the service account token:
   ```bash
   export OP_SERVICE_ACCOUNT_TOKEN="your-token-here"
   ```

### Usage

Ask the AI:
- *"Deploy the weather station on the Pi"* → calls `deploy_service`
- *"What's the weather in Toronto?"* → calls `query_service`
- *"Stop the weather station"* → calls `stop_service`

The API key flows from 1Password → `op run` → process env → OpenWeatherMap.
It never appears in any MCP response, log, or file on disk.

## Quick Start

**On a Raspberry Pi (first time, nothing installed):**

```bash
curl -fsSL https://raw.githubusercontent.com/rr3khan/macaroni-pi-mcpi-server/main/scripts/pi-setup.sh | bash
```

This installs git, Node.js 20, the **1Password CLI beta**, system dependencies,
clones the repo, builds, and runs tests.

> **Why the beta CLI?** The `op run --environment` flag — which injects secrets
> from 1Password Environments into a child process — is only available in beta
> builds (`>= 2.33.0-beta.02`). Stable releases do not include it. See
> [the 1Password docs](https://developer.1password.com/docs/environments/read-environment-variables#cli)
> for details.

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
npm test
```

## Connecting Cursor to the Pi

Cursor talks to the MCP server over SSH. The launcher command on your Mac:
1. Reads the 1Password Service Account token locally via `op read`
2. SSHs into the Pi, passing the token as an environment variable
3. Starts the MCP server on the Pi with `OP_SERVICE_ACCOUNT_TOKEN` set

The token is never stored on the Pi's disk — it only lives in the process
environment for the duration of the session.

The launcher includes step-by-step diagnostic logging (`[mcpi-launcher]`
messages on stderr) so connection failures pinpoint the exact stage that
failed, and SSH keepalives to detect dead connections.

### Prerequisites

- **1Password desktop app** running on your Mac with CLI integration enabled
  (Settings > Developer > Integrate with 1Password CLI)
- **1Password SSH agent** enabled
  (Settings > Developer > Use the SSH Agent)
- **SSH key** for the Pi stored in 1Password (not on disk) — see
  [SSH key management via 1Password](#ssh-key-management-via-1password) below
- **Service account** created in 1Password with read access to the
  environment(s) your services use

### Generic template

Add to your `~/.cursor/mcp.json` (fill in the placeholders):

```json
{
  "mcpServers": {
    "mcpi": {
      "command": "bash",
      "args": [
        "-c",
        "echo '[mcpi-launcher] fetching token from 1Password...' >&2; TOKEN=$(op read 'op://<VAULT>/<SERVICE_ACCOUNT_ITEM>/credential' 2>&1) || { echo \"[mcpi-launcher] ERROR: op read failed: $TOKEN\" >&2; exit 1; }; echo '[mcpi-launcher] token OK, connecting to Pi via SSH...' >&2; ssh -o ConnectTimeout=10 -o ServerAliveInterval=30 -o ServerAliveCountMax=3 <PI_USER>@<PI_HOST> \"OP_SERVICE_ACCOUNT_TOKEN=$TOKEN node <INSTALL_DIR>/dist/index.js\" 2>&1; EXIT_CODE=$?; echo \"[mcpi-launcher] ERROR: ssh/node exited with code $EXIT_CODE\" >&2; exit $EXIT_CODE"
      ]
    }
  }
}
```

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `<VAULT>` | 1Password vault containing the service account | `Private` |
| `<SERVICE_ACCOUNT_ITEM>` | Item name for the service account token | `MACARONI_MCPI_DEMO_SERVICE_ACCOUNT` |
| `<PI_USER>` | Username on the Pi | `riyad-rpi5` |
| `<PI_HOST>` | Hostname or IP of the Pi | `rpi5.local` |
| `<INSTALL_DIR>` | Where the repo lives on the Pi | `/home/riyad-rpi5/macaroni-pi-mcpi-server` |

### Real example

```json
{
  "mcpServers": {
    "mcpi": {
      "command": "bash",
      "args": [
        "-c",
        "echo '[mcpi-launcher] fetching token from 1Password...' >&2; TOKEN=$(op read 'op://Private/MACARONI_MCPI_DEMO_SERVICE_ACCOUNT/credential' 2>&1) || { echo \"[mcpi-launcher] ERROR: op read failed: $TOKEN\" >&2; exit 1; }; echo '[mcpi-launcher] token OK, connecting to Pi via SSH...' >&2; ssh -o ConnectTimeout=10 -o ServerAliveInterval=30 -o ServerAliveCountMax=3 riyad-rpi5@rpi5.local \"OP_SERVICE_ACCOUNT_TOKEN=$TOKEN node /home/riyad-rpi5/macaroni-pi-mcpi-server/dist/index.js\" 2>&1; EXIT_CODE=$?; echo \"[mcpi-launcher] ERROR: ssh/node exited with code $EXIT_CODE\" >&2; exit $EXIT_CODE"
      ]
    }
  }
}
```

Cursor spawns the `bash -c` command, which reads the service account token
locally, then SSHs into the Pi and starts the MCP server. All JSON-RPC
traffic flows over the SSH tunnel — the Pi reads real hardware data and
connects to 1Password via the service account.

### SSH key management via 1Password

Instead of storing SSH keys as unencrypted files on disk, use the
**1Password SSH agent** and **SSH Bookmarks** to serve keys from your vault.
This eliminates unencrypted key files (which tools like Kolide flag) and
avoids "too many authentication failures" errors by pinning the correct key
to each host.

#### Setup

1. **Import your SSH key into 1Password**: In the 1Password desktop app,
   go to File > Import and select your SSH private key.

2. **Enable the 1Password SSH agent**: In 1Password, go to
   Settings > Developer and enable "Use the SSH Agent".

3. **Configure your SSH client** to use the 1Password agent. Add to
   `~/.ssh/config`:
   ```
   Host *
       IdentityAgent "~/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"
   ```

4. **Create an SSH Bookmark** to pin the key to your Pi. Edit the SSH key
   item in 1Password and add a custom URL field:
   ```
   ssh://<PI_USER>@<PI_HOST>
   ```
   For example: `ssh://riyad-rpi5@rpi5.local`

5. **Enable SSH config file generation**: In 1Password, go to
   Settings > Developer > Advanced and enable "Generate SSH config files
   from 1Password SSH bookmarks". Then add this to the top of
   `~/.ssh/config`:
   ```
   Include ~/.ssh/1Password/config
   ```

6. **Delete the unencrypted key from disk** (only after verifying the
   1Password agent works):
   ```bash
   ssh <PI_USER>@<PI_HOST> "echo 'it works!'"
   rm ~/.ssh/id_ed25519_pi ~/.ssh/id_ed25519_pi.pub
   ```

For full details, see the
[1Password SSH Bookmarks documentation](https://developer.1password.com/docs/ssh/bookmarks/).

## Architecture

```
src/
  index.ts                  # Entry point — crash handlers, graceful shutdown
  server.ts                 # Creates McpServer, registers all tools
  logger.ts                 # Structured logging (stderr + ~/logs/mcpi-server.log)
  tools/
    system-info.ts          # get_system_info
    cpu.ts                  # get_cpu_status
    memory.ts               # get_memory_status
    disk.ts                 # get_disk_status
    network.ts              # get_network_info
    op-status.ts            # get_op_status
    environments.ts         # list_environments
    services.ts             # deploy_service, stop_service, list_services
    query-service.ts        # query_service
    health-check.ts         # health_check — dependency and filesystem verification
  providers/
    pi-system.ts            # Abstraction for /sys, /proc, exec
    onepassword.ts          # Abstraction for op CLI commands
services/
  weather-station.js        # Demo: weather API with injected secret
services.json               # Maps service names to op environments
logs/                       # Runtime logs (auto-created, gitignored)
tests/
  server.test.ts            # Tool registration tests
  tools/*.test.ts           # Per-tool integration tests
  services/*.test.ts        # Service-level tests
```

## Tech Stack

- **TypeScript** + Node.js 20+
- **@modelcontextprotocol/sdk** — official MCP TypeScript SDK
- **zod** — runtime schema validation for tool inputs
- **vitest** — test framework with in-memory MCP client/server pairs
- **1Password CLI** (`op`, beta) — secret injection via `op run --environment`
- **stdio transport** — local process communication over SSH

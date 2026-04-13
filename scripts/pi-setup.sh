#!/usr/bin/env bash
#
# First-time setup for mcpi on a fresh Raspberry Pi.
# Run this once after cloning the repo:
#
#   git clone https://github.com/rr3khan/macaroni-pi-mcpi-server.git
#   cd macaroni-pi-mcpi-server
#   bash scripts/pi-setup.sh
#

set -euo pipefail

echo "==> mcpi Pi setup"
echo ""

# --- Node.js ---
if command -v node &>/dev/null; then
  echo "[ok] Node.js already installed: $(node --version)"
else
  echo "[..] Installing Node.js 20 via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
  sudo apt-get install -y nodejs
  echo "[ok] Node.js installed: $(node --version)"
fi

echo "[ok] npm: $(npm --version)"
echo ""

# --- System deps (useful for network tool) ---
echo "[..] Installing system dependencies..."
sudo apt-get install -y --no-install-recommends \
  wireless-tools \
  net-tools \
  2>/dev/null || true
echo "[ok] System deps installed"
echo ""

# --- Project ---
echo "[..] Installing npm packages..."
npm install
echo ""

echo "[..] Building..."
npm run build
echo ""

echo "[..] Running tests..."
npm test
echo ""

echo "==> Setup complete!"
echo ""
echo "Smoke test:"
echo "  npm start  (then connect via Cursor or MCP Inspector)"
echo ""
echo "Or test a single tool:"
echo "  printf '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0.0\"}}}\\n{\"jsonrpc\":\"2.0\",\"method\":\"notifications/initialized\"}\\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"get_system_info\",\"arguments\":{}}}\\n' | node dist/index.js 2>/dev/null"

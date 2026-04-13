#!/usr/bin/env bash
#
# First-time setup for mcpi on a fresh Raspberry Pi.
#
# Option A — run from inside a clone:
#   git clone https://github.com/rr3khan/macaroni-pi-mcpi-server.git
#   cd macaroni-pi-mcpi-server
#   bash scripts/pi-setup.sh
#
# Option B — bootstrap on a bare Pi (no git yet):
#   curl -fsSL https://raw.githubusercontent.com/rr3khan/macaroni-pi-mcpi-server/main/scripts/pi-setup.sh | bash
#

set -euo pipefail

REPO_URL="https://github.com/rr3khan/macaroni-pi-mcpi-server.git"
INSTALL_DIR="$HOME/macaroni-pi-mcpi-server"

echo "==> mcpi Pi setup"
echo ""

# --- System packages ---
echo "[..] Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends \
  git \
  curl \
  wireless-tools \
  net-tools \
  2>/dev/null || true
echo "[ok] System packages installed"
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

# --- Clone repo if running outside of one ---
if [ -f "package.json" ] && grep -q "macaroni-pi-mcpi-server" package.json 2>/dev/null; then
  echo "[ok] Already inside the repo"
else
  if [ -d "$INSTALL_DIR" ]; then
    echo "[ok] Repo already cloned at $INSTALL_DIR, pulling latest..."
    cd "$INSTALL_DIR"
    git pull --ff-only
  else
    echo "[..] Cloning repo to $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi
fi
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
echo "  cd $INSTALL_DIR"
echo "  npm start  (then connect via Cursor or MCP Inspector)"

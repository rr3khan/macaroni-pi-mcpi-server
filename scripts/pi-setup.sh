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
  unzip \
  wireless-tools \
  net-tools \
  2>/dev/null || true
echo "[ok] System packages installed"
echo ""

# --- 1Password CLI (beta required for `op run --environment`) ---
# The --environment flag is only in beta builds (>= 2.33.0-beta.02).
# Stable releases do NOT have it. See:
# https://developer.1password.com/docs/environments/read-environment-variables#cli
OP_BETA_VERSION="2.34.1-beta.01"
install_op_beta() {
  local arch
  arch=$(dpkg --print-architecture 2>/dev/null || echo "arm64")
  echo "[..] Downloading 1Password CLI beta ${OP_BETA_VERSION} (${arch})..."
  curl -sSfo /tmp/op.zip "https://cache.agilebits.com/dist/1P/op2/pkg/v${OP_BETA_VERSION}/op_linux_${arch}_v${OP_BETA_VERSION}.zip"
  cd /tmp && unzip -o op.zip op && sudo mv op /usr/local/bin/op && sudo chmod +x /usr/local/bin/op
  rm -f /tmp/op.zip
}

if command -v op &>/dev/null; then
  OP_CUR=$(op --version 2>/dev/null || echo "0.0.0")
  echo "[ok] 1Password CLI installed: $OP_CUR"
  if op run --help 2>&1 | grep -q -- '--environment'; then
    echo "[ok] --environment flag available"
  else
    echo "[!!] --environment flag missing — upgrading to beta..."
    install_op_beta
    echo "[ok] Upgraded to: $(op --version)"
  fi
else
  echo "[..] Installing 1Password CLI (beta)..."
  install_op_beta
  echo "[ok] 1Password CLI installed: $(op --version)"
fi
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

#!/usr/bin/env bash
set -eu

if (set -o pipefail) 2>/dev/null; then
  set -o pipefail
fi

PORT="${PORT:-3000}"

echo ""
echo "      ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗"
echo "      ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝"
echo "      ██║███████║██████╔╝██║   ██║██║███████╗"
echo " ██   ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║"
echo " ╚█████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║███████║"
echo "  ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝"
echo ""
echo "  P1 NODE X1 — Home Control Core"
echo "  Starting on http://localhost:${PORT}"
echo ""

# node-Binary ermitteln (Git Bash, WSL und native Linux kompatibel)
if command -v node &>/dev/null; then
  exec node main.js
elif command -v node.exe &>/dev/null; then
  exec node.exe main.js
else
  echo ""
  echo "  ERROR: 'node' wurde nicht gefunden."
  echo "  Stelle sicher, dass Node.js installiert ist und im PATH liegt."
  exit 1
fi


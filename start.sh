#!/usr/bin/env bash
set -euo pipefail

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
  node main.js
elif command -v node.exe &>/dev/null; then
  node.exe main.js
else
  echo ""
  echo "  ERROR: 'node' wurde nicht gefunden."
  echo "  Stelle sicher, dass Node.js installiert ist und im PATH liegt."
  exit 1
fi

git init
git add .
git commit -m "🚀 Initial commit - Jarvis v1"
git branch -M main
git remote add origin https://github.com/l3nnardwlg/Jarvis.git
git push -u origin main
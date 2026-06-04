#!/bin/bash

# Navigate to the project directory containing this command file
cd "$(dirname "$0")"

clear
echo "=========================================================="
echo "⚡ DÉMARRAGE DE SENTILYTICS (SAMSUNG SENTIMENT ANALYSIS) ⚡"
echo "=========================================================="
echo "Initialisation du serveur local et libération des ports..."
echo ""

# Force kill any process already using port 8000 (like a previous python http.server or flask)
# This prevents the "Address already in use" error and guarantees our custom server runs!
echo "[*] Libération du port 8000..."
lsof -ti :8000 | xargs kill -9 2>/dev/null
pkill -f "server.py" 2>/dev/null

sleep 1

# Start custom server using the virtual environment python interpreter
echo "[*] Démarrage du serveur applicatif local..."
echo "[+] Pour arrêter le serveur, faites Ctrl+C ou fermez cette fenêtre."
echo ""
scraper/venv/bin/python server.py

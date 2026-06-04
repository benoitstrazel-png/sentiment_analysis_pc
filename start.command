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

# Start custom server using the virtual environment python interpreter in background
echo "[*] Démarrage du serveur applicatif local..."
scraper/venv/bin/python server.py > /dev/null 2>&1 &
SERVER_PID=$!

# Wait 2 seconds for server to start
sleep 2

# Open default web browser to the application page
echo "[*] Ouverture du navigateur..."
open "http://localhost:8000/"

echo ""
echo "=========================================================="
echo "✅ SENTILYTICS EST LANCÉ ET PRÊT !"
echo "=========================================================="
echo "[+] Le serveur tourne en arrière-plan (PID: $SERVER_PID)."
echo "[+] Pour arrêter le serveur, fermez simplement cette fenêtre."
echo "=========================================================="
echo ""

# Wait for the background process to finish (which keeps the terminal window open/active)
wait $SERVER_PID

@echo off
echo ==========================================================
echo ⚡ DÉMARRAGE DE SENTILYTICS (SAMSUNG SENTIMENT ANALYSIS) ⚡
echo ==========================================================
echo Initialisation du serveur local et libération des ports...
echo.

:: Libérer le port 8000 sous Windows
echo [*] Libération du port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 2^>nul') do (
    taskkill /f /pid %%a 2>nul
)

:: Attendre 1 seconde
timeout /t 1 /nobreak >nul

:: Vérifier si l'environnement virtuel existe
if not exist scraper\venv\Scripts\python.exe (
    echo [!] L'environnement virtuel n'existe pas.
    echo Veuillez d'abord lancer 'install.bat' pour installer les dépendances.
    pause
    exit /b 1
)

:: Lancer le serveur au premier plan (qui gère lui-même l'ouverture du navigateur via l'adresse IP locale)
echo [*] Démarrage du serveur applicatif local...
echo [+] Pour arrêter le serveur, faites Ctrl+C ou fermez cette fenêtre.
echo.
scraper\venv\Scripts\python server.py

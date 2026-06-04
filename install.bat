@echo off
echo ==========================================================
echo 🛠️ INSTALLATION DES DÉPENDANCES DE SENTILYTICS (WINDOWS) 🛠️
echo ==========================================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Erreur : Python n'est pas installé sur ce système ou n'est pas dans le PATH.
    echo Veuillez installer Python (version 3.9+) depuis python.org avant de continuer.
    pause
    exit /b 1
)

echo [+] Python détecté.
echo [*] Création de l'environnement virtuel dans scraper\venv...
python -m venv scraper\venv
if %errorlevel% neq 0 (
    echo [!] Erreur lors de la création de l'environnement virtuel.
    pause
    exit /b 1
)

echo [+] Environnement virtuel créé avec succès.
echo [*] Installation des dépendances depuis scraper\requirements.txt...
scraper\venv\Scripts\pip install -r scraper\requirements.txt
if %errorlevel% neq 0 (
    echo [!] Erreur lors de l'installation des dépendances.
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo ✅ INSTALLATION TERMINÉE AVEC SUCCÈS !
echo ==========================================================
echo Vous pouvez maintenant double-cliquer sur 'start.bat' pour
echo lancer le dashboard et le scraper Sentilytics.
echo ==========================================================
echo.
pause

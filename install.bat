@echo off
:: Force the console to use UTF-8 encoding to render accents and emojis correctly
chcp 65001 >nul

echo ==========================================================
echo 🛠️  INSTALLATION DES DÉPENDANCES DE SENTILYTICS (WINDOWS) 🛠️
echo ==========================================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Erreur : Python n'est pas installé sur ce système ou n'est pas dans le PATH.
    echo Veuillez installer Python version 3.9 ou supérieure depuis python.org avant de continuer.
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

:: Bootstrap pip inside the venv if it is missing, and execute pip via python module wrapper
echo [*] Initialisation et mise à jour du gestionnaire de paquets pip...
scraper\venv\Scripts\python -m ensurepip --default-pip >nul 2>&1
scraper\venv\Scripts\python -m pip install --upgrade pip >nul 2>&1

echo [*] Installation des dépendances depuis scraper\requirements.txt...
scraper\venv\Scripts\python -m pip install -r scraper\requirements.txt
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

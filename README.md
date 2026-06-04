# Sentilytics — Samsung Sentiment Analysis Dashboard

Sentilytics est une plateforme premium d'analyse de sentiments et d'extraction d'avis clients pour les produits officiels de Samsung France. Elle combine un scraper Bazaarvoice performant et résilient avec un tableau de bord analytique aux couleurs de la marque Samsung.

---

## 💻 Compatibilité & Prérequis

Le projet est entièrement **cross-platform** (compatible macOS et Windows PC).

### Prérequis globaux :
- **Python 3.9+** installé sur votre machine.
- Pour Windows : assurez-vous que Python est ajouté aux variables d'environnement (option "Add Python to PATH" lors de l'installation).

---

## 🚀 Lancement Rapide (Windows PC)

Si vous êtes sur un ordinateur sous Windows, deux scripts automatisés vous permettent de configurer et lancer le projet en un clic :

1. **Première installation :** 
   Double-cliquez sur le fichier **`install.bat`** à la racine du projet. Ce script va :
   - Vérifier votre installation de Python.
   - Créer un environnement virtuel local (`scraper\venv`).
   - Installer automatiquement toutes les dépendances requises (`requests`, `beautifulsoup4`, `transformers`, `torch`, `deep-translator`, etc.).

2. **Démarrage de l'application :**
   Double-cliquez sur le fichier **`start.bat`**. Ce script va :
   - Libérer le port `8000` s'il est déjà utilisé.
   - Lancer le serveur local d'analyse de données en arrière-plan.
   - Ouvrir automatiquement votre navigateur par défaut à l'adresse [http://127.0.0.1:8000](http://127.0.0.1:8000).

---

## 🍎 Lancement Rapide (macOS)

Si vous utilisez un Mac, le lancement est tout aussi simple :

1. **Première installation (si non configuré) :**
   Ouvrez un terminal dans le dossier et installez les dépendances :
   ```bash
   python3 -m venv scraper/venv
   source scraper/venv/bin/activate
   pip install -r scraper/requirements.txt
   ```

2. **Démarrage de l'application :**
   Double-cliquez sur le fichier **`start.command`** ou exécutez la commande suivante dans le terminal :
   ```bash
   ./start.command
   ```

---

## 📊 Fonctionnalités du Dashboard

- **Scraping Premium** : Saisissez l'URL d'un produit Samsung ou recherchez-le directement depuis l'onglet dédié pour lancer des extractions d'avis (jusqu'à la totalité).
- **Indicateur en temps réel** : Suivez le pourcentage d'extraction et de traduction/analyse via Gemini en temps réel.
- **Comparateur de produits** : Comparez les notes, volumes d'avis et sentiments entre plusieurs modèles d'une même catégorie (Smartphones, Électroménager, TV, Buds, etc.).
- **Filtres de Langue** : Filtrez et traduisez dynamiquement les avis pour qu'ils s'appliquent à tous les onglets du tableau de bord.
- **Analyse IA & Verbatims** : Visualisez en un clin d'œil les points forts, faiblesses, alertes et synthèses par catégories.

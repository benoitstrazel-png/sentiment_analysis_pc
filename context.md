# Projet d'Analyse de Sentiment - Samsung Customer Reviews

## 🎯 Objectif Principal
Créer un dashboard interactif local qui analyse les avis clients des produits Samsung sur le site officiel français [samsung.com/fr](https://www.samsung.com/fr/). 
L'application doit permettre :
1. De scraper et d'analyser le sentiment (positif, neutre, négatif) du contenu des avis clients.
2. À l'utilisateur de choisir et filtrer les produits spécifiques qu'il souhaite analyser via le dashboard.

---

## 🛠️ Stack Technique

### Scraping & Analyse (Backend)
- **Langage** : Python
- **Librairies** : `Requests` (si les APIs internes du site sont accessibles) ou `Playwright` (si le rendu dynamique ou la protection Cloudflare l'exige).
- **Rôle IA** : Géré par Gemini (moi-même).

### Visualisation & Interface (Frontend)
- **Langage/Outils** : HTML / CSS Vanilla / JavaScript (Vanilla) + `Chart.js` pour la visualisation graphique.
- **Rôle IA** : Géré par Claude Sonnet.

### Base de Données
- **Format** : Fichiers JSON locaux structurés (stockés sous `data/processed/`).

---

## 🤝 Contrat d'Interface (Schéma de données JSON)
Chaque avis client stocké dans le fichier JSON final (généré par le scraper et consommé par le dashboard) doit respecter strictement le format suivant :

```json
{
  "product_id": "string",
  "product_name": "string",
  "rating": 5,
  "date": "YYYY-MM-DD",
  "review_text": "string",
  "sentiment": "positive|neutral|negative"
}
```

*Note : Les fichiers seront idéalement regroupés par produit ou stockés dans un fichier centralisé propre, facilitant la lecture par le dashboard.*

---

## 🚨 Règles et Principes Fondamentaux
1. **Séparation Stricte (Découplage)** : Le scraper Python ne doit en aucun cas manipuler l'interface utilisateur. Son rôle unique est d'extraire, traiter et sauvegarder les données sous forme de fichiers JSON dans `data/processed/`. L'UI lit exclusivement ces JSON pour se mettre à jour.
2. **Modularité locale** : Tout le code doit être modulaire, propre, auto-documenté et s'exécuter localement sans dépendance complexe de serveurs distants.
3. **Robustesse du Scraper** : Gérer les erreurs réseau, la pagination des avis, et les sélecteurs dynamiques du site de Samsung de façon résiliente.

---

## 📋 Tâches & Prochaines Étapes
- [ ] **Phase 1 : Investigation (Scraper)**
  - Analyser la structure des pages produits Samsung et l'obtention des avis (existence d'une API interne de reviews ou besoin de scraping DOM).
  - Établir le script de base pour récupérer le contenu brut.
- [ ] **Phase 2 : Analyse de sentiment**
  - Mettre en place un pipeline local d'analyse de sentiment (ex. via Hugging Face Transformers, TextBlob, ou règles de notation basées sur la note et les mots clés).
  - Transformer les données brutes au format du contrat d'interface.
- [ ] **Phase 3 : Intégration Dashboard**
  - Mettre à jour le dashboard existant pour consommer dynamiquement les données du JSON généré.

import os
import json
import re
import sys
from sentiment_analyzer import SentimentAnalyzer
from deep_translator import GoogleTranslator

def detect_language_heuristic(text):
    if not text:
        return "fr"
    text_lower = text.lower()
    
    # Common words in different languages to heuristically detect language
    patterns = {
        "fr": [r'\bet\b', r'\best\b', r'\bpour\b', r'\btrès\b', r'\bavec\b', r'\bune\b', r'\bmais\b', r'\bplus\b', r'\bdans\b'],
        "en": [r'\band\b', r'\bthe\b', r'\bwith\b', r'\bthis\b', r'\bthat\b', r'\bhave\b', r'\bvery\b', r'\bgood\b', r'\bhappy\b'],
        "de": [r'\bund\b', r'\bist\b', r'\bmit\b', r'\bdas\b', r'\bder\b', r'\bdie\b', r'\bsehr\b', r'\bgut\b', r'\baber\b'],
        "it": [r'\be\b', r'\bè\b', r'\bcon\b', r'\bper\b', r'\bquesto\b', r'\bmolto\b', r'\bbello\b', r'\bbuono\b', r'\bsono\b'],
        "nl": [r'\ben\b', r'\bis\b', r'\bmet\b', r'\been\b', r'\bhet\b', r'\bde\b', r'\bzeer\b', r'\bgoed\b', r'\bvan\b'],
        "es": [r'\by\b', r'\bes\b', r'\bcon\b', r'\bpara\b', r'\beste\b', r'\bmuy\b', r'\bbieno\b', r'\bbueno\b', r'\bpero\b'],
        "pt": [r'\be\b', r'\bé\b', r'\bcom\b', r'\bpara\b', r'\beste\b', r'\bmuito\b', r'\bbom\b', r'\bótim\b', r'\bmais\b'],
        "pl": [r'\bi\b', r'\bjest\b', r'\bz\b', r'\bdla\b', r'\bto\b', r'\bbardzo\b', r'\bdobry\b', r'\bjestem\b', r'\bnie\b'],
        "hr": [r'\bi\b', r'\bje\b', r'\bsa\b', r'\bza\b', r'\bovo\b', r'\bjako\b', r'\bdobar\b', r'\bsuper\b', r'\bsve\b'],
        "bs": [r'\bi\b', r'\bje\b', r'\bsa\b', r'\bza\b', r'\bovo\b', r'\bjako\b', r'\bdobar\b', r'\bsuper\b', r'\bsve\b'],
        "sl": [r'\bin\b', r'\bje\b', r'\bz\b', r'\bza\b', r'\bto\b', r'\bzelo\b', r'\bdober\b', r'\bzelo\b']
    }
    
    scores = {lang: 0 for lang in patterns}
    for lang, regexes in patterns.items():
        for reg in regexes:
            if re.search(reg, text_lower):
                scores[lang] += 1
                
    best_lang = max(scores, key=scores.get)
    if scores[best_lang] > 0:
        return best_lang
        
    return "fr" # Default fallback

def backfill_file(file_path):
    print(f"\n[*] Traitement du fichier : {file_path}")
    if not os.path.exists(file_path):
        print(f"[!] Le fichier {file_path} n'existe pas.")
        return
        
    with open(file_path, "r", encoding="utf-8") as f:
        reviews = json.load(f)
        
    print(f"[ ] Nombre d'avis chargés : {len(reviews)}")
    
    analyzer = SentimentAnalyzer()
    translator = GoogleTranslator(source='auto', target='fr')
    
    modified_count = 0
    translation_count = 0
    translation_limit = 150 # Max foreign translations to perform via API to avoid rate limits
    
    # 1. Deduce category from product name of the first review
    product_name = reviews[0].get("product_name", "Galaxy S26 Ultra") if reviews else "Galaxy S26 Ultra"
    category = analyzer.get_product_category(product_name)
    print(f"[ ] Catégorie détectée pour les caractéristiques : {category}")
    
    for i, r in enumerate(reviews):
        review_text = r.get("review_text")
        if not review_text:
            # Skip empty reviews but ensure fields exist
            r["original_text"] = None
            r["original_language"] = "fr"
            r["aspects"] = {}
            r["sentiment"] = r.get("sentiment", "positive")
            continue
            
        # Detect language if not present
        if "original_language" not in r:
            lang = detect_language_heuristic(review_text)
            r["original_language"] = lang
            r["original_text"] = review_text
        else:
            lang = r["original_language"]
            
        # If translation is missing and it's not French
        if lang != "fr" and ("original_text" not in r or r["review_text"] == r["original_text"]):
            if translation_count < translation_limit:
                try:
                    # Translate to French
                    translated = translator.translate(review_text)
                    r["review_text"] = translated
                    r["original_text"] = review_text
                    translation_count += 1
                    if translation_count % 10 == 0:
                        print(f"    [Traduction] {translation_count} avis traduits...")
                except Exception as e:
                    # Fallback to original
                    r["review_text"] = review_text
            else:
                # Limit reached, keep original text as review_text but flag it
                r["review_text"] = review_text
                
        # Re-evaluate aspects on the (translated or original French) review_text
        if "aspects" not in r or not isinstance(r["aspects"], dict) or not r["aspects"]:
            text_to_analyze = r.get("review_text", "")
            rating = r.get("rating", 5)
            r["aspects"] = analyzer.analyze_aspects(text_to_analyze, rating, category)
            modified_count += 1
            
    # Save back
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(reviews, f, indent=2, ensure_ascii=False)
        
    print(f"[+] Traitement terminé. {modified_count} avis mis à jour avec les caractéristiques.")
    print(f"[+] {translation_count} traductions effectuées avec succès.")
    
    # Update average rating and catalog
    try:
        avg_rating = sum(r["rating"] for r in reviews) / len(reviews) if reviews else 0.0
        avg_rating = round(avg_rating, 2)
        
        catalog_path = "data/processed/products.json"
        if os.path.exists(catalog_path):
            with open(catalog_path, "r", encoding="utf-8") as f:
                catalog = json.load(f)
            
            product_id = reviews[0]["product_id"]
            catalog = [p for p in catalog if p["product_id"] != product_id]
            catalog.append({
                "product_id": product_id,
                "product_name": product_name,
                "file_path": file_path,
                "reviews_count": len(reviews),
                "average_rating": avg_rating
            })
            
            with open(catalog_path, "w", encoding="utf-8") as f:
                json.dump(catalog, f, indent=2, ensure_ascii=False)
            print("[+] Catalogue centralisé des produits mis à jour.")
    except Exception as ce:
        print(f"[!] Impossible de mettre à jour le catalogue : {ce}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        backfill_file(sys.argv[1])
    else:
        # Scan data/processed/ and migrate every single product database automatically
        processed_dir = "data/processed"
        if os.path.exists(processed_dir):
            for file_name in os.listdir(processed_dir):
                if file_name.endswith(".json") and file_name != "products.json":
                    file_path = os.path.join(processed_dir, file_name)
                    backfill_file(file_path)


import os
import json
import requests
import urllib.parse
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

def translate_free(text):
    if not text:
        return ""
    try:
        url = "https://translate.googleapis.com/translate_a/single"
        params = {
            "client": "gtx",
            "sl": "auto",
            "tl": "fr",
            "dt": "t",
            "q": text
        }
        res = requests.get(url, params=params, timeout=10)
        if res.status_code == 200:
            data = res.json()
            parts = []
            for item in data[0]:
                if item and item[0]:
                    parts.append(item[0])
            return "".join(parts).strip()
    except Exception as e:
        print(f"Translation error: {e}")
    return text

def backfill():
    processed_dir = "data/processed"
    if not os.path.exists(processed_dir):
        print("Processed data directory not found.")
        return
        
    print("[*] Début du backfill des traductions pour toutes les bases JSON...")
    
    files = [f for f in os.listdir(processed_dir) if f.endswith(".json") and f != "products.json"]
    
    for f in files:
        file_path = os.path.join(processed_dir, f)
        print(f"[*] Analyse du fichier : {file_path}")
        
        try:
            with open(file_path, "r", encoding="utf-8") as jf:
                reviews = json.load(jf)
        except Exception as e:
            print(f"[!] Erreur de lecture de {f} : {e}")
            continue
            
        modified = False
        translated_count = 0
        
        for idx, r in enumerate(reviews):
            if idx >= 300:
                break
            lang = r.get("original_language", "fr")
            orig_text = r.get("original_text", "")
            rev_text = r.get("review_text", "")
            
            # If original language is not French, and either:
            # - review_text is identical to original_text (silent failure during scraping)
            # - review_text contains non-French text or is empty
            if lang != "fr" and orig_text:
                if rev_text == orig_text or not rev_text:
                    # Translate it!
                    translated = translate_free(orig_text)
                    if translated and translated != orig_text:
                        r["review_text"] = translated
                        # Re-run sentiment analysis on new translation
                        # (to make sure it's classified correctly)
                        from sentiment_analyzer import SentimentAnalyzer
                        analyzer = SentimentAnalyzer()
                        r["sentiment"] = analyzer.analyze(translated, r.get("rating", 3))
                        # Deduce category to update aspects
                        cat = analyzer.get_product_category(r.get("product_name", ""))
                        r["aspects"] = analyzer.analyze_aspects(translated, r.get("rating", 3), cat)
                        
                        translated_count += 1
                        modified = True
                        
        if modified:
            try:
                with open(file_path, "w", encoding="utf-8") as jf:
                    json.dump(reviews, jf, indent=2, ensure_ascii=False)
                print(f"[+] Traduction et analyse terminées pour {f} : {translated_count} avis corrigés !")
            except Exception as e:
                print(f"[!] Erreur d'écriture de {f} : {e}")
        else:
            print(f"[+] Aucun problème de traduction détecté dans {f}.")

if __name__ == "__main__":
    backfill()

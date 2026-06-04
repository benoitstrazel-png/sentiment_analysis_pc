import os
import re
import json
import argparse
import requests
from bs4 import BeautifulSoup
from sentiment_analyzer import SentimentAnalyzer
from deep_translator import GoogleTranslator

class SamsungScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7"
        })
        self.analyzer = SentimentAnalyzer()
        
        # Static Bazaarvoice configuration for Samsung France
        self.bv_client = "Samsung-FR_FR"
        self.bv_display_code = "20562-fr_fr"
        self.bv_token = "20562,main_site,fr_FR"
        
        # Initialize translator
        self.translator = GoogleTranslator(source='auto', target='fr')
        
        # Ensure directories exist
        os.makedirs("data/raw", exist_ok=True)
        os.makedirs("data/processed", exist_ok=True)
        
        # Load translation cache if present to speed up operations and avoid redundant API requests
        self.cache_path = "data/processed/translation_cache.json"
        self.translation_cache = {}
        if os.path.exists(self.cache_path):
            try:
                with open(self.cache_path, "r", encoding="utf-8") as f:
                    self.translation_cache = json.load(f)
                print(f"[+] Cache de traduction chargé ({len(self.translation_cache)} entrées).")
            except Exception as e:
                print(f"[!] Impossible de charger le cache de traduction : {e}")

    def translate_text(self, text):
        """
        Translates text to French using the official Gemini API (with token minimization)
        or a highly resilient free translate API. Falls back to standard GoogleTranslator.
        """
        if not text:
            return ""
            
        # 0. Check cache first to avoid redundant API/network requests
        if text in self.translation_cache:
            return self.translation_cache[text]
            
        # 1. Try Gemini API if key is available
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if api_key:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            prompt = f"Translate the following text to French. Output ONLY the French translation, no quotes, no extra conversational text.\n\nText: {text}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.1}
            }
            try:
                res = requests.post(url, headers=headers, json=payload, timeout=8)
                if res.status_code == 200:
                    data = res.json()
                    translated = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if translated.startswith('"') and translated.endswith('"'):
                        translated = translated[1:-1].strip()
                    if translated.startswith("'") and translated.endswith("'"):
                        translated = translated[1:-1].strip()
                    # Store in cache
                    self.translation_cache[text] = translated
                    return translated
            except Exception as e:
                print(f"    [Gemini API Warning] {e} - Falling back to free translate API...")

        # 2. Try the free unofficial Google Translate API (resilient & keyless)
        try:
            url = "https://translate.googleapis.com/translate_a/single"
            params = {
                "client": "gtx",
                "sl": "auto",
                "tl": "fr",
                "dt": "t",
                "q": text
            }
            res = requests.get(url, params=params, timeout=5)
            if res.status_code == 200:
                data = res.json()
                parts = [item[0] for item in data[0] if item and item[0]]
                translated = "".join(parts).strip()
                # Store in cache
                self.translation_cache[text] = translated
                return translated
        except Exception as e:
            print(f"    [Free Translate API Warning] {e} - Falling back to standard translator...")

        # 3. Ultimate fallback to deep-translator
        try:
            translated = self.translator.translate(text)
            self.translation_cache[text] = translated
            return translated
        except Exception as e:
            print(f"    [Translator Warning] {e} - Returning original text")
            return text

    def find_key_recursive(self, data, target_key):
        """
        Recursively search for a key in a nested dict or list.
        """
        if isinstance(data, dict):
            for k, v in data.items():
                if k.lower() == target_key.lower():
                    if isinstance(v, str) and len(v) > 4:
                        return v
                    elif isinstance(v, (int, float)):
                        return str(v)
                res = self.find_key_recursive(v, target_key)
                if res:
                    return res
        elif isinstance(data, list):
            for item in data:
                res = self.find_key_recursive(item, target_key)
                if res:
                    return res
        return None

    def extract_sku_from_url_name(self, url_name):
        """
        Extract the model code or SKU from the hyphenated product url segment.
        e.g. "q60d-65-inch-qled-4k-smart-tv-tq65q60dauxxf" -> "TQ65Q60DAUXXF"
        e.g. "galaxy-tab-a11-plus-silver-256gb-wi-fi-sm-x230nzspeub" -> "SM-X230NZSPEUB"
        """
        tokens = url_name.lower().split("-")
        if not tokens:
            return url_name.upper()
            
        last_token = tokens[-1]
        
        # Check if the last token looks like a model code
        if last_token.isalnum() and len(last_token) >= 5:
            # Look at previous token too (e.g. sm-x230nz...)
            if len(tokens) > 1 and tokens[-2] == "sm":
                return f"SM-{last_token.upper()}"
            # e.g. hw-q990d -> "hw" + "-" + "q990d"
            if len(tokens) > 1 and tokens[-2] in ["hw", "wd", "mc", "qe", "tq", "qn", "qa", "ua"]:
                return f"{tokens[-2].upper()}-{last_token.upper()}"
            return last_token.upper()
            
        return url_name.upper()

    def extract_product_info(self, url):
        """
        Fetch product page HTML and extract product SKU and name.
        """
        print(f"[*] Analyse de la page produit : {url}")
        try:
            response = self.session.get(url, timeout=15)
            if response.status_code != 200:
                print(f"[!] Erreur de chargement de la page : {response.status_code}")
                return None, None
                
            html = response.text
            soup = BeautifulSoup(html, 'html.parser')
            
            # Save raw HTML to raw data folder as cache
            clean_url_name = url.strip("/").split("/")[-1]
            raw_path = f"data/raw/{clean_url_name}.html"
            with open(raw_path, "w", encoding="utf-8") as f:
                f.write(html)
            print(f"[+] Page brute sauvegardée dans : {raw_path}")
            
            # 1. Resolve product Name
            product_name = None
            og_title = soup.find("meta", property="og:title")
            if og_title:
                product_name = og_title.get("content", "").split("|")[0].strip()
            
            if not product_name:
                h1 = soup.find("h1")
                if h1:
                    product_name = h1.text.strip()
                    
            if not product_name:
                product_name = clean_url_name.replace("-", " ").title()
                
            # 2. Resolve Product ID / SKU using highly robust multi-level extraction
            product_id = None
            
            # Technique A: Recursive search in JSON-LD data
            for s in soup.find_all('script', type='application/ld+json'):
                try:
                    data = json.loads(s.string)
                    sku = self.find_key_recursive(data, "sku") or self.find_key_recursive(data, "mpn")
                    if sku and len(sku) > 4:
                        product_id = sku
                        print(f"    [Extraction] Trouvé via JSON-LD recursive : {product_id}")
                        break
                except:
                    pass
            
            # Technique B: Meta tags lookup
            if not product_id:
                for meta_name in ["product:retailer_item_id", "sku", "twitter:app:id:googleplay", "productCode", "mkt-model-code"]:
                    meta = soup.find("meta", {"name": meta_name}) or soup.find("meta", {"property": meta_name}) or soup.find("meta", {"itemprop": meta_name})
                    if meta and meta.get("content"):
                        val = meta.get("content").strip()
                        if len(val) > 4:
                            product_id = val
                            print(f"    [Extraction] Trouvé via Balise Meta ({meta_name}) : {product_id}")
                            break
            
            # Technique C: HTML data attributes lookup
            if not product_id:
                el = soup.find(lambda tag: tag.has_attr('data-model-code') or tag.has_attr('data-modelcode') or tag.has_attr('data-sku'))
                if el:
                    product_id = el.get('data-model-code') or el.get('data-modelcode') or el.get('data-sku')
                    print(f"    [Extraction] Trouvé via Attribut HTML : {product_id}")
            
            # Technique D: JS Configuration properties matching
            if not product_id:
                js_patterns = [
                    r'"modelCode"\s*:\s*"([^"]+)"',
                    r'"model_code"\s*:\s*"([^"]+)"',
                    r'"productCode"\s*:\s*"([^"]+)"',
                    r'"sku"\s*:\s*"([^"]+)"',
                    r'modelCode\s*=\s*["\']([^"\']+)["\']'
                ]
                for pattern in js_patterns:
                    matches = re.findall(pattern, html)
                    if matches:
                        valid = [m.strip() for m in matches if len(m.strip()) > 4 and m.strip().lower() != "null"]
                        if valid:
                            product_id = valid[0]
                            print(f"    [Extraction] Trouvé via Configuration JS : {product_id}")
                            break
            
            # Technique E: Regular Expression lookup for typical SM- codes (still useful fallback)
            if not product_id:
                sm_codes = re.findall(r'\b(SM-[A-Z0-9]{4,})\b', html)
                if sm_codes:
                    sm_codes.sort(key=len, reverse=True)
                    product_id = sm_codes[0]
                    print(f"    [Extraction] Trouvé via Code SM- : {product_id}")
            
            # Technique F: Smart URL parsing fallback
            if not product_id:
                product_id = self.extract_sku_from_url_name(clean_url_name)
                print(f"    [Extraction] Trouvé via Analyse d'URL (Fallback) : {product_id}")

            print(f"[+] Produit identifié : {product_name} (ID: {product_id})")
            return product_id, product_name
            
        except Exception as e:
            print(f"[!] Erreur lors de l'analyse : {e}")
            return None, None

    def update_progress(self, stage, current, total, message):
        """
        Helper to write the current scraping progress to a JSON file.
        """
        progress_file = "data/processed/progress.json"
        os.makedirs(os.path.dirname(progress_file), exist_ok=True)
        percent = int((current / total) * 100) if total > 0 else 0
        data = {
            "status": "running",
            "stage": stage,
            "current": current,
            "total": total,
            "percent": percent,
            "message": message
        }
        try:
            with open(progress_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
        except Exception as e:
            print(f"[Progress Error] {e}")

    def fetch_reviews(self, product_id, product_name, limit=100):
        """
        Fetch reviews using the Bazaarvoice API and translate non-French ones.
        """
        print(f"[*] Récupération des avis pour le produit {product_id} (Limite: {limit})...")
        
        api_url = f"https://apps.bazaarvoice.com/bfd/v1/clients/{self.bv_client}/api-products/cv2/resources/data/reviews.json"
        
        raw_reviews = []
        offset = 0
        batch_size = 50 # Max page size supported by the API
        
        self.update_progress("extraction", 0, limit, "Initialisation de l'extraction...")
        
        # STAGE 1: Extraction (fetching raw reviews from Bazaarvoice)
        print("[*] ÉTAPE 1 : Extraction des avis bruts...")
        total_results_limit = limit
        
        while len(raw_reviews) < limit:
            current_limit = min(batch_size, limit - len(raw_reviews))
            
            params = {
                "resource": "reviews",
                "action": "REVIEWS_N_STATS",
                "filter": [
                    f"productid:eq:{product_id}",
                    "isratingsonly:eq:false"
                ],
                "include": "authors,products",
                "filteredstats": "reviews",
                "Stats": "Reviews",
                "limit": current_limit,
                "offset": offset,
                "apiversion": "5.5",
                "displaycode": self.bv_display_code
            }
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "application/json",
                "Origin": "https://www.samsung.com",
                "Referer": "https://www.samsung.com/",
                "Bv-Bfd-Token": self.bv_token
            }
            
            try:
                response = self.session.get(api_url, params=params, headers=headers, timeout=15)
                if response.status_code != 200:
                    print(f"[!] Erreur API Bazaarvoice : {response.status_code}")
                    break
                    
                data = response.json()
                results = data.get("response", {}).get("Results", [])
                total_results = data.get("response", {}).get("TotalResults", 0)
                
                # Adjust limits based on actual total reviews available
                actual_max = min(limit, total_results)
                total_results_limit = actual_max if actual_max > 0 else limit
                
                if not results:
                    print("[*] Plus aucun avis disponible.")
                    break
                
                print(f"[ ] Reçu {len(results)} avis (Offset: {offset} / Total sur Samsung: {total_results})")
                raw_reviews.extend(results)
                
                # Update progress for extraction stage
                self.update_progress(
                    "extraction", 
                    len(raw_reviews), 
                    total_results_limit, 
                    f"Extraction des avis bruts : {len(raw_reviews)} / {total_results_limit}"
                )
                
                # Increment offset
                offset += len(results)
                
                if offset >= total_results:
                    break
                    
            except Exception as e:
                print(f"[!] Erreur de requête API : {e}")
                break
                
        total_extracted = len(raw_reviews)
        print(f"[+] Extraction terminée. {total_extracted} avis récupérés.")
        
        # STAGE 2: Translation & Analysis
        print("[*] ÉTAPE 2 : Traduction et analyse de sentiment...")
        processed_reviews = []
        
        for idx, rev in enumerate(raw_reviews):
            current_index = idx + 1
            progress_msg = f"Traduction & Analyse de l'avis {current_index} sur {total_extracted}..."
            self.update_progress("translation", current_index, total_extracted, progress_msg)
            
            raw_text = rev.get("ReviewText", "")
            rating = rev.get("Rating", 3)
            
            # Convert SubmissionTime format to YYYY-MM-DD
            raw_date = rev.get("SubmissionTime", "")
            date_match = re.search(r'^(\d{4}-\d{2}-\d{2})', raw_date)
            date_str = date_match.group(1) if date_match else "2026-01-01"
            
            # 1. Handle Language Translation
            content_locale = rev.get("ContentLocale", "fr_FR")
            lang_code = content_locale.split("_")[0].lower()
            
            translated_text = raw_text
            
            # If review is not originally in French, translate it!
            if lang_code != "fr" and raw_text:
                translated_text = self.translate_text(raw_text)
            
            # 2. Deduce category
            category = self.analyzer.get_product_category(product_name)
            
            # 3. Analyze Sentiment & Aspects (on the translated French text!)
            sentiment = self.analyzer.analyze(translated_text, rating)
            aspects = self.analyzer.analyze_aspects(translated_text, rating, category)
            
            # Follow strict contract schema (enriched with translation fields)
            review_item = {
                "product_id": product_id,
                "product_name": product_name,
                "rating": rating,
                "date": date_str,
                "original_text": raw_text,
                "original_language": lang_code,
                "review_text": translated_text,
                "sentiment": sentiment,
                "aspects": aspects
            }
            processed_reviews.append(review_item)
            
        # Complete
        self.update_progress("completed", total_extracted, total_extracted, f"Traitement de {total_extracted} avis terminé avec succès !")
        print(f"[+] Total de {len(processed_reviews)} avis traités avec succès.")
        return processed_reviews

    def save_processed_reviews(self, product_id, product_name, reviews):
        """
        Save reviews to JSON file and update products list catalog.
        """
        if not reviews:
            print("[!] Aucun avis à sauvegarder.")
            return
            
        file_path = f"data/processed/{product_id}.json"
        
        # Save individual product reviews
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(reviews, f, indent=2, ensure_ascii=False)
        print(f"[+] Avis sauvegardés dans : {file_path}")
        
        # Also save the updated translation cache to disk to speed up subsequent scrapings
        try:
            with open(self.cache_path, "w", encoding="utf-8") as cache_f:
                json.dump(self.translation_cache, cache_f, indent=2, ensure_ascii=False)
            print(f"[+] Cache de traduction mis à jour sur le disque ({len(self.translation_cache)} entrées).")
        except Exception as e:
            print(f"[!] Erreur de sauvegarde du cache de traduction : {e}")
        
        # Calculate statistics
        avg_rating = sum(r["rating"] for r in reviews) / len(reviews) if reviews else 0.0
        avg_rating = round(avg_rating, 2)
        
        # Update products.json catalog
        catalog_path = "data/processed/products.json"
        catalog = []
        
        if os.path.exists(catalog_path):
            try:
                with open(catalog_path, "r", encoding="utf-8") as f:
                    catalog = json.load(f)
            except:
                catalog = []
                
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
        print(f"[+] Catalogue centralisé des produits mis à jour : {catalog_path}")

    def run(self, url=None, limit=100, product_id=None, product_name=None):
        if not product_id or not product_name:
            product_id, product_name = self.extract_product_info(url)
            
        if not product_id or not product_name:
            print("[!] Impossible d'identifier le produit. Scraping annulé.")
            return
            
        reviews = self.fetch_reviews(product_id, product_name, limit)
        self.save_processed_reviews(product_id, product_name, reviews)
        print(f"[*] Processus terminé pour {product_name} !")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Samsung Reviews Sentiment Scraper")
    parser.add_argument("--url", help="URL de la fiche produit Samsung")
    parser.add_argument("--product-id", help="SKU ID direct du produit")
    parser.add_argument("--product-name", help="Nom direct du produit")
    parser.add_argument("--limit", type=int, default=100, help="Nombre maximum d'avis à scraper")
    
    args = parser.parse_args()
    
    scraper = SamsungScraper()
    scraper.run(
        url=args.url, 
        limit=args.limit,
        product_id=args.product_id,
        product_name=args.product_name
    )

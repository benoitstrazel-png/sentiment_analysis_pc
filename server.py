import http.server
import json
import os
import sys
import requests
import urllib.parse

# Add the scraper folder to python path to import modules easily
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'scraper')))
from scraper import SamsungScraper

class SentilyticsRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/scrape':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                params = json.loads(post_data.decode('utf-8'))
                
                # Support direct SKU scrape or URL scrape
                url = params.get('url', '').strip()
                product_id = params.get('product_id', '').strip()
                product_name = params.get('product_name', '').strip()
                limit = params.get('limit', 100)
                
                if limit == "all":
                    limit = 999999
                else:
                    limit = int(limit)
                
                scraper = SamsungScraper()
                
                # Direct SKU Scrape (from Search catalog page)
                if product_id and product_name:
                    print(f"\n[HTTP Server] Scraping direct via SKU reçu : {product_name} (ID: {product_id}, limite: {limit})")
                    reviews = scraper.fetch_reviews(product_id, product_name, limit)
                    if reviews:
                        scraper.save_processed_reviews(product_id, product_name, reviews)
                        self.send_json_response({
                            "status": "success",
                            "product_id": product_id,
                            "product_name": product_name,
                            "reviews_count": len(reviews)
                        })
                    else:
                        self.send_error_response("Aucun avis n'a pu être extrait pour ce produit.", 404)
                    return
                
                # Fallback: URL Scrape
                if not url or "samsung.com" not in url:
                    self.send_error_response("Veuillez fournir une URL de produit Samsung ou un SKU valide.", 400)
                    return
                
                print(f"\n[HTTP Server] Scraping par URL reçu : {url} (limite : {limit})")
                resolved_id, resolved_name = scraper.extract_product_info(url)
                
                if resolved_id and resolved_name:
                    reviews = scraper.fetch_reviews(resolved_id, resolved_name, limit)
                    if reviews:
                        scraper.save_processed_reviews(resolved_id, resolved_name, reviews)
                        self.send_json_response({
                            "status": "success",
                            "product_id": resolved_id,
                            "product_name": resolved_name,
                            "reviews_count": len(reviews)
                        })
                    else:
                        self.send_error_response("Aucun avis n'a pu être extrait.", 404)
                else:
                    self.send_error_response("Impossible d'extraire les infos produit depuis l'URL.", 400)
                    
            except Exception as e:
                print(f"[HTTP Server Error] {e}")
                self.send_error_response(f"Erreur interne : {str(e)}", 500)
        elif self.path == '/api/clear':
            try:
                processed_dir = "data/processed"
                if os.path.exists(processed_dir):
                    for f in os.listdir(processed_dir):
                        file_path = os.path.join(processed_dir, f)
                        if os.path.isfile(file_path):
                            if f == "products.json":
                                with open(file_path, "w", encoding="utf-8") as cat_f:
                                    json.dump([], cat_f)
                            else:
                                os.remove(file_path)
                
                print("[HTTP Server] Historique de données effacé.")
                self.send_json_response({
                    "status": "success",
                    "message": "Historique des données effacé avec succès !"
                })
            except Exception as e:
                print(f"[HTTP Server Error] {e}")
                self.send_error_response(f"Erreur interne : {str(e)}", 500)
        else:
            self.send_error(404, "Endpoint not found")

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type")
        self.end_headers()

    def send_json_response(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def send_error_response(self, message, status_code=400):
        self.send_json_response({
            "status": "error",
            "message": message
        }, status_code)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        # 1. Handle search API proxy to bypass CORS
        if self.path.startswith('/api/search'):
            query_components = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            q = query_components.get('q', [''])[0].strip()
            
            print(f"[HTTP Server] Proxy de recherche pour le mot-clé : '{q}'")
            
            search_url = "https://sribsrch.ecom.samsung.com/estoresearch-api/v1/scom/search"
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": "https://www.samsung.com",
                "Referer": "https://www.samsung.com/"
            }
            data = {
                "clientCode": "b2c",
                "storeID": "fr",
                "countryCode": "fr",
                "startIndex": "0",
                "requestCount": "100",
                "clientName": "scom",
                "projection": '["*"]',
                "keyword": q,
                "siteCd": "fr",
                "version": "v2",
                "inVokeAISummary": "false",
                "firstSearchYN": "true"
            }
            
            try:
                response = requests.post(search_url, data=data, headers=headers, timeout=10)
                if response.status_code == 200:
                    search_data = response.json()
                    results = search_data.get("searchResults", [])
                    
                    formatted_results = []
                    for r in results:
                        if r.get("type") == "Product":
                            img_url = r.get("images", {}).get("largeImage", {}).get("url", "")
                            # Clean relative/absolute image url
                            if img_url and not img_url.startswith("http"):
                                img_url = "https:" + img_url
                            
                            formatted_results.append({
                                "product_id": r.get("id"),
                                "product_name": r.get("productDisplayName"),
                                "image_url": img_url,
                                "reviews_count": r.get("numberOfReviews", "0")
                            })
                    self.send_json_response(formatted_results)
                else:
                    self.send_error_response(f"Erreur API Samsung : {response.status_code}", 500)
            except Exception as e:
                self.send_error_response(str(e), 500)
            return

        if self.path == '/api/progress':
            progress_file = "data/processed/progress.json"
            if os.path.exists(progress_file):
                try:
                    with open(progress_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self.send_json_response(data)
                except Exception as e:
                    self.send_json_response({
                        "status": "idle",
                        "stage": "idle",
                        "percent": 0,
                        "message": f"Erreur de lecture : {str(e)}"
                    })
            else:
                self.send_json_response({
                    "status": "idle",
                    "stage": "idle",
                    "percent": 0,
                    "message": "Aucun scraping en cours."
                })
            return

        # 2. Handle standard static files serving
        if self.path == '/' or self.path == '/index.html':
            self.path = '/dashboard/index.html'
        elif self.path.startswith('/style.css'):
            self.path = '/dashboard/style.css'
        elif self.path.startswith('/app.js'):
            self.path = '/dashboard/app.js'
            
        return super().do_GET()

from socketserver import ThreadingMixIn

class ThreadingHTTPServer(ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

def run(port=8000):
    server_address = ('', port)
    httpd = ThreadingHTTPServer(server_address, SentilyticsRequestHandler)
    print(f"\n🚀 Serveur local Sentilytics (Multi-threaded) en cours d'exécution sur http://localhost:{port}/")
    print("Double-cliquez sur 'start.command' pour ouvrir l'application automatiquement.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur.")
        httpd.server_close()

if __name__ == '__main__':
    run()

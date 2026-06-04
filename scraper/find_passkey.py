import requests
import re

bv_js_url = "https://apps.bazaarvoice.com/deployments/samsung-fr_fr/main_site/production/fr_FR/bv.js"
headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

print(f"Fetching Bazaarvoice JS: {bv_js_url}...")
try:
    response = requests.get(bv_js_url, headers=headers, timeout=15)
    if response.status_code == 200:
        content = response.text
        print(f"Downloaded {len(content)} characters.")
        
        # Save it for inspection if needed
        with open("bv.js", "w", encoding="utf-8") as f:
            f.write(content)
            
        # Search for 'passkey'
        print("\n--- Search for passkey ---")
        matches = re.findall(r'passkey["\'\s:]+([a-zA-Z0-9]{24,40})', content)
        for m in set(matches):
            print(f"Possible passkey: {m}")
            
        # Let's also do a search for 'apiKey' or 'client'
        matches2 = re.findall(r'apiKey["\'\s:]+([a-zA-Z0-9]{24,40})', content)
        for m in set(matches2):
            print(f"Possible apiKey: {m}")
            
        # Look for general config structures
        # Bazaarvoice usually has something like "client":"samsung-fr_fr" or "samsung-fr"
        client_matches = re.findall(r'client["\'\s:]+["\']([^"\']+)["\']', content)
        print(f"Client values: {set(client_matches)}")
        
        # Let's search for "passkey" string with some context
        idx = 0
        while True:
            idx = content.lower().find("passkey", idx)
            if idx == -1:
                break
            start = max(0, idx - 100)
            end = min(len(content), idx + 200)
            print(f"Context [{idx}]: ... {content[start:end].strip()} ...\n")
            idx += 7
            
    else:
        print(f"Failed to load bv.js, status: {response.status_code}")
except Exception as e:
    print(f"Error: {e}")

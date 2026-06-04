import requests
import re

url = "https://www.samsung.com/fr/smartphones/galaxy-s26-ultra/"
headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
}

print(f"Fetching {url}...")
try:
    response = requests.get(url, headers=headers, timeout=15)
    if response.status_code == 200:
        html = response.text
        
        # Search for bazaarvoice occurrences with context
        print("\n--- Occurrences of 'bazaarvoice' ---")
        idx = 0
        while True:
            idx = html.lower().find("bazaarvoice", idx)
            if idx == -1:
                break
            start = max(0, idx - 150)
            end = min(len(html), idx + 250)
            print(f"[{idx}]: ... {html[start:end].strip()} ...\n")
            idx += 11 # length of bazaarvoice
            
        # Search for occurrences of 'bv' or 'bvapi'
        print("\n--- Occurrences of 'bv.js' or similar ---")
        matches = re.findall(r'[^"\']*bv\.js[^"\']*', html)
        for m in set(matches):
            print(f"Found: {m}")
            
        matches2 = re.findall(r'[^"\']*bvapi[^"\']*', html)
        for m in set(matches2):
            print(f"Found: {m}")

        # Let's search for "SM-S" which is the typical model number prefix for Galaxy S series (e.g. SM-S928 for S24 Ultra, SM-S948 for S26 Ultra?)
        # Let's search for SM-S followed by numbers and letters
        print("\n--- Possible Samsung Model Codes ---")
        model_matches = re.findall(r'\bSM-S[0-9]{3}[A-Z0-9]*\b', html)
        for m in set(model_matches):
            print(f"Found: {m}")

    else:
        print(f"Failed to load page, status: {response.status_code}")
except Exception as e:
    print(f"Error: {e}")

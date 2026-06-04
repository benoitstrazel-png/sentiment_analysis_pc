import requests

product_id = "SM-X230NZSPEUB"
display_code = "20562-fr_fr"

url = "https://apps.bazaarvoice.com/bfd/v1/clients/Samsung-FR_FR/api-products/cv2/resources/data/reviews.json"
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
    "limit": 10,
    "offset": 0,
    "apiversion": "5.5",
    "displaycode": display_code
}

headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/json",
    "Origin": "https://www.samsung.com",
    "Referer": "https://www.samsung.com/",
    "Bv-Bfd-Token": "20562,main_site,fr_FR"
}

# 1. Fetch WITHOUT locale filter
print("--- Fetching WITHOUT locale filter ---")
try:
    response = requests.get(url, params=params, headers=headers, timeout=15)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        total = data.get("response", {}).get("TotalResults", 0)
        print(f"Total Results: {total}")
        
        # Look at the locales of the returned reviews
        results = data.get("response", {}).get("Results", [])
        locales = [r.get("ContentLocale") for r in results]
        print(f"Locales of first 10 reviews: {locales}")
    else:
        print(f"Error payload: {response.text}")
except Exception as e:
    print(f"Error: {e}")

# 2. Fetch WITH French locale filter only
print("\n--- Fetching WITH French locale filter ---")
params["filter"].append("contentlocale:eq:fr_FR,fr_FR")
try:
    response = requests.get(url, params=params, headers=headers, timeout=15)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        total_fr = data.get("response", {}).get("TotalResults", 0)
        print(f"Total French Results: {total_fr}")
    else:
        print(f"Error payload: {response.text}")
except Exception as e:
    print(f"Error: {e}")

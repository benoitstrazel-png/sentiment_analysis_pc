import requests
import json

# Construct the API URL for reviews using the captured parameters
product_id = "SM-S948BZVGEUB"
display_code = "20562-fr_fr"
limit = 5
offset = 0

url = f"https://apps.bazaarvoice.com/bfd/v1/clients/Samsung-FR_FR/api-products/cv2/resources/data/reviews.json"
params = {
    "resource": "reviews",
    "action": "REVIEWS_N_STATS",
    "filter": [
        f"productid:eq:{product_id}",
        "isratingsonly:eq:false"
    ],
    "include": "authors,products,comments",
    "filteredstats": "reviews",
    "Stats": "Reviews",
    "limit": limit,
    "offset": offset,
    "limit_comments": 3,
    "apiversion": "5.5",
    "displaycode": display_code
}

headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.samsung.com",
    "Referer": "https://www.samsung.com/",
    "Bv-Bfd-Token": "20562,main_site,fr_FR"  # Critical token discovered by Playwright!
}

print(f"Fetching reviews from Bazaarvoice API for product {product_id}...")
try:
    response = requests.get(url, params=params, headers=headers, timeout=15)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("\n--- JSON Keys ---")
        print(list(data.keys()))
        
        # Save a sample JSON for examination
        with open("sample_reviews_response.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        print("\n--- Review Summary Stats ---")
        if "Includes" in data and "Products" in data["Includes"]:
            products = data["Includes"]["Products"]
            if product_id in products:
                prod_info = products[product_id]
                print(f"Product Name: {prod_info.get('Name')}")
                if "ReviewStatistics" in prod_info:
                    stats = prod_info["ReviewStatistics"]
                    print(f"Average Rating: {stats.get('AverageOverallRating')}")
                    print(f"Total Reviews Count: {stats.get('TotalReviewCount')}")
            else:
                print(f"Product ID {product_id} not found in Includes.Products, here are the keys: {list(products.keys())}")
        
        print("\n--- Reviews List ---")
        reviews = data.get("Results", [])
        print(f"Retrieved {len(reviews)} reviews.")
        for i, rev in enumerate(reviews):
            print(f"\nReview #{i+1}:")
            print(f"  Author: {rev.get('UserNickname')}")
            print(f"  Rating: {rev.get('Rating')}")
            print(f"  Title: {rev.get('Title')}")
            print(f"  Text: {rev.get('ReviewText')[:200]}...")
            print(f"  Date: {rev.get('SubmissionTime')}")
            
    else:
        print(f"Failed to load reviews, status: {response.status_code}")
        print(response.text[:500])
except Exception as e:
    print(f"Error: {e}")

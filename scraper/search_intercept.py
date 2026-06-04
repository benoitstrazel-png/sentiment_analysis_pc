import asyncio
from playwright.async_api import async_playwright

async def main():
    search_value = "galaxy tab"
    url = f"https://www.samsung.com/fr/search/?searchvalue={search_value}"
    print(f"Launching Playwright to load search page and capture exact POST data...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        page = await context.new_page()
        
        async def handle_request(request):
            req_url = request.url
            if "estoresearch-api/v1/scom/search" in req_url:
                print(f"\n[Captured Search API]")
                print(f"URL: {req_url}")
                print(f"Method: {request.method}")
                print(f"Headers: {await request.all_headers()}")
                if request.method == "POST":
                    print(f"Post Data: {request.post_data}")
                    
        async def handle_response(response):
            res_url = response.url
            if "estoresearch-api/v1/scom/search" in res_url:
                print(f"\n[Captured Search Response]")
                print(f"Status: {response.status}")
                try:
                    text = await response.text()
                    print(f"Response Snippet: {text[:1500]}\n")
                except Exception as e:
                    print(f"Error reading response body: {e}")
        
        page.on("request", handle_request)
        page.on("response", handle_response)
        
        try:
            await page.goto(url, wait_until="load", timeout=60000)
            print("Page loaded. Waiting for network requests...")
            await asyncio.sleep(8)
        except Exception as e:
            print(f"Error during execution: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

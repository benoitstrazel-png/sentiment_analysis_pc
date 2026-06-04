import asyncio
import sys
from playwright.async_api import async_playwright

async def main():
    url = "https://www.samsung.com/fr/smartphones/galaxy-s26-ultra/"
    print(f"Launching Playwright to load {url} and intercept network request headers...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        page = await context.new_page()
        
        captured_headers = {}
        
        async def handle_request(request):
            req_url = request.url
            if "reviews.json" in req_url or "products.json" in req_url:
                print(f"\n[Captured Target Request] {req_url}")
                headers = await request.all_headers()
                print("Headers:")
                for k, v in headers.items():
                    print(f"  {k}: {v}")
                    if k.lower() in ["bv-bfd-token", "authorization", "x-bv-token"]:
                        captured_headers[k] = v
        
        page.on("request", handle_request)
        
        try:
            print("Navigating to page...")
            await page.goto(url, wait_until="networkidle", timeout=60000)
            print("Page loaded. Scrolling down to trigger reviews loading...")
            
            for i in range(10):
                await page.evaluate("window.scrollBy(0, 800)")
                await asyncio.sleep(1)
                
            print("Waiting for network requests to settle...")
            await asyncio.sleep(5)
            
        except Exception as e:
            print(f"Error during execution: {e}")
        finally:
            await browser.close()
            
        print("\n--- Summary of Captured Crucial Headers ---")
        if captured_headers:
            for k, v in captured_headers.items():
                print(f"{k}: {v}")
        else:
            print("No crucial headers like Bv-Bfd-Token were found.")

if __name__ == "__main__":
    asyncio.run(main())

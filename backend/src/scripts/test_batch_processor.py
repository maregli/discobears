"""
Test script for BatchProcessor - async markdown extraction.

Demonstrates:
1. Processing a list of URLs (max 20)
2. Concurrent/parallel extraction (5 at a time)
3. Prioritization of important URLs
4. Integration with spider results
"""

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scraper.page_extractor import (
    BatchProcessor,
    ExtractionConfig,
    WebSpider,
    SpiderConfig
)


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)


async def test_direct_urls():
    """Test 1: Process a list of URLs directly."""
    print("\n" + "="*80)
    print("TEST 1: DIRECT URL LIST")
    print("="*80)
    
    urls = {
        "https://example.com",
        "https://example.com/about",
        "https://example.com/contact",
    }
    
    print(f"Processing {len(urls)} URLs...\n")
    
    async with BatchProcessor(max_urls=20, max_concurrent=3) as processor:
        result = await processor.process_urls(urls)
    
    print(f"\n{result}")
    
    # Show results
    for page in result.successful:
        print(f"✓ {page.url} - {page.content_length} chars")
    
    for url, error in result.failed:
        print(f"✗ {url} - {error}")


async def test_with_spider():
    """Test 2: Process spider results with limit."""
    print("\n" + "="*80)
    print("TEST 2: SPIDER + BATCH PROCESSOR")
    print("="*80)
    
    url = input("Enter festival URL (or press Enter for example.com): ").strip()
    if not url:
        url = "https://example.com"
    
    # Step 1: Spider
    print(f"\n1️⃣  Running spider on {url}...")
    
    config = SpiderConfig(
        max_depth=1,
        max_urls=50,
        url_patterns=[
            r'.*/lineup.*',
            r'.*/tickets.*',
            r'.*/info.*',
        ]
    )
    
    async with WebSpider(config) as spider:
        spider_result = await spider.crawl(url)
    
    print(f"   Found {len(spider_result.discovered_urls)} URLs")
    
    # Step 2: Batch extract with limit
    print(f"\n2️⃣  Extracting markdown (max 20 URLs, 5 concurrent)...")
    
    async with BatchProcessor(max_urls=20, max_concurrent=5) as processor:
        batch_result = await processor.process_spider_result(
            spider_result,
            prioritize_patterns=['lineup', 'tickets', 'artists'],
            include_external_contextual=True
        )
    
    print(f"\n{batch_result}")
    
    # Show quality scores
    if batch_result.successful:
        print("\n📊 Quality Scores:")
        for page in sorted(batch_result.successful, 
                          key=lambda p: p.content_quality_score, 
                          reverse=True):
            print(f"  {page.content_quality_score:5.1f} - {page.url}")


async def test_prioritization():
    """Test 3: URL prioritization."""
    print("\n" + "="*80)
    print("TEST 3: URL PRIORITIZATION")
    print("="*80)
    
    # Create mock URLs
    urls = {
        "https://festival.com/",
        "https://festival.com/lineup",
        "https://festival.com/tickets",
        "https://festival.com/artists/artist1",
        "https://festival.com/artists/artist2",
        "https://festival.com/contact",
        "https://festival.com/privacy",
        "https://festival.com/terms",
        "https://festival.com/shop",
        "https://festival.com/blog",
        "https://festival.com/blog/post1",
        "https://festival.com/blog/post2",
    }
    
    print(f"Input: {len(urls)} URLs")
    print("Prioritize patterns: ['lineup', 'tickets', 'artists']")
    print("Max URLs: 5\n")
    
    # This will prioritize URLs with lineup/tickets/artists
    processor = BatchProcessor(max_urls=5)
    prioritized = processor._prioritize_urls(
        urls,
        ['lineup', 'tickets', 'artists']
    )
    
    print("Result (top 5 prioritized):")
    for i, url in enumerate(prioritized, 1):
        marker = "⭐" if any(p in url for p in ['lineup', 'tickets', 'artists']) else "  "
        print(f"{marker} {i}. {url}")


async def test_concurrency_comparison():
    """Test 4: Compare different concurrency levels."""
    print("\n" + "="*80)
    print("TEST 4: CONCURRENCY COMPARISON")
    print("="*80)
    
    url = "https://example.com"
    
    spider_config = SpiderConfig(max_depth=1, max_urls=20)
    
    print(f"Crawling {url} to get test URLs...\n")
    async with WebSpider(spider_config) as spider:
        spider_result = await spider.crawl(url)
    
    if len(spider_result.discovered_urls) < 5:
        print("Not enough URLs to test concurrency.")
        return
    
    # Test different concurrency levels
    for concurrent in [1, 3, 5]:
        print(f"\n🔄 Testing max_concurrent={concurrent}...")
        
        async with BatchProcessor(max_urls=10, max_concurrent=concurrent) as processor:
            result = await processor.process_urls(
                set(list(spider_result.discovered_urls)[:10])
            )
        
        print(f"   Time: {result.total_time_seconds:.2f}s")
        print(f"   Success: {len(result.successful)}")


async def interactive_test():
    """Interactive test menu."""
    while True:
        print("\n" + "="*80)
        print("BATCH PROCESSOR TEST SUITE")
        print("="*80)
        print("\n1. Test with direct URL list")
        print("2. Test with spider (URL input)")
        print("3. Test prioritization logic")
        print("4. Test concurrency comparison")
        print("5. Exit")
        
        choice = input("\nChoose test (1-5): ").strip()
        
        if choice == "1":
            await test_direct_urls()
        elif choice == "2":
            await test_with_spider()
        elif choice == "3":
            await test_prioritization()
        elif choice == "4":
            await test_concurrency_comparison()
        elif choice == "5":
            print("Exiting...")
            break
        else:
            print("Invalid choice!")


async def main():
    """Main entry point."""
    if len(sys.argv) > 1 and sys.argv[1] == "--url":
        # Quick test with URL
        await test_with_spider()
    else:
        # Interactive mode
        await interactive_test()


if __name__ == "__main__":
    asyncio.run(main())

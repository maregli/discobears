"""Test script for web spider functionality."""

import asyncio
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from scraper.page_extractor.spider import WebSpider, SpiderConfig


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


async def test_basic_crawl(url: str, max_depth: int = 2):
    """Test basic crawling functionality."""
    print("\n" + "="*80)
    print(f"BASIC CRAWL TEST")
    print("="*80)
    print(f"URL: {url}")
    print(f"Max Depth: {max_depth}")
    print("="*80 + "\n")
    
    config = SpiderConfig(
        max_depth=max_depth,
        max_urls=50,  # Limit for testing
        delay_between_requests=0.3
    )
    
    async with WebSpider(config) as spider:
        result = await spider.crawl(url)
    
    print("\n" + "-"*80)
    print("CRAWL RESULTS")
    print("-"*80)
    print(result)
    print()
    
    # Show discovered URLs
    print("DISCOVERED URLs:")
    print("-"*80)
    for i, discovered_url in enumerate(sorted(result.discovered_urls), 1):
        if discovered_url in result.external_contextual_urls:
            status = "🎫 external"
        elif discovered_url in result.visited_urls:
            status = "✓ visited"
        else:
            status = "○ found"
        print(f"{i:3d}. {status:12} {discovered_url}")
    
    if result.external_contextual_urls:
        print("\n" + "-"*80)
        print("EXTERNAL CONTEXTUAL URLs (e.g., ticket sellers):")
        print("-"*80)
        for ext_url in sorted(result.external_contextual_urls):
            print(f"  🎫 {ext_url}")
    
    if result.failed_urls:
        print("\n" + "-"*80)
        print("FAILED URLs:")
        print("-"*80)
        for failed_url in sorted(result.failed_urls):
            print(f"  ✗ {failed_url}")
    
    return result


async def test_with_patterns(url: str):
    """Test crawling with URL pattern filtering."""
    print("\n" + "="*80)
    print(f"PATTERN-FILTERED CRAWL TEST")
    print("="*80)
    print(f"URL: {url}")
    print("="*80 + "\n")
    
    # Example: Only crawl pages about lineup, tickets, or info
    patterns = [
        r'.*/lineup.*',
        r'.*/artists.*',
        r'.*/tickets.*',
        r'.*/info.*',
        r'.*/schedule.*',
        r'.*/location.*',
    ]
    
    print("Include patterns:")
    for pattern in patterns:
        print(f"  - {pattern}")
    print()
    
    config = SpiderConfig(
        max_depth=2,
        max_urls=50,
        url_patterns=patterns,
        delay_between_requests=0.3
    )
    
    async with WebSpider(config) as spider:
        result = await spider.crawl(url)
    
    print("\n" + "-"*80)
    print("FILTERED RESULTS")
    print("-"*80)
    print(result)
    print()
    
    print("MATCHED URLs:")
    print("-"*80)
    if result.discovered_urls:
        for i, discovered_url in enumerate(sorted(result.discovered_urls), 1):
            print(f"{i:3d}. {discovered_url}")
    else:
        print("  (No URLs matched the patterns)")
    
    return result


async def test_shallow_crawl(url: str):
    """Test shallow crawl (depth=1) - just pages linked from homepage."""
    print("\n" + "="*80)
    print(f"SHALLOW CRAWL TEST (depth=1)")
    print("="*80)
    print(f"URL: {url}")
    print("="*80 + "\n")
    
    config = SpiderConfig(
        max_depth=1,  # Only go 1 level deep
        max_urls=100,
        delay_between_requests=0.2
    )
    
    async with WebSpider(config) as spider:
        result = await spider.crawl(url)
    
    print("\n" + "-"*80)
    print("SHALLOW CRAWL RESULTS")
    print("-"*80)
    print(result)
    print()
    
    print("URLs FOUND (1 level from homepage):")
    print("-"*80)
    for i, discovered_url in enumerate(sorted(result.discovered_urls), 1):
        if discovered_url != url:  # Skip the start URL
            print(f"{i:3d}. {discovered_url}")
    
    return result


async def compare_depths(url: str):
    """Compare different crawl depths."""
    print("\n" + "="*80)
    print(f"DEPTH COMPARISON TEST")
    print("="*80)
    print(f"URL: {url}")
    print("="*80 + "\n")
    
    results = {}
    
    for depth in [0, 1, 2]:
        print(f"\nCrawling with max_depth={depth}...")
        config = SpiderConfig(
            max_depth=depth,
            max_urls=50,
            delay_between_requests=0.2
        )
        
        async with WebSpider(config) as spider:
            result = await spider.crawl(url)
            results[depth] = result
    
    print("\n" + "-"*80)
    print("DEPTH COMPARISON")
    print("-"*80)
    print(f"{'Depth':<10} {'Discovered':<15} {'Visited':<15} {'Time':<10}")
    print("-"*80)
    for depth, result in results.items():
        print(
            f"{depth:<10} "
            f"{len(result.discovered_urls):<15} "
            f"{len(result.visited_urls):<15} "
            f"{result.total_time_seconds:<10.2f}s"
        )
    
    return results


async def interactive_test():
    """Interactive testing mode."""
    print("\n" + "="*80)
    print("WEB SPIDER TEST SUITE")
    print("="*80)
    
    while True:
        print("\nOptions:")
        print("1. Basic crawl (default depth=2)")
        print("2. Shallow crawl (depth=1)")
        print("3. Pattern-filtered crawl")
        print("4. Compare different depths")
        print("5. Quick crawl (convenience method)")
        print("6. Exit")
        
        choice = input("\nEnter choice (1-6): ").strip()
        
        if choice == "1":
            url = input("Enter URL: ").strip()
            depth = input("Enter max depth (default 2): ").strip()
            depth = int(depth) if depth else 2
            if url:
                await test_basic_crawl(url, depth)
        
        elif choice == "2":
            url = input("Enter URL: ").strip()
            if url:
                await test_shallow_crawl(url)
        
        elif choice == "3":
            url = input("Enter URL: ").strip()
            if url:
                await test_with_patterns(url)
        
        elif choice == "4":
            url = input("Enter URL: ").strip()
            if url:
                await compare_depths(url)
        
        elif choice == "5":
            url = input("Enter URL: ").strip()
            if url:
                print("\nUsing quick_crawl convenience method...")
                result = await WebSpider.quick_crawl(url, max_depth=2)
                print(result)
                print(f"\nDiscovered {len(result.discovered_urls)} URLs")
        
        elif choice == "6":
            print("Exiting...")
            break
        
        else:
            print("Invalid choice!")


async def main():
    """Main test runner."""
    print("\n" + "="*80)
    print("WEB SPIDER TEST SUITE")
    print("="*80)
    
    # Check if URL provided as command line argument
    if len(sys.argv) > 1:
        url = sys.argv[1]
        print(f"\nTesting with provided URL: {url}")
        
        # Run basic test
        await test_basic_crawl(url, max_depth=2)
        
        # Optionally show pattern test
        print("\n" + "="*80)
        run_pattern_test = input("\nRun pattern-filtered test? (y/n): ").strip().lower()
        if run_pattern_test == 'y':
            await test_with_patterns(url)
    else:
        # Run interactive mode
        await interactive_test()


if __name__ == "__main__":
    asyncio.run(main())

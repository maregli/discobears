"""
Quick test for contextual external links feature.

This demonstrates how the spider detects important external links
like ticket sellers even when they're outside the main domain.
"""

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scraper.page_extractor import WebSpider, SpiderConfig


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)


async def test_contextual_links(url: str):
    """Test contextual external links detection."""
    print("\n" + "="*80)
    print("CONTEXTUAL EXTERNAL LINKS TEST")
    print("="*80)
    print(f"URL: {url}")
    print("\nThis test will find external links that are contextually important")
    print("(e.g., ticket sellers, even if they're on external domains)")
    print("="*80 + "\n")
    
    config = SpiderConfig(
        max_depth=1,  # Shallow crawl
        max_urls=50,
        same_domain_only=True,
        allow_contextual_external_links=True,  # KEY FEATURE
        contextual_keywords=[
            'ticket', 'tickets', 'buy', 'reserve', 'book', 'booking',
            'eventbrite', 'ticketmaster', 'shop', 'store', 'purchase'
        ],
        delay_between_requests=0.3
    )
    
    async with WebSpider(config) as spider:
        result = await spider.crawl(url)
    
    print("\n" + "-"*80)
    print("RESULTS")
    print("-"*80)
    print(f"Total discovered: {len(result.discovered_urls)} URLs")
    print(f"  - Internal: {len(result.discovered_urls) - len(result.external_contextual_urls)}")
    print(f"  - External (contextual): {len(result.external_contextual_urls)}")
    
    if result.external_contextual_urls:
        print("\n" + "="*80)
        print("🎫 EXTERNAL CONTEXTUAL LINKS FOUND:")
        print("="*80)
        print("These external links were kept because they match contextual keywords")
        print("(like 'ticket', 'buy', 'eventbrite', etc.)\n")
        
        for i, ext_url in enumerate(sorted(result.external_contextual_urls), 1):
            print(f"{i}. {ext_url}")
        
        print("\n💡 These links are INCLUDED in results but NOT crawled further")
        print("   (We don't want to spider all of Ticketmaster!)")
    else:
        print("\n⚠️  No external contextual links found.")
        print("   This might mean:")
        print("   - The site doesn't link to external ticket sellers")
        print("   - The keywords don't match")
        print("   - The site handles tickets internally")
    
    # Show some internal links for comparison
    internal_urls = result.discovered_urls - result.external_contextual_urls
    if internal_urls:
        print("\n" + "-"*80)
        print(f"INTERNAL LINKS (showing first 10 of {len(internal_urls)}):")
        print("-"*80)
        for i, internal_url in enumerate(sorted(internal_urls)[:10], 1):
            print(f"{i}. {internal_url}")
    
    return result


async def compare_with_without():
    """Compare crawl with and without contextual external links."""
    if len(sys.argv) < 2:
        print("Usage: python test_contextual_links.py <URL>")
        sys.exit(1)
    
    url = sys.argv[1]
    
    print("\n" + "="*80)
    print("COMPARISON: WITH vs WITHOUT contextual external links")
    print("="*80)
    
    # Test WITH contextual external links
    print("\n\n1️⃣  WITH contextual external links (default):")
    print("-"*80)
    config_with = SpiderConfig(
        max_depth=1,
        max_urls=50,
        allow_contextual_external_links=True
    )
    async with WebSpider(config_with) as spider:
        result_with = await spider.crawl(url)
    
    print(f"✓ Discovered {len(result_with.discovered_urls)} URLs")
    print(f"  - External contextual: {len(result_with.external_contextual_urls)}")
    
    # Test WITHOUT contextual external links
    print("\n\n2️⃣  WITHOUT contextual external links (strict):")
    print("-"*80)
    config_without = SpiderConfig(
        max_depth=1,
        max_urls=50,
        allow_contextual_external_links=False
    )
    async with WebSpider(config_without) as spider:
        result_without = await spider.crawl(url)
    
    print(f"✓ Discovered {len(result_without.discovered_urls)} URLs")
    print(f"  - External contextual: {len(result_without.external_contextual_urls)}")
    
    # Show difference
    print("\n" + "="*80)
    print("DIFFERENCE")
    print("="*80)
    diff = result_with.external_contextual_urls
    if diff:
        print(f"Found {len(diff)} additional external contextual URLs:")
        for url in sorted(diff):
            print(f"  🎫 {url}")
    else:
        print("No difference - site doesn't have contextual external links")


async def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python test_contextual_links.py <URL>")
        print("\nExample:")
        print("  python test_contextual_links.py https://www.mit-dir-festival.de/")
        sys.exit(1)
    
    url = sys.argv[1]
    
    # Run simple test
    await test_contextual_links(url)
    
    # Ask if user wants comparison
    print("\n" + "="*80)
    compare = input("\nRun comparison test (with vs without feature)? (y/n): ").strip().lower()
    if compare == 'y':
        await compare_with_without()


if __name__ == "__main__":
    asyncio.run(main())

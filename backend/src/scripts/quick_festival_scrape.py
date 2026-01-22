"""
Quick festival scraper - just provide a URL and go!

This is the simplest way to scrape a festival site:
- Smart defaults for festivals (lineup, tickets, etc.)
- Automatic 20 URL limit
- Async parallel extraction
- Clean markdown output
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scraper.page_extractor import (
    WebSpider,
    SpiderConfig,
    BatchProcessor,
    ExtractionConfig
)


async def quick_scrape(url: str, output_file: str = None):
    """Quick festival scrape with smart defaults."""
    
    if not output_file:
        # Generate filename from domain
        from urllib.parse import urlparse
        domain = urlparse(url).netloc.replace('www.', '').replace('.', '_')
        output_file = f"{domain}_output.md"
    
    print(f"\n🎵 Quick Festival Scraper")
    print(f"📍 URL: {url}")
    print(f"📄 Output: {output_file}")
    print(f"⚙️  Max URLs: 20 (async processing)\n")
    
    # STEP 1: Spider with festival-specific patterns
    print("🕷️  Step 1: Spidering...")
    config = SpiderConfig(
        max_depth=2,
        max_urls=100,
        url_patterns=[
            r'.*/lineup.*',
            r'.*/artists.*',
            r'.*/schedule.*',
            r'.*/timetable.*',
            r'.*/tickets.*',
            r'.*/info.*',
            r'.*/about.*',
            r'.*/location.*',
            r'.*/venue.*',
            r'.*/faq.*',
        ],
        allow_contextual_external_links=True
    )
    
    async with WebSpider(config) as spider:
        spider_result = await spider.crawl(url)
    
    print(f"   Found {len(spider_result.discovered_urls)} URLs "
          f"({spider_result.total_time_seconds:.1f}s)")
    
    if not spider_result.discovered_urls:
        print("❌ No URLs found. Site might not match patterns.")
        return
    
    # STEP 2: Extract markdown (max 20, async)
    print(f"📝 Step 2: Extracting markdown (max 20 URLs)...")
    
    processor = BatchProcessor(
        max_urls=20,
        max_concurrent=5,
        extraction_config=ExtractionConfig(
            browser_type="firefox",
            headless=True,
            stealth_mode=True,
            extraction_strategy="semantic"
        )
    )
    
    async with processor:
        batch_result = await processor.process_spider_result(
            spider_result,
            prioritize_patterns=['lineup', 'artists', 'tickets', 'info'],
            include_external_contextual=True
        )
    
    print(f"   Extracted {len(batch_result.successful)} pages "
          f"({batch_result.total_time_seconds:.1f}s)")
    
    if not batch_result.successful:
        print("❌ No pages successfully extracted.")
        return
    
    # STEP 3: Save
    print(f"💾 Step 3: Saving...")
    
    parts = [f"# {url}\n\n"]
    
    for i, page in enumerate(batch_result.successful, 1):
        parts.append(f"\n## {i}. {page.title or page.url}\n\n")
        parts.append(f"**URL:** {page.url}\n\n")
        parts.append(page.markdown)
        parts.append("\n\n---\n")
    
    output_path = Path(output_file)
    output_path.write_text("".join(parts))
    
    print(f"   Saved {len(''.join(parts)):,} chars to {output_path}")
    
    # Summary
    print(f"\n✅ Done!")
    print(f"   {len(batch_result.successful)} pages extracted")
    print(f"   Total time: {spider_result.total_time_seconds + batch_result.total_time_seconds:.1f}s")
    print(f"   Output: {output_path.absolute()}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\nUsage: python quick_festival_scrape.py <URL> [output.md]\n")
        print("Example:")
        print("  python quick_festival_scrape.py https://www.mit-dir-festival.de/\n")
        sys.exit(1)
    
    url = sys.argv[1]
    output = sys.argv[2] if len(sys.argv) > 2 else None
    
    asyncio.run(quick_scrape(url, output))

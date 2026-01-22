"""
Complete workflow: Spider + Batch Markdown Extraction

This is the main script for festival scraping:
1. Spider discovers URLs (with patterns + contextual external links)
2. Limit to 20 URLs (prioritizing important pages)
3. Async extract markdown from all 20 in parallel
4. Save combined results
"""

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scraper.page_extractor import (
    WebSpider,
    SpiderConfig,
    BatchProcessor,
    ExtractionConfig
)


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


async def spider_and_extract(
    start_url: str,
    max_urls: int = 20,
    max_depth: int = 2,
    url_patterns: list = None,
    output_file: str = "festival_output.md",
    include_external_contextual: bool = True
):
    """
    Complete workflow: Spider + Extract.
    
    Args:
        start_url: URL to start crawling
        max_urls: Maximum URLs to extract (default 20)
        max_depth: Spider depth (default 2)
        url_patterns: Optional URL patterns to filter
        output_file: Output markdown file
        include_external_contextual: Include ticket seller links
    """
    print("\n" + "="*80)
    print("FESTIVAL SCRAPER - SPIDER + EXTRACT WORKFLOW")
    print("="*80)
    print(f"Start URL: {start_url}")
    print(f"Max URLs to extract: {max_urls}")
    print(f"Spider depth: {max_depth}")
    print("="*80 + "\n")
    
    # =========================================================================
    # PHASE 1: SPIDER - Discover URLs
    # =========================================================================
    print("PHASE 1: DISCOVERING URLs WITH SPIDER")
    print("-"*80)
    
    spider_config = SpiderConfig(
        max_depth=max_depth,
        max_urls=100,  # Safety limit for spider
        url_patterns=url_patterns,
        allow_contextual_external_links=True,
        delay_between_requests=0.3
    )
    
    print(f"Spider config:")
    print(f"  - Max depth: {spider_config.max_depth}")
    print(f"  - URL patterns: {url_patterns or 'None (crawl all)'}")
    print(f"  - Contextual external links: {spider_config.allow_contextual_external_links}")
    print()
    
    async with WebSpider(spider_config) as spider:
        spider_result = await spider.crawl(start_url)
    
    print(f"\n✓ Spider completed:")
    print(f"  - Discovered: {len(spider_result.discovered_urls)} URLs")
    print(f"  - Visited: {len(spider_result.visited_urls)} URLs")
    print(f"  - External contextual: {len(spider_result.external_contextual_urls)} URLs")
    print(f"  - Failed: {len(spider_result.failed_urls)} URLs")
    print(f"  - Time: {spider_result.total_time_seconds:.2f}s")
    
    if not spider_result.discovered_urls:
        print("\n✗ No URLs discovered. Exiting.")
        return
    
    # Show discovered URLs
    print("\n📋 Discovered URLs:")
    for i, url in enumerate(sorted(spider_result.discovered_urls)[:30], 1):
        marker = "🎫" if url in spider_result.external_contextual_urls else "  "
        print(f"{marker} {i:2d}. {url}")
    
    if len(spider_result.discovered_urls) > 30:
        print(f"     ... and {len(spider_result.discovered_urls) - 30} more")
    
    # =========================================================================
    # PHASE 2: BATCH EXTRACT - Convert to Markdown (Async, Limited to 20)
    # =========================================================================
    print("\n" + "="*80)
    print(f"PHASE 2: EXTRACTING MARKDOWN (max {max_urls} URLs, async)")
    print("-"*80)
    
    # Determine if we need to limit
    will_skip = max(0, len(spider_result.discovered_urls) - max_urls)
    if will_skip > 0:
        print(f"⚠️  Found {len(spider_result.discovered_urls)} URLs, will process top {max_urls}")
        print(f"   (skipping {will_skip} URLs)")
    
    print()
    
    # Create batch processor
    extraction_config = ExtractionConfig(
        browser_type="firefox",
        headless=True,
        stealth_mode=True,
        extraction_strategy="semantic",
        wait_state="networkidle"
    )
    
    processor = BatchProcessor(
        max_urls=max_urls,
        max_concurrent=5,  # Process 5 pages at a time
        extraction_config=extraction_config
    )
    
    # Process URLs with prioritization
    prioritize_patterns = ['lineup', 'artists', 'tickets', 'info', 'about']
    
    async with processor:
        batch_result = await processor.process_spider_result(
            spider_result,
            prioritize_patterns=prioritize_patterns,
            include_external_contextual=include_external_contextual
        )
    
    print(f"\n✓ Batch extraction completed:")
    print(f"  - Successful: {len(batch_result.successful)}")
    print(f"  - Failed: {len(batch_result.failed)}")
    print(f"  - Skipped: {batch_result.skipped_count}")
    print(f"  - Time: {batch_result.total_time_seconds:.2f}s")
    
    if not batch_result.successful:
        print("\n✗ No pages successfully extracted. Exiting.")
        return
    
    # =========================================================================
    # PHASE 3: COMBINE AND SAVE
    # =========================================================================
    print("\n" + "="*80)
    print("PHASE 3: COMBINING AND SAVING RESULTS")
    print("-"*80)
    
    # Build combined markdown
    parts = []
    
    # Header
    parts.append(f"# Festival Content: {start_url}\n")
    parts.append(f"Scraped with spider_and_extract workflow\n")
    parts.append(f"Total pages extracted: {len(batch_result.successful)}\n")
    parts.append("\n---\n")
    
    # Add each page
    for i, page in enumerate(batch_result.successful, 1):
        parts.append(f"\n\n## Page {i}: {page.title or 'Untitled'}\n")
        parts.append(f"**URL:** {page.url}\n")
        parts.append(f"**Quality Score:** {page.content_quality_score:.1f}/100\n")
        parts.append(f"**Length:** {page.content_length} characters\n")
        parts.append(f"\n{page.markdown}\n")
        parts.append("\n---\n")
    
    # Add failed URLs if any
    if batch_result.failed:
        parts.append("\n\n## Failed URLs\n")
        for url, error in batch_result.failed:
            parts.append(f"- {url}\n")
            parts.append(f"  Error: {error}\n")
    
    # Add skipped count if any
    if batch_result.skipped_count > 0:
        parts.append(f"\n\n## Skipped URLs\n")
        parts.append(f"{batch_result.skipped_count} URLs were skipped (exceeded max_urls limit)\n")
    
    combined_markdown = "".join(parts)
    
    # Save to file
    output_path = Path(output_file)
    output_path.write_text(combined_markdown)
    
    print(f"✓ Saved to: {output_path.absolute()}")
    print(f"  Total size: {len(combined_markdown):,} characters")
    
    # =========================================================================
    # SUMMARY
    # =========================================================================
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Start URL: {start_url}")
    print(f"Spider discovered: {len(spider_result.discovered_urls)} URLs")
    print(f"  - Internal: {len(spider_result.discovered_urls) - len(spider_result.external_contextual_urls)}")
    print(f"  - External contextual: {len(spider_result.external_contextual_urls)}")
    print(f"Markdown extracted: {len(batch_result.successful)} pages")
    print(f"Failed extractions: {len(batch_result.failed)}")
    print(f"Skipped: {batch_result.skipped_count}")
    print(f"Output: {output_path.absolute()}")
    print(f"Total time: {spider_result.total_time_seconds + batch_result.total_time_seconds:.2f}s")
    print("="*80)


async def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python spider_and_extract.py <URL> [options]")
        print("\nExample:")
        print("  python spider_and_extract.py https://www.mit-dir-festival.de/")
        print("\nOptions:")
        print("  --max-urls N        Maximum URLs to extract (default: 20)")
        print("  --depth N           Spider depth (default: 2)")
        print("  --output FILE       Output file (default: festival_output.md)")
        print("  --no-external       Exclude external contextual links")
        print("\nAdvanced:")
        print("  --patterns lineup,tickets,info   Only crawl URLs matching these keywords")
        sys.exit(1)
    
    start_url = sys.argv[1]
    
    # Parse options
    max_urls = 20
    max_depth = 2
    output_file = "festival_output.md"
    include_external = True
    url_patterns = None
    
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == "--max-urls" and i + 1 < len(sys.argv):
            max_urls = int(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == "--depth" and i + 1 < len(sys.argv):
            max_depth = int(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == "--output" and i + 1 < len(sys.argv):
            output_file = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == "--no-external":
            include_external = False
            i += 1
        elif sys.argv[i] == "--patterns" and i + 1 < len(sys.argv):
            patterns = sys.argv[i + 1].split(',')
            url_patterns = [f'.*/{p}.*' for p in patterns]
            i += 2
        else:
            i += 1
    
    await spider_and_extract(
        start_url=start_url,
        max_urls=max_urls,
        max_depth=max_depth,
        url_patterns=url_patterns,
        output_file=output_file,
        include_external_contextual=include_external
    )


if __name__ == "__main__":
    asyncio.run(main())

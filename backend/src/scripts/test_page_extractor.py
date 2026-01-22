"""Test script for page extractor functionality."""

import asyncio
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from scraper.page_extractor import PageExtractor, ExtractionConfig


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


async def test_single_url(url: str, config: ExtractionConfig = None):
    """Test extraction on a single URL."""
    print("\n" + "="*80)
    print(f"Testing URL: {url}")
    print("="*80 + "\n")
    
    try:
        # Use context manager for automatic cleanup
        async with PageExtractor(config) as extractor:
            result = await extractor.extract(url, include_raw_html=False)
        
        # Print results
        print("\n" + "-"*80)
        print("EXTRACTION RESULTS")
        print("-"*80)
        print(f"URL: {result.url}")
        print(f"Title: {result.title}")
        print(f"Description: {result.description[:100] if result.description else 'N/A'}...")
        print(f"Content Length: {result.content_length} characters")
        print(f"Extraction Time: {result.fetch_duration_ms}ms")
        print(f"Quality Score: {result.content_quality_score:.2f}/100")
        print(f"Strategy: {result.extraction_strategy}")
        print(f"Links Found: {result.links_found}")
        print(f"Images Found: {result.images_found}")
        print(f"Headings Found: {result.headings_found}")
        print(f"Has Main Content: {result.has_main_content}")
        
        print("\n" + "-"*80)
        print("MARKDOWN PREVIEW (first 1000 chars)")
        print("-"*80)
        print(result.markdown[:1000])
        if len(result.markdown) > 1000:
            print(f"\n... ({len(result.markdown) - 1000} more characters)")
        
        # Optionally save to file
        output_file = Path("test_output.md")
        output_file.write_text(result.markdown)
        print(f"\n✓ Full markdown saved to: {output_file.absolute()}")
        
        return result
        
    except Exception as e:
        print(f"\n✗ Error during extraction: {e}")
        logging.exception("Extraction failed")
        return None


async def test_multiple_strategies(url: str):
    """Test different extraction strategies on the same URL."""
    print("\n" + "="*80)
    print(f"Testing different strategies on: {url}")
    print("="*80 + "\n")
    
    strategies = ["semantic", "simple"]
    results = []
    
    for strategy in strategies:
        print(f"\n--- Testing strategy: {strategy} ---")
        config = ExtractionConfig(extraction_strategy=strategy)
        
        try:
            result = await PageExtractor.extract_url(url, config)
            results.append((strategy, result))
            print(f"✓ {strategy}: {result.content_length} chars, quality={result.content_quality_score:.2f}")
        except Exception as e:
            print(f"✗ {strategy} failed: {e}")
    
    # Compare results
    if len(results) > 1:
        print("\n" + "-"*80)
        print("STRATEGY COMPARISON")
        print("-"*80)
        for strategy, result in results:
            print(f"{strategy:15} | {result.content_length:8} chars | quality: {result.content_quality_score:5.2f}")


async def test_different_browsers(url: str):
    """Test different browser types."""
    print("\n" + "="*80)
    print(f"Testing different browsers on: {url}")
    print("="*80 + "\n")
    
    browsers = ["firefox", "chromium"]
    
    for browser in browsers:
        print(f"\n--- Testing browser: {browser} ---")
        config = ExtractionConfig(browser_type=browser)
        
        try:
            result = await PageExtractor.extract_url(url, config)
            print(f"✓ {browser}: {result.content_length} chars in {result.fetch_duration_ms}ms")
        except Exception as e:
            print(f"✗ {browser} failed: {e}")


async def test_festival_sites():
    """Test on real festival/event websites."""
    print("\n" + "="*80)
    print("Testing on festival/event websites")
    print("="*80 + "\n")
    
    # Example festival sites (use real ones that are publicly available)
    test_sites = [
        {
            "url": "https://www.coachella.com",
            "name": "Coachella",
            "config": ExtractionConfig(
                wait_state="networkidle",
                timeout_ms=30000,
                extraction_strategy="semantic"
            )
        },
        {
            "url": "https://www.glastonburyfestivals.co.uk",
            "name": "Glastonbury",
            "config": ExtractionConfig(
                wait_state="networkidle",
                extraction_strategy="semantic"
            )
        },
    ]
    
    for site in test_sites:
        print(f"\n--- Testing: {site['name']} ---")
        try:
            result = await PageExtractor.extract_url(site['url'], site['config'])
            print(f"✓ {site['name']}: {result.content_length} chars")
            print(f"  Title: {result.title}")
            print(f"  Quality: {result.content_quality_score:.2f}")
            
            # Save each to a separate file
            output_file = Path(f"test_{site['name'].lower()}.md")
            output_file.write_text(result.markdown)
            print(f"  Saved to: {output_file}")
            
        except Exception as e:
            print(f"✗ {site['name']} failed: {e}")


async def interactive_test():
    """Interactive testing mode."""
    print("\n" + "="*80)
    print("INTERACTIVE PAGE EXTRACTOR TEST")
    print("="*80)
    
    while True:
        print("\nOptions:")
        print("1. Test a single URL")
        print("2. Test with different strategies")
        print("3. Test with different browsers")
        print("4. Test festival sites")
        print("5. Exit")
        
        choice = input("\nEnter choice (1-5): ").strip()
        
        if choice == "1":
            url = input("Enter URL: ").strip()
            if url:
                await test_single_url(url)
        
        elif choice == "2":
            url = input("Enter URL: ").strip()
            if url:
                await test_multiple_strategies(url)
        
        elif choice == "3":
            url = input("Enter URL: ").strip()
            if url:
                await test_different_browsers(url)
        
        elif choice == "4":
            await test_festival_sites()
        
        elif choice == "5":
            print("Exiting...")
            break
        
        else:
            print("Invalid choice!")


async def main():
    """Main test runner."""
    print("\n" + "="*80)
    print("PAGE EXTRACTOR TEST SUITE")
    print("="*80)
    
    # Check if URL provided as command line argument
    if len(sys.argv) > 1:
        url = sys.argv[1]
        print(f"\nTesting with provided URL: {url}")
        await test_single_url(url)
    else:
        # Run interactive mode
        await interactive_test()


if __name__ == "__main__":
    asyncio.run(main())

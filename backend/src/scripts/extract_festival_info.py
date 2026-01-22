"""
Extract structured festival information from markdown using langextract.

Extracts:
- Ticket price (for full festival/all days)
- Lineup artists
- Location

All fields are optional - if info isn't found, it won't be extracted.
"""

import asyncio
import sys
from pathlib import Path
from typing import Optional
import os

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Install langextract if needed
try:
    import langextract as lx
except ImportError:
    print("langextract not found. Installing...")
    os.system("pip install ../langextract")
    import langextract as lx


def extract_festival_info(
    markdown_file: str,
    provider: str = "openai",
    model_id: str = None,
    api_key: Optional[str] = None
):
    """
    Extract festival information from markdown file.
    
    Args:
        markdown_file: Path to markdown file with festival content
        provider: LLM provider - "openai" (default), "ollama", or "gemini"
        model_id: Model to use (auto-selected based on provider if None)
        api_key: API key for OpenAI/Gemini (or set via env var)
    
    Returns:
        Result with extractions
    """
    
    # Read markdown
    markdown_path = Path(markdown_file)
    if not markdown_path.exists():
        raise FileNotFoundError(f"Markdown file not found: {markdown_file}")
    
    markdown_text = markdown_path.read_text()
    
    print(f"📄 Reading: {markdown_file}")
    print(f"📏 Length: {len(markdown_text):,} characters\n")
    
    # =========================================================================
    # Define extraction task
    # =========================================================================
    
    prompt_description = """
Extract festival information in the order it appears in the text.
Use EXACT text from the markdown - do not paraphrase.

Extract these entity types:
1. ticket_price: Full festival ticket price (weekend pass or all-days ticket)
2. artist: Musicians/bands/DJs performing at the festival
3. location: Festival location (city, venue, or site name)

IMPORTANT: Only extract information if it's clearly stated in the text.
If information is not available, simply don't extract it.
"""
    
    # =========================================================================
    # Provide example to guide the model
    # =========================================================================
    
    # Create a realistic example that demonstrates the extraction pattern
    examples = [
        lx.data.ExampleData(
            text="""
# Beispiel Festival 2025

Tickets gibt es ab 150€ für das Wochenende.
Es gibt auch ein Soli-Ticket für 120€.

## Location
Das Festival findet in der Musterstadt am Beispielsee statt.

## Lineup
Dieses Jahr spielen:
- The Example Band
- DJ Sample
- Die Testgruppe
            """.strip(),
            extractions=[
                # Ticket prices (in order of appearance)
                lx.data.Extraction(
                    extraction_class="ticket_price",
                    extraction_text="150€",
                    attributes={"ticket_type": "weekend"}
                ),
                lx.data.Extraction(
                    extraction_class="ticket_price",
                    extraction_text="120€",
                    attributes={"ticket_type": "soli"}
                ),
                # Location
                lx.data.Extraction(
                    extraction_class="location",
                    extraction_text="Musterstadt am Beispielsee"
                ),
                # Artists (in order of appearance)
                lx.data.Extraction(
                    extraction_class="artist",
                    extraction_text="The Example Band"
                ),
                lx.data.Extraction(
                    extraction_class="artist",
                    extraction_text="DJ Sample"
                ),
                lx.data.Extraction(
                    extraction_class="artist",
                    extraction_text="Die Testgruppe"
                ),
            ]
        )
    ]
    
    # =========================================================================
    # Run extraction
    # =========================================================================
    
    # Set default model IDs if not specified
    if model_id is None:
        if provider == "openai":
            model_id = "gpt-4o-mini"  # Fast and cheap
        elif provider == "ollama":
            model_id = "llama3.2:latest"
        else:  # gemini
            model_id = "gemini-2.5-flash"
    
    # Get API key from env if not provided
    if api_key is None:
        if provider == "openai":
            api_key = os.environ.get('OPENAI_API_KEY')
        elif provider == "gemini":
            api_key = os.environ.get('LANGEXTRACT_API_KEY')
    
    print("🔍 Extracting festival information...")
    print(f"   Provider: {provider.upper()}")
    print(f"   Model: {model_id}\n")
    
    # Configure based on provider
    if provider == "openai":
        # OpenAI
        if not api_key:
            print("⚠️  Warning: OPENAI_API_KEY not set")
            print("   Set it with: export OPENAI_API_KEY='your-key'\n")
        
        result = lx.extract(
            text_or_documents=markdown_text,
            prompt_description=prompt_description,
            examples=examples,
            model_id=model_id,
            api_key=api_key,
            fence_output=True,  # Required for OpenAI
            use_schema_constraints=False,  # Required for OpenAI
        )
    
    elif provider == "ollama":
        # Local Ollama
        result = lx.extract(
            text_or_documents=markdown_text,
            prompt_description=prompt_description,
            examples=examples,
            model_id=model_id,
            model_url="http://localhost:11434",
            fence_output=True,
            use_schema_constraints=False,
            max_char_buffer=3000,
        )
    
    else:  # gemini
        # Google Gemini
        if not api_key:
            print("⚠️  Warning: LANGEXTRACT_API_KEY not set")
            print("   Set it with: export LANGEXTRACT_API_KEY='your-key'\n")
        
        result = lx.extract(
            text_or_documents=markdown_text,
            prompt_description=prompt_description,
            examples=examples,
            model_id=model_id,
            api_key=api_key,
        )
    
    return result


def display_results(result):
    """Display extracted festival information in a structured way."""
    
    print("\n" + "="*80)
    print("EXTRACTION RESULTS")
    print("="*80 + "\n")
    
    if not result.extractions:
        print("⚠️  No information extracted.\n")
        return
    
    # Group by extraction class
    ticket_prices = []
    artists = []
    locations = []
    
    for extraction in result.extractions:
        if extraction.extraction_class == "ticket_price":
            ticket_prices.append(extraction)
        elif extraction.extraction_class == "artist":
            artists.append(extraction)
        elif extraction.extraction_class == "location":
            locations.append(extraction)
    
    # Display ticket prices
    if ticket_prices:
        print("💰 TICKET PRICES:")
        for price in ticket_prices:
            ticket_type = ""
            if price.attributes and "ticket_type" in price.attributes:
                ticket_type = f" ({price.attributes['ticket_type']})"
            
            position = ""
            if price.char_interval:
                position = f" [pos: {price.char_interval.start_pos}-{price.char_interval.end_pos}]"
            
            print(f"   • {price.extraction_text}{ticket_type}{position}")
        print()
    else:
        print("💰 TICKET PRICES: Not found\n")
    
    # Display location
    if locations:
        print("📍 LOCATION:")
        for loc in locations:
            position = ""
            if loc.char_interval:
                position = f" [pos: {loc.char_interval.start_pos}-{loc.char_interval.end_pos}]"
            print(f"   • {loc.extraction_text}{position}")
        print()
    else:
        print("📍 LOCATION: Not found\n")
    
    # Display artists
    if artists:
        print(f"🎵 LINEUP ({len(artists)} artists):")
        for artist in artists[:20]:  # Show first 20
            position = ""
            if artist.char_interval:
                position = f" [pos: {artist.char_interval.start_pos}-{artist.char_interval.end_pos}]"
            print(f"   • {artist.extraction_text}{position}")
        
        if len(artists) > 20:
            print(f"   ... and {len(artists) - 20} more")
        print()
    else:
        print("🎵 LINEUP: Not found\n")
    
    # Summary
    print("-"*80)
    print(f"Total extractions: {len(result.extractions)}")
    print(f"  - Ticket prices: {len(ticket_prices)}")
    print(f"  - Locations: {len(locations)}")
    print(f"  - Artists: {len(artists)}")


def save_results(result, output_file: str):
    """Save results to JSONL file."""
    output_path = Path(output_file)
    
    print(f"\n💾 Saving results to: {output_path}")
    
    lx.io.save_annotated_documents(
        [result],
        output_name=output_path.stem,
        output_dir=str(output_path.parent)
    )
    
    print(f"✓ Saved to: {output_path.absolute()}")


def main():
    """Main entry point."""
    
    if len(sys.argv) < 2:
        print("Usage: python extract_festival_info.py <markdown_file> [output.jsonl] [options]")
        print("\nExample:")
        print("  python extract_festival_info.py mit-dir-festival_de_output.md")
        print("  python extract_festival_info.py file.md output.jsonl --ollama")
        print("\nProvider Options (choose one):")
        print("  --openai      Use OpenAI (default, requires OPENAI_API_KEY)")
        print("  --ollama      Use local Ollama")
        print("  --gemini      Use Google Gemini (requires LANGEXTRACT_API_KEY)")
        print("\nOther Options:")
        print("  --model NAME  Specify model (default: gpt-4o-mini for OpenAI)")
        print("\nAPI Keys:")
        print("  OpenAI: export OPENAI_API_KEY='your-key'")
        print("  Gemini: export LANGEXTRACT_API_KEY='your-key'")
        print("\nDefault: Uses OpenAI with gpt-4o-mini")
        sys.exit(1)
    
    markdown_file = sys.argv[1]
    output_file = "festival_info.jsonl"
    provider = "openai"  # Default to OpenAI
    model_id = None  # Auto-select based on provider
    
    # Parse arguments
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == "--openai":
            provider = "openai"
            i += 1
        elif sys.argv[i] == "--ollama":
            provider = "ollama"
            i += 1
        elif sys.argv[i] == "--gemini":
            provider = "gemini"
            i += 1
        elif sys.argv[i] == "--model" and i + 1 < len(sys.argv):
            model_id = sys.argv[i + 1]
            i += 2
        elif not sys.argv[i].startswith("--"):
            output_file = sys.argv[i]
            i += 1
        else:
            i += 1
    
    try:
        # Extract
        result = extract_festival_info(
            markdown_file=markdown_file,
            provider=provider,
            model_id=model_id
        )
        
        # Display
        display_results(result)
        
        # Save
        save_results(result, output_file)
        
        print("\n✅ Done!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        
        # Provide helpful suggestions based on error type
        if "extractions" in str(e).lower():
            print("\n" + "="*80)
            print("💡 FORMATTING ERROR: LLM output isn't structured correctly")
            print("="*80)
            if provider == "ollama":
                print("\n🔧 Ollama troubleshooting:")
                print("   1. Try a larger model:")
                print("      ollama pull llama3.1:8b")
                print(f"      python {sys.argv[0]} {markdown_file} --ollama --model llama3.1:8b")
                print("\n   2. Or use OpenAI (more reliable):")
                print(f"      python {sys.argv[0]} {markdown_file}")
            else:
                print(f"\n🔧 Current provider: {provider}")
                print("   Try a different provider:")
                print(f"   - OpenAI: python {sys.argv[0]} {markdown_file} --openai")
                print(f"   - Gemini: python {sys.argv[0]} {markdown_file} --gemini")
            print("="*80)
        elif "api" in str(e).lower() or "key" in str(e).lower():
            print("\n" + "="*80)
            print("💡 API KEY ERROR")
            print("="*80)
            if provider == "openai":
                print("\nSet your OpenAI API key:")
                print("  export OPENAI_API_KEY='your-key'")
                print("  Get key from: https://platform.openai.com/api-keys")
            elif provider == "gemini":
                print("\nSet your Gemini API key:")
                print("  export LANGEXTRACT_API_KEY='your-key'")
                print("  Get key from: https://aistudio.google.com/app/apikey")
            print("="*80)
        else:
            import traceback
            traceback.print_exc()
        
        sys.exit(1)


if __name__ == "__main__":
    main()

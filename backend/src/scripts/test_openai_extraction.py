"""
Quick test to verify OpenAI extraction works.

This tests the festival extraction with OpenAI before
running on the full markdown.
"""

import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import langextract as lx
except ImportError:
    print("Installing langextract...")
    os.system("pip install ../langextract")
    import langextract as lx


def test_openai():
    """Test festival extraction with OpenAI."""
    
    print("\n" + "="*80)
    print("TESTING OPENAI EXTRACTION")
    print("="*80)
    
    # Check API key
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        print("\n❌ Error: OPENAI_API_KEY not set")
        print("\nPlease set your OpenAI API key:")
        print("  export OPENAI_API_KEY='your-key-here'")
        print("\nGet a key from: https://platform.openai.com/api-keys")
        return False
    
    print(f"\n✓ API key found: {api_key[:8]}...{api_key[-4:]}")
    
    # Small test text
    test_text = """
MIT DIR Festival 2025

Tickets:
- Regular ticket: 180€ for the full festival weekend
- Soli-Ticket: 130€ (subsidized ticket)

Location: Klingemühle near Müllrose, Brandenburg

Lineup:
- The Test Band
- DJ Sample
- Die Beispielgruppe
    """
    
    print("\n📄 Test text:")
    print(test_text)
    print("\n" + "-"*80)
    
    # Define extraction
    prompt = """
Extract festival information:
- ticket_price: Price for festival ticket (full festival/weekend pass)
- location: Where the festival takes place
- artist: Musicians/bands/DJs performing

Use EXACT text from the input. If info is missing, don't extract it.
"""
    
    examples = [
        lx.data.ExampleData(
            text="Festival X costs 150€ in Berlin. Artists: The Band, DJ Test.",
            extractions=[
                lx.data.Extraction(
                    extraction_class="ticket_price",
                    extraction_text="150€",
                    attributes={"ticket_type": "regular"}
                ),
                lx.data.Extraction(
                    extraction_class="location",
                    extraction_text="Berlin"
                ),
                lx.data.Extraction(
                    extraction_class="artist",
                    extraction_text="The Band"
                ),
                lx.data.Extraction(
                    extraction_class="artist",
                    extraction_text="DJ Test"
                ),
            ]
        )
    ]
    
    print("🔍 Running extraction with OpenAI...")
    print("   Model: gpt-4o-mini")
    print("   (Fast and cost-effective)\n")
    
    try:
        result = lx.extract(
            text_or_documents=test_text,
            prompt_description=prompt,
            examples=examples,
            model_id="gpt-4o-mini",
            api_key=api_key,
            fence_output=True,
            use_schema_constraints=False,
        )
        
        print("✓ Extraction completed!\n")
        print("="*80)
        print("RESULTS")
        print("="*80)
        
        if not result.extractions:
            print("\n⚠️  No extractions found")
            return False
        
        # Group by type
        prices = [e for e in result.extractions if e.extraction_class == "ticket_price"]
        locations = [e for e in result.extractions if e.extraction_class == "location"]
        artists = [e for e in result.extractions if e.extraction_class == "artist"]
        
        print(f"\n💰 Ticket Prices ({len(prices)}):")
        for p in prices:
            attrs = f" [{p.attributes}]" if p.attributes else ""
            print(f"   • {p.extraction_text}{attrs}")
        
        print(f"\n📍 Location ({len(locations)}):")
        for l in locations:
            print(f"   • {l.extraction_text}")
        
        print(f"\n🎵 Artists ({len(artists)}):")
        for a in artists:
            print(f"   • {a.extraction_text}")
        
        print(f"\n{'='*80}")
        print(f"Total extractions: {len(result.extractions)}")
        print("\n✅ Test PASSED! OpenAI extraction is working.")
        print("\nYou can now run on your full markdown:")
        print("  python src/scripts/extract_festival_info.py mit-dir-festival_de_output.md")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        
        print("\n💡 Troubleshooting:")
        print("   1. Check API key is valid: https://platform.openai.com/api-keys")
        print("   2. Check you have API credits: https://platform.openai.com/usage")
        print("   3. Try with a different model: --model gpt-4o")
        
        return False


if __name__ == "__main__":
    success = test_openai()
    sys.exit(0 if success else 1)

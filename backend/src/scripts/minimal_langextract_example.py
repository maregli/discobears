"""
MINIMAL LANGEXTRACT EXAMPLE

This is the simplest possible example showing how to extract
festival information with optional fields.
"""

import langextract as lx


def minimal_example():
    """Minimal festival extraction example."""
    
    # =========================================================================
    # 1. YOUR INPUT TEXT (from markdown file)
    # =========================================================================
    
    input_text = """
    MIT DIR Festival 2025
    
    Tickets:
    - Regular ticket: 180€
    - Soli-Ticket: 130€
    
    Location: Klingemühle, near Müllrose
    
    Lineup coming soon...
    """
    
    # =========================================================================
    # 2. DEFINE WHAT TO EXTRACT (with example)
    # =========================================================================
    
    prompt = """
Extract festival information:
- ticket_price: Price for festival ticket
- location: Where the festival takes place
- artist: Musicians/bands performing

Use EXACT text. If info is missing, don't extract it.
"""
    
    examples = [
        lx.data.ExampleData(
            text="Festival X costs 150€ in Berlin. Artist: The Band.",
            extractions=[
                lx.data.Extraction(
                    extraction_class="ticket_price",
                    extraction_text="150€"
                ),
                lx.data.Extraction(
                    extraction_class="location",
                    extraction_text="Berlin"
                ),
                lx.data.Extraction(
                    extraction_class="artist",
                    extraction_text="The Band"
                ),
            ]
        )
    ]
    
    # =========================================================================
    # 3. RUN EXTRACTION (using OpenAI)
    # =========================================================================
    
    result = lx.extract(
        text_or_documents=input_text,
        prompt_description=prompt,
        examples=examples,
        model_id="gpt-4o-mini",  # Fast and cheap OpenAI model
        # api_key="your-key"  # Or set OPENAI_API_KEY env var
        fence_output=True,
        use_schema_constraints=False,
    )
    
    # =========================================================================
    # ALTERNATIVE: Use local Ollama instead
    # =========================================================================
    # result = lx.extract(
    #     text_or_documents=input_text,
    #     prompt_description=prompt,
    #     examples=examples,
    #     model_id="llama3.2:latest",
    #     model_url="http://localhost:11434",
    #     fence_output=True,
    #     use_schema_constraints=False,
    # )
    
    # =========================================================================
    # 4. ACCESS RESULTS
    # =========================================================================
    
    print("Extracted information:")
    for extraction in result.extractions:
        print(f"  {extraction.extraction_class}: {extraction.extraction_text}")
    
    # Expected output:
    # ticket_price: 180€
    # ticket_price: 130€
    # location: Klingemühle, near Müllrose
    # (no artists - they weren't in the text, so nothing extracted!)


if __name__ == "__main__":
    minimal_example()

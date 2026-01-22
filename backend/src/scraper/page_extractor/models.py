"""Data models for page extraction."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class ExtractionConfig:
    """Configuration for page extraction."""
    
    # Browser settings
    browser_type: str = "firefox"  # "firefox" or "chromium"
    headless: bool = True
    stealth_mode: bool = True
    timeout_ms: int = 30000
    wait_state: str = "networkidle"  # "domcontentloaded", "load", or "networkidle"
    
    # Content extraction
    extraction_strategy: str = "semantic"  # "semantic" or "simple"
    min_content_length: int = 100
    max_content_length: int = 500000
    
    # Scrolling (for infinite-scroll pages)
    scrolls: int = 0
    scroll_delay_ms: int = 2000
    
    # Iframe handling
    include_iframes: bool = False
    
    # Custom selectors (optional)
    wait_for_selector: Optional[str] = None
    content_selector: Optional[str] = None  # Force specific content area


@dataclass
class ExtractedPage:
    """Result of page extraction."""
    
    url: str
    markdown: str
    raw_html: Optional[str] = None
    
    # Metadata
    title: Optional[str] = None
    description: Optional[str] = None
    content_length: int = 0
    extracted_at: str = field(default_factory=lambda: datetime.now().isoformat())
    fetch_duration_ms: int = 0
    extraction_strategy: str = "semantic"
    
    # Statistics
    links_found: int = 0
    images_found: int = 0
    headings_found: int = 0
    
    # Quality indicators
    content_quality_score: float = 0.0
    has_main_content: bool = False
    
    def __str__(self) -> str:
        return (
            f"ExtractedPage(\n"
            f"  url={self.url}\n"
            f"  title={self.title}\n"
            f"  content_length={self.content_length}\n"
            f"  quality_score={self.content_quality_score:.2f}\n"
            f"  extraction_strategy={self.extraction_strategy}\n"
            f")"
        )

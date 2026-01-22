"""Main page extractor orchestrator."""

import asyncio
import logging
import time
from typing import Optional

from .models import ExtractedPage, ExtractionConfig
from .fetcher import BrowserFetcher, FetchError
from .extractor import ContentExtractor, ExtractionError
from .converter import MarkdownConverter
from .cleaner import MarkdownCleaner

logger = logging.getLogger(__name__)


class PageExtractor:
    """
    Main orchestrator for extracting clean markdown from web pages.
    
    Usage:
        # Async context manager (recommended)
        async with PageExtractor() as extractor:
            result = await extractor.extract("https://example.com")
        
        # Manual lifecycle
        extractor = PageExtractor()
        await extractor.start()
        result = await extractor.extract("https://example.com")
        await extractor.close()
        
        # One-shot extraction
        result = await PageExtractor.extract_url("https://example.com")
    """
    
    def __init__(self, config: Optional[ExtractionConfig] = None):
        """
        Initialize page extractor.
        
        Args:
            config: Extraction configuration (uses defaults if None)
        """
        self.config = config or ExtractionConfig()
        
        # Initialize components
        self.fetcher = BrowserFetcher(self.config)
        self.content_extractor = ContentExtractor(self.config)
        self.markdown_converter = MarkdownConverter(self.config)
        self.cleaner = MarkdownCleaner(self.config)
        
        self._browser_started = False
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
    
    async def start(self):
        """Initialize browser (call before extract if not using context manager)."""
        if not self._browser_started:
            await self.fetcher.start()
            self._browser_started = True
            logger.info("PageExtractor initialized")
    
    async def close(self):
        """Close browser and cleanup."""
        if self._browser_started:
            await self.fetcher.close()
            self._browser_started = False
            logger.info("PageExtractor closed")
    
    async def extract(
        self,
        url: str,
        include_raw_html: bool = False
    ) -> ExtractedPage:
        """
        Extract markdown content from a URL.
        
        Args:
            url: URL to extract from
            include_raw_html: Whether to include raw HTML in result
            
        Returns:
            ExtractedPage with markdown and metadata
            
        Raises:
            FetchError: If page fetching fails
            ExtractionError: If content extraction fails
        """
        logger.info(f"Starting extraction for: {url}")
        start_time = time.time()
        
        try:
            # Step 1: Fetch HTML
            logger.info("[1/4] Fetching HTML with Playwright...")
            html = await self.fetcher.fetch(url)
            
            # Step 2: Extract main content
            logger.info("[2/4] Extracting main content with BeautifulSoup...")
            soup, content_element, metadata = self.content_extractor.extract(html)
            
            # Calculate quality score
            content_text = content_element.get_text(strip=True)
            quality_score = self._calculate_quality_score(content_element, metadata)
            
            # Step 3: Convert to markdown
            logger.info("[3/4] Converting to Markdown...")
            markdown = self.markdown_converter.convert(content_element, url)
            
            # Step 4: Clean markdown
            logger.info("[4/4] Cleaning and post-processing...")
            markdown = self.cleaner.clean(markdown)
            
            # Calculate duration
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Create result
            result = ExtractedPage(
                url=url,
                markdown=markdown,
                raw_html=html if include_raw_html else None,
                title=metadata.get("title"),
                description=metadata.get("description"),
                content_length=len(markdown),
                fetch_duration_ms=duration_ms,
                extraction_strategy=self.config.extraction_strategy,
                links_found=metadata.get("links_found", 0),
                images_found=metadata.get("images_found", 0),
                headings_found=metadata.get("headings_found", 0),
                content_quality_score=quality_score,
                has_main_content=quality_score > 50.0,
            )
            
            logger.info(
                f"Extraction completed in {duration_ms}ms: "
                f"{len(markdown)} chars, quality={quality_score:.2f}"
            )
            
            return result
            
        except FetchError as e:
            logger.error(f"Fetch error for {url}: {e}")
            raise
        except ExtractionError as e:
            logger.error(f"Extraction error for {url}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error extracting {url}: {e}")
            raise ExtractionError(f"Unexpected error: {e}")
    
    def _calculate_quality_score(self, content_element, metadata: dict) -> float:
        """Calculate content quality score (0-100)."""
        score = 0.0
        
        # Length score (up to 30 points)
        text = content_element.get_text(strip=True)
        length_score = min(len(text) / 100, 30)
        score += length_score
        
        # Structure score (up to 40 points)
        paragraphs = len(content_element.find_all("p"))
        headings = metadata.get("headings_found", 0)
        structure_score = min(paragraphs * 2 + headings * 3, 40)
        score += structure_score
        
        # Semantic score (up to 30 points)
        has_main = bool(content_element.find_parent("main"))
        has_article = bool(content_element.find_parent("article"))
        if has_main or has_article:
            score += 30
        elif content_element.name in ["main", "article"]:
            score += 30
        else:
            score += 10  # Base score for any content
        
        return min(score, 100.0)
    
    @classmethod
    async def extract_url(
        cls,
        url: str,
        config: Optional[ExtractionConfig] = None,
        include_raw_html: bool = False
    ) -> ExtractedPage:
        """
        One-shot extraction (convenience method).
        
        Args:
            url: URL to extract
            config: Optional custom configuration
            include_raw_html: Whether to include raw HTML
            
        Returns:
            ExtractedPage result
        """
        async with cls(config) as extractor:
            return await extractor.extract(url, include_raw_html)

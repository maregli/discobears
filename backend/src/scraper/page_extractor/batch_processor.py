"""Batch processor for extracting markdown from multiple URLs in parallel."""

import asyncio
import logging
from typing import List, Set, Optional
from dataclasses import dataclass, field

from .spider import SpiderResult
from .page_extractor import PageExtractor
from .models import ExtractedPage, ExtractionConfig

logger = logging.getLogger(__name__)


@dataclass
class BatchResult:
    """Result of batch markdown extraction."""
    
    successful: List[ExtractedPage] = field(default_factory=list)
    failed: List[tuple[str, str]] = field(default_factory=list)  # (url, error)
    skipped_count: int = 0
    total_time_seconds: float = 0.0
    
    def __str__(self) -> str:
        return (
            f"BatchResult(\n"
            f"  successful={len(self.successful)}\n"
            f"  failed={len(self.failed)}\n"
            f"  skipped={self.skipped_count}\n"
            f"  time={self.total_time_seconds:.2f}s\n"
            f")"
        )


class BatchProcessor:
    """
    Process multiple URLs to markdown in parallel.
    
    Usage:
        processor = BatchProcessor(max_urls=20)
        async with processor:
            result = await processor.process_urls(urls)
    """
    
    def __init__(
        self,
        max_urls: int = 20,
        max_concurrent: int = 5,
        extraction_config: Optional[ExtractionConfig] = None
    ):
        """
        Initialize batch processor.
        
        Args:
            max_urls: Maximum number of URLs to process
            max_concurrent: Maximum concurrent extractions
            extraction_config: Configuration for PageExtractor
        """
        self.max_urls = max_urls
        self.max_concurrent = max_concurrent
        
        # Create extractor config
        self.extraction_config = extraction_config or ExtractionConfig(
            browser_type="firefox",
            headless=True,
            stealth_mode=True,
            extraction_strategy="semantic",
            wait_state="networkidle"
        )
        
        self.extractor = PageExtractor(self.extraction_config)
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self.extractor.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.extractor.close()
    
    async def process_urls(self, urls: Set[str]) -> BatchResult:
        """
        Process multiple URLs to markdown in parallel.
        
        Args:
            urls: Set of URLs to process
            
        Returns:
            BatchResult with successful and failed extractions
        """
        import time
        start_time = time.time()
        
        # Limit to max_urls
        urls_to_process = list(urls)[:self.max_urls]
        skipped = len(urls) - len(urls_to_process)
        
        if skipped > 0:
            logger.info(f"Processing {len(urls_to_process)} URLs (skipped {skipped})")
        else:
            logger.info(f"Processing {len(urls_to_process)} URLs")
        
        # Create semaphore for concurrency control
        semaphore = asyncio.Semaphore(self.max_concurrent)
        
        # Process all URLs concurrently (with semaphore limit)
        tasks = [
            self._process_single_url(url, i+1, len(urls_to_process), semaphore)
            for i, url in enumerate(urls_to_process)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Separate successful and failed
        successful = []
        failed = []
        
        for url, result in zip(urls_to_process, results):
            if isinstance(result, Exception):
                failed.append((url, str(result)))
            elif isinstance(result, ExtractedPage):
                successful.append(result)
            else:
                failed.append((url, "Unknown error"))
        
        duration = time.time() - start_time
        
        batch_result = BatchResult(
            successful=successful,
            failed=failed,
            skipped_count=skipped,
            total_time_seconds=duration
        )
        
        logger.info(f"Batch processing complete: {batch_result}")
        
        return batch_result
    
    async def _process_single_url(
        self,
        url: str,
        index: int,
        total: int,
        semaphore: asyncio.Semaphore
    ) -> ExtractedPage:
        """Process a single URL with semaphore control."""
        async with semaphore:
            logger.info(f"[{index}/{total}] Extracting: {url}")
            
            try:
                result = await self.extractor.extract(url)
                logger.info(
                    f"[{index}/{total}] ✓ {url} - "
                    f"{result.content_length} chars, "
                    f"quality: {result.content_quality_score:.1f}"
                )
                return result
            except Exception as e:
                logger.error(f"[{index}/{total}] ✗ {url} - {e}")
                raise
    
    async def process_spider_result(
        self,
        spider_result: SpiderResult,
        prioritize_patterns: Optional[List[str]] = None,
        include_external_contextual: bool = True
    ) -> BatchResult:
        """
        Process URLs from spider result with smart prioritization.
        
        Args:
            spider_result: Result from WebSpider
            prioritize_patterns: URL patterns to prioritize (e.g., ['lineup', 'tickets'])
            include_external_contextual: Whether to include external ticket links
            
        Returns:
            BatchResult
        """
        # Determine which URLs to process
        urls_to_process = set(spider_result.discovered_urls)
        
        if not include_external_contextual:
            # Remove external contextual URLs
            urls_to_process -= spider_result.external_contextual_urls
            logger.info(
                f"Excluding {len(spider_result.external_contextual_urls)} "
                f"external contextual URLs"
            )
        
        # Prioritize certain URLs
        if prioritize_patterns and len(urls_to_process) > self.max_urls:
            priority_urls = self._prioritize_urls(
                urls_to_process,
                prioritize_patterns
            )
            logger.info(
                f"Prioritized {len(priority_urls)} URLs matching patterns: "
                f"{prioritize_patterns}"
            )
        else:
            priority_urls = list(urls_to_process)
        
        return await self.process_urls(set(priority_urls))
    
    def _prioritize_urls(
        self,
        urls: Set[str],
        patterns: List[str]
    ) -> List[str]:
        """
        Prioritize URLs matching patterns, then fill with others up to max_urls.
        
        Args:
            urls: Set of all URLs
            patterns: Keywords to prioritize (e.g., ['lineup', 'tickets'])
            
        Returns:
            Prioritized list of URLs (max length = max_urls)
        """
        priority = []
        other = []
        
        for url in urls:
            url_lower = url.lower()
            if any(pattern.lower() in url_lower for pattern in patterns):
                priority.append(url)
            else:
                other.append(url)
        
        # Take priority first, then fill with others
        result = priority[:self.max_urls]
        remaining = self.max_urls - len(result)
        if remaining > 0:
            result.extend(other[:remaining])
        
        return result
    
    @classmethod
    async def quick_process(
        cls,
        urls: Set[str],
        max_urls: int = 20,
        max_concurrent: int = 5
    ) -> BatchResult:
        """
        Convenience method for quick batch processing.
        
        Args:
            urls: URLs to process
            max_urls: Maximum URLs to process
            max_concurrent: Maximum concurrent extractions
            
        Returns:
            BatchResult
        """
        async with cls(max_urls=max_urls, max_concurrent=max_concurrent) as processor:
            return await processor.process_urls(urls)

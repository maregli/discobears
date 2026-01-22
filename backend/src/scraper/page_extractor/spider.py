"""Web spider for discovering URLs on a website."""

import asyncio
import logging
import re
from typing import Optional, Set, List, Callable
from urllib.parse import urlparse, urljoin
from dataclasses import dataclass, field

from bs4 import BeautifulSoup

from .models import ExtractionConfig
from .fetcher import BrowserFetcher, FetchError

logger = logging.getLogger(__name__)


@dataclass
class LinkContext:
    """Context information about a discovered link."""
    
    url: str
    link_text: str = ""
    parent_text: str = ""
    link_classes: str = ""
    parent_classes: str = ""
    
    def get_full_context(self) -> str:
        """Get combined context text for keyword matching."""
        return " ".join([
            self.url,
            self.link_text,
            self.parent_text,
            self.link_classes,
            self.parent_classes
        ]).lower()


@dataclass
class SpiderConfig:
    """Configuration for web spider."""
    
    # Crawl depth
    max_depth: int = 2
    max_urls: int = 100  # Safety limit
    
    # Domain filtering
    same_domain_only: bool = True
    include_subdomains: bool = True
    
    # Contextual external links (e.g., ticket sellers)
    allow_contextual_external_links: bool = True
    contextual_keywords: Optional[List[str]] = field(default_factory=lambda: [
        'ticket', 'tickets', 'buy', 'reserve', 'book', 'booking',
        'eventbrite', 'ticketmaster', 'shop', 'store'
    ])
    
    # URL filtering
    url_patterns: Optional[List[str]] = None  # Regex patterns to include
    exclude_patterns: Optional[List[str]] = field(default_factory=lambda: [
        r'.*\.(pdf|jpg|jpeg|png|gif|svg|mp4|avi|zip|tar|gz)$',  # File downloads
        r'.*/(login|logout|signin|signout|register).*',  # Auth pages
        r'.*\?.*page=\d+',  # Pagination (often duplicates)
    ])
    
    # Rate limiting
    delay_between_requests: float = 0.5  # seconds
    
    # Browser config (will use from ExtractionConfig if provided)
    browser_config: Optional[ExtractionConfig] = None


@dataclass
class SpiderResult:
    """Result of spidering operation."""
    
    start_url: str
    discovered_urls: Set[str]
    visited_urls: Set[str]
    failed_urls: Set[str]
    external_contextual_urls: Set[str] = field(default_factory=set)  # External links kept for context
    total_time_seconds: float = 0.0
    
    def __str__(self) -> str:
        result = (
            f"SpiderResult(\n"
            f"  start_url={self.start_url}\n"
            f"  discovered={len(self.discovered_urls)} URLs\n"
            f"  visited={len(self.visited_urls)} URLs\n"
            f"  failed={len(self.failed_urls)} URLs\n"
        )
        if self.external_contextual_urls:
            result += f"  external_contextual={len(self.external_contextual_urls)} URLs (e.g., ticket sellers)\n"
        result += f"  time={self.total_time_seconds:.2f}s\n)"
        return result


class WebSpider:
    """
    Web spider for discovering URLs on a website.
    
    Usage:
        async with WebSpider(config) as spider:
            result = await spider.crawl("https://example.com")
            print(f"Found {len(result.discovered_urls)} URLs")
    """
    
    def __init__(self, config: Optional[SpiderConfig] = None):
        """
        Initialize spider.
        
        Args:
            config: Spider configuration
        """
        self.config = config or SpiderConfig()
        
        # Initialize browser fetcher
        browser_config = self.config.browser_config or ExtractionConfig(
            headless=True,
            stealth_mode=True,
            timeout_ms=15000,
            wait_state="domcontentloaded"  # Faster for just getting links
        )
        self.fetcher = BrowserFetcher(browser_config)
        
        # State
        self.visited_urls: Set[str] = set()
        self.discovered_urls: Set[str] = set()
        self.failed_urls: Set[str] = set()
        self.external_contextual_urls: Set[str] = set()
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self.fetcher.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.fetcher.close()
    
    async def crawl(self, start_url: str) -> SpiderResult:
        """
        Crawl website starting from given URL.
        
        Args:
            start_url: URL to start crawling from
            
        Returns:
            SpiderResult with discovered URLs
        """
        import time
        start_time = time.time()
        
        logger.info(f"Starting crawl from: {start_url}")
        
        # Reset state
        self.visited_urls = set()
        self.discovered_urls = {start_url}
        self.failed_urls = set()
        self.external_contextual_urls = set()
        
        # Queue: (url, depth)
        to_visit = [(start_url, 0)]
        
        while to_visit and len(self.visited_urls) < self.config.max_urls:
            url, depth = to_visit.pop(0)
            
            # Skip if already visited or too deep
            if url in self.visited_urls or depth > self.config.max_depth:
                continue
            
            # Mark as visited
            self.visited_urls.add(url)
            
            logger.info(
                f"[{len(self.visited_urls)}/{self.config.max_urls}] "
                f"Crawling (depth={depth}): {url}"
            )
            
            # Fetch and extract links
            try:
                link_contexts = await self._extract_links(url)
                logger.debug(f"Found {len(link_contexts)} links on {url}")
                
                # Add new links to queue if not at max depth
                if depth < self.config.max_depth:
                    for link_context in link_contexts:
                        link_url = link_context.url
                        
                        if link_url in self.visited_urls:
                            continue
                        
                        should_crawl, is_external_contextual = self._should_crawl(link_context, start_url)
                        
                        if should_crawl:
                            self.discovered_urls.add(link_url)
                            
                            if is_external_contextual:
                                # Track but don't visit external contextual links
                                self.external_contextual_urls.add(link_url)
                                logger.debug(f"Added external contextual link: {link_url}")
                            else:
                                # Normal link - add to visit queue
                                to_visit.append((link_url, depth + 1))
                
                # Rate limiting
                if self.config.delay_between_requests > 0:
                    await asyncio.sleep(self.config.delay_between_requests)
                    
            except Exception as e:
                logger.warning(f"Failed to crawl {url}: {e}")
                self.failed_urls.add(url)
                continue
        
        duration = time.time() - start_time
        
        result = SpiderResult(
            start_url=start_url,
            discovered_urls=self.discovered_urls,
            visited_urls=self.visited_urls,
            failed_urls=self.failed_urls,
            external_contextual_urls=self.external_contextual_urls,
            total_time_seconds=duration
        )
        
        logger.info(f"Crawl complete: {result}")
        
        return result
    
    async def _extract_links(self, url: str) -> List[LinkContext]:
        """Extract all valid links from a URL with context."""
        try:
            # Fetch HTML
            html = await self.fetcher.fetch(url)
            
            # Parse with BeautifulSoup
            soup = BeautifulSoup(html, "lxml")
            
            # Extract all links with context
            links = []
            seen_urls = set()
            
            for link_tag in soup.find_all("a", href=True):
                href = link_tag["href"].strip()
                
                # Skip empty, fragments, javascript, mailto
                if not href or href.startswith(('#', 'javascript:', 'mailto:', 'tel:')):
                    continue
                
                # Convert to absolute URL
                absolute_url = urljoin(url, href)
                
                # Remove fragment
                if '#' in absolute_url:
                    absolute_url = absolute_url.split('#')[0]
                
                # Remove trailing slash for consistency
                absolute_url = absolute_url.rstrip('/')
                
                if not absolute_url or absolute_url in seen_urls:
                    continue
                
                seen_urls.add(absolute_url)
                
                # Extract context
                link_text = link_tag.get_text(strip=True)
                link_classes = " ".join(link_tag.get("class", []))
                
                # Get parent element context
                parent = link_tag.parent
                parent_text = ""
                parent_classes = ""
                if parent and parent.name:
                    parent_text = parent.get_text(strip=True)[:200]  # Limit length
                    parent_classes = " ".join(parent.get("class", []))
                
                context = LinkContext(
                    url=absolute_url,
                    link_text=link_text,
                    parent_text=parent_text,
                    link_classes=link_classes,
                    parent_classes=parent_classes
                )
                
                links.append(context)
            
            return links
            
        except FetchError as e:
            logger.error(f"Fetch error for {url}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error extracting links from {url}: {e}")
            raise
    
    def _should_crawl(self, link_context: LinkContext, start_url: str) -> tuple[bool, bool]:
        """
        Determine if a URL should be crawled based on filters.
        
        Args:
            link_context: Link with context information
            start_url: Original starting URL
            
        Returns:
            Tuple of (should_crawl, is_external_contextual)
        """
        try:
            url = link_context.url
            parsed_url = urlparse(url)
            parsed_start = urlparse(start_url)
            
            is_external = False
            
            # Same domain check
            if self.config.same_domain_only:
                if self.config.include_subdomains:
                    # Allow subdomains (e.g., blog.site.com if start is site.com)
                    start_domain = '.'.join(parsed_start.netloc.split('.')[-2:])
                    url_domain = '.'.join(parsed_url.netloc.split('.')[-2:])
                    if url_domain != start_domain:
                        is_external = True
                else:
                    # Exact domain match only
                    if parsed_url.netloc != parsed_start.netloc:
                        is_external = True
                
                # Check for contextual exception (e.g., ticket sellers)
                if is_external and self.config.allow_contextual_external_links:
                    if self._has_contextual_exception(link_context):
                        logger.info(
                            f"Allowing external link due to context: {url} "
                            f"(text: '{link_context.link_text}')"
                        )
                        # Don't crawl it (don't follow its links), but do add it to discovered
                        return (True, True)  # should_crawl=True, is_external_contextual=True
                    else:
                        return (False, False)
                elif is_external:
                    return (False, False)
            
            # Exclude patterns check
            if self.config.exclude_patterns:
                for pattern in self.config.exclude_patterns:
                    if re.search(pattern, url, re.IGNORECASE):
                        logger.debug(f"Excluded by pattern '{pattern}': {url}")
                        return (False, False)
            
            # Include patterns check (if specified, URL must match at least one)
            if self.config.url_patterns:
                matched = False
                for pattern in self.config.url_patterns:
                    if re.search(pattern, url, re.IGNORECASE):
                        matched = True
                        break
                
                if not matched:
                    logger.debug(f"Not matched by include patterns: {url}")
                    return (False, False)
            
            return (True, False)  # should_crawl=True, is_external_contextual=False
            
        except Exception as e:
            logger.warning(f"Error checking if should crawl {url}: {e}")
            return (False, False)
    
    def _has_contextual_exception(self, link_context: LinkContext) -> bool:
        """
        Check if a link has contextual keywords that make it important.
        
        Args:
            link_context: Link with context information
            
        Returns:
            True if link has important contextual keywords
        """
        if not self.config.contextual_keywords:
            return False
        
        # Get all context text
        context_text = link_context.get_full_context()
        
        # Check if any keyword appears in context
        for keyword in self.config.contextual_keywords:
            if keyword.lower() in context_text:
                logger.debug(
                    f"Found contextual keyword '{keyword}' in: "
                    f"{link_context.link_text} / {link_context.parent_text[:50]}"
                )
                return True
        
        return False
    
    @classmethod
    async def quick_crawl(
        cls,
        start_url: str,
        max_depth: int = 2,
        url_patterns: Optional[List[str]] = None
    ) -> SpiderResult:
        """
        Convenience method for quick crawling.
        
        Args:
            start_url: URL to start from
            max_depth: Maximum crawl depth
            url_patterns: Optional URL patterns to include
            
        Returns:
            SpiderResult
        """
        config = SpiderConfig(
            max_depth=max_depth,
            url_patterns=url_patterns
        )
        
        async with cls(config) as spider:
            return await spider.crawl(start_url)

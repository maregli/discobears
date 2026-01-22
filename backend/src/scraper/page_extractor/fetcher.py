"""Browser fetcher using Playwright."""

import asyncio
import logging
from typing import Optional

from playwright.async_api import async_playwright, Browser, BrowserContext, Page
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

try:
    from playwright_stealth import stealth_async
    STEALTH_AVAILABLE = True
except ImportError:
    STEALTH_AVAILABLE = False
    logging.warning("playwright-stealth not available. Stealth mode disabled.")

from .models import ExtractionConfig

logger = logging.getLogger(__name__)


class FetchError(Exception):
    """Error during page fetching."""
    pass


class BrowserFetcher:
    """Manages browser session and page fetching with Playwright."""
    
    def __init__(self, config: ExtractionConfig):
        self.config = config
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        
    async def __aenter__(self):
        """Async context manager entry."""
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
    
    async def start(self):
        """Initialize browser."""
        logger.info(f"Starting {self.config.browser_type} browser (headless={self.config.headless})")
        
        self.playwright = await async_playwright().start()
        
        browser_args = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
        ]
        
        if self.config.browser_type == "firefox":
            self.browser = await self.playwright.firefox.launch(
                headless=self.config.headless,
                args=browser_args
            )
        elif self.config.browser_type == "chromium":
            self.browser = await self.playwright.chromium.launch(
                headless=self.config.headless,
                args=browser_args
            )
        else:
            raise ValueError(f"Unsupported browser type: {self.config.browser_type}")
        
        # Create context
        self.context = await self.browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )
        
        logger.info("Browser started successfully")
    
    async def close(self):
        """Close browser and cleanup."""
        if self.context:
            await self.context.close()
            logger.debug("Browser context closed")
        
        if self.browser:
            await self.browser.close()
            logger.debug("Browser closed")
        
        if self.playwright:
            await self.playwright.stop()
            logger.debug("Playwright stopped")
    
    async def fetch(self, url: str) -> str:
        """
        Fetch HTML content from URL.
        
        Args:
            url: URL to fetch
            
        Returns:
            HTML content as string
            
        Raises:
            FetchError: If fetching fails
        """
        if not self.context:
            raise FetchError("Browser not initialized. Use 'async with' or call start()")
        
        page = None
        try:
            page = await self.context.new_page()
            
            # Apply stealth mode if enabled
            if self.config.stealth_mode and STEALTH_AVAILABLE:
                await stealth_async(page)
                logger.debug("Stealth mode applied")
            
            logger.info(f"Navigating to {url}")
            
            # Navigate to URL
            try:
                await page.goto(
                    url,
                    timeout=self.config.timeout_ms,
                    wait_until=self.config.wait_state
                )
            except PlaywrightTimeoutError as e:
                raise FetchError(f"Timeout navigating to {url}: {e}")
            
            # Wait for custom selector if provided
            if self.config.wait_for_selector:
                try:
                    await page.wait_for_selector(
                        self.config.wait_for_selector,
                        timeout=self.config.timeout_ms
                    )
                    logger.debug(f"Selector found: {self.config.wait_for_selector}")
                except PlaywrightTimeoutError:
                    logger.warning(f"Selector not found: {self.config.wait_for_selector}")
            
            # Handle scrolling for infinite-scroll pages
            if self.config.scrolls > 0:
                await self._scroll_page(page, self.config.scrolls)
            
            # Get HTML content
            if self.config.include_iframes:
                html = await self._get_full_html_with_iframes(page)
            else:
                html = await page.content()
            
            logger.info(f"Fetched {len(html)} characters from {url}")
            return html
            
        except PlaywrightTimeoutError as e:
            raise FetchError(f"Timeout error: {e}")
        except Exception as e:
            raise FetchError(f"Error fetching {url}: {e}")
        finally:
            if page:
                await page.close()
    
    async def _scroll_page(self, page: Page, scrolls: int):
        """Scroll page multiple times for infinite-scroll content."""
        logger.info(f"Scrolling page {scrolls} times")
        
        for i in range(scrolls):
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(self.config.scroll_delay_ms / 1000)
            logger.debug(f"Scroll {i + 1}/{scrolls} completed")
    
    async def _get_full_html_with_iframes(self, page: Page) -> str:
        """Get HTML including iframe content."""
        main_html = await page.content()
        
        iframe_htmls = []
        for frame in page.frames[1:]:  # Skip main frame
            try:
                if not frame.is_detached():
                    iframe_html = await frame.evaluate("document.documentElement.outerHTML")
                    iframe_htmls.append(iframe_html)
            except Exception as e:
                logger.warning(f"Could not access iframe: {e}")
        
        # Combine all HTML
        combined_html = f"<!-- Main Page HTML -->\n{main_html}\n"
        for idx, iframe_html in enumerate(iframe_htmls):
            combined_html += f"\n<!-- Iframe {idx + 1} HTML -->\n{iframe_html}\n"
        
        return combined_html

"""Convert HTML to Markdown."""

import logging
from typing import Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup, Tag
from markdownify import MarkdownConverter as BaseMarkdownConverter

from .models import ExtractionConfig

logger = logging.getLogger(__name__)


class CustomMarkdownConverter(BaseMarkdownConverter):
    """Custom markdown converter with better formatting."""
    
    def __init__(self, **options):
        super().__init__(**options)
    
    def convert_img(self, el, text, convert_as_inline):
        """Convert img tags, preserving alt text."""
        alt = el.get('alt', '') or ''
        src = el.get('src', '') or ''
        title = el.get('title', '') or ''
        
        if alt or src:
            title_part = f' "{title}"' if title else ''
            return f'![{alt}]({src}{title_part})'
        return ''
    
    def convert_a(self, el, text, convert_as_inline):
        """Convert links, preserving href."""
        href = el.get('href', '')
        title = el.get('title', '')
        
        if not text.strip():
            text = href
        
        if href:
            title_part = f' "{title}"' if title else ''
            return f'[{text}]({href}{title_part})'
        return text


class MarkdownConverter:
    """Converts HTML content to clean Markdown."""
    
    def __init__(self, config: ExtractionConfig):
        self.config = config
    
    def convert(self, content: Tag, base_url: str) -> str:
        """
        Convert HTML content to Markdown.
        
        Args:
            content: BeautifulSoup Tag containing content to convert
            base_url: Base URL for resolving relative links
            
        Returns:
            Markdown string
        """
        # Clone to avoid modifying original
        content_copy = self._prepare_content(content)
        
        # Resolve relative URLs
        self._resolve_urls(content_copy, base_url)
        
        # Convert to markdown
        # Note: No strip/convert params needed - BeautifulSoup already cleaned everything
        markdown = CustomMarkdownConverter(
            heading_style="ATX",  # Use # style headings
            bullets="-",  # Use - for bullets
        ).convert_soup(content_copy)
        
        logger.info(f"Converted to {len(markdown)} characters of markdown")
        
        return markdown
    
    def _prepare_content(self, content: Tag) -> Tag:
        """Prepare content for conversion by removing unwanted elements."""
        # Clone the content
        content_copy = BeautifulSoup(str(content), "lxml")
        
        # Remove unwanted elements
        unwanted_tags = [
            "script", "style", "noscript", "iframe", "embed", "object",
            "nav", "aside", "footer", "header", "img"  # Remove images
        ]
        
        for tag in unwanted_tags:
            for element in content_copy.find_all(tag):
                element.decompose()
        
        # Remove elements with unwanted classes
        unwanted_classes = [
            "advertisement", "ads", "ad-container", "banner",
            "sidebar", "navigation", "nav", "menu",
            "footer", "header", "social", "share",
            "comment", "comments", "related", "recommended"
        ]
        
        for element in content_copy.find_all(class_=True):
            # Skip if element has been decomposed or doesn't have attrs
            if not element or not hasattr(element, 'attrs') or element.attrs is None:
                continue
            element_classes = " ".join(element.get("class", [])).lower()
            if any(cls in element_classes for cls in unwanted_classes):
                element.decompose()
        
        # Remove hidden elements
        for element in content_copy.find_all(style=True):
            # Skip if element has been decomposed or doesn't have attrs
            if not element or not hasattr(element, 'attrs') or element.attrs is None:
                continue
            if "display:none" in element.get("style", "").replace(" ", ""):
                element.decompose()
        
        return content_copy
    
    def _resolve_urls(self, content: Tag, base_url: str):
        """Convert relative URLs to absolute URLs."""
        # Fix links
        for link in content.find_all("a", href=True):
            href = link["href"]
            if href and not href.startswith(("#", "javascript:", "mailto:")):
                absolute_url = urljoin(base_url, href)
                link["href"] = absolute_url
        
        # Fix images
        for img in content.find_all("img", src=True):
            src = img["src"]
            if src and not src.startswith(("data:", "http:", "https:")):
                absolute_url = urljoin(base_url, src)
                img["src"] = absolute_url
        
        logger.debug(f"Resolved URLs relative to {base_url}")

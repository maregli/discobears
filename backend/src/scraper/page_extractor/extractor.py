"""Content extraction from HTML using BeautifulSoup."""

import logging
import re
from typing import Optional, Tuple

from bs4 import BeautifulSoup, Tag

from .models import ExtractionConfig

logger = logging.getLogger(__name__)


class ExtractionError(Exception):
    """Error during content extraction."""
    pass


class ContentExtractor:
    """Extracts main content from HTML using semantic strategies."""
    
    def __init__(self, config: ExtractionConfig):
        self.config = config
    
    def extract(self, html: str) -> Tuple[BeautifulSoup, Tag, dict]:
        """
        Extract main content from HTML.
        
        Args:
            html: Raw HTML string
            
        Returns:
            Tuple of (soup, content_element, metadata)
            
        Raises:
            ExtractionError: If extraction fails
        """
        # Parse HTML
        soup = BeautifulSoup(html, "lxml")
        
        # Extract metadata first
        metadata = self._extract_metadata(soup)
        
        # Try custom selector first
        if self.config.content_selector:
            content = soup.select_one(self.config.content_selector)
            if content:
                logger.info(f"Content found using custom selector: {self.config.content_selector}")
                return soup, content, metadata
            logger.warning(f"Custom selector not found: {self.config.content_selector}")
        
        # Use extraction strategy
        if self.config.extraction_strategy == "semantic":
            content = self._semantic_extraction(soup)
        else:
            content = self._simple_extraction(soup)
        
        if not content:
            raise ExtractionError("No content could be extracted from page")
        
        # Validate content length
        content_text = content.get_text(strip=True)
        if len(content_text) < self.config.min_content_length:
            logger.warning(
                f"Content too short ({len(content_text)} chars), "
                f"minimum: {self.config.min_content_length}"
            )
        
        logger.info(f"Extracted {len(content_text)} characters of content")
        
        return soup, content, metadata
    
    def _semantic_extraction(self, soup: BeautifulSoup) -> Optional[Tag]:
        """
        Strategy 1: Extract using semantic HTML5 tags and content indicators.
        Inspired by llm-webextract approach.
        """
        candidates = []
        
        # 1. Try semantic HTML5 elements first (highest priority)
        for tag in ["main", "article"]:
            elements = soup.find_all(tag)
            for element in elements:
                text = element.get_text(strip=True)
                if len(text) > 50:
                    score = self._score_content_container(element)
                    candidates.append((score, len(text), element))
                    logger.debug(f"Found <{tag}> with score {score}, length {len(text)}")
        
        # 2. Look for content-indicating classes and IDs
        content_patterns = [
            r"content",
            r"main-content",
            r"article-content",
            r"post-content",
            r"entry-content",
            r"story",
            r"body-content",
            r"page-content",
        ]
        
        for pattern in content_patterns:
            # Check classes
            elements = soup.find_all(class_=re.compile(pattern, re.I))
            # Check IDs
            elements.extend(soup.find_all(id=re.compile(pattern, re.I)))
            
            for element in elements:
                text = element.get_text(strip=True)
                if len(text) > 50:
                    score = self._score_content_container(element)
                    candidates.append((score, len(text), element))
        
        # 3. If no good candidates, analyze all containers
        if not candidates:
            logger.info("No semantic tags found, analyzing all containers")
            containers = soup.find_all(["div", "section", "article"])
            
            for container in containers:
                score = self._score_content_container(container)
                if score > 0:
                    text = container.get_text(strip=True)
                    candidates.append((score, len(text), container))
        
        # Return the best candidate
        if candidates:
            candidates.sort(key=lambda x: (x[0], x[1]), reverse=True)
            best_score, best_length, best_element = candidates[0]
            logger.info(
                f"Best content container: score={best_score:.2f}, length={best_length}"
            )
            return best_element
        
        # Last resort: return body
        logger.warning("No good content container found, using <body>")
        return soup.find("body") or soup
    
    def _simple_extraction(self, soup: BeautifulSoup) -> Tag:
        """
        Strategy 2: Simple extraction - just get body with basic cleanup.
        """
        body = soup.find("body") or soup
        logger.info("Using simple extraction (body tag)")
        return body
    
    def _score_content_container(self, container: Tag) -> float:
        """
        Score a container based on content quality indicators.
        Higher score = more likely to be main content.
        """
        if not container:
            return 0.0
        
        score = 0.0
        text = container.get_text(strip=True)
        
        # Base score: text length (but cap it to avoid huge containers dominating)
        score += min(len(text) * 0.05, 500)
        
        # Bonus for paragraphs (indicates article content)
        paragraphs = container.find_all("p")
        score += len(paragraphs) * 15
        
        # Bonus for headings (structured content)
        headings = container.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
        score += len(headings) * 8
        
        # Bonus for lists (organized content)
        lists = container.find_all(["ul", "ol"])
        score += len(lists) * 5
        
        # Penalty for navigation/unwanted elements
        unwanted = container.find_all(["nav", "aside", "footer", "header"])
        score -= len(unwanted) * 30
        
        # Penalty for too many links (likely navigation)
        links = container.find_all("a")
        if text:
            link_text_length = sum(len(link.get_text(strip=True)) for link in links)
            link_ratio = link_text_length / max(len(text), 1)
            if link_ratio > 0.3:  # More than 30% links
                score *= 0.3
        
        # Penalty for ads/social indicators in classes
        class_text = " ".join(container.get("class", []))
        id_text = container.get("id", "")
        combined_attrs = (class_text + " " + id_text).lower()
        
        unwanted_keywords = ["ad", "banner", "popup", "social", "share", "comment", "sidebar"]
        for keyword in unwanted_keywords:
            if keyword in combined_attrs:
                score *= 0.5
        
        return max(0.0, score)
    
    def _extract_metadata(self, soup: BeautifulSoup) -> dict:
        """Extract page metadata (title, description, etc.)."""
        metadata = {}
        
        # Title (try multiple sources)
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            metadata["title"] = og_title["content"].strip()
        elif soup.find("title"):
            metadata["title"] = soup.find("title").get_text(strip=True)
        elif soup.find("h1"):
            metadata["title"] = soup.find("h1").get_text(strip=True)
        
        # Description
        og_desc = soup.find("meta", property="og:description")
        if og_desc and og_desc.get("content"):
            metadata["description"] = og_desc["content"].strip()
        else:
            meta_desc = soup.find("meta", attrs={"name": "description"})
            if meta_desc and meta_desc.get("content"):
                metadata["description"] = meta_desc["content"].strip()
        
        # Language
        html_tag = soup.find("html")
        if html_tag and html_tag.get("lang"):
            metadata["language"] = html_tag["lang"]
        
        # Count elements
        metadata["links_found"] = len(soup.find_all("a"))
        metadata["images_found"] = len(soup.find_all("img"))
        metadata["headings_found"] = len(soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]))
        
        return metadata

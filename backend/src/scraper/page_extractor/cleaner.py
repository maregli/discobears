"""Post-processing and cleaning of markdown output."""

import logging
import re

from .models import ExtractionConfig

logger = logging.getLogger(__name__)


class MarkdownCleaner:
    """Cleans and post-processes markdown output."""
    
    def __init__(self, config: ExtractionConfig):
        self.config = config
    
    def clean(self, markdown: str) -> str:
        """
        Clean and normalize markdown.
        
        Args:
            markdown: Raw markdown string
            
        Returns:
            Cleaned markdown string
        """
        # 1. Remove excessive whitespace
        markdown = self._normalize_whitespace(markdown)
        
        # 2. Remove common artifacts
        markdown = self._remove_artifacts(markdown)
        
        # 3. Fix broken formatting
        markdown = self._fix_formatting(markdown)
        
        # 4. Normalize line endings
        markdown = markdown.strip()
        
        # 5. Validate length
        if len(markdown) > self.config.max_content_length:
            logger.warning(
                f"Content exceeds max length ({len(markdown)} > {self.config.max_content_length}), "
                "truncating..."
            )
            markdown = markdown[:self.config.max_content_length]
        
        logger.info(f"Cleaned markdown to {len(markdown)} characters")
        
        return markdown
    
    def _normalize_whitespace(self, text: str) -> str:
        """Normalize whitespace and blank lines."""
        # Replace multiple spaces with single space (but preserve indentation)
        lines = text.split('\n')
        normalized_lines = []
        
        for line in lines:
            # Preserve leading whitespace, but clean the rest
            leading_space = len(line) - len(line.lstrip())
            cleaned = ' '.join(line.split())
            if cleaned:
                normalized_lines.append(' ' * leading_space + cleaned)
            else:
                normalized_lines.append('')
        
        # Join and remove excessive blank lines (more than 2 consecutive)
        text = '\n'.join(normalized_lines)
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        return text
    
    def _remove_artifacts(self, text: str) -> str:
        """Remove common markdown artifacts and noise."""
        # Remove empty links []()
        text = re.sub(r'\[\]\(\)', '', text)
        
        # Remove links with just # or javascript:
        text = re.sub(r'\[([^\]]+)\]\(#\)', r'\1', text)
        text = re.sub(r'\[([^\]]+)\]\(javascript:[^\)]+\)', r'\1', text)
        
        # Remove empty images ![](
        text = re.sub(r'!\[\]\([^\)]*\)', '', text)
        
        # Remove common UI noise patterns
        noise_patterns = [
            r'Skip to (main )?content',
            r'Cookie (Policy|Consent|Notice)',
            r'Accept (All )?Cookies',
            r'Manage (Cookie )?Settings',
            r'Privacy Policy',
            r'Terms of Service',
            r'Subscribe to Newsletter',
            r'Follow us on',
            r'Share (on|this)',
        ]
        
        for pattern in noise_patterns:
            text = re.sub(pattern, '', text, flags=re.IGNORECASE)
        
        return text
    
    def _fix_formatting(self, text: str) -> str:
        """Fix common formatting issues."""
        # Fix headings with no space after #
        text = re.sub(r'^(#{1,6})([^\s#])', r'\1 \2', text, flags=re.MULTILINE)
        
        # Fix list items with no space after -
        text = re.sub(r'^(\s*-)([^\s-])', r'\1 \2', text, flags=re.MULTILINE)
        
        # Fix multiple consecutive list markers
        text = re.sub(r'^(\s*-)\s*-+', r'\1', text, flags=re.MULTILINE)
        
        # Remove standalone punctuation lines
        text = re.sub(r'^\s*[•\-\_\*]+\s*$', '', text, flags=re.MULTILINE)
        
        return text

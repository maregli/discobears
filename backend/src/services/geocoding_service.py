"""
Geocoding service using Nominatim (OpenStreetMap)
Converts venue addresses to latitude/longitude coordinates
"""

import re
import time
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError


class GeocodingService:
    def __init__(self):
        # Initialize Nominatim with a user agent
        self.geolocator = Nominatim(user_agent="discobears-festival-mapper/1.0")
        self.rate_limit_delay = 1.1  # Nominatim requires 1 request per second
    
    def parse_venue_text(self, venue_text):
        """
        Parse venue text to extract city, postal code, and country
        Also format venue for better display
        
        Format examples:
        - "Am Flugplatz 1Neustadt-Glewe,DE19306"
        - "WestfalenhalleRheinlanddamm 200Dortmund,DE44139"
        
        Returns:
            dict with 'city', 'postal_code', 'country', 'full_address', 'formatted_venue'
        """
        # Extract country code (last 2 letters before postal code)
        country_match = re.search(r',([A-Z]{2})(\d{4,5})$', venue_text)
        
        parsed = {
            'city': None,
            'postal_code': None,
            'country': None,
            'full_address': venue_text,
            'formatted_venue': venue_text
        }
        
        if country_match:
            parsed['country'] = country_match.group(1)
            parsed['postal_code'] = country_match.group(2)
            
            # Extract city name (text before country code)
            # Remove the country+postal part
            address_part = venue_text[:country_match.start()]
            
            # City name is typically the last capitalized word(s) before comma
            # Look for pattern: ends with a capital letter followed by lowercase
            city_match = re.search(r'([A-ZÄÖÜ][a-zäöüß-]+(?:\s+[A-ZÄÖÜ][a-zäöüß-]+)*)[,]?$', address_part)
            if city_match:
                parsed['city'] = city_match.group(1).strip()
            else:
                # Fallback: look for any capital word at the end
                words = re.findall(r'[A-ZÄÖÜ][a-zäöüß-]+', address_part)
                if words:
                    parsed['city'] = words[-1]
            
            # Format venue for display: add spaces before capitals and before postal
            formatted = venue_text
            # Add space before city name if found
            if parsed['city']:
                formatted = formatted.replace(parsed['city'], f" {parsed['city']}")
            # Add space before country code
            formatted = formatted.replace(f",{parsed['country']}", f", {parsed['country']} ")
            # Clean up multiple spaces
            formatted = re.sub(r'\s+', ' ', formatted).strip()
            parsed['formatted_venue'] = formatted
        
        return parsed
        
    def geocode_venue(self, venue_text, region):
        """
        Geocode a venue address to coordinates using multiple strategies
        
        Args:
            venue_text: Raw venue text from scraper
            region: Region/country name
            
        Returns:
            dict: {'lat': float, 'lng': float, 'city': str, 'country': str} or None
        """
        # Parse venue information
        parsed = self.parse_venue_text(venue_text)
        
        # Try multiple geocoding strategies in order of accuracy
        strategies = []
        
        # Strategy 1: Postal code + Country (most accurate)
        if parsed['postal_code'] and parsed['country']:
            strategies.append(f"{parsed['postal_code']}, {self._expand_country_code(parsed['country'])}")
        
        # Strategy 2: City + Country
        if parsed['city'] and parsed['country']:
            strategies.append(f"{parsed['city']}, {self._expand_country_code(parsed['country'])}")
        
        # Strategy 3: City + Region
        if parsed['city'] and region:
            strategies.append(f"{parsed['city']}, {region}")
        
        # Strategy 4: Original query (fallback)
        strategies.append(f"{venue_text}, {region}")
        
        # Try each strategy
        for i, query in enumerate(strategies, 1):
            try:
                location = self.geolocator.geocode(query, timeout=10)
                
                if location:
                    result = {
                        'lat': location.latitude,
                        'lng': location.longitude,
                        'city': parsed['city'] or location.address.split(',')[0],
                        'country': parsed['country'],
                        'formatted_venue': parsed.get('formatted_venue', venue_text)
                    }
                    print(f"    ✓ Found: {result['lat']:.4f}, {result['lng']:.4f} (strategy {i})")
                    time.sleep(self.rate_limit_delay)
                    return result
                    
            except (GeocoderTimedOut, GeocoderServiceError) as e:
                print(f"    ✗ Strategy {i} error: {e}")
                
            time.sleep(self.rate_limit_delay)
        
        print(f"    ✗ Geocoding failed for all strategies")
        return None
    
    def _expand_country_code(self, code):
        """Expand 2-letter country codes to full names for better geocoding"""
        country_map = {
            'DE': 'Germany',
            'AT': 'Austria',
            'CH': 'Switzerland',
            'FR': 'France',
            'NL': 'Netherlands',
            'BE': 'Belgium',
            'HR': 'Croatia',
            'IT': 'Italy',
            'ES': 'Spain',
        }
        return country_map.get(code, code)

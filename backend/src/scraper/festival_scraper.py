"""
Festival data scraper for festival-alarm.com
Extracts festival information including location, dates, genres, and prices.
"""

import requests
from bs4 import BeautifulSoup
import time


def extract_external_link(festival_url):
    """
    Extract the external link from a festival detail page.
    Looks for the link under "Sonstiges › Weiterführende Optionen › Externer Link"
    
    Args:
        festival_url: URL of the festival detail page
        
    Returns:
        str: External link URL or None if not found
    """
    if not festival_url:
        return None
        
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        # Small delay to avoid overwhelming the server
        time.sleep(0.5)
        
        response = requests.get(festival_url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, "lxml")
        
        # Strategy 1: Look for a link containing "Externer Link" text
        external_link_tag = soup.find("a", string=lambda s: s and "Externer Link" in s)
        if external_link_tag and external_link_tag.get("href"):
            return external_link_tag["href"]
        
        # Strategy 2: Look for links in sections containing "Weiterführende" or "Sonstiges"
        sections = soup.find_all(["div", "section", "td", "th"])
        for section in sections:
            section_text = section.get_text()
            if "Weiterführende" in section_text or "externer Link" in section_text.lower():
                link = section.find("a", href=True)
                if link and link.get("href"):
                    href = link["href"]
                    # Filter out internal festival-alarm links
                    if "festival-alarm.com" not in href:
                        return href
        
        # Strategy 3: Look in table rows for "Externer Link" label
        rows = soup.find_all("tr")
        for row in rows:
            cells = row.find_all(["td", "th"])
            for i, cell in enumerate(cells):
                if "externer link" in cell.get_text().lower():
                    # Check if there's a link in this cell or the next cell
                    link = cell.find("a", href=True)
                    if link and link.get("href"):
                        href = link["href"]
                        if "festival-alarm.com" not in href:
                            return href
                    # Check next cell if exists
                    if i + 1 < len(cells):
                        link = cells[i + 1].find("a", href=True)
                        if link and link.get("href"):
                            href = link["href"]
                            if "festival-alarm.com" not in href:
                                return href
        
        return None
        
    except Exception as e:
        print(f"    ⚠ Error extracting external link: {e}")
        return None


def scrape_electro_festivals(fetch_external_links=True):
    """
    Scrape electro festival data from festival-alarm.com

    Args:
        fetch_external_links: If True, fetch external links from detail pages (slower but complete)
    
    Returns:
        list: List of dictionaries containing festival information
    """
    url = "https://www.festival-alarm.com/Kategorien/Electro-Festivals/"

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    print(f"Fetching data from {url}...")
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    print(f"✓ Page fetched successfully ({len(response.content)} bytes)")

    soup = BeautifulSoup(response.content, "lxml")

    # Find the festival table
    festivals = []
    festival_rows = soup.find_all("tr")[1:]  # Skip header row

    print(f"✓ Found {len(festival_rows)} festival rows")
    print(f"Parsing festival data...")

    for i, row in enumerate(festival_rows, 1):
        try:
            cells = row.find_all("td")
            if len(cells) < 8:
                continue

            # Extract festival name
            name_cell = cells[0]
            name_link = name_cell.find("a")
            name = name_link.get_text(strip=True) if name_link else ""
            festival_url = (
                "https://www.festival-alarm.com" + name_link["href"]
                if name_link and "href" in name_link.attrs
                else ""
            )

            # Extract dates
            date_text = cells[1].get_text(strip=True)

            # Extract duration
            duration = cells[2].get_text(strip=True)

            # Extract venue type (indoor/outdoor)
            venue_type = cells[3].get_text(strip=True)

            # Extract genres
            genres_text = cells[4].get_text(strip=True)
            genres = [g.strip() for g in genres_text.split(",") if g.strip()]

            # Extract country/region
            region_cell = cells[5]
            region_link = region_cell.find("a")
            region = region_link.get_text(strip=True) if region_link else ""

            # Extract venue/location details
            venue_text = cells[6].get_text(strip=True)

            # Extract visitor count (column 7)
            visitors_text = cells[7].get_text(strip=True)
            
            # Extract price (column 8)
            price_text = cells[8].get_text(strip=True) if len(cells) > 8 else ""

            festival_data = {
                "name": name,
                "source_url": festival_url,  # URL to Festival Alarm page (source)
                "dates": date_text,
                "duration": duration,
                "venue_type": venue_type,
                "genres": genres,
                "region": region,
                "venue": venue_text,
                "price": price_text,
                "visitors": visitors_text,
                "external_link": None,  # Will be populated if fetch_external_links is True
            }

            festivals.append(festival_data)
            
            # Progress indicator every 10 festivals
            if i % 10 == 0:
                print(f"  Parsed {i}/{len(festival_rows)} festivals...")

        except Exception as e:
            print(f"✗ Error parsing row {i}: {e}")
            continue

    print(f"✓ Successfully parsed {len(festivals)} festivals")
    
    # Fetch external links if requested
    if fetch_external_links and festivals:
        print(f"\n🔗 Fetching external links from detail pages...")
        print(f"   This will take approximately {len(festivals) * 0.5:.0f} seconds...")
        festivals = enrich_festivals_with_external_links(festivals)
    
    return festivals


def enrich_festivals_with_external_links(festivals):
    """
    Enrich festival data with external links by fetching detail pages.
    
    Args:
        festivals: List of festival dictionaries
        
    Returns:
        list: Updated list with external_link field populated
    """
    print(f"\nEnriching {len(festivals)} festivals with external links...")
    
    for i, festival in enumerate(festivals, 1):
        try:
            if festival.get("source_url"):
                print(f"  [{i}/{len(festivals)}] {festival['name'][:40]}... ", end="", flush=True)
                external_link = extract_external_link(festival["source_url"])
                festival["external_link"] = external_link
                if external_link:
                    print(f"✓ Found: {external_link}")
                else:
                    print("✗ Not found")
            else:
                print(f"  [{i}/{len(festivals)}] {festival['name'][:40]}... ✗ No source URL")
                festival["external_link"] = None
                
        except Exception as e:
            print(f"  [{i}/{len(festivals)}] {festival['name'][:40]}... ✗ Error: {e}")
            festival["external_link"] = None
    
    print(f"✓ Enrichment complete")
    return festivals


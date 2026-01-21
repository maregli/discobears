"""
Flask server for festival scraping and Firebase upload
"""

import sys
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

from src.scraper.festival_scraper import scrape_electro_festivals
from src.services.geocoding_service import GeocodingService
from src.services.firebase_service import FirebaseService


app = Flask(__name__)
# Enable CORS for all routes with permissive settings for development
CORS(app, 
     origins=["http://localhost:3000", "http://localhost:3001"],
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Add CORS headers manually to ensure they're always present
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Initialize services
geocoding_service = GeocodingService()
firebase_service = FirebaseService()


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'discobears-backend'})


@app.route('/api/scrape-and-upload', methods=['POST'])
def scrape_and_upload():
    """
    Scrape festivals, geocode locations, and upload to Firebase
    """
    try:
        # Get optional clear parameter
        clear_existing = request.args.get('clear', 'false').lower() == 'true'
        
        # Clear existing festivals if requested
        if clear_existing:
            print("Clearing existing festivals from Firebase...")
            firebase_service.clear_festivals_collection()
        
        # Step 1: Scrape festivals
        print("=" * 60)
        print("STEP 1: SCRAPING FESTIVALS")
        print("=" * 60)
        festivals = scrape_electro_festivals()
        print(f"\n✓ Scraped {len(festivals)} festivals\n")
        
        if not festivals:
            return jsonify({
                'error': 'No festivals found',
                'success': 0,
                'failed': 0
            }), 400
        
        # Step 2: Geocode and upload
        print("=" * 60)
        print("STEP 2: GEOCODING AND UPLOADING TO FIREBASE")
        print("=" * 60)
        print(f"Note: Geocoding is rate-limited to 1 request/second (Nominatim requirement)")
        print(f"Estimated time: ~{len(festivals) * 1.5:.0f} seconds ({len(festivals) * 1.5 / 60:.1f} minutes)\n")
        
        success_count = 0
        failed_count = 0
        updated_count = 0
        skipped_count = 0
        geocoded_count = 0
        
        import time as time_module
        start_time = time_module.time()
        
        for i, festival in enumerate(festivals, 1):
            try:
                print(f"\n[{i}/{len(festivals)}] {festival['name']}")
                
                # Upload to Firebase (returns: festival_id, was_updated, needs_geocoding)
                festival_id, was_updated, needs_geocoding = firebase_service.upload_festival(festival)
                
                if was_updated:
                    updated_count += 1
                else:
                    skipped_count += 1
                
                # Geocode if needed (new festival or venue changed)
                if needs_geocoding:
                    print(f"  → Geocoding...")
                    geocode_result = geocoding_service.geocode_venue(
                        festival['venue'],
                        festival['region']
                    )
                    
                    if geocode_result:
                        update_data = {
                            'coordinates': {
                                'lat': geocode_result['lat'],
                                'lng': geocode_result['lng']
                            },
                            'geocoding_needed': False,
                            'updated_at': datetime.utcnow()
                        }
                        
                        if geocode_result.get('city'):
                            update_data['parsed_city'] = geocode_result['city']
                        if geocode_result.get('country'):
                            update_data['parsed_country'] = geocode_result['country']
                        if geocode_result.get('formatted_venue'):
                            update_data['venue_formatted'] = geocode_result['formatted_venue']
                        
                        # Update coordinates in Firebase
                        doc_ref = firebase_service.db.collection('festivals').document(festival_id)
                        doc_ref.update(update_data)
                        print(f"  ✓ Geocoded successfully")
                        geocoded_count += 1
                    else:
                        print(f"  ✗ Geocoding failed")
                        doc_ref = firebase_service.db.collection('festivals').document(festival_id)
                        doc_ref.update({
                            'geocoding_failed': True,
                            'updated_at': datetime.utcnow()
                        })
                
                success_count += 1
                
                # Progress summary every 10 festivals
                if i % 10 == 0:
                    elapsed = time_module.time() - start_time
                    avg_per_festival = elapsed / i
                    remaining = (len(festivals) - i) * avg_per_festival
                    print(f"\n--- Progress: {i}/{len(festivals)} ({i/len(festivals)*100:.1f}%) ---")
                    print(f"    Elapsed: {elapsed/60:.1f}m | Remaining: ~{remaining/60:.1f}m")
                    print(f"    Updated: {updated_count} | Skipped: {skipped_count} | Geocoded: {geocoded_count}")
                
            except Exception as e:
                print(f"    ✗ Error: {e}")
                failed_count += 1
        
        elapsed_total = time_module.time() - start_time
        print("\n" + "=" * 60)
        print("UPLOAD COMPLETE")
        print("=" * 60)
        print(f"Total time: {elapsed_total/60:.1f} minutes")
        print(f"Updated: {updated_count} | Skipped (no changes): {skipped_count}")
        print(f"Geocoded: {geocoded_count} | Failed: {failed_count}")
        print("=" * 60)
        
        return jsonify({
            'message': 'Scraping and upload complete',
            'total_scraped': len(festivals),
            'updated': updated_count,
            'skipped': skipped_count,
            'geocoded': geocoded_count,
            'failed': failed_count
        })
        
    except Exception as e:
        print(f"Error in scrape_and_upload: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/scrape-only', methods=['GET'])
def scrape_only():
    """
    Just scrape festivals without uploading (for testing)
    """
    try:
        festivals = scrape_electro_festivals()
        return jsonify({
            'count': len(festivals),
            'festivals': festivals[:5]  # Return first 5 as preview
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/scrape-without-geocoding', methods=['POST'])
def scrape_without_geocoding():
    """
    Scrape festivals and upload ONLY NEW ones to Firebase (no geocoding)
    Existing festivals are skipped to preserve coordinates
    Use this for initial data load, then geocode separately
    """
    try:
        # Get optional clear parameter
        clear_existing = request.args.get('clear', 'false').lower() == 'true'
        
        # Clear existing festivals if requested
        if clear_existing:
            print("Clearing existing festivals from Firebase...")
            firebase_service.clear_festivals_collection()
        
        # Scrape festivals
        print("=" * 60)
        print("SCRAPING FESTIVALS (NO GEOCODING)")
        print("=" * 60)
        festivals = scrape_electro_festivals()
        print(f"\n✓ Scraped {len(festivals)} festivals\n")
        
        if not festivals:
            return jsonify({
                'error': 'No festivals found',
                'new': 0,
                'skipped': 0,
                'failed': 0
            }), 400
        
        # Note: Don't set coordinates here - let upload_festival handle it
        # New festivals will get coordinates=None automatically
        # Existing festivals will preserve their coordinates
        
        # Upload festivals (will only update if data changed)
        print("=" * 60)
        print("UPLOADING FESTIVALS TO FIREBASE")
        print("=" * 60)
        
        updated_count = 0
        skipped_count = 0
        failed_count = 0
        new_count = 0
        needs_geocoding_count = 0
        
        for i, festival in enumerate(festivals, 1):
            try:
                # Upload to Firebase (returns: festival_id, was_updated, needs_geocoding)
                festival_id, was_updated, needs_geocoding = firebase_service.upload_festival(festival)
                
                if was_updated:
                    updated_count += 1
                    # Check if this was a new festival
                    doc_ref = firebase_service.db.collection('festivals').document(festival_id)
                    doc = doc_ref.get()
                    if doc.exists and doc.to_dict().get('created_at') == doc.to_dict().get('updated_at'):
                        new_count += 1
                else:
                    skipped_count += 1
                
                if needs_geocoding:
                    needs_geocoding_count += 1
                
                if i % 10 == 0:
                    print(f"  Progress: {i}/{len(festivals)} festivals processed...")
                    
            except Exception as e:
                print(f"  ✗ Failed to upload {festival.get('name', 'Unknown')}: {e}")
                failed_count += 1
        
        print("\n" + "=" * 60)
        print("UPLOAD COMPLETE")
        print("=" * 60)
        print(f"Total processed: {len(festivals)}")
        print(f"New festivals: {new_count}")
        print(f"Updated (data changed): {updated_count - new_count}")
        print(f"Skipped (no changes): {skipped_count}")
        print(f"Need geocoding: {needs_geocoding_count}")
        print(f"Failed: {failed_count}")
        if needs_geocoding_count > 0:
            print("\n→ Next: Call POST /api/geocode-missing to add coordinates")
        print("=" * 60)
        
        return jsonify({
            'message': 'Festivals scraped and uploaded',
            'total_scraped': len(festivals),
            'new': new_count,
            'updated': updated_count - new_count,
            'skipped': skipped_count,
            'needs_geocoding': needs_geocoding_count,
            'failed': failed_count,
            'next_step': f'Call POST /api/geocode-missing to geocode {needs_geocoding_count} festivals' if needs_geocoding_count > 0 else 'All done!'
        })
        
    except Exception as e:
        print(f"Error in scrape_without_geocoding: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/geocode-missing', methods=['POST'])
def geocode_missing():
    """
    Geocode ONLY festivals that are missing coordinates
    Only updates the coordinates field, preserves all other data
    """
    try:
        print("=" * 60)
        print("GEOCODING MISSING COORDINATES")
        print("=" * 60)
        
        # Get all festivals from Firebase that need geocoding
        festivals_ref = firebase_service.db.collection('festivals')
        docs = festivals_ref.stream()
        
        # Find festivals without coordinates
        festivals_to_geocode = []
        for doc in docs:
            data = doc.to_dict()
            # Only geocode if coordinates are None/missing or geocoding_needed flag is set
            if not data.get('coordinates') or data.get('geocoding_needed'):
                data['id'] = doc.id
                festivals_to_geocode.append(data)
        
        print(f"Found {len(festivals_to_geocode)} festivals needing geocoding\n")
        
        if not festivals_to_geocode:
            return jsonify({
                'message': 'All festivals already have coordinates',
                'geocoded': 0,
                'failed': 0
            })
        
        print(f"Estimated time: ~{len(festivals_to_geocode) * 1.5:.0f} seconds ({len(festivals_to_geocode) * 1.5 / 60:.1f} minutes)\n")
        
        success_count = 0
        failed_count = 0
        
        import time as time_module
        start_time = time_module.time()
        
        for i, festival in enumerate(festivals_to_geocode, 1):
            try:
                print(f"\n[{i}/{len(festivals_to_geocode)}] {festival['name']}")
                
                # Geocode venue
                geocode_result = geocoding_service.geocode_venue(
                    festival['venue'],
                    festival['region']
                )
                
                if geocode_result:
                    # ONLY update coordinates fields, don't touch other data
                    doc_ref = festivals_ref.document(festival['id'])
                    update_data = {
                        'coordinates': {
                            'lat': geocode_result['lat'],
                            'lng': geocode_result['lng']
                        },
                        'geocoding_needed': False,
                        'updated_at': datetime.utcnow()
                    }
                    
                    # Add parsed data if available
                    if geocode_result.get('city'):
                        update_data['parsed_city'] = geocode_result['city']
                    if geocode_result.get('country'):
                        update_data['parsed_country'] = geocode_result['country']
                    if geocode_result.get('formatted_venue'):
                        update_data['venue_formatted'] = geocode_result['formatted_venue']
                    
                    doc_ref.update(update_data)
                    print(f"    ✓ Updated with coordinates")
                    success_count += 1
                else:
                    print(f"    ✗ Geocoding failed")
                    # Mark as failed but don't remove existing data
                    doc_ref = festivals_ref.document(festival['id'])
                    doc_ref.update({
                        'geocoding_failed': True,
                        'updated_at': datetime.utcnow()
                    })
                    failed_count += 1
                
                # Progress summary every 10 festivals
                if i % 10 == 0:
                    elapsed = time_module.time() - start_time
                    avg_per_festival = elapsed / i
                    remaining = (len(festivals_to_geocode) - i) * avg_per_festival
                    print(f"\n--- Progress: {i}/{len(festivals_to_geocode)} ({i/len(festivals_to_geocode)*100:.1f}%) ---")
                    print(f"    Elapsed: {elapsed/60:.1f}m | Remaining: ~{remaining/60:.1f}m")
                    print(f"    Success: {success_count} | Failed: {failed_count}")
                
            except Exception as e:
                print(f"    ✗ Error: {e}")
                failed_count += 1
        
        elapsed_total = time_module.time() - start_time
        print("\n" + "=" * 60)
        print("GEOCODING COMPLETE")
        print("=" * 60)
        print(f"Total time: {elapsed_total/60:.1f} minutes")
        print(f"Success: {success_count} | Failed: {failed_count}")
        print("=" * 60)
        
        return jsonify({
            'message': 'Geocoding complete',
            'total_processed': len(festivals_to_geocode),
            'geocoded': success_count,
            'failed': failed_count
        })
        
    except Exception as e:
        print(f"Error in geocode_missing: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/geocode-festival/<festival_id>', methods=['POST'])
def geocode_single_festival(festival_id):
    """
    Geocode a single festival by ID
    Useful for user-submitted festivals after admin approval
    Works with both legacy 'venue' field and new structured address fields
    """
    try:
        print(f"\n{'=' * 60}")
        print(f"GEOCODING FESTIVAL: {festival_id}")
        print(f"{'=' * 60}\n")
        
        # Get the festival document
        from firebase_admin import firestore
        db = firestore.client()
        doc_ref = db.collection('festivals').document(festival_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return jsonify({'error': 'Festival not found'}), 404
        
        festival = doc.to_dict()
        
        # Check if it already has coordinates
        if festival.get('coordinates'):
            print(f"✓ Festival already has coordinates: {festival['coordinates']}")
            return jsonify({
                'message': 'Festival already geocoded',
                'coordinates': festival['coordinates']
            })
        
        # Build address string from structured fields or use legacy venue field
        address_parts = []
        
        # Try structured address first
        if festival.get('city') or festival.get('postal_code'):
            print("📍 Using structured address fields")
            
            # Street + number
            if festival.get('street'):
                street = festival['street']
                if festival.get('street_number'):
                    street += f" {festival['street_number']}"
                address_parts.append(street)
            
            # Postal code + City
            if festival.get('postal_code'):
                address_parts.append(festival['postal_code'])
            if festival.get('city'):
                address_parts.append(festival['city'])
            if festival.get('country'):
                address_parts.append(festival['country'])
            
            address_string = ', '.join(address_parts)
            print(f"   Constructed address: {address_string}")
            
        # Fallback to legacy venue field
        elif festival.get('venue'):
            print("📍 Using legacy venue field")
            address_string = festival['venue']
            print(f"   Venue: {address_string}")
        else:
            print("✗ No address information found")
            return jsonify({
                'error': 'No address information',
                'message': 'Festival has no venue or address data'
            }), 400
        
        # Geocode the address
        print(f"   Region: {festival.get('region', 'Unknown')}")
        
        geocode_result = geocoding_service.geocode_venue(
            address_string,
            festival.get('region', '')
        )
        
        if geocode_result:
            # Update festival with coordinates
            update_data = {
                'coordinates': {
                    'lat': geocode_result['lat'],
                    'lng': geocode_result['lng']
                },
                'geocoding_needed': False,
                'geocoding_failed': False,
                'updated_at': datetime.utcnow()
            }
            
            # Add parsed data if available
            if geocode_result.get('city'):
                update_data['parsed_city'] = geocode_result['city']
            if geocode_result.get('country'):
                update_data['parsed_country'] = geocode_result['country']
            if geocode_result.get('formatted_venue'):
                update_data['venue_formatted'] = geocode_result['formatted_venue']
            
            doc_ref.update(update_data)
            
            print(f"✓ Successfully geocoded!")
            print(f"  Coordinates: {geocode_result['lat']}, {geocode_result['lng']}")
            if geocode_result.get('city'):
                print(f"  City: {geocode_result['city']}")
            if geocode_result.get('country'):
                print(f"  Country: {geocode_result['country']}")
            
            return jsonify({
                'message': 'Festival geocoded successfully',
                'coordinates': {
                    'lat': geocode_result['lat'],
                    'lng': geocode_result['lng']
                },
                'parsed_city': geocode_result.get('city'),
                'parsed_country': geocode_result.get('country')
            })
        else:
            # Mark as geocoding failed
            doc_ref.update({
                'geocoding_failed': True,
                'geocoding_needed': False,
                'updated_at': datetime.utcnow()
            })
            
            print(f"✗ Geocoding failed for {address_string}")
            
            return jsonify({
                'error': 'Geocoding failed',
                'message': 'Could not find coordinates for this address'
            }), 400
        
    except Exception as e:
        print(f"Error in geocode_single_festival: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("Starting DiscoBears Backend Server...")
    print("Available endpoints:")
    print("  GET  /api/health")
    print("  POST /api/scrape-and-upload          - Scrape + geocode + upload (all in one)")
    print("  POST /api/scrape-without-geocoding   - Fast initial load (no geocoding)")
    print("  POST /api/geocode-missing            - Geocode only festivals without coords")
    print("  POST /api/geocode-festival/<id>      - Geocode a single festival by ID")
    print("  GET  /api/scrape-only                - Test scraper (no upload)")
    print("\nRecommended workflow:")
    print("  1. POST /api/scrape-without-geocoding  (fast, ~10 seconds)")
    print("  2. POST /api/geocode-missing           (slow, ~1-2 minutes)")
    
    app.run(host='0.0.0.0', port=5000, debug=True)

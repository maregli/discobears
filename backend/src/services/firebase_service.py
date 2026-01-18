"""
Firebase Admin SDK service for Firestore operations
Handles initialization and data uploads to Firebase
"""

import os
import hashlib
import json
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore


class FirebaseService:
    def __init__(self):
        # Get service account path from environment
        service_account_path = os.getenv(
            'FIREBASE_SERVICE_ACCOUNT_PATH', 
            './firebase-service-account.json'
        )
        
        # Initialize Firebase Admin SDK
        if not firebase_admin._apps:
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK initialized")
        
        self.db = firestore.client()
        
    def _compute_data_hash(self, festival_data):
        """
        Compute a hash of the scraped festival data (excluding metadata fields).
        This helps detect if festival information has actually changed.
        
        Args:
            festival_data: Festival dictionary
            
        Returns:
            str: SHA256 hash of relevant fields
        """
        # Fields to include in hash (only scraped data that might change)
        hashable_fields = [
            'name', 'source_url', 'dates', 'duration', 'venue_type',
            'genres', 'region', 'venue', 'price', 'visitors', 'external_link'
        ]
        
        # Create a stable representation
        hashable_data = {
            k: festival_data.get(k) for k in hashable_fields 
            if k in festival_data
        }
        
        # Convert to JSON string with sorted keys for consistency
        data_string = json.dumps(hashable_data, sort_keys=True)
        
        # Return SHA256 hash
        return hashlib.sha256(data_string.encode()).hexdigest()
        
    def _generate_festival_id(self, festival_data):
        """
        Generate a consistent ID from festival URL for deduplication
        URL includes name + year + date + location, making it unique per edition
        
        Example:
        URL: https://www.festival-alarm.com/Festivals-2026/Airbeat-One-Festival-Mittwoch-08.-Juli-2026-Neustadt-Glewe
        ID: airbeat-one-festival-mittwoch-08-juli-2026-neustadt-glewe
        
        Args:
            festival_data: Festival dictionary containing source_url or url
            
        Returns:
            str: Sanitized ID suitable for Firestore document ID
        """
        import re
        from urllib.parse import urlparse
        
        # Support both source_url (new) and url (legacy)
        festival_url = festival_data.get('source_url') or festival_data.get('url')
        if not festival_url:
            raise ValueError("Festival data must contain either 'source_url' or 'url'")
        
        # Extract the path from URL and get the last segment
        path = urlparse(festival_url).path
        # Get everything after the last slash
        url_slug = path.split('/')[-1]
        
        # Sanitize: lowercase, replace dots and special chars with hyphens
        festival_id = url_slug.lower()
        festival_id = re.sub(r'[^a-z0-9]+', '-', festival_id)
        festival_id = festival_id.strip('-')
        
        # Limit length to 1500 chars (Firestore limit)
        return festival_id[:1500]
    
    def upload_festival(self, festival_data, update_existing=True, preserve_fields=True):
        """
        Upload or update a single festival in Firestore
        Uses festival URL as unique ID to prevent duplicates
        Uses hash-based change detection to only update when data actually changes
        
        Args:
            festival_data: Dictionary containing festival information
            update_existing: If False, skip if festival already exists
            preserve_fields: If True, preserve certain fields (coordinates, ratings) when updating
            
        Returns:
            tuple: (festival_id, was_updated, needs_geocoding) - ID, whether it was updated, and if geocoding is needed
        """
        try:
            # Generate consistent ID from festival URL (includes year)
            festival_id = self._generate_festival_id(festival_data)
            
            # Compute hash of the new data
            new_data_hash = self._compute_data_hash(festival_data)
            festival_data['data_hash'] = new_data_hash
            
            # Check if document exists
            doc_ref = self.db.collection('festivals').document(festival_id)
            existing_doc = doc_ref.get()
            
            if existing_doc.exists:
                existing_data = existing_doc.to_dict()
                old_data_hash = existing_data.get('data_hash', '')
                
                # Check if data has actually changed
                data_has_changed = (new_data_hash != old_data_hash)
                
                if not update_existing:
                    print(f"⊘ Skipped existing festival: {festival_data['name']} (ID: {festival_id})")
                    return (festival_id, False, False)
                
                if not data_has_changed:
                    print(f"⊘ No changes detected: {festival_data['name']} (ID: {festival_id})")
                    return (festival_id, False, False)
                
                # Data has changed - update it
                print(f"↻ Data changed, updating: {festival_data['name']} (ID: {festival_id})")
                festival_data['updated_at'] = datetime.utcnow()
                
                needs_geocoding = False
                
                if preserve_fields:
                    # Preserve important fields that shouldn't be overwritten
                    fields_to_preserve = [
                        'coordinates',  # Don't overwrite geocoded coordinates
                        'parsed_city',
                        'parsed_country',
                        'venue_formatted',
                        'geocoding_failed',
                        'geocoding_needed',
                        'created_at',  # Preserve original creation date
                        # Preserve rating fields
                        'rating_overall_average',
                        'rating_overall_count',
                        'rating_lineup_average',
                        'rating_lineup_count',
                        'rating_location_average',
                        'rating_location_count',
                    ]
                    
                    for field in fields_to_preserve:
                        if field in existing_data and field not in festival_data:
                            festival_data[field] = existing_data[field]
                    
                    # Check if venue changed - if so, we need to re-geocode
                    old_venue = existing_data.get('venue', '')
                    new_venue = festival_data.get('venue', '')
                    if old_venue != new_venue:
                        print(f"  → Venue changed! Marking for re-geocoding")
                        festival_data['geocoding_needed'] = True
                        festival_data['coordinates'] = None
                        needs_geocoding = True
                
                doc_ref.update(festival_data)
                print(f"  ✓ Updated successfully")
                return (festival_id, True, needs_geocoding)
                
            else:
                # Create new document
                print(f"+ Creating new festival: {festival_data['name']} (ID: {festival_id})")
                festival_data['created_at'] = datetime.utcnow()
                festival_data['updated_at'] = datetime.utcnow()
                festival_data['coordinates'] = None
                festival_data['geocoding_needed'] = True
                festival_data['source'] = 'scraped'  # Mark as scraped festival
                doc_ref.set(festival_data)
                print(f"  ✓ Created successfully")
                return (festival_id, True, True)  # New festivals need geocoding
            
        except Exception as e:
            print(f"✗ Error uploading festival {festival_data.get('name', 'Unknown')}: {e}")
            raise
    
    def get_existing_festival_ids(self):
        """
        Get set of all existing festival IDs in Firestore
        
        Returns:
            set: Set of document IDs
        """
        try:
            docs = self.db.collection('festivals').stream()
            return {doc.id for doc in docs}
        except Exception as e:
            print(f"Error getting existing festival IDs: {e}")
            return set()
    
    def bulk_upload_new_festivals(self, festivals_data):
        """
        Bulk upload only NEW festivals (not already in database)
        Uses batched writes for efficiency
        
        Args:
            festivals_data: List of festival dictionaries
            
        Returns:
            dict: {'new': int, 'skipped': int, 'failed': int}
        """
        try:
            # Get existing festival IDs
            print("Fetching existing festivals from database...")
            existing_ids = self.get_existing_festival_ids()
            print(f"Found {len(existing_ids)} existing festivals in database")
            
            # Generate IDs for all scraped festivals
            festivals_with_ids = []
            for festival in festivals_data:
                festival_id = self._generate_festival_id(festival)
                festivals_with_ids.append((festival_id, festival))
            
            # Filter to only new festivals
            new_festivals = [
                (fid, fdata) for fid, fdata in festivals_with_ids 
                if fid not in existing_ids
            ]
            
            skipped_count = len(festivals_data) - len(new_festivals)
            
            if not new_festivals:
                print("No new festivals to upload - all already exist!")
                return {'new': 0, 'skipped': skipped_count, 'failed': 0}
            
            print(f"\nUploading {len(new_festivals)} new festivals (skipping {skipped_count} existing)...")
            
            # Bulk upload in batches of 500 (Firestore limit)
            batch_size = 500
            new_count = 0
            failed_count = 0
            
            for i in range(0, len(new_festivals), batch_size):
                batch = self.db.batch()
                batch_festivals = new_festivals[i:i + batch_size]
                
                for festival_id, festival_data in batch_festivals:
                    try:
                        doc_ref = self.db.collection('festivals').document(festival_id)
                        festival_data['created_at'] = datetime.utcnow()
                        festival_data['updated_at'] = datetime.utcnow()
                        festival_data['source'] = 'scraped'  # Mark as scraped festival
                        batch.set(doc_ref, festival_data)
                        new_count += 1
                    except Exception as e:
                        print(f"  ✗ Error preparing {festival_data.get('name')}: {e}")
                        failed_count += 1
                
                # Commit batch
                batch.commit()
                print(f"  Uploaded batch {i//batch_size + 1} ({len(batch_festivals)} festivals)")
            
            return {'new': new_count, 'skipped': skipped_count, 'failed': failed_count}
            
        except Exception as e:
            print(f"Error in bulk upload: {e}")
            raise
    
    def upload_festivals_batch(self, festivals):
        """
        Upload multiple festivals to Firestore
        
        Args:
            festivals: List of festival dictionaries
            
        Returns:
            dict: {'success': int, 'failed': int}
        """
        results = {'success': 0, 'failed': 0}
        
        for festival in festivals:
            try:
                self.upload_festival(festival)
                results['success'] += 1
            except Exception as e:
                print(f"Failed to upload: {e}")
                results['failed'] += 1
        
        return results
    
    def clear_festivals_collection(self):
        """
        Delete all documents in the festivals collection
        Useful for re-scraping fresh data
        """
        try:
            docs = self.db.collection('festivals').stream()
            deleted_count = 0
            
            for doc in docs:
                doc.reference.delete()
                deleted_count += 1
            
            print(f"Deleted {deleted_count} festival documents")
            return deleted_count
            
        except Exception as e:
            print(f"Error clearing festivals collection: {e}")
            raise

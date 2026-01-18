"""
One-time migration script to add 'source: scraped' to existing festivals
Run this ONCE in the backend container to update all current festivals

Usage:
  docker-compose exec backend poetry run python -m src.scripts.migrate_add_source_field
"""
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import os


def migrate_existing_festivals():
    """Add 'source: scraped' to all existing festivals that don't have a source field"""
    
    # Initialize Firebase if not already done
    if not firebase_admin._apps:
        service_account_path = os.getenv(
            'FIREBASE_SERVICE_ACCOUNT_PATH',
            './firebase-service-account.json'
        )
        cred = credentials.Certificate(service_account_path)
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    
    print("=" * 70)
    print("FESTIVAL SOURCE MIGRATION SCRIPT")
    print("=" * 70)
    print("This script adds 'source: scraped' to existing festival documents")
    print("that don't already have a source field.\n")
    
    # Get all festivals
    print("📥 Fetching all festivals from Firestore...")
    festivals_ref = db.collection('festivals')
    festivals = festivals_ref.stream()
    
    batch = db.batch()
    count = 0
    updated = 0
    batch_count = 0
    
    for doc in festivals:
        count += 1
        data = doc.to_dict()
        
        # Only update if 'source' field doesn't exist
        if 'source' not in data:
            batch.update(doc.reference, {
                'source': 'scraped'
            })
            updated += 1
            print(f"  [{count}] ✓ Marking as scraped: {data.get('name', 'Unknown')}")
            
            # Commit every 500 documents (Firestore batch limit)
            if updated > 0 and updated % 500 == 0:
                batch_count += 1
                print(f"\n  📤 Committing batch #{batch_count} ({updated} updates so far)...\n")
                batch.commit()
                batch = db.batch()
        else:
            print(f"  [{count}] ⊘ Already has source: {data.get('name', 'Unknown')} (source: {data.get('source')})")
    
    # Commit remaining updates
    if updated % 500 != 0 and updated > 0:
        batch_count += 1
        print(f"\n  📤 Committing final batch #{batch_count}...\n")
        batch.commit()
    
    print("=" * 70)
    print("✅ MIGRATION COMPLETE!")
    print("=" * 70)
    print(f"  Total festivals processed: {count}")
    print(f"  Updated (added source): {updated}")
    print(f"  Skipped (already had source): {count - updated}")
    print(f"  Total batches committed: {batch_count}")
    print("=" * 70)


if __name__ == '__main__':
    try:
        migrate_existing_festivals()
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

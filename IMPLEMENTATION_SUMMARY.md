# User Festival Submissions Feature - Implementation Complete

## ✅ Successfully Implemented

### 1. Migration Script
- **File**: `backend/src/scripts/migrate_add_source_field.py`
- **Status**: ✅ Executed successfully
- **Result**: All 112 existing festivals now have `source: 'scraped'`

### 2. Backend Updates
- **File**: `backend/src/services/firebase_service.py`
- **Changes**: 
  - New scraped festivals automatically get `source: 'scraped'`
  - Both `upload_festival()` and `bulk_upload_new_festivals()` updated

### 3. Frontend Type System
- **File**: `frontend/src/types/festival.ts`
- **Added Fields**:
  ```typescript
  source?: 'scraped' | 'user-submitted';
  status?: 'pending' | 'approved' | 'rejected';
  submittedBy?: string;
  submittedByName?: string;
  submittedAt?: Date;
  reviewedAt?: Date;
  rejectionReason?: string;
  ```

### 4. Firestore Functions
- **File**: `frontend/src/firebaseServices/firestore.ts`
- **Added Functions**:
  - `isUserAdmin(email)` - Check if user has admin privileges
  - `submitUserFestival(data, userId, userName)` - Submit a festival
  - `getFestivalsByStatus(status)` - Get pending/approved/rejected festivals
  - `updateFestivalStatus(id, status, reason)` - Approve/reject festivals

### 5. Map Filtering
- **File**: `frontend/src/components/FestivalMap.tsx`
- **Updated**: Now filters out pending user-submitted festivals
- **Logic**:
  - Legacy festivals (no source) → Always shown
  - Scraped festivals → Always shown
  - User-submitted → Only if approved

### 6. Submit Festival Form
- **File**: `frontend/src/components/AddFestivalForm.tsx`
- **Features**:
  - Required fields: name, URL, venue, genres
  - Optional fields: dates, duration, venue type, region, price, visitors
  - Multi-select genre chips
  - Validation with error messages
  - Submission creates pending festival

### 7. Admin Panel
- **File**: `frontend/src/pages/AdminPanel.tsx`
- **Features**:
  - Admin-only access (redirects non-admins)
  - Tabs: Pending / Approved / Rejected
  - Festival cards with all details
  - Approve/Reject buttons
  - Optional rejection reason
  - View festival detail link

### 8. Routes
- **File**: `frontend/src/App.tsx`
- **Added Routes**:
  - `/submit-festival` - User submission form
  - `/admin` - Admin moderation panel

### 9. UI Integration
- **File**: `frontend/src/components/FestivalMap.tsx`
- **Added**: Green "Submit a Festival" button in sidebar

## 📋 Next Steps Required

### 1. Update Firestore Security Rules

Go to **Firebase Console** → **Firestore Database** → **Rules** and replace with:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Admin collection
    match /admins/{document} {
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/admins/admin-users).data.emails.hasAny([request.auth.token.email]);
      allow write: if false;
    }
    
    match /festivals/{festivalId} {
      allow read: if true;
      
      // Users can create submissions
      allow create: if request.auth != null 
        && request.resource.data.source == 'user-submitted'
        && request.resource.data.submittedBy == request.auth.uid
        && request.resource.data.status == 'pending';
      
      // Only admins can update status
      allow update: if request.auth != null && 
        get(/databases/$(database)/documents/admins/admin-users).data.emails.hasAny([request.auth.token.email]);
      
      allow delete: if false;
      
      // Ratings and comments
      match /ratings/{userId} {
        allow read: if true;
        allow write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /comments/{commentId} {
        allow read: if true;
        allow create: if request.auth != null;
        allow update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
      }
    }
  }
}
```

### 2. Create Admin User Document

In **Firebase Console**:

1. Go to **Firestore Database**
2. Create collection: `admins`
3. Create document with ID: `admin-users`
4. Add field: `emails` (type: **array**)
5. Add your admin email(s) to the array:
   ```
   ["your-google-email@gmail.com"]
   ```

## 🎯 How It Works

### User Flow
1. User clicks "Submit a Festival" button
2. Fills out form (name, URL, venue, genres required)
3. Submits → Festival created with `status: 'pending'`
4. Festival hidden from map until approved

### Admin Flow
1. Admin navigates to `/admin`
2. System checks if user's email is in `admins/admin-users`
3. If authorized, sees list of pending festivals
4. Can approve (shows on map) or reject (stays hidden)
5. Can add optional rejection reason

### Map Display
- **Scraped festivals**: Always visible (source: 'scraped' or undefined)
- **User-submitted**: Only visible if status: 'approved'

## 📊 Data Model Summary

```
Festival Document:
{
  // Existing fields (unchanged)
  name, url, dates, venue, genres, coordinates, etc.
  
  // NEW: Source tracking
  source: 'scraped' | 'user-submitted',
  
  // NEW: User submission metadata (only if user-submitted)
  status: 'pending' | 'approved' | 'rejected',
  submittedBy: 'userId',
  submittedByName: 'username',
  submittedAt: Timestamp,
  reviewedAt: Timestamp,
  rejectionReason: 'optional reason'
}
```

## ✅ Testing Checklist

- [x] Migration script executed successfully (112 festivals updated)
- [x] Backend scraper adds `source: 'scraped'` to new festivals
- [x] Map displays scraped festivals
- [ ] User can submit festival (pending approval)
- [ ] Pending festivals don't appear on map
- [ ] Admin can access `/admin` panel
- [ ] Non-admin gets redirected from `/admin`
- [ ] Admin can approve festival → appears on map
- [ ] Admin can reject festival → stays hidden

## 🚀 Ready to Use

The feature is fully implemented! Complete the two manual steps above (Firestore rules + admin document) and test the user submission and admin approval flow.

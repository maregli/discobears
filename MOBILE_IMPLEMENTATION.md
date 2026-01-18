# Mobile-Friendly Implementation

## Overview
Implemented a completely different mobile experience inspired by Booking.com's mobile app design.

## Changes Made

### 1. New Components

#### `hooks/useIsMobile.ts`
- Custom hook to detect mobile devices (< 768px width)
- Automatically updates on window resize
- Used throughout the app to conditionally render mobile/desktop views

#### `components/MobileFilterDrawer.tsx`
- Full-screen filter drawer (slides up from bottom)
- Booking.com style with blue header
- Expandable sections for genres and date ranges
- Shows festival count in bottom button
- Smooth animations for better UX

#### `components/FestivalBottomSheet.tsx`
- Single festival card that appears at the bottom
- Swipeable between multiple festivals in the same area
- Shows festival image placeholder, ratings, location, dates, and genres
- "See availability" button to view full details
- Navigation dots for multiple festivals
- Handle bar for intuitive closing

### 2. Updated Components

#### `components/FestivalMap.tsx`
- **Complete mobile redesign:**
  - Fixed top bar with search and filter buttons
  - Full-screen map view (no sidebar)
  - Booking.com style map markers (white pills with text)
  - Bottom sheet for festival details instead of sidebar
  - Click on marker → shows bottom sheet
  - Click on cluster → zooms in or shows all festivals in bottom sheet

- **Desktop view remains unchanged:**
  - Original sidebar layout preserved
  - All existing functionality intact

#### `index.css`
- Added mobile-specific CSS with media queries
- Larger touch targets (44px minimum)
- Disabled tooltips on mobile (interfere with touch)
- Repositioned zoom controls (bottom-right)
- Prevented unwanted scrolling/zooming on iOS
- Fixed body overflow issues on mobile

#### `public/index.html`
- Updated viewport meta tag for better mobile support
- Prevents unwanted zoom on input focus (iOS)
- Added `viewport-fit=cover` for iPhone notches
- Changed theme color to match brand (#0066ff)

## Mobile UX Features

### Booking.com Inspired Design
1. **Top Search Bar**: Always visible, fixed at top
2. **Filter Button**: Shows badge with active filter count
3. **Submit Button**: Quick access to submit festivals
4. **Map Markers**: Clean white pills showing festival count for clusters
5. **Bottom Sheet**: Single festival card at a time (swipeable)
6. **Full-Page Filters**: Immersive filter experience with animations

### Touch Optimizations
- Larger tap targets (minimum 44x44px)
- Swipe gestures on bottom sheet
- No tooltips (they interfere with touch)
- Larger zoom controls
- Prevented accidental zoom on inputs

### Performance
- Conditional rendering (only renders mobile OR desktop, not both)
- Smooth animations with CSS transitions
- Optimized for touch interactions

## Testing

To test the mobile view:
1. Open the app in your browser
2. Open DevTools (F12)
3. Toggle device toolbar (Ctrl+Shift+M or Cmd+Shift+M)
4. Select a mobile device (iPhone, Pixel, etc.)
5. Refresh the page

Or simply visit from your mobile device!

## Breakpoints

- **Mobile**: < 768px (completely different UI)
- **Tablet**: 769px - 1024px (desktop view with narrower sidebar)
- **Desktop**: > 1024px (original full-width sidebar)

## Future Enhancements

Potential improvements for v2:
- Add price information to markers (when available in data)
- Image carousel in bottom sheet
- Share festival functionality
- Save/favorite festivals
- Offline map support with service workers
- Progressive Web App (PWA) features

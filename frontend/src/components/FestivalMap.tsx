import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { subscribeToFestivals, isUserAdmin } from 'firebaseServices/firestore';
import { Festival } from 'types/festival';
import FestivalCard from './FestivalCard';
import FilterPanel from './FilterPanel';
import LoginModal from './LoginModal';
import MobileFilterDrawer from './MobileFilterDrawer';
import MobileProfileDrawer from './MobileProfileDrawer';
import FestivalBottomSheet from './FestivalBottomSheet';
import { useAuth } from 'contexts/AuthContext';
import { useIsMobile } from 'hooks/useIsMobile';

// Custom marker icon - modern style with enhanced hover effect
const createCustomIcon = (isHighlighted: boolean, count?: number, isMobile: boolean = false) => {
  if (count && count > 1) {
    // Cluster marker
    const size = isMobile ? 48 : 40;
    const highlightedSize = isHighlighted ? size * 1.3 : size;
    return L.divIcon({
      className: 'custom-cluster-marker',
      html: `
        <div style="
          width: ${highlightedSize}px;
          height: ${highlightedSize}px;
          background: ${isHighlighted 
            ? 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)' 
            : 'linear-gradient(135deg, #0066ff 0%, #0052cc 100%)'};
          border: ${isHighlighted ? '4px' : '3px'} solid white;
          border-radius: 50%;
          box-shadow: ${isHighlighted 
            ? '0 6px 20px rgba(255,68,68,0.6), 0 0 0 4px rgba(255,68,68,0.3)' 
            : '0 3px 8px rgba(0,0,0,0.3)'};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${isMobile ? '18px' : '16px'};
          font-weight: bold;
          color: white;
          transition: all 0.3s ease;
          animation: ${isHighlighted ? 'pulse 1.5s ease-in-out infinite' : 'none'};
        ">
          ${count}
        </div>
      `,
      iconSize: [highlightedSize, highlightedSize],
      iconAnchor: [highlightedSize / 2, highlightedSize / 2],
    });
  }
  
  // Individual marker
  const size = isMobile ? 40 : 32;
  const highlightedSize = isHighlighted ? size * 1.4 : size;
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${highlightedSize}px;
        height: ${highlightedSize}px;
        background: ${isHighlighted ? '#ff4444' : '#0066ff'};
        border: ${isHighlighted ? '4px' : '3px'} solid white;
        border-radius: 50%;
        box-shadow: ${isHighlighted 
          ? '0 6px 20px rgba(255,68,68,0.6), 0 0 0 4px rgba(255,68,68,0.3)' 
          : '0 3px 8px rgba(0,0,0,0.3)'};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isMobile ? '18px' : '16px'};
        transition: all 0.3s ease;
        animation: ${isHighlighted ? 'pulse 1.5s ease-in-out infinite' : 'none'};
      ">
        🎵
      </div>
    `,
    iconSize: [highlightedSize, highlightedSize],
    iconAnchor: [highlightedSize / 2, highlightedSize / 2],
  });
};

// Component to handle map events without causing zoom loops
const MapEventHandler: React.FC<{ 
  onZoomEnd: (zoom: number) => void;
  onMoveEnd: (bounds: L.LatLngBounds) => void;
}> = ({ onZoomEnd, onMoveEnd }) => {
  const lastZoomRef = useRef<number | null>(null);
  const lastBoundsRef = useRef<string | null>(null);
  
  const map = useMapEvents({
    zoomend: () => {
      const currentZoom = map.getZoom();
      const bounds = map.getBounds();
      const boundsKey = `${bounds.getNorth()},${bounds.getSouth()},${bounds.getEast()},${bounds.getWest()}`;
      
      // Only trigger callbacks if values actually changed
      if (lastZoomRef.current !== currentZoom) {
        lastZoomRef.current = currentZoom;
        onZoomEnd(currentZoom);
      }
      
      if (lastBoundsRef.current !== boundsKey) {
        lastBoundsRef.current = boundsKey;
        onMoveEnd(bounds);
      }
    },
    moveend: () => {
      const bounds = map.getBounds();
      const boundsKey = `${bounds.getNorth()},${bounds.getSouth()},${bounds.getEast()},${bounds.getWest()}`;
      
      if (lastBoundsRef.current !== boundsKey) {
        lastBoundsRef.current = boundsKey;
        onMoveEnd(bounds);
      }
    },
  });
  
  return null;
};

// Simple clustering function
const clusterFestivals = (festivals: Festival[], zoom: number) => {
  if (zoom >= 10) {
    // At high zoom, group only exact same locations
    const locationMap = new Map<string, Festival[]>();
    
    festivals.forEach(f => {
      const key = `${f.coordinates!.lat.toFixed(6)},${f.coordinates!.lng.toFixed(6)}`;
      if (!locationMap.has(key)) {
        locationMap.set(key, []);
      }
      locationMap.get(key)!.push(f);
    });
    
    return Array.from(locationMap.values()).map(festivalList => ({
      festivals: festivalList,
      center: festivalList[0].coordinates!
    }));
  }
  
  // Calculate clustering distance based on zoom
  const clusterDistance = zoom < 6 ? 2 : zoom < 8 ? 1 : 0.5; // degrees
  
  const clusters: { festivals: Festival[], center: { lat: number, lng: number } }[] = [];
  const processed = new Set<string>();
  
  festivals.forEach(festival => {
    if (processed.has(festival.id)) return;
    
    const cluster = [festival];
    processed.add(festival.id);
    
    // Find nearby festivals
    festivals.forEach(other => {
      if (processed.has(other.id)) return;
      
      const distance = Math.sqrt(
        Math.pow(festival.coordinates!.lat - other.coordinates!.lat, 2) +
        Math.pow(festival.coordinates!.lng - other.coordinates!.lng, 2)
      );
      
      if (distance < clusterDistance) {
        cluster.push(other);
        processed.add(other.id);
      }
    });
    
    // Calculate center
    const center = {
      lat: cluster.reduce((sum, f) => sum + f.coordinates!.lat, 0) / cluster.length,
      lng: cluster.reduce((sum, f) => sum + f.coordinates!.lng, 0) / cluster.length,
    };
    
    clusters.push({ festivals: cluster, center });
  });
  
  return clusters;
};

const FestivalMap: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [highlightedFestival, setHighlightedFestival] = useState<string | null>(null);
  const [selectedFestival, setSelectedFestival] = useState<Festival | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  const [currentZoom, setCurrentZoom] = useState(5);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  
  // Mobile-specific states
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMobileProfile, setShowMobileProfile] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [selectedClusterFestivals, setSelectedClusterFestivals] = useState<Festival[]>([]);
  const [currentBottomSheetIndex, setCurrentBottomSheetIndex] = useState(0);
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);
  
  // Filters
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ 
    year: new Date().getFullYear(), 
    startMonth: 1, 
    endMonth: 12 
  });
  const [searchQuery, setSearchQuery] = useState('');

  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    console.log('Subscribing to festivals...');
    const unsubscribe = subscribeToFestivals(setFestivals, setIsLoading, setError);
    
    return () => {
      console.log('Unsubscribing from festivals');
      unsubscribe();
    };
  }, []);

  // Check if current user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (user && user.email) {
        console.log('Checking admin status for:', user.email);
        const adminStatus = await isUserAdmin(user.email);
        console.log('Admin status:', adminStatus);
        setIsAdmin(adminStatus);
      } else {
        console.log('No user or email, not admin');
        setIsAdmin(false);
      }
    };
    
    checkAdmin();
  }, [user]);

  // Invalidate map size when switching between mobile/desktop
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
    }
  }, [isMobile]);

  // Load ratings for all festivals
  useEffect(() => {
    // Map tooltips now use denormalized rating data from festival documents
    // No need to load separately - it's already on the festival object!
  }, [festivals]);

  // Get all unique genres for filter
  const allGenres = useMemo(() => {
    const genreSet = new Set<string>();
    festivals.forEach(f => {
      f.genres.forEach(g => genreSet.add(g));
    });
    return Array.from(genreSet).sort();
  }, [festivals]);

  // Filter festivals for MAP display (all that pass genre/date/search filters)
  const filteredFestivals = useMemo(() => {
    return festivals.filter(f => {
      // Must have valid coordinates
      if (!f.coordinates || !f.coordinates.lat || !f.coordinates.lng ||
          f.coordinates.lat === 0 || f.coordinates.lng === 0) {
        return false;
      }

      // Source/Status filtering - only show approved user submissions
      // Legacy scraped festivals (no source) are always shown
      // New scraped festivals (source: 'scraped') are always shown
      // User-submitted must be approved to show
      if (f.source === 'user-submitted' && f.status !== 'approved') {
        return false;
      }

      // Genre filter
      if (selectedGenres.length > 0) {
        const hasMatchingGenre = f.genres.some(g => selectedGenres.includes(g));
        if (!hasMatchingGenre) return false;
      }

      // Date filter - check if festival falls within selected year and month range
      if (dateRange.startMonth !== 1 || dateRange.endMonth !== 12 || dateRange.year !== new Date().getFullYear()) {
        // Extract year from URL (e.g., "Festivals-2025")
        const urlMatch = f.url?.match(/Festivals-(\d{4})/);
        const festivalYear = urlMatch ? parseInt(urlMatch[1]) : new Date().getFullYear();
        
        // Check if year matches
        if (festivalYear !== dateRange.year) {
          return false;
        }

        // Parse date string (e.g., "08.07.-12.07.")
        const dateMatch = f.dates.match(/^(\d{2})\.(\d{2})/);
        if (dateMatch) {
          const festivalStartMonth = parseInt(dateMatch[2]);
          
          // Check if festival month is within range
          if (festivalStartMonth < dateRange.startMonth || festivalStartMonth > dateRange.endMonth) {
            return false;
          }
        }
      }

      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = f.name.toLowerCase().includes(query);
        const matchesCity = (f.parsed_city || '').toLowerCase().includes(query);
        const matchesRegion = f.region.toLowerCase().includes(query);
        if (!matchesName && !matchesCity && !matchesRegion) return false;
      }

      return true;
    });
  }, [festivals, selectedGenres, dateRange, searchQuery]);

  // Filter festivals for SIDEBAR display (only those visible in current map bounds)
  const visibleFestivals = useMemo(() => {
    if (!mapBounds) {
      // If no bounds yet, show all filtered festivals
      return filteredFestivals;
    }

    return filteredFestivals.filter(f => {
      if (!f.coordinates) return false;
      
      // Check if festival coordinates are within current map bounds
      return mapBounds.contains([f.coordinates.lat, f.coordinates.lng]);
    });
  }, [filteredFestivals, mapBounds]);

  // On mobile, update festival list for bottom sheet
  useEffect(() => {
    if (isMobile && visibleFestivals.length > 0) {
      // Only update the festivals list, don't auto-open
      setSelectedClusterFestivals(visibleFestivals);
      if (showBottomSheet) {
        // Reset to first festival when list changes
        setCurrentBottomSheetIndex(0);
      }
    }
  }, [isMobile, visibleFestivals.length, showBottomSheet]);

  // Highlight marker when bottom sheet index changes on mobile
  useEffect(() => {
    if (isMobile && visibleFestivals.length > 0 && currentBottomSheetIndex < visibleFestivals.length) {
      const currentFestival = visibleFestivals[currentBottomSheetIndex];
      setHighlightedFestival(currentFestival.id);
    }
  }, [currentBottomSheetIndex, isMobile, visibleFestivals]);

  // Cluster festivals based on zoom level
  const clusteredFestivals = useMemo(() => {
    return clusterFestivals(filteredFestivals, currentZoom);
  }, [filteredFestivals, currentZoom]);

  const handleFestivalClick = (festival: Festival) => {
    setSelectedFestival(festival);
    setHighlightedFestival(festival.id);
    
    // Zoom to festival without triggering state loop
    if (mapRef.current && festival.coordinates) {
      mapRef.current.setView([festival.coordinates.lat, festival.coordinates.lng], 12, {
        animate: true
      });
    }
  };

  const handleClusterClick = (cluster: { festivals: Festival[], center: { lat: number, lng: number } }) => {
    if (cluster.festivals.length === 1) {
      // Single festival
      if (isMobile) {
        // On mobile, update bottom sheet to show this festival
        const festivalIndex = visibleFestivals.findIndex(f => f.id === cluster.festivals[0].id);
        if (festivalIndex !== -1) {
          setCurrentBottomSheetIndex(festivalIndex);
          // Optionally center map on this festival
          if (mapRef.current) {
            mapRef.current.setView([cluster.center.lat, cluster.center.lng], 12, {
              animate: true
            });
          }
        }
      } else {
        // On desktop, navigate to detail page
        navigate(`/festival/${cluster.festivals[0].id}`);
      }
    } else if (mapRef.current) {
      // Multiple festivals - zoom to show them all
      if (isMobile && currentZoom >= 12) {
        // On mobile at high zoom, update bottom sheet with first festival in cluster
        const festivalIndex = visibleFestivals.findIndex(f => f.id === cluster.festivals[0].id);
        if (festivalIndex !== -1) {
          setCurrentBottomSheetIndex(festivalIndex);
        }
      } else {
        // Check if all festivals are at exact same location
        const uniqueLocations = new Set(
          cluster.festivals.map(f => `${f.coordinates!.lat.toFixed(6)},${f.coordinates!.lng.toFixed(6)}`)
        );
        
        if (uniqueLocations.size === 1) {
          // All at same location - just zoom in to that point
          mapRef.current.setView(
            [cluster.center.lat, cluster.center.lng],
            Math.min(currentZoom + 3, 18),
            { animate: true, duration: 0.5 }
          );
        } else {
          // Different locations - zoom to fit all
          const coordinates = cluster.festivals.map(f => [f.coordinates!.lat, f.coordinates!.lng] as [number, number]);
          const bounds = L.latLngBounds(coordinates);
          mapRef.current.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 15,
            animate: true,
            duration: 0.5
          });
        }
      }
    }
  };

  const handleClearFilters = () => {
    setSelectedGenres([]);
    setDateRange({ year: new Date().getFullYear(), startMonth: 1, endMonth: 12 });
    setSearchQuery('');
  };

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        color: '#ff4444',
        fontSize: '18px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        Error loading festivals: {error.message}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        fontSize: '18px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        Loading festivals...
      </div>
    );
  }

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      display: 'flex',
      overflow: 'hidden',
      position: 'fixed',
      top: 0,
      left: 0,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* MOBILE VIEW */}
      {isMobile ? (
        <div style={{ 
          width: '100vw', 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column'
        }}>
          {/* Mobile Top Bar */}
          <div style={{
            backgroundColor: 'transparent',
            padding: '12px 16px',
            flexShrink: 0,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000
          }}>
            {/* Search Bar with integrated actions */}
            <div style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'center'
            }}>
              {/* Search Container with Actions */}
              <div style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'white',
                border: '1px solid #d0d0d0',
                borderRadius: '24px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                height: '48px'
              }}>
                {/* Search Icon */}
                <span style={{
                  padding: '0 12px',
                  fontSize: '18px',
                  color: '#666',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  🔍
                </span>
                
                {/* Search Input */}
                <input
                  type="text"
                  placeholder="Search festivals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px 8px',
                    border: 'none',
                    outline: 'none',
                    fontSize: '15px',
                    backgroundColor: 'transparent',
                    height: '100%'
                  }}
                />
                
                {/* Filter Button */}
                <button
                  onClick={() => setShowMobileFilters(true)}
                  title="Filter"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#666',
                    height: '100%',
                    position: 'relative'
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="6" x2="10" y2="6"></line>
                    <line x1="14" y1="6" x2="20" y2="6"></line>
                    <circle cx="12" cy="6" r="2"></circle>
                    <line x1="4" y1="12" x2="16" y2="12"></line>
                    <line x1="20" y1="12" x2="20" y2="12"></line>
                    <circle cx="18" cy="12" r="2"></circle>
                    <line x1="4" y1="18" x2="8" y2="18"></line>
                    <line x1="12" y1="18" x2="20" y2="18"></line>
                    <circle cx="10" cy="18" r="2"></circle>
                  </svg>
                  {(selectedGenres.length > 0 || dateRange.startMonth !== 1 || dateRange.endMonth !== 12) && (
                    <span style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      backgroundColor: '#0066ff',
                      color: 'white',
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {selectedGenres.length}
                    </span>
                  )}
                </button>
              </div>
              
              {/* Profile Button - Round White Button */}
              <button
                onClick={() => setShowMobileProfile(true)}
                title="Profile"
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  border: '1px solid #d0d0d0',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  color: user ? '#0066ff' : '#666',
                  flexShrink: 0
                }}
              >
                👤
              </button>
            </div>
          </div>

          {/* Map - SIMPLIFIED */}
          <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
            {/* Bottom buttons when drawer is closed */}
            {!showBottomSheet && (
              <>
                {/* Floating Add Festival Button */}
                <button
                  onClick={() => navigate('/submit-festival')}
                  title="Add Festival"
                  style={{
                    position: 'absolute',
                    bottom: '32px',
                    right: '12px',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(40,167,69,0.4)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    zIndex: 1000,
                    transition: 'all 0.3s ease'
                  }}
                >
                  +
                </button>

                {/* Show list button when bottom sheet is closed */}
                {visibleFestivals.length > 0 && (
                  <button
                    onClick={() => setShowBottomSheet(true)}
                    style={{
                      position: 'absolute',
                      bottom: '32px',
                      left: '12px',
                      right: '80px',
                      backgroundColor: 'white',
                      border: '1px solid #d0d0d0',
                      borderRadius: '24px',
                      padding: '14px 24px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                      cursor: 'pointer',
                      fontSize: '15px',
                      fontWeight: '600',
                      color: '#0066ff',
                      zIndex: 1000,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    📍 Show {visibleFestivals.length} festival{visibleFestivals.length !== 1 ? 's' : ''}
                  </button>
                )}
              </>
            )}

            <MapContainer
              key="mobile-map"
              center={[50, 10]}
              zoom={5}
              style={{ width: '100%', height: '100%' }}
              ref={mapRef}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              <MapEventHandler 
                onZoomEnd={setCurrentZoom} 
                onMoveEnd={setMapBounds}
              />
              
              {clusteredFestivals.map((cluster, idx) => {
                const isCluster = cluster.festivals.length > 1;
                const isHighlighted = cluster.festivals.some(f => f.id === highlightedFestival);
                const festivalIds = cluster.festivals.map(f => f.id).sort().join('-');
                
                return (
                  <Marker
                    key={`mobile-marker-${idx}-${festivalIds}-${isHighlighted ? 'highlighted' : 'normal'}`}
                    position={[cluster.center.lat, cluster.center.lng]}
                    icon={createCustomIcon(isHighlighted, isCluster ? cluster.festivals.length : undefined, isMobile)}
                    eventHandlers={{
                      click: () => handleClusterClick(cluster)
                    }}
                  />
                );
              })}
            </MapContainer>
          </div>

          {/* Bottom Sheet - Closable on mobile */}
          {showBottomSheet && selectedClusterFestivals.length > 0 && (
            <FestivalBottomSheet
              festivals={selectedClusterFestivals}
              onClose={() => {
                setShowBottomSheet(false);
                setIsBottomSheetExpanded(false);
              }}
              currentIndex={currentBottomSheetIndex}
              onIndexChange={setCurrentBottomSheetIndex}
              isPersistent={true}
              isExpanded={isBottomSheetExpanded}
              onToggleExpand={() => setIsBottomSheetExpanded(!isBottomSheetExpanded)}
            />
          )}

          {/* Mobile Filter Drawer */}
          <MobileFilterDrawer
            isOpen={showMobileFilters}
            onClose={() => setShowMobileFilters(false)}
            genres={allGenres}
            selectedGenres={selectedGenres}
            onGenreChange={setSelectedGenres}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            onClearFilters={handleClearFilters}
            festivalCount={filteredFestivals.length}
          />

          {/* Mobile Profile Drawer */}
          <MobileProfileDrawer
            isOpen={showMobileProfile}
            onClose={() => setShowMobileProfile(false)}
            onOpenLogin={() => setShowLoginModal(true)}
          />
        </div>
      ) : (
        /* DESKTOP VIEW - Original sidebar layout */
        <>
          {/* Sidebar */}
          <div style={{
            width: isSidebarOpen ? '420px' : '0',
            height: '100%',
            backgroundColor: '#f7f7f7',
            borderRight: '1px solid #e0e0e0',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.3s ease',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px',
              backgroundColor: 'white',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1a1a1a' }}>
                  Festivals
                </h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {user ? (
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={logout}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '14px',
                          cursor: 'pointer',
                          color: '#0066ff',
                          fontWeight: '600'
                        }}
                        title={user.email || ''}
                      >
                        Logout
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowLoginModal(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '14px',
                        cursor: 'pointer',
                        color: '#0066ff',
                        fontWeight: '600'
                      }}
                    >
                      Sign In
                    </button>
                  )}
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '24px',
                      cursor: 'pointer',
                      padding: '0',
                      color: '#666'
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
              
              {/* Search */}
              <input
                type="text"
                placeholder="Search festivals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d0d0d0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />

              {/* Submit Festival Button */}
              <button
                onClick={() => navigate('/submit-festival')}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginTop: '16px'
                }}
              >
                + Submit a Festival
              </button>

              {/* Admin Panel Button (only shown to admins) */}
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#ff6b35',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginTop: '8px'
                  }}
                >
                  🛡️ Admin Panel
                </button>
              )}
            </div>

            {/* Filters */}
            <div style={{ padding: '16px', backgroundColor: '#f7f7f7' }}>
              <FilterPanel
                genres={allGenres}
                selectedGenres={selectedGenres}
                onGenreChange={setSelectedGenres}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                onClearFilters={handleClearFilters}
              />
            </div>

            {/* Festival List */}
            <div style={{ 
              flex: 1,
              overflowY: 'auto',
              padding: '0 16px 16px 16px'
            }}>
              {visibleFestivals.length > 0 ? (
                visibleFestivals.map(festival => (
                  <FestivalCard
                    key={festival.id}
                    festival={festival}
                    onHover={() => setHighlightedFestival(festival.id)}
                    onLeave={() => setHighlightedFestival(null)}
                    onClick={() => handleFestivalClick(festival)}
                    isHighlighted={highlightedFestival === festival.id}
                  />
                ))
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#888',
                  fontSize: '14px'
                }}>
                  No festivals in this area. Try zooming out or adjusting filters.
                </div>
              )}
            </div>
          </div>

          {/* Map */}
          <div style={{ flex: 1, position: 'relative' }}>
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                style={{
                  position: 'absolute',
                  top: '20px',
                  left: '20px',
                  zIndex: 1000,
                  backgroundColor: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                ☰ Show Festivals ({visibleFestivals.length})
              </button>
            )}
            
            <MapContainer
              key="desktop-map"
              center={[50, 10]}
              zoom={5}
              style={{ width: '100%', height: '100%' }}
              ref={mapRef}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              <MapEventHandler 
                onZoomEnd={setCurrentZoom} 
                onMoveEnd={setMapBounds}
              />
              
              {clusteredFestivals.map((cluster, idx) => {
                const isCluster = cluster.festivals.length > 1;
                const isHighlighted = cluster.festivals.some(f => f.id === highlightedFestival);
                const festivalIds = cluster.festivals.map(f => f.id).sort().join('-');
                
                return (
                  <Marker
                    key={`marker-${idx}-${festivalIds}-${isHighlighted ? 'highlighted' : 'normal'}`}
                    position={[cluster.center.lat, cluster.center.lng]}
                    icon={createCustomIcon(isHighlighted, isCluster ? cluster.festivals.length : undefined, isMobile)}
                    eventHandlers={{
                      mouseover: () => {
                        // Highlight festivals in this cluster
                        if (cluster.festivals.length >= 1) {
                          setHighlightedFestival(cluster.festivals[0].id);
                        }
                      },
                      mouseout: () => {
                        // Unhighlight
                        setHighlightedFestival(null);
                      }
                    }}
                  >
                    {/* Interactive Popup showing all festivals at this location */}
                    <Popup
                      closeButton={true}
                      className="festival-popup"
                      maxWidth={300}
                      autoPan={true}
                      closeOnClick={false}
                    >
                      <div style={{ 
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        maxHeight: '400px',
                        overflowY: 'auto'
                      }}>
                        {cluster.festivals.map((festival, festivalIdx) => (
                          <div
                            key={festival.id}
                            onClick={() => navigate(`/festival/${festival.id}`)}
                            onMouseEnter={() => setHighlightedFestival(festival.id)}
                            onMouseLeave={() => setHighlightedFestival(null)}
                            style={{
                              padding: '12px',
                              cursor: 'pointer',
                              borderBottom: festivalIdx < cluster.festivals.length - 1 ? '1px solid #f0f0f0' : 'none',
                              backgroundColor: highlightedFestival === festival.id ? '#f8f9fa' : 'transparent',
                              transition: 'background-color 0.2s ease'
                            }}
                          >
                            <div style={{ 
                              fontWeight: '600', 
                              fontSize: '14px', 
                              marginBottom: '6px',
                              color: '#0066ff',
                              textDecoration: 'none'
                            }}>
                              {festival.name}
                            </div>
                            
                            {/* Location and Date */}
                            <div style={{
                              fontSize: '12px',
                              color: '#666',
                              marginBottom: '4px'
                            }}>
                              📍 {festival.parsed_city || festival.region}
                            </div>
                            
                            <div style={{
                              fontSize: '12px',
                              color: '#666',
                              marginBottom: '6px'
                            }}>
                              📅 {festival.dates}
                            </div>
                            
                            {/* Rating */}
                            {festival.rating_overall_count && festival.rating_overall_count > 0 ? (
                              <div style={{ 
                                fontSize: '12px', 
                                color: '#666',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <span style={{ color: '#ffd700' }}>★</span>
                                {festival.rating_overall_average?.toFixed(1)} 
                                <span style={{ color: '#999' }}>
                                  ({festival.rating_overall_count} {festival.rating_overall_count === 1 ? 'review' : 'reviews'})
                                </span>
                              </div>
                            ) : (
                              <div style={{ fontSize: '12px', color: '#999' }}>
                                No ratings yet
                              </div>
                            )}
                            
                            {/* Genres */}
                            {festival.genres.length > 0 && (
                              <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '4px',
                                marginTop: '6px'
                              }}>
                                {festival.genres.slice(0, 3).map((genre, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      backgroundColor: '#e8f0fe',
                                      color: '#0066ff',
                                      padding: '2px 6px',
                                      borderRadius: '10px',
                                      fontSize: '11px',
                                      fontWeight: '500'
                                    }}
                                  >
                                    {genre}
                                  </span>
                                ))}
                                {festival.genres.length > 3 && (
                                  <span style={{ fontSize: '11px', color: '#999' }}>
                                    +{festival.genres.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {cluster.festivals.length > 1 && (
                          <div style={{
                            padding: '8px 12px',
                            fontSize: '11px',
                            color: '#999',
                            textAlign: 'center',
                            backgroundColor: '#f8f9fa'
                          }}>
                            {cluster.festivals.length} festivals at this location
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </>
      )}

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
};

export default FestivalMap;

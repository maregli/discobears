import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Festival } from 'types/festival';
import { useViewportHeight } from 'hooks/useViewportHeight';

interface FestivalBottomSheetProps {
  festivals: Festival[];
  onClose: () => void;
  initialIndex?: number;
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  isPersistent?: boolean; // If true, no close button/backdrop
  isExpanded?: boolean; // If true, show expanded view
  onToggleExpand?: () => void; // Toggle between collapsed and expanded
}

const FestivalBottomSheet: React.FC<FestivalBottomSheetProps> = ({
  festivals,
  onClose,
  initialIndex = 0,
  currentIndex: controlledIndex,
  onIndexChange,
  isPersistent = false,
  isExpanded = false,
  onToggleExpand
}) => {
  const navigate = useNavigate();
  const viewportHeight = useViewportHeight();
  const [internalIndex, setInternalIndex] = useState(initialIndex);
  const carouselRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use controlled index if provided, otherwise use internal state
  const currentIndex = controlledIndex !== undefined ? controlledIndex : internalIndex;
  const setCurrentIndex = (index: number) => {
    if (onIndexChange) {
      onIndexChange(index);
    } else {
      setInternalIndex(index);
    }
  };

  // Scroll to current index when it changes (only if not user scrolling)
  useEffect(() => {
    if (carouselRef.current && !isUserScrollingRef.current) {
      // Card width is 85vw + 12px gap
      const cardWidth = window.innerWidth * 0.85 + 12;
      carouselRef.current.scrollTo({
        left: currentIndex * cardWidth,
        behavior: 'smooth'
      });
    }
  }, [currentIndex]);

  if (festivals.length === 0) return null;

  // Ensure currentIndex is within valid bounds
  const safeIndex = Math.max(0, Math.min(currentIndex, festivals.length - 1));

  const handleScrollStart = () => {
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Mark that user is scrolling
    isUserScrollingRef.current = true;
    
    // Capture scroll position immediately (don't use e.currentTarget in timeout)
    const scrollLeft = e.currentTarget.scrollLeft;
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Set timeout to detect end of scroll
    scrollTimeoutRef.current = setTimeout(() => {
      // Detect which card is most visible and update index
      // Card width is 85vw + 12px gap
      const cardWidth = window.innerWidth * 0.85 + 12;
      const newIndex = Math.round(scrollLeft / cardWidth);
      
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < festivals.length) {
        setCurrentIndex(newIndex);
      }
      
      // Reset scrolling flag after a brief delay
      setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 100);
    }, 150);
  };

  const handleViewDetails = (festivalId: string) => {
    navigate(`/festival/${festivalId}`);
  };

  return (
    <>
      {/* Backdrop for closing - always shown to capture map clicks */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: `${viewportHeight}px`,
          zIndex: 998,
          backgroundColor: 'transparent'
        }}
        onClick={onClose}
      />

      {/* Bottom Sheet Carousel */}
      <div
        style={{
          position: 'fixed',
          top: 'auto',
          bottom: '16px',
          left: 0,
          right: 0,
          maxHeight: `${viewportHeight - 32}px`,
          backgroundColor: 'transparent',
          zIndex: 999,
          animation: 'slideUpSheet 0.3s ease',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Handle bar - tap to expand/collapse */}
        <div 
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '8px 0',
            cursor: 'pointer'
          }}
          onClick={onToggleExpand}
        >
          <div style={{
            width: '40px',
            height: '4px',
            backgroundColor: 'rgba(255,255,255,0.8)',
            borderRadius: '2px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
          }} />
        </div>

        {/* Carousel Container */}
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          onTouchStart={handleScrollStart}
          onMouseDown={handleScrollStart}
          style={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            gap: '12px',
            padding: '0 calc(7.5vw) 20px calc(7.5vw)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {festivals.map((festival, idx) => (
            <div
              key={festival.id}
              style={{
                minWidth: '85vw',
                maxWidth: '85vw',
                scrollSnapAlign: 'center',
                backgroundColor: 'white',
                borderRadius: '20px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'transform 0.2s ease, opacity 0.2s ease',
                opacity: idx === safeIndex ? 1 : 0.7,
                transform: idx === safeIndex ? 'scale(1)' : 'scale(0.95)'
              }}
            >
              {/* Festival Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <h3 
                  onClick={() => handleViewDetails(festival.id)}
                  style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#0066ff',
                    flex: 1,
                    lineHeight: '1.3',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  {festival.name}
                </h3>
                {festival.rating_overall_count && festival.rating_overall_count > 0 && (
                  <div style={{
                    backgroundColor: '#0066ff',
                    color: 'white',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '700',
                    minWidth: '45px',
                    textAlign: 'center',
                    flexShrink: 0
                  }}>
                    ⭐ {festival.rating_overall_average?.toFixed(1)}
                  </div>
                )}
              </div>

              {/* Location */}
              <div style={{
                fontSize: '15px',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '18px' }}>📍</span>
                <span style={{ fontWeight: '500' }}>{festival.parsed_city || festival.region}</span>
              </div>

              {/* Date */}
              <div style={{
                fontSize: '15px',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '18px' }}>📅</span>
                <span style={{ fontWeight: '500' }}>{festival.dates}</span>
              </div>

              {/* Genres */}
              {festival.genres.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  marginTop: '4px'
                }}>
                  {festival.genres.slice(0, 4).map((genre, genreIdx) => (
                    <span
                      key={genreIdx}
                      style={{
                        backgroundColor: '#e8f0fe',
                        color: '#0066ff',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}
                    >
                      {genre}
                    </span>
                  ))}
                  {festival.genres.length > 4 && (
                    <span style={{
                      backgroundColor: '#f0f0f0',
                      color: '#666',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}>
                      +{festival.genres.length - 4}
                    </span>
                  )}
                </div>
              )}

              {/* Rating info */}
              {festival.rating_overall_count && festival.rating_overall_count > 0 && (
                <div style={{
                  fontSize: '13px',
                  color: '#888',
                  marginTop: '4px'
                }}>
                  Based on {festival.rating_overall_count} {festival.rating_overall_count === 1 ? 'review' : 'reviews'}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Navigation dots indicator */}
        {festivals.length > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '6px',
            padding: '0 0 12px 0'
          }}>
            {festivals.map((_, idx) => (
              <div
                key={idx}
                style={{
                  width: idx === safeIndex ? '24px' : '8px',
                  height: '8px',
                  backgroundColor: idx === safeIndex ? 'white' : 'rgba(255,255,255,0.5)',
                  borderRadius: '4px',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUpSheet {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        
        /* Hide scrollbar for carousel */
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
};

export default FestivalBottomSheet;

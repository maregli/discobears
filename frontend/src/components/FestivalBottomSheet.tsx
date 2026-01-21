import React, { useState } from 'react';
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
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchEndY, setTouchEndY] = useState(0);

  // Use controlled index if provided, otherwise use internal state
  const currentIndex = controlledIndex !== undefined ? controlledIndex : internalIndex;
  const setCurrentIndex = (index: number) => {
    if (onIndexChange) {
      onIndexChange(index);
    } else {
      setInternalIndex(index);
    }
  };

  if (festivals.length === 0) return null;

  const festival = festivals[currentIndex];

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    const horizontalSwipe = touchStart - touchEnd;
    const verticalSwipe = touchStartY - touchEndY;
    
    // Check if it's a vertical swipe down (to close)
    if (verticalSwipe < -80 && Math.abs(horizontalSwipe) < 50) {
      // Swipe down - close the drawer
      if (isPersistent) {
        onClose();
      }
      return;
    }
    
    // Horizontal swipes for navigation
    if (horizontalSwipe > 50) {
      // Swipe left - next festival
      if (currentIndex < festivals.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }

    if (horizontalSwipe < -50) {
      // Swipe right - previous festival
      if (currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    }
  };

  const handleNext = () => {
    if (currentIndex < festivals.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleViewDetails = () => {
    navigate(`/festival/${festival.id}`);
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

      {/* Bottom Sheet */}
      <div
        style={{
          position: 'fixed',
          top: 'auto',
          bottom: '16px',
          left: '12px',
          right: '12px',
          maxHeight: `${viewportHeight - 32}px`,
          backgroundColor: 'white',
          borderRadius: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          zIndex: 999,
          animation: 'slideUpSheet 0.3s ease',
          height: isExpanded ? `${viewportHeight * 0.5}px` : 'auto',
          display: 'flex',
          flexDirection: 'column',
          transition: 'height 0.3s ease'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle bar - tap to expand/collapse */}
        <div 
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '12px 0 8px 0',
            cursor: 'pointer',
            position: 'relative'
          }}
          onClick={onToggleExpand}
        >
          <div style={{
            width: '40px',
            height: '4px',
            backgroundColor: '#d0d0d0',
            borderRadius: '2px'
          }} />
        </div>

        {/* Content */}
        <div style={{
          padding: '12px 20px 20px 20px'
        }}>
          {/* Festival Info */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '12px'
            }}>
              <h3 
                onClick={handleViewDetails}
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
                  marginLeft: '12px',
                  backgroundColor: '#0066ff',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '700',
                  minWidth: '42px',
                  textAlign: 'center'
                }}>
                  {festival.rating_overall_average?.toFixed(1)}
                </div>
              )}
            </div>

            {/* Location */}
            <div style={{
              fontSize: '15px',
              color: '#666',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>📍</span>
              <span>{festival.parsed_city || festival.region}</span>
            </div>

            {/* Date */}
            <div style={{
              fontSize: '15px',
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>📅</span>
              <span>{festival.dates}</span>
            </div>
          </div>

          {/* Navigation dots and counter */}
          {festivals.length > 1 && (
            <>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '6px',
                marginBottom: '8px'
              }}>
                {festivals.map((_, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: idx === currentIndex ? '20px' : '6px',
                      height: '6px',
                      backgroundColor: idx === currentIndex ? '#0066ff' : '#d0d0d0',
                      borderRadius: '3px',
                      transition: 'all 0.3s ease'
                    }}
                  />
                ))}
              </div>
              
              {/* Counter text */}
              <div style={{
                textAlign: 'center',
                fontSize: '13px',
                color: '#888'
              }}>
                {currentIndex + 1} of {festivals.length} festivals in this area
              </div>
            </>
          )}
        </div>

        {/* Navigation arrows (for multiple festivals) */}
        {festivals.length > 1 && (
          <>
            {currentIndex > 0 && (
              <button
                onClick={handlePrev}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  border: '1px solid #e0e0e0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  zIndex: 1
                }}
              >
                ‹
              </button>
            )}
            {currentIndex < festivals.length - 1 && (
              <button
                onClick={handleNext}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  border: '1px solid #e0e0e0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  zIndex: 1
                }}
              >
                ›
              </button>
            )}
          </>
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
      `}</style>
    </>
  );
};

export default FestivalBottomSheet;

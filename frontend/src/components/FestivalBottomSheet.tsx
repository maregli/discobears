import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Festival } from 'types/festival';

interface FestivalBottomSheetProps {
  festivals: Festival[];
  onClose: () => void;
  initialIndex?: number;
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  isPersistent?: boolean; // If true, no close button/backdrop
}

const FestivalBottomSheet: React.FC<FestivalBottomSheetProps> = ({
  festivals,
  onClose,
  initialIndex = 0,
  currentIndex: controlledIndex,
  onIndexChange,
  isPersistent = false
}) => {
  const navigate = useNavigate();
  const [internalIndex, setInternalIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

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
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 50) {
      // Swipe left - next festival
      if (currentIndex < festivals.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }

    if (touchStart - touchEnd < -50) {
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

  // Parse price from festival data (placeholder - you might want to add actual price field)
  const getDisplayPrice = () => {
    // For now, return "Free" or extract from description if available
    return 'View Details';
  };

  return (
    <>
      {/* Backdrop for closing - only if not persistent */}
      {!isPersistent && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 998,
            backgroundColor: 'transparent'
          }}
          onClick={onClose}
        />
      )}

      {/* Bottom Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'white',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          zIndex: 999,
          animation: 'slideUpSheet 0.3s ease',
          maxHeight: isPersistent ? '35vh' : '40vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle bar - only if not persistent */}
        {!isPersistent && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 0 8px 0'
          }}>
            <div style={{
              width: '40px',
              height: '4px',
              backgroundColor: '#d0d0d0',
              borderRadius: '2px'
            }} />
          </div>
        )}

        {/* Content */}
        <div style={{
          padding: '0 20px 20px 20px',
          flex: 1,
          overflowY: 'auto'
        }}>
          {/* Festival Image Placeholder */}
          <div style={{
            width: '100%',
            height: '120px',
            backgroundColor: '#f0f0f0',
            borderRadius: '12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            fontWeight: 'bold'
          }}>
            🎵
          </div>

          {/* Festival Info */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '8px'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '700',
                color: '#1a1a1a',
                flex: 1,
                lineHeight: '1.3'
              }}>
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

            {festival.rating_overall_count && festival.rating_overall_count > 0 && (
              <div style={{
                fontSize: '13px',
                color: '#666',
                marginBottom: '8px'
              }}>
                ⭐ Based on {festival.rating_overall_count} {festival.rating_overall_count === 1 ? 'review' : 'reviews'}
              </div>
            )}

            {/* Location */}
            <div style={{
              fontSize: '14px',
              color: '#666',
              marginBottom: '4px'
            }}>
              📍 {festival.parsed_city || festival.region}
            </div>

            {/* Date */}
            <div style={{
              fontSize: '14px',
              color: '#666',
              marginBottom: '8px'
            }}>
              📅 {festival.dates}
            </div>

            {/* Genres */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              marginBottom: '12px'
            }}>
              {festival.genres.slice(0, 3).map((genre, idx) => (
                <span
                  key={idx}
                  style={{
                    backgroundColor: '#f0f0f0',
                    color: '#666',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  {genre}
                </span>
              ))}
              {festival.genres.length > 3 && (
                <span style={{
                  color: '#0066ff',
                  fontSize: '12px',
                  fontWeight: '500',
                  padding: '4px 0'
                }}>
                  +{festival.genres.length - 3} more
                </span>
              )}
            </div>
          </div>

          {/* Navigation dots */}
          {festivals.length > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '6px',
              marginBottom: '12px'
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
          )}

          {/* View Details Button */}
          <button
            onClick={handleViewDetails}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#0066ff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '8px'
            }}
          >
            See availability
          </button>

          {/* Counter text */}
          {festivals.length > 1 && (
            <div style={{
              textAlign: 'center',
              fontSize: '13px',
              color: '#888'
            }}>
              {currentIndex + 1} of {festivals.length} festivals in this area
            </div>
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

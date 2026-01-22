import React from 'react';
import { Festival } from 'types/festival';

interface FestivalCardProps {
  festival: Festival;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  isHighlighted: boolean;
  onOpenDetail?: (festivalId: string) => void;
}

const FestivalCard: React.FC<FestivalCardProps> = ({
  festival,
  onHover,
  onLeave,
  onClick,
  isHighlighted,
  onOpenDetail
}) => {
  const hasCoordinates = festival.coordinates && 
    festival.coordinates.lat && 
    festival.coordinates.lng;

  const handleClick = () => {
    if (onOpenDetail) {
      onOpenDetail(festival.id);
    }
  };

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={handleClick}
      style={{
        padding: '16px',
        backgroundColor: isHighlighted ? '#f0f8ff' : 'white',
        borderRadius: '8px',
        marginBottom: '12px',
        cursor: 'pointer',
        border: isHighlighted ? '2px solid #0066ff' : '1px solid #e0e0e0',
        transition: 'all 0.2s ease',
        boxShadow: isHighlighted ? '0 4px 12px rgba(0,102,255,0.15)' : '0 1px 3px rgba(0,0,0,0.1)',
        opacity: hasCoordinates ? 1 : 0.6
      }}
    >
      {/* Name */}
      <h3 style={{ 
        margin: '0 0 10px 0', 
        fontSize: '16px', 
        fontWeight: '600',
        color: '#1a1a1a'
      }}>
        {festival.name}
      </h3>

      {/* Rating - Modern & Sleek */}
      {festival.rating_overall_count && festival.rating_overall_count > 0 ? (
        <div style={{ 
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          marginBottom: '10px',
          fontSize: '13px',
          color: '#666'
        }}>
          <span style={{ color: '#ffa500' }}>★</span>
          <span style={{ fontWeight: '600', color: '#1a1a1a' }}>
            {festival.rating_overall_average?.toFixed(1)}
          </span>
        </div>
      ) : (
        <div style={{ marginBottom: '10px', fontSize: '13px', color: '#999' }}>
          No ratings
        </div>
      )}

      {/* Date */}
      <div style={{ 
        fontSize: '14px', 
        color: '#666',
        marginBottom: '6px'
      }}>
        📅 {festival.dates}
      </div>

      {/* Location */}
      <div style={{ 
        fontSize: '14px', 
        color: '#666'
      }}>
        📍 {festival.parsed_city || festival.region}
      </div>
    </div>
  );
};

export default FestivalCard;

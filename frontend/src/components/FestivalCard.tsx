import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Festival } from 'types/festival';

interface FestivalCardProps {
  festival: Festival;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  isHighlighted: boolean;
}

const FestivalCard: React.FC<FestivalCardProps> = ({
  festival,
  onHover,
  onLeave,
  onClick,
  isHighlighted
}) => {
  const navigate = useNavigate();
  const hasCoordinates = festival.coordinates && 
    festival.coordinates.lat && 
    festival.coordinates.lng;

  const handleClick = () => {
    // Navigate directly to detail page instead of zooming to map
    navigate(`/festival/${festival.id}`);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: '16px', 
          fontWeight: '600',
          color: '#1a1a1a',
          flex: 1
        }}>
          {festival.name}
        </h3>
        {!hasCoordinates && (
          <span style={{
            fontSize: '11px',
            color: '#999',
            backgroundColor: '#f5f5f5',
            padding: '2px 8px',
            borderRadius: '4px',
            marginLeft: '8px',
            whiteSpace: 'nowrap'
          }}>
            No location
          </span>
        )}
      </div>

      <div style={{ 
        fontSize: '14px', 
        color: '#666',
        marginBottom: '8px'
      }}>
        📅 {festival.dates} · {festival.duration}
      </div>

      <div style={{ 
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        marginBottom: '8px'
      }}>
        {festival.genres.slice(0, 3).map((genre, idx) => (
          <span
            key={idx}
            style={{
              fontSize: '12px',
              color: '#0066ff',
              backgroundColor: '#e6f2ff',
              padding: '4px 10px',
              borderRadius: '12px',
              fontWeight: '500'
            }}
          >
            {genre}
          </span>
        ))}
        {festival.genres.length > 3 && (
          <span style={{
            fontSize: '12px',
            color: '#666',
            padding: '4px 10px'
          }}>
            +{festival.genres.length - 3} more
          </span>
        )}
      </div>

      <div style={{ 
        fontSize: '13px', 
        color: '#888',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        📍 {festival.parsed_city || festival.region}
      </div>

      {festival.visitors && (
        <div style={{
          marginTop: '8px',
          fontSize: '14px',
          fontWeight: '600',
          color: '#1a1a1a'
        }}>
          {festival.visitors}
        </div>
      )}
    </div>
  );
};

export default FestivalCard;

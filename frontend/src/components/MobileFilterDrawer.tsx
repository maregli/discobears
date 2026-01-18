import React, { useState } from 'react';

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  genres: string[];
  selectedGenres: string[];
  onGenreChange: (genres: string[]) => void;
  dateRange: { year: number; startMonth: number; endMonth: number };
  onDateRangeChange: (range: { year: number; startMonth: number; endMonth: number }) => void;
  onClearFilters: () => void;
  festivalCount: number;
}

const MobileFilterDrawer: React.FC<MobileFilterDrawerProps> = ({
  isOpen,
  onClose,
  genres,
  selectedGenres,
  onGenreChange,
  dateRange,
  onDateRangeChange,
  onClearFilters,
  festivalCount
}) => {
  const [isGenreExpanded, setIsGenreExpanded] = useState(true);
  const [isDateExpanded, setIsDateExpanded] = useState(true);

  const handleGenreToggle = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      onGenreChange(selectedGenres.filter(g => g !== genre));
    } else {
      onGenreChange([...selectedGenres, genre]);
    }
  };

  const hasActiveFilters = selectedGenres.length > 0 || 
    dateRange.startMonth !== 1 || 
    dateRange.endMonth !== 12;

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          animation: 'fadeIn 0.3s ease'
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'white',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s ease'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0066ff',
          color: 'white'
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '8px',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ← Back
          </button>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
            Filters
          </h2>
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '16px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Reset
            </button>
          )}
          {!hasActiveFilters && <div style={{ width: '60px' }} />}
        </div>

        {/* Filters Content */}
        <div style={{ 
          flex: 1,
          overflowY: 'auto',
          padding: '0 0 80px 0'
        }}>
          {/* Date Filter */}
          <div style={{ padding: '20px', borderBottom: '1px solid #e0e0e0' }}>
            <button
              onClick={() => setIsDateExpanded(!isDateExpanded)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: '600',
                padding: '0 0 16px 0',
                color: '#1a1a1a'
              }}
            >
              <span>Date Range</span>
              <span style={{ fontSize: '16px' }}>
                {isDateExpanded ? '▲' : '▼'}
              </span>
            </button>
            
            {isDateExpanded && (
              <div>
                {/* Year Dropdown */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    color: '#666',
                    marginBottom: '12px',
                    fontWeight: '500'
                  }}>
                    Year
                  </label>
                  <select
                    value={dateRange.year}
                    onChange={(e) => onDateRangeChange({ ...dateRange, year: parseInt(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '14px',
                      border: '1px solid #d0d0d0',
                      borderRadius: '8px',
                      fontSize: '16px',
                      backgroundColor: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    {years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                {/* Month Range */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    color: '#666',
                    marginBottom: '12px',
                    fontWeight: '500'
                  }}>
                    Month Range
                  </label>
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    color: '#1a1a1a',
                    marginBottom: '16px',
                    fontWeight: '600'
                  }}>
                    <span>{monthNames[dateRange.startMonth - 1]}</span>
                    <span>—</span>
                    <span>{monthNames[dateRange.endMonth - 1]}</span>
                  </div>

                  {/* Start Month Slider */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '13px', 
                      color: '#888',
                      marginBottom: '8px'
                    }}>
                      From: {monthNames[dateRange.startMonth - 1]}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="12"
                      value={dateRange.startMonth}
                      onChange={(e) => {
                        const newStart = parseInt(e.target.value);
                        onDateRangeChange({
                          ...dateRange,
                          startMonth: newStart,
                          endMonth: Math.max(newStart, dateRange.endMonth)
                        });
                      }}
                      style={{
                        width: '100%',
                        height: '8px',
                        cursor: 'pointer',
                        accentColor: '#0066ff'
                      }}
                    />
                  </div>

                  {/* End Month Slider */}
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '13px', 
                      color: '#888',
                      marginBottom: '8px'
                    }}>
                      To: {monthNames[dateRange.endMonth - 1]}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="12"
                      value={dateRange.endMonth}
                      onChange={(e) => {
                        const newEnd = parseInt(e.target.value);
                        onDateRangeChange({
                          ...dateRange,
                          endMonth: newEnd,
                          startMonth: Math.min(newEnd, dateRange.startMonth)
                        });
                      }}
                      style={{
                        width: '100%',
                        height: '8px',
                        cursor: 'pointer',
                        accentColor: '#0066ff'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Genre Filter */}
          <div style={{ padding: '20px' }}>
            <button
              onClick={() => setIsGenreExpanded(!isGenreExpanded)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: '600',
                padding: '0 0 16px 0',
                color: '#1a1a1a'
              }}
            >
              <span>Genre {selectedGenres.length > 0 && `(${selectedGenres.length})`}</span>
              <span style={{ fontSize: '16px' }}>
                {isGenreExpanded ? '▲' : '▼'}
              </span>
            </button>
            
            {isGenreExpanded && (
              <div style={{ 
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                {genres.map(genre => (
                  <label
                    key={genre}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '14px 0',
                      cursor: 'pointer',
                      fontSize: '16px',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGenres.includes(genre)}
                      onChange={() => handleGenreToggle(genre)}
                      style={{
                        marginRight: '14px',
                        width: '22px',
                        height: '22px',
                        cursor: 'pointer',
                        accentColor: '#0066ff'
                      }}
                    />
                    <span style={{ color: '#1a1a1a' }}>{genre}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Button */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px 20px',
          backgroundColor: 'white',
          borderTop: '1px solid #e0e0e0',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.1)'
        }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: '#0066ff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Show {festivalCount} festivals
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export default MobileFilterDrawer;

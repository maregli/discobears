import React, { useState } from 'react';

interface FilterPanelProps {
  genres: string[];
  selectedGenres: string[];
  onGenreChange: (genres: string[]) => void;
  dateRange: { year: number; startMonth: number; endMonth: number };
  onDateRangeChange: (range: { year: number; startMonth: number; endMonth: number }) => void;
  onClearFilters: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  genres,
  selectedGenres,
  onGenreChange,
  dateRange,
  onDateRangeChange,
  onClearFilters
}) => {
  const [isGenreExpanded, setIsGenreExpanded] = useState(false);
  const [isDateExpanded, setIsDateExpanded] = useState(false);

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
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i); // Current year + 4 years ahead

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      border: '1px solid #e0e0e0',
      marginBottom: '16px'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          Filters
        </h3>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            style={{
              background: 'none',
              border: 'none',
              color: '#0066ff',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Genre Filter */}
      <div style={{ borderBottom: '1px solid #e0e0e0' }}>
        <button
          onClick={() => setIsGenreExpanded(!isGenreExpanded)}
          style={{
            width: '100%',
            padding: '16px',
            background: 'none',
            border: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f7f7f7'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <span>Genre {selectedGenres.length > 0 && `(${selectedGenres.length})`}</span>
          <span style={{ 
            fontSize: '18px',
            transition: 'transform 0.2s',
            transform: isGenreExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            ▼
          </span>
        </button>
        
        {isGenreExpanded && (
          <div style={{ 
            padding: '0 16px 16px 16px',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {genres.map(genre => (
              <label
                key={genre}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 0',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedGenres.includes(genre)}
                  onChange={() => handleGenreToggle(genre)}
                  style={{
                    marginRight: '10px',
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ color: '#1a1a1a' }}>{genre}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Date Filter */}
      <div>
        <button
          onClick={() => setIsDateExpanded(!isDateExpanded)}
          style={{
            width: '100%',
            padding: '16px',
            background: 'none',
            border: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f7f7f7'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <span>Date Range</span>
          <span style={{ 
            fontSize: '18px',
            transition: 'transform 0.2s',
            transform: isDateExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            ▼
          </span>
        </button>
        
        {isDateExpanded && (
          <div style={{ padding: '0 16px 16px 16px' }}>
            {/* Year Dropdown */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '13px', 
                color: '#666',
                marginBottom: '8px',
                fontWeight: '500'
              }}>
                Year
              </label>
              <select
                value={dateRange.year}
                onChange={(e) => onDateRangeChange({ ...dateRange, year: parseInt(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Month Range Slider */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '13px', 
                color: '#666',
                marginBottom: '8px',
                fontWeight: '500'
              }}>
                Month Range
              </label>
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#888',
                marginBottom: '8px'
              }}>
                <span>{monthNames[dateRange.startMonth - 1]}</span>
                <span>{monthNames[dateRange.endMonth - 1]}</span>
              </div>

              {/* Start Month Slider */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '12px', 
                  color: '#888',
                  marginBottom: '4px'
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
                    cursor: 'pointer'
                  }}
                />
              </div>

              {/* End Month Slider */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '12px', 
                  color: '#888',
                  marginBottom: '4px'
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
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterPanel;

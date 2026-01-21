import React, { useState } from 'react';
import { useAuth } from 'contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { submitUserFestival } from 'firebaseServices/firestore';

interface FestivalFormData {
  name: string;
  external_link: string;
  dates: string;
  duration: string;
  // Structured address fields
  street: string;
  street_number: string;
  city: string;
  postal_code: string;
  country: string;
  venue_type: 'indoor' | 'outdoor';
  region: string;
  genres: string[];
  price: string;
  visitors: string;
}

const AddFestivalForm: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<FestivalFormData>({
    name: '',
    external_link: '',
    dates: '',
    duration: '',
    street: '',
    street_number: '',
    city: '',
    postal_code: '',
    country: '',
    venue_type: 'outdoor',
    region: '',
    genres: [],
    price: '',
    visitors: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Genre options (same as scraped festivals)
  const genreOptions = [
    'Techno', 'House', 'Trance', 'Hardstyle', 'Drum & Bass',
    'Dubstep', 'EDM', 'Progressive', 'Minimal', 'Tech House',
    'Electro', 'Deep House', 'Psytrance', 'Hardcore'
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Required fields
    if (!formData.name.trim()) newErrors.name = 'Festival name is required';
    if (!formData.external_link.trim()) newErrors.external_link = 'Festival URL is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.country.trim()) newErrors.country = 'Country is required';
    if (!formData.dates.trim()) newErrors.dates = 'Dates are required';
    if (!formData.price.trim()) newErrors.price = 'Price is required';
    if (formData.genres.length === 0) newErrors.genres = 'At least one genre is required';
    
    // URL validation
    if (formData.external_link && !formData.external_link.match(/^https?:\/\/.+/)) {
      newErrors.external_link = 'Please enter a valid URL (starting with http:// or https://)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      alert('Please sign in to submit a festival');
      navigate('/');
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Call Firestore function to add festival
      await submitUserFestival(formData, user.uid, user.displayName || user.email || 'Anonymous');
      alert('Festival submitted successfully! It will appear on the map after admin approval.');
      navigate('/');
    } catch (error) {
      console.error('Error submitting festival:', error);
      alert('Failed to submit festival. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenreToggle = (genre: string) => {
    setFormData(prev => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre]
    }));
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f7f7f7',
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          marginBottom: '24px'
        }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              color: '#0066ff',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: 0
            }}
          >
            ← Back to Map
          </button>
          
          <h1 style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: '700' }}>
            Submit a Festival
          </h1>
          <p style={{ margin: 0, color: '#666', fontSize: '16px' }}>
            Share an electronic music festival with the community
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ 
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '32px'
          }}>
            {/* Festival Name */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#1a1a1a'
              }}>
                Festival Name <span style={{ color: '#e74c3c' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Tomorrowland"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `1px solid ${errors.name ? '#e74c3c' : '#d0d0d0'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              {errors.name && (
                <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '4px' }}>
                  {errors.name}
                </div>
              )}
            </div>

            {/* Festival URL */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#1a1a1a'
              }}>
                Festival Website <span style={{ color: '#e74c3c' }}>*</span>
              </label>
              <input
                type="url"
                value={formData.external_link}
                onChange={(e) => setFormData({ ...formData, external_link: e.target.value })}
                placeholder="https://www.festival-website.com"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `1px solid ${errors.external_link ? '#e74c3c' : '#d0d0d0'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              {errors.external_link && (
                <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '4px' }}>
                  {errors.external_link}
                </div>
              )}
            </div>

            {/* Location Section */}
            <div style={{ 
              marginBottom: '24px',
              padding: '16px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px'
            }}>
              <h3 style={{ 
                margin: '0 0 16px 0',
                fontSize: '16px',
                fontWeight: '600',
                color: '#1a1a1a'
              }}>
                📍 Location
              </h3>

              {/* City and Country Row */}
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '12px'
              }}>
                {/* City */}
                <div>
                  <label style={{ 
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: '#1a1a1a'
                  }}>
                    City <span style={{ color: '#e74c3c' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g., Amsterdam"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: `1px solid ${errors.city ? '#e74c3c' : '#d0d0d0'}`,
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                  {errors.city && (
                    <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '4px' }}>
                      {errors.city}
                    </div>
                  )}
                </div>

                {/* Country */}
                <div>
                  <label style={{ 
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: '#1a1a1a'
                  }}>
                    Country <span style={{ color: '#e74c3c' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="e.g., Netherlands"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: `1px solid ${errors.country ? '#e74c3c' : '#d0d0d0'}`,
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                  {errors.country && (
                    <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '4px' }}>
                      {errors.country}
                    </div>
                  )}
                </div>
              </div>

              {/* Street and Number Row */}
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: '3fr 1fr',
                gap: '12px',
                marginBottom: '12px'
              }}>
                {/* Street */}
                <div>
                  <label style={{ 
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px',
                    color: '#666'
                  }}>
                    Street (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    placeholder="e.g., Festival Grounds"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #d0d0d0',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Number */}
                <div>
                  <label style={{ 
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px',
                    color: '#666'
                  }}>
                    Number
                  </label>
                  <input
                    type="text"
                    value={formData.street_number}
                    onChange={(e) => setFormData({ ...formData, street_number: e.target.value })}
                    placeholder="e.g., 42"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #d0d0d0',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Postal Code */}
              <div>
                <label style={{ 
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: '#666'
                }}>
                  Postal Code (recommended for accurate geocoding)
                </label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  placeholder="e.g., 1012 JS"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d0d0d0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Postal code helps us find the exact location on the map
                </div>
              </div>
            </div>

            {/* Genres */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#1a1a1a'
              }}>
                Genres <span style={{ color: '#e74c3c' }}>*</span>
              </label>
              <div style={{ 
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '12px',
                border: `1px solid ${errors.genres ? '#e74c3c' : '#d0d0d0'}`,
                borderRadius: '6px',
                minHeight: '60px'
              }}>
                {genreOptions.map(genre => (
                  <label
                    key={genre}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '6px 12px',
                      backgroundColor: formData.genres.includes(genre) ? '#e6f2ff' : '#f7f7f7',
                      border: `2px solid ${formData.genres.includes(genre) ? '#0066ff' : 'transparent'}`,
                      borderRadius: '16px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: formData.genres.includes(genre) ? '#0066ff' : '#666',
                      transition: 'all 0.2s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.genres.includes(genre)}
                      onChange={() => handleGenreToggle(genre)}
                      style={{ display: 'none' }}
                    />
                    {genre}
                  </label>
                ))}
              </div>
              {errors.genres && (
                <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '4px' }}>
                  {errors.genres}
                </div>
              )}
            </div>

            {/* Optional Fields Section */}
            <div style={{ 
              borderTop: '1px solid #e0e0e0',
              paddingTop: '24px',
              marginTop: '24px'
            }}>
              <h3 style={{ 
                fontSize: '18px',
                fontWeight: '600',
                marginBottom: '16px',
                color: '#1a1a1a'
              }}>
                Additional Information
              </h3>

              {/* Dates - NOW REQUIRED */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '8px',
                  color: '#1a1a1a'
                }}>
                  Dates <span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.dates}
                  onChange={(e) => setFormData({ ...formData, dates: e.target.value })}
                  placeholder="e.g., 15.07.-18.07.2025"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${errors.dates ? '#e74c3c' : '#d0d0d0'}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                {errors.dates && (
                  <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '4px' }}>
                    {errors.dates}
                  </div>
                )}
              </div>

              {/* Price - NOW REQUIRED */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '8px',
                  color: '#1a1a1a'
                }}>
                  Price <span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="e.g., € 199"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${errors.price ? '#e74c3c' : '#d0d0d0'}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                {errors.price && (
                  <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '4px' }}>
                    {errors.price}
                  </div>
                )}
              </div>

              {/* Duration */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: '#666'
                }}>
                  Duration
                </label>
                <input
                  type="text"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  placeholder="e.g., 3 days"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d0d0d0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Venue Type */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: '#666'
                }}>
                  Venue Type
                </label>
                <select
                  value={formData.venue_type}
                  onChange={(e) => setFormData({ ...formData, venue_type: e.target.value as 'indoor' | 'outdoor' })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d0d0d0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="outdoor">Outdoor</option>
                  <option value="indoor">Indoor</option>
                </select>
              </div>

              {/* Region */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: '#666'
                }}>
                  Region
                </label>
                <input
                  type="text"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="e.g., Western Europe"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d0d0d0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Visitors */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: '#666'
                }}>
                  Expected Visitors
                </label>
                <input
                  type="text"
                  value={formData.visitors}
                  onChange={(e) => setFormData({ ...formData, visitors: e.target.value })}
                  placeholder="e.g., 50000"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d0d0d0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: isSubmitting ? '#ccc' : '#0066ff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                marginTop: '24px'
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Festival'}
            </button>

            <div style={{ 
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#856404'
            }}>
              <strong>Note:</strong> Your submission will be reviewed by an admin before appearing on the map.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddFestivalForm;

import React, { useEffect, useState } from 'react';
import { useAuth } from 'contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  isUserAdmin,
  getFestivalsByStatus,
  updateFestivalStatus
} from 'firebaseServices/firestore';
import { Festival } from 'types/festival';

const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [selectedTab, setSelectedTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [geocodingStatus, setGeocodingStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});
  const [manualCoordinates, setManualCoordinates] = useState<Record<string, { lat: string; lng: string }>>({});
  const [editedAddresses, setEditedAddresses] = useState<Record<string, {
    street?: string;
    street_number?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  }>>({});
  const [savingAddress, setSavingAddress] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user) {
        navigate('/');
        return;
      }

      // Check if user is admin
      const adminStatus = await isUserAdmin(user.email || '');
      
      if (!adminStatus) {
        alert('Access denied. Admin privileges required.');
        navigate('/');
        return;
      }

      setIsAdmin(true);
      setLoading(false);
      loadFestivals('pending');
    };

    checkAdminAccess();
  }, [user, navigate]);

  const loadFestivals = async (status: 'pending' | 'approved' | 'rejected') => {
    const data = await getFestivalsByStatus(status);
    setFestivals(data);
  };

  const handleApprove = async (festivalId: string) => {
    if (!window.confirm('Approve this festival? It will appear on the map.')) return;
    
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
    
    try {
      console.log('Step 1: Approving festival...');
      // First approve the festival
      await updateFestivalStatus(festivalId, 'approved');
      console.log('✓ Festival approved');
      
      // Then geocode it automatically
      console.log('Step 2: Geocoding approved festival...');
      console.log('Calling: ' + backendUrl + '/api/geocode-festival/' + festivalId);
      
      const geocodeResponse = await fetch(`${backendUrl}/api/geocode-festival/${festivalId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Geocode response status:', geocodeResponse.status);
      
      if (geocodeResponse.ok) {
        const geocodeData = await geocodeResponse.json();
        console.log('✓ Geocoding result:', geocodeData);
        alert('Festival approved and geocoded successfully!');
      } else {
        const errorData = await geocodeResponse.json();
        console.error('✗ Geocoding failed:', errorData);
        alert(`Festival approved, but geocoding failed: ${errorData.error || errorData.message || 'Unknown error'}`);
      }
      
      loadFestivals(selectedTab);
    } catch (error) {
      console.error('✗ Error in approval process:', error);
      alert('Failed to approve festival: ' + (error as Error).message);
    }
  };

  const handleChangeToPending = async (festivalId: string) => {
    if (!window.confirm('Move this festival back to pending?')) return;
    
    try {
      await updateFestivalStatus(festivalId, 'pending');
      alert('Festival moved to pending');
      loadFestivals(selectedTab);
    } catch (error) {
      console.error('Error changing status:', error);
      alert('Failed to change status');
    }
  };

  const handleReject = async (festivalId: string) => {
    const reason = window.prompt('Rejection reason (optional):');
    if (reason === null) return; // User cancelled
    
    try {
      await updateFestivalStatus(festivalId, 'rejected', reason || undefined);
      alert('Festival rejected');
      loadFestivals(selectedTab);
    } catch (error) {
      console.error('Error rejecting festival:', error);
      alert('Failed to reject festival');
    }
  };

  const handleSaveAddress = async (festivalId: string) => {
    const editedData = editedAddresses[festivalId];
    if (!editedData) {
      alert('No changes to save');
      return;
    }

    // Validate required fields
    if (!editedData.city || !editedData.country) {
      alert('City and Country are required fields');
      return;
    }

    setSavingAddress(prev => ({ ...prev, [festivalId]: true }));

    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      const { db } = await import('firebaseServices/firebaseConfig');
      
      const festivalRef = doc(db, 'festivals', festivalId);
      await updateDoc(festivalRef, {
        street: editedData.street || null,
        street_number: editedData.street_number || null,
        city: editedData.city,
        postal_code: editedData.postal_code || null,
        country: editedData.country
      });

      alert('✓ Address saved successfully!');
      // Clear edited state for this festival
      setEditedAddresses(prev => {
        const newState = { ...prev };
        delete newState[festivalId];
        return newState;
      });
      loadFestivals(selectedTab);
    } catch (error) {
      alert('Failed to save address: ' + (error as Error).message);
    } finally {
      setSavingAddress(prev => ({ ...prev, [festivalId]: false }));
    }
  };

  const handleTestGeocode = async (festivalId: string) => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
    
    // First save any address changes before geocoding
    if (editedAddresses[festivalId]) {
      await handleSaveAddress(festivalId);
    }
    
    setGeocodingStatus(prev => ({ ...prev, [festivalId]: 'loading' }));
    
    try {
      const response = await fetch(`${backendUrl}/api/geocode-festival/${festivalId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setGeocodingStatus(prev => ({ ...prev, [festivalId]: 'success' }));
        alert(`✓ Geocoding successful!\nCoordinates: ${data.coordinates.lat}, ${data.coordinates.lng}${data.parsed_city ? `\nCity: ${data.parsed_city}` : ''}${data.parsed_country ? `\nCountry: ${data.parsed_country}` : ''}`);
        loadFestivals(selectedTab);
      } else {
        setGeocodingStatus(prev => ({ ...prev, [festivalId]: 'error' }));
        alert(`✗ Geocoding failed: ${data.error || data.message || 'Unknown error'}\n\nTry editing the location and test again, or enter coordinates manually.`);
      }
    } catch (error) {
      setGeocodingStatus(prev => ({ ...prev, [festivalId]: 'error' }));
      alert('Failed to geocode: ' + (error as Error).message);
    }
  };

  const handleSaveManualCoordinates = async (festivalId: string) => {
    const coords = manualCoordinates[festivalId];
    if (!coords || !coords.lat || !coords.lng) {
      alert('Please enter both latitude and longitude');
      return;
    }

    const lat = parseFloat(coords.lat);
    const lng = parseFloat(coords.lng);

    if (isNaN(lat) || isNaN(lng)) {
      alert('Invalid coordinates. Please enter valid numbers.');
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.');
      return;
    }

    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      const { db } = await import('firebaseServices/firebaseConfig');
      
      const festivalRef = doc(db, 'festivals', festivalId);
      await updateDoc(festivalRef, {
        coordinates: {
          lat,
          lng
        },
        geocoding_needed: false,
        geocoding_failed: false
      });

      alert('✓ Coordinates saved successfully!');
      setManualCoordinates(prev => ({ ...prev, [festivalId]: { lat: '', lng: '' } }));
      loadFestivals(selectedTab);
    } catch (error) {
      alert('Failed to save coordinates: ' + (error as Error).message);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadFestivals(selectedTab);
    }
  }, [selectedTab, isAdmin]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        Checking admin access...
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      height: 'auto',
      backgroundColor: '#f7f7f7',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: 'white',
        borderBottom: '1px solid #e0e0e0',
        padding: '20px 40px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>
            Admin Panel
          </h1>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0066ff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Back to Map
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '40px auto', padding: '0 20px' }}>
        {/* Tabs */}
        <div style={{ 
          display: 'flex',
          gap: '16px',
          marginBottom: '24px',
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '12px'
        }}>
          {(['pending', 'approved', 'rejected'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              style={{
                padding: '12px 24px',
                backgroundColor: 
                  selectedTab === tab 
                    ? (tab === 'pending' ? '#ffc107' : tab === 'approved' ? '#28a745' : '#dc3545')
                    : '#f0f0f0',
                color: selectedTab === tab ? 'white' : '#666',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                textTransform: 'capitalize'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Festival List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {festivals.map(festival => (
            <div
              key={festival.id}
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600' }}>
                    {festival.name}
                  </h3>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    Submitted by: <strong>{festival.submittedByName}</strong>
                    {festival.submittedAt && ' • ' + festival.submittedAt.toLocaleDateString()}
                  </div>
                </div>
                
                <div style={{
                  padding: '6px 12px',
                  backgroundColor: 
                    festival.status === 'pending' ? '#ffc107' :
                    festival.status === 'approved' ? '#28a745' : '#dc3545',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  height: 'fit-content',
                  textTransform: 'uppercase'
                }}>
                  {festival.status}
                </div>
              </div>

              {/* Details Grid */}
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
                marginBottom: '16px',
                paddingBottom: '16px',
                borderBottom: '1px solid #e0e0e0'
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>URL</div>
                  <a 
                    href={festival.external_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#0066ff', fontSize: '14px', wordBreak: 'break-all' }}
                  >
                    {festival.external_link}
                  </a>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Dates</div>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>
                    {festival.dates || 'Not specified'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Venue Type</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', textTransform: 'capitalize' }}>
                    {festival.venue_type}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                    Address Summary
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '500', lineHeight: '1.4' }}>
                    {[
                      festival.street && festival.street_number ? `${festival.street} ${festival.street_number}` : festival.street,
                      festival.postal_code,
                      festival.city,
                      festival.country
                    ].filter(Boolean).join(', ') || <span style={{ color: '#888', fontStyle: 'italic' }}>No address data</span>}
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                    Coordinates
                    {festival.coordinates && (
                      <span style={{ marginLeft: '8px', color: '#28a745', fontWeight: '600' }}>✓ Set</span>
                    )}
                    {!festival.coordinates && (
                      <span style={{ marginLeft: '8px', color: '#dc3545', fontWeight: '600' }}>✗ Missing</span>
                    )}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>
                    {festival.coordinates 
                      ? `${festival.coordinates.lat.toFixed(6)}, ${festival.coordinates.lng.toFixed(6)}`
                      : 'Not set - use geocoding or enter manually below'}
                  </div>
                </div>
              </div>

              {/* Location Testing Section */}
              <div style={{ 
                backgroundColor: '#f8f9fa',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#333' }}>
                  📍 Location & Geocoding
                </div>
                
                {/* Editable Address Fields */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#666', marginBottom: '4px', display: 'block' }}>
                        Street
                      </label>
                      <input
                        type="text"
                        value={editedAddresses[festival.id]?.street ?? festival.street ?? ''}
                        onChange={(e) => setEditedAddresses(prev => ({
                          ...prev,
                          [festival.id]: {
                            ...prev[festival.id],
                            street: e.target.value,
                            city: prev[festival.id]?.city ?? festival.city,
                            country: prev[festival.id]?.country ?? festival.country,
                            street_number: prev[festival.id]?.street_number ?? festival.street_number,
                            postal_code: prev[festival.id]?.postal_code ?? festival.postal_code
                          }
                        }))}
                        placeholder="e.g., Am Flugplatz"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#666', marginBottom: '4px', display: 'block' }}>
                        Number
                      </label>
                      <input
                        type="text"
                        value={editedAddresses[festival.id]?.street_number ?? festival.street_number ?? ''}
                        onChange={(e) => setEditedAddresses(prev => ({
                          ...prev,
                          [festival.id]: {
                            ...prev[festival.id],
                            street_number: e.target.value,
                            city: prev[festival.id]?.city ?? festival.city,
                            country: prev[festival.id]?.country ?? festival.country,
                            street: prev[festival.id]?.street ?? festival.street,
                            postal_code: prev[festival.id]?.postal_code ?? festival.postal_code
                          }
                        }))}
                        placeholder="e.g., 1"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#666', marginBottom: '4px', display: 'block' }}>
                        City <span style={{ color: '#e74c3c' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={editedAddresses[festival.id]?.city ?? festival.city ?? ''}
                        onChange={(e) => setEditedAddresses(prev => ({
                          ...prev,
                          [festival.id]: {
                            ...prev[festival.id],
                            city: e.target.value,
                            country: prev[festival.id]?.country ?? festival.country,
                            street: prev[festival.id]?.street ?? festival.street,
                            street_number: prev[festival.id]?.street_number ?? festival.street_number,
                            postal_code: prev[festival.id]?.postal_code ?? festival.postal_code
                          }
                        }))}
                        placeholder="e.g., Berlin"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#666', marginBottom: '4px', display: 'block' }}>
                        Postal Code
                      </label>
                      <input
                        type="text"
                        value={editedAddresses[festival.id]?.postal_code ?? festival.postal_code ?? ''}
                        onChange={(e) => setEditedAddresses(prev => ({
                          ...prev,
                          [festival.id]: {
                            ...prev[festival.id],
                            postal_code: e.target.value,
                            city: prev[festival.id]?.city ?? festival.city,
                            country: prev[festival.id]?.country ?? festival.country,
                            street: prev[festival.id]?.street ?? festival.street,
                            street_number: prev[festival.id]?.street_number ?? festival.street_number
                          }
                        }))}
                        placeholder="e.g., 10115"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#666', marginBottom: '4px', display: 'block' }}>
                      Country <span style={{ color: '#e74c3c' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={editedAddresses[festival.id]?.country ?? festival.country ?? ''}
                      onChange={(e) => setEditedAddresses(prev => ({
                        ...prev,
                        [festival.id]: {
                          ...prev[festival.id],
                          country: e.target.value,
                          city: prev[festival.id]?.city ?? festival.city,
                          street: prev[festival.id]?.street ?? festival.street,
                          street_number: prev[festival.id]?.street_number ?? festival.street_number,
                          postal_code: prev[festival.id]?.postal_code ?? festival.postal_code
                        }
                      }))}
                      placeholder="e.g., Germany or DE"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button
                    onClick={() => handleSaveAddress(festival.id)}
                    disabled={!editedAddresses[festival.id] || savingAddress[festival.id]}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      backgroundColor: editedAddresses[festival.id] ? '#28a745' : '#e0e0e0',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: editedAddresses[festival.id] && !savingAddress[festival.id] ? 'pointer' : 'not-allowed',
                      fontWeight: '600',
                      fontSize: '13px',
                      opacity: savingAddress[festival.id] ? 0.6 : 1
                    }}
                  >
                    {savingAddress[festival.id] ? '💾 Saving...' : '💾 Save Address'}
                  </button>
                  <button
                    onClick={() => handleTestGeocode(festival.id)}
                    disabled={geocodingStatus[festival.id] === 'loading'}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      backgroundColor: geocodingStatus[festival.id] === 'success' ? '#28a745' : 
                                     geocodingStatus[festival.id] === 'error' ? '#dc3545' : 
                                     '#0066ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: geocodingStatus[festival.id] === 'loading' ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      fontSize: '13px',
                      opacity: geocodingStatus[festival.id] === 'loading' ? 0.6 : 1
                    }}
                  >
                    {geocodingStatus[festival.id] === 'loading' ? '⏳ Geocoding...' : 
                     geocodingStatus[festival.id] === 'success' ? '✓ Found Coords' :
                     geocodingStatus[festival.id] === 'error' ? '✗ Failed' :
                     '🔍 Test Geocode'}
                  </button>
                </div>

                {/* Manual Coordinates Input */}
                <div style={{ 
                  borderTop: '1px solid #e0e0e0',
                  paddingTop: '12px'
                }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px', fontWeight: '600' }}>
                    Manual Coordinates (if geocoding fails)
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Latitude (e.g., 52.5200)"
                      value={manualCoordinates[festival.id]?.lat || ''}
                      onChange={(e) => setManualCoordinates(prev => ({ 
                        ...prev, 
                        [festival.id]: { ...prev[festival.id], lat: e.target.value }
                      }))}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontFamily: 'monospace'
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Longitude (e.g., 13.4050)"
                      value={manualCoordinates[festival.id]?.lng || ''}
                      onChange={(e) => setManualCoordinates(prev => ({ 
                        ...prev, 
                        [festival.id]: { ...prev[festival.id], lng: e.target.value }
                      }))}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontFamily: 'monospace'
                      }}
                    />
                    <button
                      onClick={() => handleSaveManualCoordinates(festival.id)}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '12px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      💾 Save
                    </button>
                  </div>
                </div>
              </div>

              {/* Genres */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Genres</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {festival.genres.map((genre, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '12px',
                        color: '#0066ff',
                        backgroundColor: '#e6f2ff',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontWeight: '500'
                      }}
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons - Pending */}
              {festival.status === 'pending' && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button
                    onClick={() => handleApprove(festival.id)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleReject(festival.id)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                  >
                    ✗ Reject
                  </button>
                  <button
                    onClick={() => navigate(`/festival/${festival.id}`)}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#f0f0f0',
                      color: '#666',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                  >
                    View
                  </button>
                </div>
              )}

              {/* Action Buttons - Approved */}
              {festival.status === 'approved' && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button
                    onClick={() => handleChangeToPending(festival.id)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#ffc107',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                  >
                    ← Back to Pending
                  </button>
                  <button
                    onClick={() => handleReject(festival.id)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                  >
                    ✗ Reject
                  </button>
                  <button
                    onClick={() => navigate(`/festival/${festival.id}`)}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#f0f0f0',
                      color: '#666',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                  >
                    View
                  </button>
                </div>
              )}

              {/* Action Buttons - Rejected */}
              {festival.status === 'rejected' && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button
                    onClick={() => handleChangeToPending(festival.id)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#ffc107',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                  >
                    ← Back to Pending
                  </button>
                  <button
                    onClick={() => handleApprove(festival.id)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => navigate(`/festival/${festival.id}`)}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#f0f0f0',
                      color: '#666',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                  >
                    View
                  </button>
                </div>
              )}

              {festival.rejectionReason && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: '#fff3cd',
                  borderRadius: '6px',
                  fontSize: '13px'
                }}>
                  <strong>Rejection reason:</strong> {festival.rejectionReason}
                </div>
              )}
            </div>
          ))}

          {festivals.length === 0 && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
              color: '#888'
            }}>
              No {selectedTab} festivals to display
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;

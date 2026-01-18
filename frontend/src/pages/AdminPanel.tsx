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
      backgroundColor: '#f7f7f7',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
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
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Location</div>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>{festival.venue}</div>
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

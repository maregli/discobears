import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Festival } from 'types/festival';
import { 
  getFestivalById, 
  submitRating, 
  getUserRating, 
  getFestivalRatings,
  addComment,
  subscribeToComments,
  setAttendance,
  removeAttendance,
  getUserAttendance,
  subscribeToAttendance,
  Comment,
  Rating,
  FestivalRatings,
  Attendance
} from 'firebaseServices/firestore';
import { useAuth } from 'contexts/AuthContext';
import LoginModal from '../components/LoginModal';

const FestivalDetailPage: React.FC = () => {
  const { festivalId } = useParams<{ festivalId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [festival, setFestival] = useState<Festival | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState<Rating | null>(null);
  const [festivalRatings, setFestivalRatings] = useState<FestivalRatings>({
    overall: { average: 0, count: 0 },
    lineup: { average: 0, count: 0 },
    location: { average: 0, count: 0 }
  });
  const [hoveredRatings, setHoveredRatings] = useState<{
    overall: number | null;
    lineup: number | null;
    location: number | null;
  }>({ overall: null, lineup: null, location: null });
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [userAttendance, setUserAttendance] = useState<Attendance | null>(null);
  const [allAttendance, setAllAttendance] = useState<Attendance[]>([]);

  useEffect(() => {
    if (!festivalId) return;

    // Load festival
    getFestivalById(festivalId).then(data => {
      setFestival(data);
      setLoading(false);
    });

    // Subscribe to comments
    const unsubscribeComments = subscribeToComments(festivalId, setComments);
    
    // Subscribe to attendance
    const unsubscribeAttendance = subscribeToAttendance(festivalId, setAllAttendance);

    // Load ratings
    getFestivalRatings(festivalId).then(setFestivalRatings);

    return () => {
      unsubscribeComments();
      unsubscribeAttendance();
    };
  }, [festivalId]);

  useEffect(() => {
    if (user && festivalId) {
      getUserRating(festivalId, user.uid).then(setUserRating);
      getUserAttendance(festivalId, user.uid).then(setUserAttendance);
    } else {
      setUserAttendance(null);
    }
  }, [user, festivalId]);

  const handleRatingClick = async (category: 'overall' | 'lineup' | 'location', rating: number) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    if (!festivalId) return;

    try {
      // Keep existing ratings, update only the clicked category
      // Only include categories that have been rated (value > 0)
      const newRatings = {
        overall: category === 'overall' ? rating : (userRating?.overall || 0),
        lineup: category === 'lineup' ? rating : (userRating?.lineup || 0),
        location: category === 'location' ? rating : (userRating?.location || 0)
      };
      
      await submitRating(festivalId, user.uid, user.email || '', newRatings);
      
      // Update local state with the new ratings
      const updatedUserRating = {
        userId: user.uid,
        userEmail: user.email || '',
        overall: newRatings.overall,
        lineup: newRatings.lineup,
        location: newRatings.location,
        createdAt: userRating?.createdAt || new Date(),
        updatedAt: new Date()
      };
      setUserRating(updatedUserRating);
      
      // Reload festival ratings
      const updatedRatings = await getFestivalRatings(festivalId);
      setFestivalRatings(updatedRatings);
    } catch (error) {
      console.error('Error submitting rating:', error);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    if (!festivalId || !commentText.trim()) return;

    try {
      const userName = user.displayName || user.email || 'Anonymous';
      await addComment(festivalId, user.uid, userName, commentText);
      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleAttendanceChange = async (status: 'attending' | 'tempted' | null) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    if (!festivalId) return;

    try {
      if (status === null) {
        await removeAttendance(festivalId, user.uid);
        setUserAttendance(null);
      } else {
        const userName = user.displayName || user.email || 'Anonymous';
        await setAttendance(festivalId, user.uid, userName, user.email || '', status);
        // Optimistically update local state
        setUserAttendance({
          userId: user.uid,
          userName,
          userEmail: user.email || '',
          status,
          createdAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        Loading festival...
      </div>
    );
  }

  if (!festival) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Festival not found</h2>
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: '20px',
            padding: '12px 24px',
            backgroundColor: '#0066ff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Back to Map
        </button>
      </div>
    );
  }

  const renderStars = (
    category: 'overall' | 'lineup' | 'location',
    rating: number, 
    interactive: boolean = false
  ) => {
    return (
      <div style={{ display: 'flex', gap: '8px' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            onMouseEnter={() => interactive && setHoveredRatings(prev => ({ ...prev, [category]: star }))}
            onMouseLeave={() => interactive && setHoveredRatings(prev => ({ ...prev, [category]: null }))}
            onClick={() => interactive && handleRatingClick(category, star)}
            style={{
              fontSize: '32px',
              cursor: interactive ? 'pointer' : 'default',
              color: star <= (hoveredRatings[category] || rating) ? '#ffd700' : '#ddd',
              transition: 'color 0.2s'
            }}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

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
        padding: '20px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '16px',
            color: '#0066ff',
            cursor: 'pointer',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ← Back to Map
        </button>
        
        {festival.external_link && (
          <a
            href={festival.external_link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#0066ff',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Official Website →
          </a>
        )}
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        {/* Hero Section */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '40px',
          marginBottom: '24px'
        }}>
          <h1 style={{ margin: '0 0 20px 0', fontSize: '36px', fontWeight: '700' }}>
            {festival.name}
          </h1>

          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <div>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '6px' }}>📅 Dates</div>
              <div style={{ fontSize: '18px', fontWeight: '600' }}>{festival.dates}</div>
              <div style={{ fontSize: '14px', color: '#888' }}>{festival.duration}</div>
            </div>

            <div>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '6px' }}>📍 Location</div>
              <div style={{ fontSize: '18px', fontWeight: '600' }}>{festival.parsed_city || festival.region}</div>
              <div style={{ fontSize: '14px', color: '#888' }}>{festival.venue_type}</div>
            </div>

            {festival.visitors && (
              <div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '6px' }}>👥 Visitors</div>
                <div style={{ fontSize: '18px', fontWeight: '600' }}>{festival.visitors}</div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>🎸 Genres</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {festival.genres.map((genre, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '14px',
                    color: '#0066ff',
                    backgroundColor: '#e6f2ff',
                    padding: '6px 14px',
                    borderRadius: '16px',
                    fontWeight: '500'
                  }}
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '6px' }}>Address</div>
            <div style={{ fontSize: '16px', color: '#333' }}>
              {festival.venue_formatted || festival.venue}
            </div>
          </div>

          {/* Source Information */}
          <div style={{ 
            marginTop: '32px', 
            paddingTop: '24px', 
            borderTop: '1px solid #e0e0e0',
            fontSize: '14px',
            color: '#666'
          }}>
            <div style={{ marginBottom: '4px', fontWeight: '500' }}>Source:</div>
            {festival.source === 'user-submitted' ? (
              <div>User Submitted</div>
            ) : (
              (festival.source_url || festival.url) ? (
                <a
                  href={festival.source_url || festival.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#0066ff',
                    textDecoration: 'none',
                    fontWeight: '500'
                  }}
                >
                  Festival Alarm →
                </a>
              ) : (
                <div>Scraped</div>
              )
            )}
          </div>
        </div>

        {/* Attendance Section */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          marginBottom: '24px'
        }}>
          <h2 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: '700' }}>
            Are you going?
          </h2>

          {/* Attendance Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
            <button
              onClick={() => handleAttendanceChange(userAttendance?.status === 'attending' ? null : 'attending')}
              style={{
                flex: 1,
                padding: '16px 24px',
                backgroundColor: userAttendance?.status === 'attending' ? '#0066ff' : 'white',
                color: userAttendance?.status === 'attending' ? 'white' : '#1a1a1a',
                border: `2px solid ${userAttendance?.status === 'attending' ? '#0066ff' : '#d0d0d0'}`,
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                if (userAttendance?.status !== 'attending') {
                  e.currentTarget.style.borderColor = '#0066ff';
                  e.currentTarget.style.color = '#0066ff';
                }
              }}
              onMouseLeave={(e) => {
                if (userAttendance?.status !== 'attending') {
                  e.currentTarget.style.borderColor = '#d0d0d0';
                  e.currentTarget.style.color = '#1a1a1a';
                }
              }}
            >
              <span style={{ fontSize: '20px' }}>✓</span>
              Attending
            </button>

            <button
              onClick={() => handleAttendanceChange(userAttendance?.status === 'tempted' ? null : 'tempted')}
              style={{
                flex: 1,
                padding: '16px 24px',
                backgroundColor: userAttendance?.status === 'tempted' ? '#ff9500' : 'white',
                color: userAttendance?.status === 'tempted' ? 'white' : '#1a1a1a',
                border: `2px solid ${userAttendance?.status === 'tempted' ? '#ff9500' : '#d0d0d0'}`,
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                if (userAttendance?.status !== 'tempted') {
                  e.currentTarget.style.borderColor = '#ff9500';
                  e.currentTarget.style.color = '#ff9500';
                }
              }}
              onMouseLeave={(e) => {
                if (userAttendance?.status !== 'tempted') {
                  e.currentTarget.style.borderColor = '#d0d0d0';
                  e.currentTarget.style.color = '#1a1a1a';
                }
              }}
            >
              <span style={{ fontSize: '20px' }}>🤔</span>
              Tempted
            </button>
          </div>

          {!user && (
            <div style={{
              padding: '16px',
              backgroundColor: '#f7f7f7',
              borderRadius: '8px',
              textAlign: 'center',
              marginBottom: '32px'
            }}>
              <button
                onClick={() => setShowLoginModal(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#0066ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                Sign In to Respond
              </button>
            </div>
          )}

          {/* Attendees List */}
          {allAttendance.length > 0 && (
            <div style={{ 
              borderTop: '1px solid #e0e0e0', 
              paddingTop: '24px',
              marginTop: '8px'
            }}>
              <h3 style={{ 
                margin: '0 0 20px 0', 
                fontSize: '18px', 
                fontWeight: '600',
                color: '#1a1a1a'
              }}>
                Who's Going
              </h3>
              
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                gap: '24px',
                alignItems: 'start'
              }}>
                {/* Going */}
                <div>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: '600',
                    color: '#0066ff',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ fontSize: '16px' }}>✓</span>
                    Going ({allAttendance.filter(a => a.status === 'attending').length})
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '6px' 
                  }}>
                    {allAttendance
                      .filter(a => a.status === 'attending')
                      .map(attendee => (
                        <div
                          key={attendee.userId}
                          style={{
                            fontSize: '14px',
                            color: '#1a1a1a'
                          }}
                        >
                          {attendee.userName}
                        </div>
                      ))}
                    {allAttendance.filter(a => a.status === 'attending').length === 0 && (
                      <div style={{ fontSize: '14px', color: '#999', fontStyle: 'italic' }}>
                        No one yet
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{
                  width: '1px',
                  height: '100%',
                  minHeight: '100px',
                  backgroundColor: '#e0e0e0'
                }} />

                {/* Tempted */}
                <div>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: '600',
                    color: '#ff9500',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ fontSize: '16px' }}>🤔</span>
                    Tempted ({allAttendance.filter(a => a.status === 'tempted').length})
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '6px' 
                  }}>
                    {allAttendance
                      .filter(a => a.status === 'tempted')
                      .map(attendee => (
                        <div
                          key={attendee.userId}
                          style={{
                            fontSize: '14px',
                            color: '#1a1a1a'
                          }}
                        >
                          {attendee.userName}
                        </div>
                      ))}
                    {allAttendance.filter(a => a.status === 'tempted').length === 0 && (
                      <div style={{ fontSize: '14px', color: '#999', fontStyle: 'italic' }}>
                        No one yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rating Section */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          marginBottom: '24px'
        }}>
          <h2 style={{ margin: '0 0 32px 0', fontSize: '24px', fontWeight: '700' }}>
            Ratings
          </h2>

          {/* Overall Rating */}
          <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>
                Overall
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#0066ff' }}>
                  {festivalRatings.overall.count > 0 ? festivalRatings.overall.average.toFixed(1) : '—'}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {festivalRatings.overall.count} {festivalRatings.overall.count === 1 ? 'rating' : 'ratings'}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
              {user ? 'Your Rating' : 'Sign in to rate'}
            </div>
            {renderStars('overall', userRating?.overall || 0, !!user)}
          </div>

          {/* Lineup Rating */}
          <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>
                Lineup
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#0066ff' }}>
                  {festivalRatings.lineup.count > 0 ? festivalRatings.lineup.average.toFixed(1) : '—'}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {festivalRatings.lineup.count} {festivalRatings.lineup.count === 1 ? 'rating' : 'ratings'}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
              {user ? 'Your Rating' : 'Sign in to rate'}
            </div>
            {renderStars('lineup', userRating?.lineup || 0, !!user)}
          </div>

          {/* Location Rating */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>
                Location
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#0066ff' }}>
                  {festivalRatings.location.count > 0 ? festivalRatings.location.average.toFixed(1) : '—'}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {festivalRatings.location.count} {festivalRatings.location.count === 1 ? 'rating' : 'ratings'}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
              {user ? 'Your Rating' : 'Sign in to rate'}
            </div>
            {renderStars('location', userRating?.location || 0, !!user)}
          </div>

          {!user && (
            <button
              onClick={() => setShowLoginModal(true)}
              style={{
                marginTop: '24px',
                padding: '12px 24px',
                backgroundColor: '#0066ff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '16px'
              }}
            >
              Sign In to Rate
            </button>
          )}
        </div>

        {/* Comments Section */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px'
        }}>
          <h2 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: '700' }}>
            Comments ({comments.length})
          </h2>

          {/* Comment Form */}
          {user ? (
            <form onSubmit={handleCommentSubmit} style={{ marginBottom: '32px' }}>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Share your experience..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '12px',
                  border: '1px solid #d0d0d0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  marginBottom: '12px'
                }}
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: commentText.trim() ? '#0066ff' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: commentText.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                Post Comment
              </button>
            </form>
          ) : (
            <div style={{
              padding: '20px',
              backgroundColor: '#f7f7f7',
              borderRadius: '8px',
              marginBottom: '32px',
              textAlign: 'center'
            }}>
              <button
                onClick={() => setShowLoginModal(true)}
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
                Sign In to Comment
              </button>
            </div>
          )}

          {/* Comments List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {comments.map(comment => (
              <div
                key={comment.id}
                style={{
                  padding: '16px',
                  backgroundColor: '#f7f7f7',
                  borderRadius: '8px'
                }}
              >
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>
                    {comment.userName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    {comment.createdAt.toLocaleDateString()}
                  </div>
                </div>
                <div style={{ fontSize: '14px', color: '#333', lineHeight: '1.5' }}>
                  {comment.text}
                </div>
              </div>
            ))}
          </div>

          {comments.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              color: '#888', 
              fontSize: '14px',
              padding: '40px 20px'
            }}>
              No comments yet. Be the first to share your experience!
            </div>
          )}
        </div>
      </div>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
};

export default FestivalDetailPage;

import React from 'react';
import { useAuth } from 'contexts/AuthContext';

interface MobileProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogin: () => void;
}

const MobileProfileDrawer: React.FC<MobileProfileDrawerProps> = ({
  isOpen,
  onClose,
  onOpenLogin
}) => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    onClose();
  };

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
            Profile
          </h2>
          <div style={{ width: '60px' }} />
        </div>

        {/* Profile Content */}
        <div style={{ 
          flex: 1,
          overflowY: 'auto',
          padding: '20px'
        }}>
          {user ? (
            <>
              {/* User Info */}
              <div style={{
                padding: '20px',
                backgroundColor: '#f8f9fa',
                borderRadius: '12px',
                marginBottom: '24px',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '48px',
                  marginBottom: '12px'
                }}>
                  👤
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1a1a1a',
                  marginBottom: '4px'
                }}>
                  {user.displayName || 'User'}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#666'
                }}>
                  {user.email}
                </div>
              </div>

              {/* Profile Options */}
              <div style={{
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                overflow: 'hidden'
              }}>
                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    backgroundColor: 'white',
                    border: 'none',
                    borderBottom: '1px solid #e0e0e0',
                    cursor: 'pointer',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: '#dc3545'
                  }}
                >
                  <span style={{ fontWeight: '500' }}>Logout</span>
                  <span>→</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Not Logged In */}
              <div style={{
                padding: '40px 20px',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '64px',
                  marginBottom: '20px'
                }}>
                  👤
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1a1a1a',
                  marginBottom: '12px'
                }}>
                  Not signed in
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#666',
                  marginBottom: '24px'
                }}>
                  Sign in to access your profile and submit festivals
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onOpenLogin();
                  }}
                  style={{
                    padding: '14px 32px',
                    backgroundColor: '#0066ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Sign In
                </button>
              </div>
            </>
          )}
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

export default MobileProfileDrawer;

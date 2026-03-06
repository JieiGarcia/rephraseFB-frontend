import React, { useState } from 'react';

interface AuthPageProps {
  onLogin: (userId: string) => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [userId, setUserId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userId.trim()) {
      console.log('User ID submitted:', userId.trim());
      onLogin(userId.trim());
    }
  };

  const handleGuestLogin = () => {
    const guestId = `guest_${Math.random().toString(36).substring(2, 9)}`;
    console.log('Guest login:', guestId);
    onLogin(guestId);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{
          textAlign: 'center',
          marginBottom: '2rem',
          color: '#333'
        }}>
          Welcome to rephraseFB
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: '#555',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              For Research Participants:
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your assigned User ID"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={!userId.trim()}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: userId.trim() ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: userId.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Log In
          </button>
        </form>

        {/* 境界線と「or」 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          margin: '1.5rem 0',
          color: '#adb5bd'
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e9ecef' }}></div>
          <span style={{ padding: '0 10px', fontSize: '14px' }}>or</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e9ecef' }}></div>
        </div>

        {/* ゲストログインボタン */}
        <div>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            color: '#555',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            ゲストの方はこちら:
          </label>
          <button
            type="button"
            onClick={handleGuestLogin}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
          >
            Try as Guest
          </button>
        </div>

      </div>
    </div>
  );
};

export default AuthPage;
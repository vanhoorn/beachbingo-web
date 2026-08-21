import React from 'react';
import { useNavigate } from 'react-router-dom';

const KlontauschLobbyScreen: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f1b2e', color: '#fff', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🃏</div>
      <h1 style={{ margin: 0 }}>Klontausch</h1>
      <p style={{ color: '#8899aa', textAlign: 'center', maxWidth: 320 }}>
        Web-Version in Kürze verfügbar.<br />Spiele jetzt auf Android!
      </p>
      <button onClick={() => navigate('/')} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#8B5CF6', color: '#fff', cursor: 'pointer', fontSize: 16 }}>
        Zurück
      </button>
    </div>
  );
};

export default KlontauschLobbyScreen;

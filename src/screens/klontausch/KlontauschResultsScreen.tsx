import React from 'react';
import { useNavigate } from 'react-router-dom';

const KlontauschResultsScreen: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f1b2e', color: '#fff', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🏆</div>
      <h2 style={{ margin: 0 }}>Klontausch – Ergebnis</h2>
      <p style={{ color: '#8899aa' }}>Web-Version in Kürze verfügbar.</p>
      <button onClick={() => navigate('/klontausch/lobby')} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#8B5CF6', color: '#fff', cursor: 'pointer', fontSize: 16 }}>
        Neue Runde
      </button>
      <button onClick={() => navigate('/')} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid #334', background: 'transparent', color: '#8899aa', cursor: 'pointer', fontSize: 16 }}>
        Hauptmenü
      </button>
    </div>
  );
};

export default KlontauschResultsScreen;

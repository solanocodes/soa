'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function ImportPage() {
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const alertsRef = useRef<HTMLInputElement>(null);
  const winsRef = useRef<HTMLInputElement>(null);

  if (!user?.is_admin) {
    return (
      <div style={{ padding: 40, color: '#FF4444', textAlign: 'center' }}>
        Admin access required
      </div>
    );
  }

  const handleImport = async (type: 'alerts' | 'wins', file: File) => {
    setLoading(true);
    setStatus('');
    setProgress(`Reading ${type} file...`);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const messages = data.messages || data;

      const totalMessages = messages.length;
      setProgress(`Parsed ${totalMessages} messages. Importing in batches...`);

      let totalImported = 0;
      const batchSize = 100;

      for (let i = 0; i < totalMessages; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        setProgress(`Importing ${type}: ${i}/${totalMessages}...`);

        const { data: result } = await api.post('/admin/import', {
          type,
          messages: batch,
        });

        totalImported += result.imported;
      }

      setStatus(`Done! Imported ${totalImported} ${type}.`);
      setProgress('');
    } catch (err: any) {
      setStatus(`Error: ${err?.response?.data?.error || err.message}`);
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40, maxWidth: 600 }}>
      <h1 style={{ color: '#fff', fontSize: 24, marginBottom: 24, fontWeight: 700 }}>
        Import Discord Data
      </h1>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ color: '#00D084', fontSize: 18, marginBottom: 12 }}>
          Import Solano Alerts
        </h2>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 12 }}>
          Upload the Discord export JSON file for #solano-alerts
        </p>
        <input
          ref={alertsRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImport('alerts', file);
          }}
        />
        <button
          onClick={() => alertsRef.current?.click()}
          disabled={loading}
          style={{
            background: '#00D084',
            color: '#000',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 8,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          Choose Alerts File
        </button>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ color: '#C9A84C', fontSize: 18, marginBottom: 12 }}>
          Import Student Wins
        </h2>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 12 }}>
          Upload the Discord export JSON file for #share-your-wins
        </p>
        <input
          ref={winsRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImport('wins', file);
          }}
        />
        <button
          onClick={() => winsRef.current?.click()}
          disabled={loading}
          style={{
            background: '#C9A84C',
            color: '#000',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 8,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          Choose Wins File
        </button>
      </div>

      {progress && (
        <div style={{ color: '#FFB800', fontSize: 14, marginBottom: 12 }}>
          {progress}
        </div>
      )}

      {status && (
        <div style={{
          color: status.startsWith('Error') ? '#FF4444' : '#00D084',
          fontSize: 16,
          fontWeight: 600,
          padding: 16,
          background: '#111',
          borderRadius: 8,
          border: `1px solid ${status.startsWith('Error') ? '#FF4444' : '#00D084'}`,
        }}>
          {status}
        </div>
      )}
    </div>
  );
}

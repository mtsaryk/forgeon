import { useState } from 'react';
import './styles.css';

type HealthResponse = {
  status: string;
  message: string;
};

export default function App() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkApi = async () => {
    setError(null);
    try {
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as HealthResponse;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <main className="page">
      <h1>Forgeon Fullstack Scaffold</h1>
      <p>Default frontend preset: React + Vite + TypeScript.</p>
      <button onClick={checkApi}>Check API health</button>
      {data ? <pre>{JSON.stringify(data, null, 2)}</pre> : null}
      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}


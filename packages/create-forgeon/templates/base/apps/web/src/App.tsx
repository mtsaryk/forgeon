import { useState } from 'react';
import './styles.css';

type ProbeResult = {
  statusCode: number;
  body: unknown;
};

export default function App() {
  const [healthResult, setHealthResult] = useState<ProbeResult | null>(null);
  const [errorProbeResult, setErrorProbeResult] = useState<ProbeResult | null>(null);
  const [validationProbeResult, setValidationProbeResult] = useState<ProbeResult | null>(null);
  const [dbProbeResult, setDbProbeResult] = useState<ProbeResult | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const requestProbe = async (url: string, init?: RequestInit): Promise<ProbeResult> => {
    const response = await fetch(url, init);
    let body: unknown = null;

    try {
      body = await response.json();
    } catch {
      body = { message: 'Non-JSON response' };
    }

    return {
      statusCode: response.status,
      body,
    };
  };

  const runProbe = async (
    setter: (value: ProbeResult | null) => void,
    url: string,
    init?: RequestInit,
  ) => {
    setNetworkError(null);
    try {
      const result = await requestProbe(url, init);
      setter(result);
    } catch (err) {
      setNetworkError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const renderResult = (title: string, result: ProbeResult | null) => (
    <section>
      <h3>{title}</h3>
      {result ? <pre>{JSON.stringify(result, null, 2)}</pre> : null}
    </section>
  );

  return (
    <main className="page">
      <h1>Forgeon Fullstack Scaffold</h1>
      <p>Default frontend preset: React + Vite + TypeScript.</p>
      <div className="actions">
        <button onClick={() => runProbe(setHealthResult, '/api/health')}>Check API health</button>
        <button onClick={() => runProbe(setErrorProbeResult, '/api/health/error')}>
          Check error envelope
        </button>
        <button onClick={() => runProbe(setValidationProbeResult, '/api/health/validation')}>
          Check validation (expect 400)
        </button>
        <button onClick={() => runProbe(setDbProbeResult, '/api/health/db', { method: 'POST' })}>
          Check database (create user)
        </button>
      </div>
      {renderResult('Health response', healthResult)}
      {renderResult('Error probe response', errorProbeResult)}
      {renderResult('Validation probe response', validationProbeResult)}
      {renderResult('DB probe response', dbProbeResult)}
      {networkError ? <p className="error">{networkError}</p> : null}
    </main>
  );
}



import { useState } from 'react';
import { probeDefinitions, type ProbeDefinition, type ProbeResult } from './probes';
import './styles.css';

type ProbeState = {
  result: ProbeResult | null;
  error: string | null;
  loading: boolean;
};

const emptyProbeState: ProbeState = {
  result: null,
  error: null,
  loading: false,
};

export default function App() {
  const [probeState, setProbeState] = useState<Record<string, ProbeState>>({});

  const requestProbe = async (probe: ProbeDefinition): Promise<ProbeResult> => {
    const response = await fetch(`/api${probe.path}`, {
      ...(probe.request ?? {}),
      cache: 'no-store',
      headers: {
        ...(probe.request?.headers ?? {}),
      },
    });
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

  const runProbe = async (probe: ProbeDefinition) => {
    setProbeState((current) => ({
      ...current,
      [probe.id]: {
        ...(current[probe.id] ?? emptyProbeState),
        error: null,
        loading: true,
      },
    }));

    try {
      const result = await requestProbe(probe);
      setProbeState((current) => ({
        ...current,
        [probe.id]: {
          result,
          error: null,
          loading: false,
        },
      }));
    } catch (err) {
      setProbeState((current) => ({
        ...current,
        [probe.id]: {
          result: current[probe.id]?.result ?? null,
          error: err instanceof Error ? err.message : 'Unknown error',
          loading: false,
        },
      }));
    }
  };

  return (
    <main className="page">
      <h1>Forgeon Fullstack Scaffold</h1>
      <p>Default frontend preset: React + Vite + TypeScript.</p>
      <div id="probes" className="probes">
        {probeDefinitions.map((probe) => {
          const current = probeState[probe.id] ?? emptyProbeState;

          return (
            <section key={probe.id} className="probe">
              <div className="probe-header">
                <h2>{probe.title}</h2>
                <button type="button" onClick={() => runProbe(probe)} disabled={current.loading}>
                  {current.loading ? 'Running...' : probe.buttonLabel}
                </button>
              </div>
              <div className="probe-output">
                <h3>{probe.resultTitle}</h3>
                {current.error ? <p className="error">{current.error}</p> : null}
                {current.result ? <pre>{JSON.stringify(current.result, null, 2)}</pre> : null}
                {!current.error && !current.result ? (
                  <p className="placeholder">No probe result yet.</p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

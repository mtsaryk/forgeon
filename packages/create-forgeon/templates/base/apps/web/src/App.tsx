import { useState } from 'react';
import { probeDefinitions, type ProbeDefinition, type ProbeInputDefinition, type ProbeResult } from './probes';
import './styles.css';

type ProbeState = {
  result: ProbeResult | null;
  error: string | null;
  loading: boolean;
};

type ProbeInputState = Record<string, string>;

const emptyProbeState: ProbeState = {
  result: null,
  error: null,
  loading: false,
};

function resolveBodyTemplate(value: unknown, inputs: ProbeInputState): unknown {
  if (typeof value === 'string') {
    const match = value.match(/^\$INPUT\.([a-zA-Z0-9_-]+)\$$/);
    if (match) {
      return inputs[match[1]] ?? '';
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveBodyTemplate(item, inputs));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, resolveBodyTemplate(nestedValue, inputs)]),
    );
  }

  return value;
}

export default function App() {
  const [probeState, setProbeState] = useState<Record<string, ProbeState>>({});
  const [probeInputs, setProbeInputs] = useState<Record<string, ProbeInputState>>({});

  const getProbeInputValue = (probeId: string, input: ProbeInputDefinition): string => {
    return probeInputs[probeId]?.[input.id] ?? input.defaultValue ?? '';
  };

  const updateProbeInput = (probeId: string, inputId: string, value: string) => {
    setProbeInputs((current) => ({
      ...current,
      [probeId]: {
        ...(current[probeId] ?? {}),
        [inputId]: value,
      },
    }));
  };

  const requestProbe = async (probe: ProbeDefinition): Promise<ProbeResult> => {
    const method = probe.request?.method ?? 'GET';
    const headers: Record<string, string> = {
      ...(probe.request?.headers ?? {}),
    };

    const requestInit: RequestInit = {
      method,
      cache: 'no-store',
      headers,
    };

    if (method !== 'GET' && probe.request?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestInit.body = JSON.stringify(resolveBodyTemplate(probe.request.body, probeInputs[probe.id] ?? {}));
    }

    const response = await fetch(`/api${probe.path}`, requestInit);
    let responseBody: unknown = null;

    try {
      responseBody = await response.json();
    } catch {
      responseBody = { message: 'Non-JSON response' };
    }

    return {
      statusCode: response.status,
      body: responseBody,
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
              {probe.inputs?.length ? (
                <div className="probe-inputs">
                  {probe.inputs.map((input) => (
                    <label key={`${probe.id}-${input.id}`} className="probe-input">
                      <span>{input.label}</span>
                      <input
                        type={input.type ?? 'text'}
                        value={getProbeInputValue(probe.id, input)}
                        placeholder={input.placeholder}
                        onChange={(event) => updateProbeInput(probe.id, input.id, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              ) : null}
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

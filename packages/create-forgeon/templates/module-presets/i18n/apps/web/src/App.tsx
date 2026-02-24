import { useState } from 'react';
import * as i18nWeb from '@forgeon/i18n-web';
import type { I18nLocale } from '@forgeon/i18n-web';
import './styles.css';

type HealthResponse = {
  status: string;
  message: string;
};

export default function App() {
  const { I18N_LOCALES, getInitialLocale, persistLocale, toLangQuery } = i18nWeb;
  const [locale, setLocale] = useState<I18nLocale>(getInitialLocale);
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changeLocale = (nextLocale: I18nLocale) => {
    setLocale(nextLocale);
    persistLocale(nextLocale);
  };

  const checkApi = async () => {
    setError(null);
    try {
      const response = await fetch(`/api/health${toLangQuery(locale)}`, {
        headers: {
          'Accept-Language': locale,
        },
      });
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
      <label htmlFor="language">Language:</label>
      <select
        id="language"
        value={locale}
        onChange={(event) => changeLocale(event.target.value as I18nLocale)}
      >
        {I18N_LOCALES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <button onClick={checkApi}>Check API health</button>
      {data ? <pre>{JSON.stringify(data, null, 2)}</pre> : null}
      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}

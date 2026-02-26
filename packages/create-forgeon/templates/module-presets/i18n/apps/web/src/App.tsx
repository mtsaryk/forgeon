import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import * as i18nWeb from '@forgeon/i18n-web';
import type { I18nLocale } from '@forgeon/i18n-web';
import './styles.css';

type ProbeResult = {
  statusCode: number;
  body: unknown;
};

function localeLabelKey(locale: I18nLocale): string {
  return locale === 'uk' ? 'common:languages.ukrainian' : 'common:languages.english';
}

export default function App() {
  const { t } = useTranslation(['common']);
  const { I18N_LOCALES, getInitialLocale, persistLocale, toLangQuery } = i18nWeb;
  const [locale, setLocale] = useState<I18nLocale>(getInitialLocale);
  const [healthResult, setHealthResult] = useState<ProbeResult | null>(null);
  const [errorProbeResult, setErrorProbeResult] = useState<ProbeResult | null>(null);
  const [validationProbeResult, setValidationProbeResult] = useState<ProbeResult | null>(null);
  const [dbProbeResult, setDbProbeResult] = useState<ProbeResult | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const changeLocale = (nextLocale: I18nLocale) => {
    setLocale(nextLocale);
    persistLocale(nextLocale);
    void i18n.changeLanguage(nextLocale);
  };

  const requestProbe = async (path: string, init?: RequestInit): Promise<ProbeResult> => {
    const response = await fetch(`/api${path}${toLangQuery(locale)}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        'Accept-Language': locale,
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

  const runProbe = async (
    setter: (value: ProbeResult | null) => void,
    path: string,
    init?: RequestInit,
  ) => {
    setNetworkError(null);
    try {
      const result = await requestProbe(path, init);
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
      <label htmlFor="language">{t('common:language')}:</label>
      <select
        id="language"
        value={locale}
        onChange={(event) => changeLocale(event.target.value as I18nLocale)}
      >
        {I18N_LOCALES.map((item) => (
          <option key={item} value={item}>
            {t(localeLabelKey(item))}
          </option>
        ))}
      </select>
      <div className="actions">
        <button onClick={() => runProbe(setHealthResult, '/health')}>{t('common:checkApiHealth')}</button>
        <button onClick={() => runProbe(setErrorProbeResult, '/health/error')}>
          {t('common:checkErrorEnvelope')}
        </button>
        <button onClick={() => runProbe(setValidationProbeResult, '/health/validation')}>
          {t('common:checkValidation')}
        </button>
        <button onClick={() => runProbe(setDbProbeResult, '/health/db', { method: 'POST' })}>
          {t('common:checkDatabase')}
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

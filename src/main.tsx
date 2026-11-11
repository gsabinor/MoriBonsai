import React from 'react';
import ReactDOM from 'react-dom/client';
import DemoApp from './App';
import LiveApp from './LiveApp';
import { configurationError, isConfigured } from './lib/supabase';
import './styles.css';
import './live.css';
import './redesign.css';
import './interior-v13.css';
import './interior-v131.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {configurationError ? (
      <main className="setup-error"><h1>Configuração incompleta</h1><p>{configurationError}</p><p>Corrija o arquivo <code>.env.local</code> e reinicie o Vite.</p></main>
    ) : isConfigured ? <LiveApp /> : <DemoApp />}
  </React.StrictMode>,
);

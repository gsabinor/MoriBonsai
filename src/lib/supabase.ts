import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

// Ausência de configuração mantém somente o protótipo demonstrativo.
// Uma configuração preenchida incorretamente mostra erro explícito ao usuário.
export const isConfigured = Boolean(url && publishableKey);
export const configurationError = !isConfigured
  ? null
  : !/^https:\/\/[^\s/]+\.supabase\.co\/?$/.test(url)
    ? 'VITE_SUPABASE_URL deve ser uma URL HTTPS válida do projeto Supabase.'
    : !/^(sb_publishable_|eyJ)/.test(publishableKey)
      ? 'A chave informada não parece ser uma chave publicável (ou anon legada).'
      : null;

export const supabase = isConfigured && !configurationError
  ? createClient(url, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

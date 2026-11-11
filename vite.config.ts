import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// No GitHub Actions, o nome do repositório define automaticamente o caminho base.
// Localmente, a aplicação sempre roda na raiz (/).
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.GITHUB_PAGES === 'true' && repository ? `/${repository}/` : '/';

export default defineConfig({
  plugins: [react()],
  base,
});

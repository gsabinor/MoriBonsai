// Verificacao antes de publicar: Node nativo, sem dependencias npm.
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const deploy = process.argv.includes('--deploy');
const errors = [];
const warnings = [];
const requireFile = (path) => {
  if (!existsSync(resolve(root,path))) errors.push(`Arquivo necessário ausente: ${path}`);
};
for (const f of ['index.html','src/main.tsx','src/LiveApp.tsx','vite.config.ts',
  '.github/workflows/deploy.yml','public/assets/mori-forest-hero.webp','public/assets/mori-dragon-logo.webp',
  'supabase/14_planos_desejos.sql','supabase/16_colecao_manejos_midias.sql','.env.example']) requireFile(f);
const config = existsSync(resolve(root,'vite.config.ts')) ? readFileSync(resolve(root,'vite.config.ts'),'utf8') : '';
if (!config.includes('GITHUB_REPOSITORY') || !config.includes('GITHUB_PAGES'))
  errors.push('A configuração do caminho-base do GitHub Pages precisa ser revisada.');
const envExample = existsSync(resolve(root,'.env.example')) ? readFileSync(resolve(root,'.env.example'),'utf8') : '';
for (const field of ['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY']) {
  if (!envExample.includes(field)) errors.push(`Falta ${field} no .env.example.`);
}
if (deploy) {
  const url = (process.env.VITE_SUPABASE_URL ?? '').trim();
  const key = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  if (!/^https:\/\/[^\s/]+\.supabase\.co\/?$/.test(url) || url.includes('SEU-PROJETO'))
    errors.push('VITE_SUPABASE_URL ausente/inválida para publicação.');
  if (!/^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.test(key) || key.includes('SUA_CHAVE'))
    errors.push('VITE_SUPABASE_PUBLISHABLE_KEY ausente/inválida. Nunca use sb_secret_ ou service_role.');
  if (!process.env.GITHUB_REPOSITORY || !process.env.GITHUB_REPOSITORY.includes('/'))
    errors.push('GITHUB_REPOSITORY não disponível; confirme a execução no GitHub Actions.');
  if (!existsSync(resolve(root,'package-lock.json')))
    errors.push('package-lock.json não existe. Rode npm.cmd install localmente e inclua o lockfile no Git.');
}
function privateFile(path) {
  const name = path.replaceAll('\\','/').toLowerCase();
  const parts = name.split('/');
  const leaf = parts.at(-1) ?? '';
  if (parts.some(s => ['node_modules','dist','backups','exports','private','credentials'].includes(s))) return true;
  if (leaf==='.env.example') return false;
  if (leaf==='.env' || leaf.startsWith('.env.') || leaf.endsWith('.crdownload')) return true;
  // Nomes de arquivos exportados, nunca modulos do codigo-fonte (ex.: src/lib/backup.ts).
  if (/^(mori-bonsai-backup|dados[-_]|dump[-_]|backup[-_])/.test(leaf)) return true;
  if (/^(dados|dump|backup)\.(json|sql|csv|bak|dump|tar|gz|sqlite|db)$/.test(leaf)) return true;
  if (/\.(zip|7z|rar|sqlite|db|pem|p12|pfx|key)$/.test(leaf)) return true;
  return false;
}
try {
  const tracked = new Set([
    ...execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\0'),
    ...execFileSync('git',['diff','--cached','--name-only','-z'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\0'),
  ].filter(Boolean));
  for(const path of tracked) if(privateFile(path)) errors.push(`Arquivo privado no Git: ${path}. Remova do índice (git rm --cached).`);
} catch {
  warnings.push('Sem repositório Git acessível; a verificação de arquivos rastreados fica pendente.');
}
console.log('MORI BONSAI — REVISÃO PRÉ-PUBLICAÇÃO');
for (const w of warnings) console.log('ATENÇÃO:',w);
for (const e of errors) console.error('ERRO:',e);
console.log(errors.length ? `Falhou: ${errors.length} pendência(s).` : 'Verificações automatizadas concluídas sem pendências.');
console.log('Ainda é necessário testar login, RLS, fotos, recuperação e backup manualmente.');
process.exit(errors.length ? 1 : 0);

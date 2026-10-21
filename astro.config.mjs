// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// `base` permite publicar sob um subpath sem reescrever o código-fonte.
// Em produção o domínio é o `www` (decisão do dono, 2026-10-20), então o
// padrão é '/'.
const base = process.env.SITE_BASE ?? '/';

export default defineConfig({
  site: 'https://www.galastriadvocacia.com.br',
  base,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [
    sitemap({
      // `/404.html` é um soft-404 e nunca pode estar no sitemap (QA-6).
      // O `/home/` já não é construído (é um 301 ✗) — a exclusão fica como
      // rede de segurança, para o caso de alguém recriar a página ✗.
      filter: (page) => !page.endsWith('/home/') && !page.endsWith('/404.html'),
    }),
  ],
});

// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// `base` permite publicar sob um subpath sem reescrever o código-fonte.
// Em produção o domínio é o apex, então o padrão é '/'.
const base = process.env.SITE_BASE ?? '/';

export default defineConfig({
  site: 'https://galastriadvocacia.com.br',
  base,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [
    sitemap({
      // `/home/` é o alias da home (canonical para `/`) e `/404.html` é um
      // soft-404: nenhum dos dois pode estar no sitemap (R4, QA-6).
      filter: (page) => !page.endsWith('/home/') && !page.endsWith('/404.html'),
    }),
  ],
});

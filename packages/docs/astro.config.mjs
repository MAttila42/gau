// @ts-check
import { fileURLToPath } from 'node:url'
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://gau.rettend.me',
  base: '/',
  vite: {
    resolve: {
      alias: {
        '~': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  },
  integrations: [
    starlight({
      title: 'gau',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/rttnd/gau' }],
      customCss: ['@fontsource/inter/400.css', '@fontsource/inter/600.css', './src/styles/custom.css'],
      components: {
        Header: './src/components/Header.astro',
      },
      sidebar: [
        {
          label: 'Guides',
          items: [
            { label: 'Getting Started', slug: 'guides/getting-started' },
            { label: 'Configuration', slug: 'guides/configuration' },
            { label: 'JWT', slug: 'guides/jwt' },
            { label: 'Deployment', slug: 'guides/deployment' },
          ],
        },
        {
          label: 'Integrations',
          autogenerate: { directory: 'integrations' },
        },
        {
          label: 'Database Adapters',
          autogenerate: { directory: 'adapters' },
        },
        {
          label: 'OAuth Providers',
          autogenerate: { directory: 'providers' },
        },
        {
          label: 'Reference',
          items: [
            { label: 'Core API', slug: 'reference/core-api' },
            { label: 'CLI', slug: 'reference/cli' },
          ],
        },
      ],
    }),
  ],
})

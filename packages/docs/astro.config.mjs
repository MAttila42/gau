// @ts-check
import { fileURLToPath } from 'node:url'
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://gau.yuo.app',
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
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/yuo-app/gau' }],
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
            { label: 'Frontend Clients', slug: 'guides/clients' },
            { label: 'JWT', slug: 'guides/jwt' },
            { label: 'Deployment', slug: 'guides/deployment' },
          ],
        },
        {
          label: 'Integrations',
          items: [
            { label: 'SvelteKit', slug: 'integrations/sveltekit' },
            { label: 'SolidStart', slug: 'integrations/solidstart', badge: 'Soon' },
            { label: 'Cloudflare Workers', slug: 'integrations/cloudflare-workers' },
            { label: 'Tauri', slug: 'integrations/tauri' },
          ],
        },
        {
          label: 'Database Adapters',
          items: [
            { label: 'Drizzle', slug: 'adapters/drizzle' },
            { label: 'Prisma', slug: 'adapters/prisma', badge: 'Soon' },
          ],
        },
        {
          label: 'OAuth Providers',
          items: [
            { label: 'GitHub', slug: 'providers/github' },
            { label: 'Google', slug: 'providers/google' },
            { label: 'Microsoft Entra ID', slug: 'providers/microsoft' },
          ],
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

// @ts-check
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import Icons from 'starlight-plugin-icons'
import UnoCSS from 'unocss/astro'

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
    UnoCSS(),
    Icons({
      sidebar: true,
      codeblock: true,
      extractSafelist: true,
      starlight: {
        title: 'gau',
        social: [
          { icon: 'github', label: 'GitHub', href: 'https://github.com/Rettend/gau' },
          { icon: 'discord', label: 'Discord', href: 'https://discord.gg/FvVaUPhj3t' },
        ],
        customCss: ['@fontsource/inter/400.css', '@fontsource/inter/600.css', './src/styles/custom.css'],
        components: {
          Header: './src/components/starlight/Header.astro',
        },
        tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 5 },
        sidebar: [
          {
            label: 'Guides',
            items: [
              { icon: 'i-ph:rocket-launch-duotone', label: 'Getting Started', slug: 'guides/getting-started' },
              { icon: 'i-ph:lego-duotone', label: 'Configuration', slug: 'guides/configuration' },
              { icon: 'i-ph:cookie-duotone', label: 'Session Management', slug: 'guides/session-management' },
              { icon: 'i-ph:plugs-connected-duotone', label: 'Account Linking', slug: 'guides/account-linking' },
              { icon: 'i-ph:user-check-duotone', label: 'Role-Based Access Control', slug: 'guides/role-based-access-control' },
              { icon: 'i-ph:key-duotone', label: 'JWT', slug: 'guides/jwt' },
              { icon: 'i-ph:shield-check-duotone', label: 'Security', slug: 'guides/security' },
            ],
          },
          {
            label: 'Framework Integrations',
            items: [
              { icon: 'i-ph:puzzle-piece-duotone', label: 'Integrations', slug: 'integrations' },
              { icon: 'i-material-icon-theme:svelte', label: 'SvelteKit', slug: 'integrations/sveltekit' },
              { icon: 'i-devicon:solidjs', label: 'SolidStart', slug: 'integrations/solidstart' },
            ],
          },
          {
            label: 'Database Adapters',
            items: [
              { icon: 'i-ph:database-duotone', label: 'Adapters', slug: 'adapters' },
              { icon: 'i-icons:drizzle', label: 'Drizzle', slug: 'adapters/drizzle' },
            ],
          },
          {
            label: 'Runtimes',
            items: [
              { icon: 'i-ph:cpu-duotone', label: 'Runtimes', slug: 'runtimes' },
              { icon: 'i-material-icon-theme:tauri', label: 'Tauri', slug: 'runtimes/tauri' },
            ],
          },
          {
            label: 'OAuth Providers',
            items: [
              { icon: 'i-ph:plugs-duotone', label: 'Providers', slug: 'providers' },
              { icon: 'i-simple-icons:github', label: 'GitHub', slug: 'providers/github' },
              { icon: 'i-logos:google-icon', label: 'Google', slug: 'providers/google' },
              { icon: 'i-logos:microsoft-icon', label: 'Microsoft', slug: 'providers/microsoft' },
            ],
          },
          {
            label: 'Reference',
            items: [
              { icon: 'i-ph:code-duotone', label: 'Core API', slug: 'reference/core-api' },
              { icon: 'i-ph:terminal-window-duotone', label: 'CLI', slug: 'reference/cli' },
            ],
          },
        ],
      },
    }),
  ],
})

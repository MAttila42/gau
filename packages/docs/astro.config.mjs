// @ts-check
import { fileURLToPath } from 'node:url'
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import UnoCSS from 'unocss/astro'

/**
 * @param {any[]} sidebar
 *
 * @returns {any[]} sidebar
 */
function addIcons(sidebar) {
  return sidebar.map((entry) => {
    if ('items' in entry)
      return { ...entry, items: addIcons(entry.items) }

    if ('autogenerate' in entry)
      return entry

    const icon = entry.attrs?.icon ?? entry.icon
    if (icon) {
      delete entry.icon
      if (!entry.attrs)
        entry.attrs = {}
      entry.attrs['data-icon'] = icon
    }

    return entry
  })
}

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
    starlight({
      title: 'gau',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Rettend/gau' }],
      customCss: ['@fontsource/inter/400.css', '@fontsource/inter/600.css', './src/styles/custom.css'],
      components: {
        Header: './src/components/starlight/Header.astro',
        Sidebar: './src/components/starlight/Sidebar.astro',
      },
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 5 },
      sidebar: addIcons([
        {
          label: 'Guides',
          items: [
            { label: 'Getting Started', slug: 'guides/getting-started', icon: 'i-ph:rocket-launch-duotone' },
            { label: 'Configuration', slug: 'guides/configuration', icon: 'i-ph:gear-duotone' },
            { label: 'Session Management', slug: 'guides/session-management', icon: 'i-ph:cookie-duotone' },
            { label: 'Account Linking', slug: 'guides/account-linking', icon: 'i-ph:plugs-connected-duotone' },
            { label: 'JWT', slug: 'guides/jwt', icon: 'i-ph:key-duotone' },
            { label: 'Security', slug: 'guides/security', icon: 'i-ph:shield-check-duotone' },
            { label: 'Deployment', slug: 'guides/deployment', icon: 'i-ph:globe-duotone' },
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
            { label: 'Core API', slug: 'reference/core-api', icon: 'i-ph:code-duotone' },
            { label: 'CLI', slug: 'reference/cli', icon: 'i-ph:terminal-window-duotone' },
          ],
        },
      ]),
    }),
  ],
})

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { glob } from 'glob'
import { getIconDetails } from '../src/lib/material-icons.mjs'

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../..')
const pattern = 'src/content/**/*.{md,mdx}'
const cacheDir = path.join(rootDir, '.material-icons-cache')
const safelistPath = path.join(cacheDir, 'material-icons-safelist.json')

const codeBlockRegex = /```(?<lang>[a-zA-Z]\w*)?(?:\s[^\n]*?title="(?<title>[^"]+)")?/g

async function generateSafelist() {
  const files = await glob(pattern, { cwd: rootDir, absolute: true })
  if (files.length === 0)
    console.warn(`No content files found for safelist generation (pattern: ${pattern})`)

  const usedIcons = new Set()

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8')
    const matches = content.matchAll(codeBlockRegex)

    for (const match of matches) {
      const { lang, title } = match.groups
      const iconDetails = await getIconDetails(title, lang)
      if (iconDetails?.iconClass)
        usedIcons.add(iconDetails.iconClass)
    }
  }

  await fs.mkdir(cacheDir, { recursive: true })
  await fs.writeFile(safelistPath, JSON.stringify([...usedIcons], null, 2), 'utf-8')

  // eslint-disable-next-line no-console
  console.log(`Generated icon safelist with ${usedIcons.size} icons.`)
}

generateSafelist()

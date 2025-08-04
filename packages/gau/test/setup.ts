import { getRandomValues, randomUUID } from 'node:crypto'
import { vi } from 'vitest'

Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: vi.fn(randomUUID),
    subtle: globalThis.crypto.subtle,
    getRandomValues: vi.fn(getRandomValues),
  },
  writable: true,
})

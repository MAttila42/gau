import type { LayoutLoad } from './$types'

export const ssr = false

export const load: LayoutLoad = async ({ fetch }) => {
  try {
    const res = await fetch('/api/auth/session')
    if (res.ok) {
      const session = await res.json()
      return { session }
    }
    return { session: null }
  }
  catch (error) {
    console.error('Failed to load session', error)
    return { session: null }
  }
}

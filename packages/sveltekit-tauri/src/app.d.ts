// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      getSession: () => Promise<{
        user: import('@rttnd/gau/core').User | null
        session: { [key: string]: unknown, id: string, sub: string } | null
      } | null>
    }
    // interface PageData {}
    // interface Platform {}
  }
}

export {}

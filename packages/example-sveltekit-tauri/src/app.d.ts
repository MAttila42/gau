import type { GauSession } from '@rttnd/gau'

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      getSession: () => Promise<GauSession>
    }
    // interface PageData {}
    // interface Platform {}
  }
}

export {}

import type { Session, User } from '@rttnd/gau'

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      getSession: () => Promise<{ user: User, session: Session } | null>
    }
    // interface PageData {}
    // interface Platform {}
  }
}

export {}

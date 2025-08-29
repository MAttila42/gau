import type { Account, Adapter, NewAccount, NewUser, User } from '../../core/index'

interface InternalAccountKey {
  provider: string
  providerAccountId: string
}

function accountKey(k: InternalAccountKey): string {
  return `${k.provider}:${k.providerAccountId}`
}

export function MemoryAdapter(): Adapter {
  const users = new Map<string, User>()
  const usersByEmail = new Map<string, string>() // email -> userId
  const accounts = new Map<string, string>() // accountKey -> userId

  return {
    async getUser(id) {
      return users.get(id) ?? null
    },

    async getUserByEmail(email) {
      const id = usersByEmail.get(email)
      if (!id)
        return null
      return users.get(id) ?? null
    },

    async getUserByAccount(provider, providerAccountId) {
      const id = accounts.get(accountKey({ provider, providerAccountId }))
      if (!id)
        return null
      return users.get(id) ?? null
    },

    async getAccounts(userId) {
      const userAccounts: Account[] = []
      for (const [key, accUserId] of accounts.entries()) {
        if (accUserId === userId) {
          const [provider, providerAccountId] = key.split(':') as [string, string]
          userAccounts.push({ userId, provider, providerAccountId })
        }
      }
      return userAccounts
    },

    async getUserAndAccounts(userId) {
      const user = await this.getUser(userId)
      if (!user)
        return null
      const accounts = await this.getAccounts(userId)
      return { user, accounts }
    },

    async createUser(data: NewUser) {
      const id = data.id ?? crypto.randomUUID()
      const user: User = {
        id,
        name: data.name ?? null,
        email: data.email ?? null,
        image: data.image ?? null,
        emailVerified: data.emailVerified ?? null,
        role: data.role ?? undefined,
      }
      users.set(id, user)
      if (user.email)
        usersByEmail.set(user.email, id)
      return user
    },

    async linkAccount(data: NewAccount) {
      accounts.set(accountKey(data), data.userId)
    },

    async unlinkAccount(provider, providerAccountId) {
      accounts.delete(accountKey({ provider, providerAccountId }))
    },

    async updateUser(partial) {
      const existing = users.get(partial.id)
      if (!existing)
        throw new Error('User not found')
      const updated: User = { ...existing, ...partial }
      users.set(updated.id, updated)
      if (updated.email)
        usersByEmail.set(updated.email, updated.id)
      return updated
    },
    async deleteUser(id) {
      const user = users.get(id)
      if (user?.email)
        usersByEmail.delete(user.email)
      users.delete(id)
      for (const [key, userId] of accounts.entries()) {
        if (userId === id)
          accounts.delete(key)
      }
    },
  }
}

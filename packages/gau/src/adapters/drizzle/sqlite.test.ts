import type { Adapter } from '../../core'
import Database from 'better-sqlite3'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SQLiteDrizzleAdapter } from './sqlite'
import { createClient } from '@libsql/client'
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql'
import { DrizzleAdapter } from './index'
import { transaction } from './transaction'

const usersTable = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').unique(),
  image: text('image'),
  emailVerified: integer('emailVerified', { mode: 'boolean' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
})

const accountsTable = sqliteTable('accounts', {
  userId: text('userId').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  type: text('type'),
})

describe('sQLiteDrizzleAdapter with better-sqlite3', () => {
  let db: ReturnType<typeof drizzle>
  let adapter: Adapter
  let client: Database.Database

  beforeEach(async () => {
    client = new Database(':memory:')
    db = drizzle(client)
    db.run(sql`
      CREATE TABLE "users" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text,
        "email" text,
        "image" text,
        "emailVerified" integer,
        "createdAt" integer NOT NULL,
        "updatedAt" integer NOT NULL
      );
    `)
    db.run(sql`
      CREATE TABLE "accounts" (
        "userId" text NOT NULL,
        "provider" text NOT NULL,
        "providerAccountId" text NOT NULL,
        "type" text,
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE cascade
      );
    `)

    adapter = SQLiteDrizzleAdapter(db, usersTable, accountsTable)
  })

  afterEach(async () => {
    db.run(sql`DROP TABLE IF EXISTS "accounts"`)
    db.run(sql`DROP TABLE IF EXISTS "users"`)
    client.close()
  })

  it('createUser: should create a new user with all fields', async () => {
    const user = await adapter.createUser({
      name: 'Test User',
      email: 'test@example.com',
      image: 'image.png',
      emailVerified: true,
    })
    expect(user.id).toBeDefined()
    expect(user.name).toBe('Test User')
    expect(user.email).toBe('test@example.com')
    expect(user.image).toBe('image.png')
    expect(user.emailVerified).toBe(true)
  })

  it('createUser: should create a user with only an email', async () => {
    const user = await adapter.createUser({ email: 'minimal@example.com' })
    expect(user.id).toBeDefined()
    expect(user.email).toBe('minimal@example.com')
    expect(user.name).toBeNull()
    expect(user.image).toBeNull()
    expect(user.emailVerified).toBeNull()
  })

  it('getUser: should retrieve a user by id', async () => {
    const createdUser = await adapter.createUser({ email: 'get@example.com' })
    const user = await adapter.getUser(createdUser.id)
    expect(user).toEqual(createdUser)
  })

  it('getUser: should return null for a non-existent user', async () => {
    const user = await adapter.getUser('non-existent-id')
    expect(user).toBeNull()
  })

  it('getUserByEmail: should retrieve a user by email', async () => {
    const createdUser = await adapter.createUser({ email: 'getbyemail@example.com' })
    const user = await adapter.getUserByEmail('getbyemail@example.com')
    expect(user).toEqual(createdUser)
  })

  it('getUserByEmail: should return null for a non-existent email', async () => {
    const user = await adapter.getUserByEmail('non-existent@example.com')
    expect(user).toBeNull()
  })

  it('getUserByAccount: should retrieve a user by account', async () => {
    const createdUser = await adapter.createUser({ email: 'getbyaccount@example.com' })
    await adapter.linkAccount({
      userId: createdUser.id,
      provider: 'test-provider',
      providerAccountId: 'test-provider-id',
    })
    const user = await adapter.getUserByAccount('test-provider', 'test-provider-id')
    expect(user).toEqual(createdUser)
  })

  it('getUserByAccount: should return null for a non-existent account', async () => {
    const user = await adapter.getUserByAccount('non-existent-provider', 'non-existent-id')
    expect(user).toBeNull()
  })

  it('updateUser: should update user fields', async () => {
    const createdUser = await adapter.createUser({ name: 'Original Name', email: 'update@example.com' })
    const updatedUser = await adapter.updateUser({
      id: createdUser.id,
      name: 'Updated Name',
      image: 'new-image.png',
      emailVerified: true,
    })
    expect(updatedUser.name).toBe('Updated Name')
    expect(updatedUser.image).toBe('new-image.png')
    expect(updatedUser.emailVerified).toBe(true)
    expect(updatedUser.email).toBe('update@example.com') // Should not change
  })

  it('linkAccount: should link an account to a user', async () => {
    const user = await adapter.createUser({ email: 'link@example.com' })
    await adapter.linkAccount({
      userId: user.id,
      provider: 'test-provider',
      providerAccountId: 'test-provider-id',
    })
    const retrievedUser = await adapter.getUserByAccount('test-provider', 'test-provider-id')
    expect(retrievedUser).toEqual(user)
  })

  it('deleteUser: should delete a user', async () => {
    const user = await adapter.createUser({ email: 'delete@example.com' })
    expect(await adapter.getUser(user.id)).not.toBeNull()
    await adapter.deleteUser(user.id)
    expect(await adapter.getUser(user.id)).toBeNull()
  })
})

describe('sQLiteDrizzleAdapter with libsql', () => {
  let db: ReturnType<typeof drizzleLibsql>
  let adapter: Adapter
  let client: ReturnType<typeof createClient>

  beforeEach(async () => {
    client = createClient({ url: ':memory:' })
    db = drizzleLibsql(client)
    await db.run(sql`
      CREATE TABLE "users" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text,
        "email" text,
        "image" text,
        "emailVerified" integer,
        "createdAt" integer NOT NULL,
        "updatedAt" integer NOT NULL
      );
    `)
    await db.run(sql`
      CREATE TABLE "accounts" (
        "userId" text NOT NULL,
        "provider" text NOT NULL,
        "providerAccountId" text NOT NULL,
        "type" text,
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE cascade
      );
    `)

    adapter = DrizzleAdapter(db, usersTable, accountsTable)
  })

  afterEach(async () => {
    await db.run(sql`DROP TABLE IF EXISTS "accounts"`)
    await db.run(sql`DROP TABLE IF EXISTS "users"`)
    client.close()
  })

  it('should create and retrieve a user', async () => {
    const user = await adapter.createUser({
      name: 'LibSQL User',
      email: 'libsql@example.com',
    })
    expect(user).toBeDefined()
    const fetchedUser = await adapter.getUser(user.id)
    expect(fetchedUser).toEqual(user)
  })
})

describe('transaction helper', () => {
  it('should commit a successful transaction with better-sqlite3', async () => {
    const client = new Database(':memory:')
    const db = drizzle(client)
    db.run(sql`CREATE TABLE "users" ("id" text, "name" text);`)

    await transaction(db, async (tx) => {
      await tx.run(sql`INSERT INTO "users" VALUES ('1', 'test')`)
    })

    const result = db.get<{ id: string, name: string }>(sql`SELECT * FROM "users"`)
    expect(result?.name).toBe('test')
    client.close()
  })

  it('should rollback a failed transaction with better-sqlite3', async () => {
    const client = new Database(':memory:')
    const db = drizzle(client)
    db.run(sql`CREATE TABLE "users" ("id" text, "name" text);`)

    await expect(transaction(db, async (tx) => {
      await tx.run(sql`INSERT INTO "users" VALUES ('1', 'test')`)
      throw new Error('Transaction failed')
    })).rejects.toThrow('Transaction failed')

    const result = db.get(sql`SELECT * FROM "users"`)
    expect(result).toBeUndefined()
    client.close()
  })

  it('should handle async transactions with libsql', async () => {
    const client = createClient({ url: ':memory:' })
    const db = drizzleLibsql(client)
    await db.run(sql`CREATE TABLE "users" ("id" text, "name" text);`)

    await transaction(db, async (tx) => {
      await tx.run(sql`INSERT INTO "users" VALUES ('1', 'test-async')`)
    })

    const result = await db.get<{ id: string, name: string }>(sql`SELECT * FROM "users"`)
    expect(result?.name).toBe('test-async')
    client.close()
  })
})

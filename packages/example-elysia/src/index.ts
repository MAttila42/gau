import { createHandler } from '@rttnd/gau/core'
import { Elysia, file } from 'elysia'
import { auth } from './auth'

const handler = createHandler(auth)

const app = new Elysia()
  .mount(handler)
  .get('/', () => file('./index.html'))
  .listen(3000)

// eslint-disable-next-line no-console
console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)

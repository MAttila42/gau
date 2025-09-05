import { createHandler } from '@rttnd/gau/core'
import { auth } from './auth'

const handler = createHandler(auth)

const server = Bun.serve({
  routes: {
    '/api/auth/*': req => handler(req),
    '/': new Response(await Bun.file('./index.html').bytes()),
  },
})

// eslint-disable-next-line no-console
console.log(`Server listening on ${server.url.hostname}:${server.url.port}`)

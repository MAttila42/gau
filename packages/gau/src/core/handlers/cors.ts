import type { RequestLike } from '../index'

export function applyCors(request: RequestLike, response: Response): Response {
  const origin = request.headers.get('Origin') || request.headers.get('origin')
  if (!origin)
    return response
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Vary', 'Origin')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  return response
}

export function handlePreflight(request: RequestLike): Response {
  const origin = request.headers.get('Origin') || request.headers.get('origin') || '*'
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  })
}

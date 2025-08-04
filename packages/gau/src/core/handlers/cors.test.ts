import { describe, expect, it } from 'vitest'
import { applyCors, handlePreflight } from './cors'

describe('cors handler', () => {
  describe('handlePreflight', () => {
    it('should return 204 with CORS headers', () => {
      const request = new Request('http://localhost/api/auth/mock', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:3000' },
      })

      const response = handlePreflight(request)

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization, Cookie')
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS')
    })

    it('should handle missing origin', () => {
      const request = new Request('http://localhost/api/auth/mock', {
        method: 'OPTIONS',
      })

      const response = handlePreflight(request)

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })
  })

  describe('applyCors', () => {
    it('should add CORS headers to response', () => {
      const request = new Request('http://localhost/api/auth/mock', {
        headers: { Origin: 'http://localhost:3000' },
      })
      const response = new Response('OK', { status: 200 })

      const corsResponse = applyCors(request, response)

      expect(corsResponse.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
      expect(corsResponse.headers.get('Vary')).toBe('Origin')
      expect(corsResponse.headers.get('Access-Control-Allow-Credentials')).toBe('true')
      expect(corsResponse.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization, Cookie')
      expect(corsResponse.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS')
    })

    it('should return response unchanged when no origin', () => {
      const request = new Request('http://localhost/api/auth/mock')
      const response = new Response('OK', { status: 200 })

      const corsResponse = applyCors(request, response)

      expect(corsResponse.headers.has('Access-Control-Allow-Origin')).toBe(false)
      expect(corsResponse.status).toBe(200)
    })
  })
})

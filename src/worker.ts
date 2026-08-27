import { generateLayout } from './api/generate-layout'

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  OPENROUTER_API_KEY?: string
  OPENROUTER_MODEL?: string
}

const notFound = () => new Response(JSON.stringify({ error: 'Not found.' }), { status: 404, headers: { 'content-type': 'application/json' } })
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://images.unsplash.com; media-src 'self'; connect-src 'self' https://openrouter.ai",
}

const withSecurityHeaders = (response: Response) => {
  const headers = new Headers(response.headers)
  Object.entries(securityHeaders).forEach(([name, value]) => headers.set(name, value))
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === '/api/generate-layout') return withSecurityHeaders(await generateLayout(request, env))
    if (pathname.startsWith('/api/')) return withSecurityHeaders(notFound())

    return withSecurityHeaders(await env.ASSETS.fetch(request))
  },
}

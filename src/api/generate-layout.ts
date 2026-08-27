type Env = { OPENROUTER_API_KEY?: string; OPENROUTER_MODEL?: string }

const approvedPhotos = [
  { id: 'coast-road', src: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=85', alt: 'A sunlit road through a green landscape' },
  { id: 'friends-sea', src: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=800&q=85', alt: 'Friends walking near the sea' },
  { id: 'cabin-woods', src: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=85', alt: 'A quiet cabin in the woods' },
  { id: 'mountain-light', src: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1000&q=85', alt: 'Golden light over a mountain valley' },
]
const approvedPhotoUrls = new Set(approvedPhotos.map(photo => photo.src))
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

function validLayout(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const root = value as Record<string, unknown>; const album = root.album as Record<string, unknown> | undefined; const pages = root.pages
  if (root.version !== 1 || !album || typeof album.title !== 'string' || !Array.isArray(pages) || pages.length < 1 || pages.length > 12) return false
  const elements = pages.flatMap(page => page && typeof page === 'object' && Array.isArray((page as Record<string, unknown>).elements) ? (page as Record<string, unknown>).elements : []) as Array<Record<string, unknown>>
  const images = elements.filter(element => element.type === 'image')
  if (!images.length || images.some(element => typeof element.src !== 'string' || !approvedPhotoUrls.has(element.src))) return false
  return pages.every(page => {
    if (!page || typeof page !== 'object') return false
    const item = page as Record<string, unknown>
    if (typeof item.background !== 'string' || !Array.isArray(item.elements) || item.elements.length > 30) return false
    return item.elements.every(element => { if (!element || typeof element !== 'object') return false; const entry = element as Record<string, unknown>; return ['image', 'text', 'shape'].includes(String(entry.type)) && ['x', 'y', 'width', 'height'].every(key => typeof entry[key] === 'number' && Number.isFinite(entry[key])) })
  })
}

export async function generateLayout(request: Request, env: Env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  if (!env.OPENROUTER_API_KEY) return json({ error: 'OpenRouter is not configured yet.' }, 503)
  try {
    const input = await request.json() as { prompt?: string; title?: string; pageCount?: number; style?: string }
    if (!input.prompt?.trim() || input.prompt.length > 1200) return json({ error: 'Tell the studio what this album should feel like in 1,200 characters or less.' }, 400)
    const pageCount = Math.min(Math.max(Number(input.pageCount) || 3, 1), 8)
    const photoCatalog = approvedPhotos.map(photo => `- ${photo.id}: ${photo.src} — ${photo.alt}`).join('\n')
    const system = `You are the layout director for Albumcrafter, a quiet editorial photo album studio. Return JSON only, matching this schema exactly: {"version":1,"album":{"title":"string","subtitle":"string","palette":["#hex"]},"pages":[{"id":"string","background":"#hex","elements":[{"id":"string","type":"image|text|shape","x":number,"y":number,"width":number,"height":number,"rotation":number,"zIndex":number,"src":"exact approved photo URL for image","photoId":"approved photo id for image","alt":"short image description","text":"string optional","style":{}}]}]}. Make ${pageCount} pages and include at least one image element. Use only an exact URL from this approved photo catalog; never invent or modify a photo URL:\n${photoCatalog}\nUse a restrained paper palette, short human copy, and coordinates from 0 to 100. Keep each page under 10 elements.`
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://albumcrafter.com', 'X-Title': 'Albumcrafter' }, body: JSON.stringify({ model: env.OPENROUTER_MODEL || 'google/gemini-2.5-flash', temperature: .7, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: `Album title: ${input.title || 'Untitled album'}\nMood and story: ${input.prompt}\nStyle: ${input.style || 'quiet-editorial'}` }] }) })
    if (!upstream.ok) return json({ error: 'The model is unavailable right now. Try again in a moment.' }, upstream.status === 429 ? 429 : 502)
    const data = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> }; const content = data.choices?.[0]?.message?.content
    if (!content) return json({ error: 'The model returned no draft.' }, 502)
    const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ''))
    if (!validLayout(parsed)) return json({ error: 'The model returned an invalid page draft.' }, 502)
    return json(parsed)
  } catch { return json({ error: 'The studio could not make that draft. Check your prompt and try again.' }, 500) }
}

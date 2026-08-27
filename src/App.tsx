import { useEffect, useRef, useState } from 'react'
import 'grapesjs/dist/css/grapes.min.css'
import videoUrl from '../Albumcrafter.mp4'
import DOMPurify from 'dompurify'
import { Icon } from './icons'
import { samplePages } from './content'
import { allowedPhotoUrls, photoLibrary } from './photo-library'
import type { AlbumAsset, AlbumPage, AlbumProject, GeneratedAlbum } from './types'

const projectKey = 'albumcrafter-project'
const safeHtml = (html: string) => DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, ADD_ATTR: ['target'] })
const makeProject = (): AlbumProject => ({ version: 1, title: 'A little further west', subtitle: 'a field book from the coast road', pages: samplePages.map((page, index) => ({ ...page, id: `page-${index + 1}` })), assets: photoLibrary, updatedAt: new Date().toISOString() })
const handoffName = import.meta.env.VITE_LLM_HANDOFF_NAME || 'ChatGPT'
const handoffBaseUrl = import.meta.env.VITE_LLM_HANDOFF_URL || 'https://chatgpt.com/?q='
type ToastKind = 'success' | 'error' | 'info'
type ToastState = { id: number; message: string; kind: ToastKind; duration: number }

function makeHandoffUrl(prompt: string) {
  try {
    const base = new URL(handoffBaseUrl)
    if (base.protocol === 'http:' || base.protocol === 'https:') return `${base.toString()}${encodeURIComponent(prompt)}`
  } catch { /* use the safe default below */ }
  return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`
}

function makeHandoffPrompt(project: AlbumProject, pageCount: number, idea: string) {
  const photoCatalog = photoLibrary.map(photo => `- ${photo.id}: ${photo.src} — ${photo.alt}`).join('\n')
  return `Create an editable Albumcrafter photo album draft for this idea: ${idea || project.subtitle || project.title}. Use the album title "${project.title}" and make ${pageCount} pages. Keep the voice personal, restrained, and specific. Include at least one image element so the book has real photographs. For images, copy an exact URL and matching id from this approved photo catalog only — never invent, modify, or omit the query string from a photo URL. Approved photo catalog:\n${photoCatalog}\nReturn ONLY one valid JSON object, with no markdown fences or explanation, matching this exact shape: {"version":1,"album":{"title":"string","subtitle":"string","palette":["#hex"]},"pages":[{"id":"string","background":"#hex","elements":[{"id":"string","type":"image|text|shape","x":number,"y":number,"width":number,"height":number,"rotation":number,"zIndex":number,"src":"exact catalog URL for image","photoId":"catalog id for image","alt":"short description for image","text":"string optional","style":{}}]}]}. Use coordinates from 0 to 100, make 1 to 8 pages, keep each page under 10 elements, use short human copy, and keep every image URL from the catalog. Albumcrafter will validate the JSON, save the referenced photographs with the project, and render it as editable HTML/CSS.`
}

function parseHandoff(value: string): GeneratedAlbum {
  const source = value.trim().replace(/^```(?:json)?\s*|\s*```$/gi, '')
  const start = source.indexOf('{'); const end = source.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('No JSON object was found in the response.')
  let parsed: GeneratedAlbum
  try { parsed = JSON.parse(source.slice(start, end + 1)) as GeneratedAlbum } catch { throw new Error(`That response is not valid JSON. Copy the complete ${handoffName} response and try again.`) }
  if (parsed.version !== 1 || !parsed.album?.title || !Array.isArray(parsed.pages) || parsed.pages.length < 1 || parsed.pages.length > 12) throw new Error('This response is not an Albumcrafter draft.')
  if (parsed.pages.some(page => !page.background || !Array.isArray(page.elements) || page.elements.length > 30 || page.elements.some(element => !['image', 'text', 'shape'].includes(element.type) || [element.x, element.y, element.width, element.height].some(value => !Number.isFinite(value))))) throw new Error('Some page elements are missing required layout values.')
  const imageElements = parsed.pages.flatMap(page => page.elements).filter(element => element.type === 'image')
  if (!imageElements.length) throw new Error(`No photographs were included. Ask ${handoffName} to add at least one image from the approved photo catalog.`)
  imageElements.forEach(element => {
    const photo = photoLibrary.find(item => [element.src, element.alt].some(value => typeof value === 'string' && value.includes(item.src)))
    if (!photo) return
    element.src = photo.src
    element.photoId = photo.id
    if (!element.alt || /https?:\/\/|%22|\]\(/i.test(element.alt)) element.alt = photo.alt
  })
  if (imageElements.some(element => typeof element.src !== 'string' || !allowedPhotoUrls.has(element.src))) throw new Error(`A photograph URL could not be verified. Ask ${handoffName} to use only the exact URLs from the approved photo catalog.`)
  return parsed
}

function layoutToPages(result: GeneratedAlbum): AlbumPage[] {
  return result.pages.map((page, index) => ({ id: `ai-${Date.now()}-${index}`, label: `draft ${index + 1}`, background: page.background || '#ede9df', html: safeHtml(`<div class="album-page ai-page"><p class="eyebrow">${result.album.title}</p>${page.elements.map(element => { const photo = element.type === 'image' && element.src && allowedPhotoUrls.has(element.src) ? photoLibrary.find(item => item.src === element.src) : undefined; return element.type === 'text' ? `<p class="ai-copy">${element.text || ''}</p>` : photo ? `<img class="ai-image" src="${photo.src}" alt="${element.alt || photo.alt}" />` : '<div class="ai-shape"></div>' }).join('')}</div>`), css: `.album-page{min-height:100%;padding:48px;position:relative;background:${page.background || '#ede9df'};color:#1f2823}.eyebrow{font:600 10px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase}.ai-copy{font:38px/1 Georgia,serif;max-width:260px}.ai-image{width:100%;height:260px;object-fit:cover;margin-top:30px}.ai-shape{height:1px;background:#1f2823;margin:30px 0}` }))
}

function assetsForAlbum(result: GeneratedAlbum): AlbumAsset[] {
  const assets = new Map<string, AlbumAsset>()
  result.pages.flatMap(page => page.elements).forEach(element => {
    if (element.type !== 'image' || !element.src || !allowedPhotoUrls.has(element.src)) return
    const photo = photoLibrary.find(item => item.src === element.src)
    if (photo) assets.set(photo.id, { ...photo, alt: element.alt || photo.alt })
  })
  return [...assets.values()]
}

function makeExportNode(page: AlbumPage) {
  const node = document.createElement('div'); node.className = 'export-page-canvas'; node.style.background = page.background; node.style.left = '0'; node.style.zIndex = '-1'
  const style = document.createElement('style'); style.textContent = page.css; node.append(style)
  const content = document.createElement('div'); content.innerHTML = safeHtml(page.html); node.append(content)
  node.querySelectorAll('img').forEach(image => { image.crossOrigin = 'anonymous' })
  document.body.append(node); return node
}

function downloadFile(url: string, name: string) {
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url)
}

export default function App() {
  const [route, setRoute] = useState(window.location.pathname === '/craft' ? 'craft' : 'home')
  useEffect(() => { const onPop = () => setRoute(window.location.pathname === '/craft' ? 'craft' : 'home'); window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop) }, [])
  const goCraft = () => { window.history.pushState({}, '', '/craft'); setRoute('craft'); window.scrollTo(0, 0) }
  return route === 'craft' ? <Craft onHome={() => { window.history.pushState({}, '', '/'); setRoute('home') }} /> : <Landing onCraft={goCraft} />
}

function Landing({ onCraft }: { onCraft: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    const video = document.querySelector<HTMLVideoElement>('.hero-video')
    if (!video) return
    video.loop = false
    let restartTimer: number | undefined
    let revealTimer: number | undefined
    const restartSmoothly = () => {
      video.classList.add('hero-video-fading')
      restartTimer = window.setTimeout(() => {
        video.currentTime = 0
        void video.play()
        revealTimer = window.setTimeout(() => video.classList.remove('hero-video-fading'), 40)
      }, 420)
    }
    video.addEventListener('ended', restartSmoothly)
    return () => { video.removeEventListener('ended', restartSmoothly); window.clearTimeout(restartTimer); window.clearTimeout(revealTimer) }
  }, [])
  return <div className="site-shell">
    <header className="site-header"><button className="wordmark" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Albumcrafter home"><span className="wordmark-mark">A</span> albumcrafter</button><nav className={`site-nav ${menuOpen ? 'open' : ''}`} aria-label="Main navigation"><a href="#method" onClick={() => setMenuOpen(false)}>The method</a><a href="#why" onClick={() => setMenuOpen(false)}>Why it matters</a><button className="text-button" onClick={() => { setMenuOpen(false); onCraft() }}>Open the studio <Icon name="arrow" /></button></nav><button className="icon-button mobile-menu" onClick={() => setMenuOpen(open => !open)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen}><Icon name="menu" /></button></header>
    <main id="main">
      <section className="hero"><video className="hero-video" autoPlay muted loop playsInline aria-hidden="true"><source src={videoUrl} type="video/mp4" /></video><div className="hero-wash" /><div className="hero-content"><p className="kicker">A new kind of photo album</p><h1>Make the good<br /><em>stuff</em> tangible.</h1><p className="hero-copy">Albumcrafter helps you turn a handful of photographs and a feeling into a considered little world — ready to keep, share, or print.</p><button className="button button-light" onClick={onCraft}>Start with your photographs <Icon name="arrow" /></button></div><div className="hero-footer"><span>For the places you still talk about</span><span>Scroll to explore <span className="scroll-line" /></span></div></section>
      <section className="manifesto" id="why"><div className="section-index">01 / the idea</div><div className="manifesto-copy"><p className="section-lead">Not another folder full of almost-forgotten images. A personal artifact made from the way the day actually felt.</p><p>Choose the photographs that bring it back. Tell us what to notice. Then shape the result until it sounds like you.</p></div><div className="manifesto-note">A quieter way to remember<br /><span>with a little help from AI</span></div></section>
      <section className="method" id="method"><div className="section-heading"><div className="section-index">02 / the method</div><h2>From lived<br /><em>to held.</em></h2><p>Three small decisions are enough to begin. The rest is yours.</p></div><div className="method-list"><article><span className="method-number">01</span><div><h3>Bring the evidence</h3><p>Upload the photographs that carry the feeling — the blurry ones count too.</p></div></article><article><span className="method-number">02</span><div><h3>Name the thread</h3><p>Describe the trip, the people, or the detail you cannot stop thinking about.</p></div></article><article><span className="method-number">03</span><div><h3>Make it yours</h3><p>Start from a suggested arrangement, then move, rewrite, and refine every page.</p></div></article></div></section>
      <section className="studio-invite"><div className="invite-card"><div><p className="kicker">The studio is open</p><h2>Begin with<br /><em>one good image.</em></h2></div><div className="invite-side"><p>No account. No blank canvas anxiety. Just a place to start making.</p><button className="button button-dark" onClick={onCraft}>Open the editor <Icon name="arrow" /></button></div></div></section>
    </main>
    <footer className="site-footer"><span>© {new Date().getFullYear()} Albumcrafter</span><span>Made for the moments in between</span><span><a href="mailto:hello@albumcrafter.example">Say hello</a></span></footer>
  </div>
}

function Craft({ onHome }: { onHome: () => void }) {
  const [project, setProject] = useState<AlbumProject>(() => { try { const saved = JSON.parse(localStorage.getItem(projectKey) || '') as AlbumProject; return saved.version === 1 && saved.pages?.length ? { ...saved, assets: Array.isArray(saved.assets) ? saved.assets : photoLibrary } : makeProject() } catch { return makeProject() } })
  const [activeId, setActiveId] = useState(project.pages[0].id)
  const [preview, setPreview] = useState(false); const [exportOpen, setExportOpen] = useState(false); const [exporting, setExporting] = useState(false); const [aiOpen, setAiOpen] = useState(false); const [handoffOpen, setHandoffOpen] = useState(false); const [handoffResponse, setHandoffResponse] = useState(''); const [handoffError, setHandoffError] = useState(''); const [prompt, setPrompt] = useState('A slow weekend by the sea with old friends, salt in the air, and nowhere to be.'); const [aiState, setAiState] = useState<'idle' | 'loading' | 'error' | 'success'>('idle'); const [notice, setNotice] = useState(''); const [toast, setToast] = useState<ToastState | null>(null); const toastTimer = useRef<number | undefined>(undefined)
  const activePage = project.pages.find(page => page.id === activeId) || project.pages[0]
  const updatePage = (changes: Partial<AlbumPage>, newAssets: AlbumAsset[] = []) => setProject(current => ({ ...current, assets: newAssets.length ? [...current.assets, ...newAssets.filter(asset => !current.assets.some(existing => existing.id === asset.id))] : current.assets, pages: current.pages.map(page => page.id === activeId ? { ...page, ...changes } : page), updatedAt: new Date().toISOString() }))
  const flash = (message: string, kind: ToastKind = 'success') => { setNotice(message); window.setTimeout(() => setNotice(''), 2600); const id = Date.now(); const duration = kind === 'error' ? 6500 : 4200; window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(null), duration); setToast({ id, message, kind, duration }) }
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])
  const save = () => { localStorage.setItem(projectKey, JSON.stringify(project)); flash('Saved on this device') }
  const addPage = () => { const page = { ...project.pages[project.pages.length - 1], id: `page-${Date.now()}`, label: 'new page' }; setProject(current => ({ ...current, pages: [...current.pages, page] })); setActiveId(page.id) }
  const deletePage = () => { if (project.pages.length === 1) return; setProject(current => ({ ...current, pages: current.pages.filter(page => page.id !== activeId) })); setActiveId(project.pages.find(page => page.id !== activeId)?.id || project.pages[0].id) }
  const addPhoto = (file?: File) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { flash('Use a JPG, PNG, or WebP image'); return }
    if (file.size > 4 * 1024 * 1024) { flash('Keep photographs under 4 MB for this local draft'); return }
    const reader = new FileReader()
    reader.onload = () => { const src = String(reader.result); const asset = { id: `upload-${Date.now()}`, src, alt: file.name.replace(/\.[^.]+$/, '') || 'Uploaded album photograph' }; updatePage({ html: safeHtml(activePage.html.replace('</div>', `<img class="user-photo" src="${src}" alt="${asset.alt}" /></div>`)), css: `${activePage.css}.user-photo{display:block;height:170px;margin:24px auto 0;max-width:100%;object-fit:cover;transform:rotate(-1deg)}` }, [asset]); flash('Photograph added to this page') }
    reader.readAsDataURL(file)
  }
  const exportProject = async (format: 'json' | 'png' | 'pdf') => {
    setExportOpen(false)
    if (format === 'json') { const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }); downloadFile(URL.createObjectURL(blob), `${project.title.toLowerCase().replace(/\s+/g, '-')}.json`); flash('Project JSON downloaded'); return }
    setExporting(true)
    try {
      const { toPng } = await import('html-to-image')
      const renderPage = async (page: AlbumPage) => {
        const node = makeExportNode(page)
        try {
          await document.fonts.ready
          await Promise.all([...node.querySelectorAll('img')].map(image => image.complete ? Promise.resolve() : new Promise<void>(resolve => { image.addEventListener('load', () => resolve(), { once: true }); image.addEventListener('error', () => resolve(), { once: true }) })))
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
          return await toPng(node, { pixelRatio: 2, cacheBust: true })
        } finally { node.remove() }
      }
      if (format === 'png') { const url = await renderPage(activePage); downloadFile(url, `${activePage.label.replace(/\s+/g, '-').toLowerCase()}.png`); flash('Current page exported as PNG'); return }
      const { jsPDF } = await import('jspdf'); const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [148, 214] })
      for (const [index, page] of project.pages.entries()) { const url = await renderPage(page); if (index > 0) pdf.addPage([148, 214], 'portrait'); pdf.addImage(url, 'PNG', 0, 0, 148, 214) }
      pdf.save(`${project.title.toLowerCase().replace(/\s+/g, '-')}.pdf`); flash('Album PDF downloaded')
    } catch { flash(`Could not export ${format.toUpperCase()}. Try again after the page finishes loading.`, 'error') } finally { setExporting(false) }
  }
  const handoffPrompt = makeHandoffPrompt(project, project.pages.length, prompt)
  const handoffUrl = makeHandoffUrl(handoffPrompt)
  const openHandoff = () => { setHandoffError(''); navigator.clipboard?.writeText(handoffPrompt).catch(() => undefined); const opened = window.open(handoffUrl, '_blank', 'noopener,noreferrer'); if (!opened) { const message = `Your browser blocked the ${handoffName} tab. Use the link below, then paste the response here.`; setHandoffError(message); flash(message, 'error') } }
  const importHandoff = () => { try { if (handoffResponse.length > 250000) throw new Error('That response is too large for a browser draft. Ask ChatGPT for a shorter album.') ; const result = parseHandoff(handoffResponse); const pages = layoutToPages(result); const importedAssets = assetsForAlbum(result); setProject(current => ({ ...current, title: result.album.title || current.title, subtitle: result.album.subtitle || current.subtitle, assets: [...current.assets, ...importedAssets.filter(asset => !current.assets.some(existing => existing.id === asset.id))], pages, updatedAt: new Date().toISOString() })); setActiveId(pages[0].id); setHandoffOpen(false); setHandoffResponse(''); setHandoffError(''); flash(`Imported ${importedAssets.length} verified photograph${importedAssets.length === 1 ? '' : 's'} from ${handoffName}`) } catch (error) { const message = error instanceof Error ? error.message : `Paste the JSON response from ${handoffName}.`; setHandoffError(message); flash(message, 'error') } }
  const generate = async () => {
    setAiState('loading')
    try {
      const response = await fetch('/api/generate-layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, title: project.title, pageCount: project.pages.length, style: 'quiet-editorial', photos: [] }) })
      if (!response.ok) throw new Error((await response.json()).error || 'The studio could not reach the model.')
      const result = await response.json() as GeneratedAlbum
      if (!result.pages?.length) throw new Error('The model returned an empty album.')
      const generatedPages = layoutToPages(result)
      const generatedAssets = assetsForAlbum(result)
      setProject(current => ({ ...current, title: result.album.title || current.title, subtitle: result.album.subtitle || current.subtitle, assets: [...current.assets, ...generatedAssets.filter(asset => !current.assets.some(existing => existing.id === asset.id))], pages: generatedPages, updatedAt: new Date().toISOString() })); setActiveId(generatedPages[0].id); setAiState('success'); setAiOpen(false); flash('A new draft is ready to edit')
    } catch (error) { const message = error instanceof Error ? error.message : 'Something went wrong while making the draft.'; setAiState('error'); flash(message, 'error') }
  }
  return <div className="craft-shell"><header className="craft-header"><button className="wordmark" onClick={onHome}><span className="wordmark-mark">A</span> albumcrafter</button><div className="craft-title"><span>untitled album</span><strong>{project.title}</strong></div><div className="craft-actions"><button className="quiet-button mobile-handoff" onClick={() => setHandoffOpen(true)}>AI</button><button className="quiet-button" onClick={save}><Icon name="save" /> <span>Save</span></button><div className="export-wrap"><button className="quiet-button" onClick={() => setExportOpen(open => !open)} aria-expanded={exportOpen} aria-haspopup="menu" disabled={exporting}><Icon name="download" /> <span>{exporting ? 'Exporting…' : 'Export'}</span></button>{exportOpen && <div className="export-menu" role="menu"><button role="menuitem" onClick={() => exportProject('png')}>Current page · PNG</button><button role="menuitem" onClick={() => exportProject('pdf')}>Whole album · PDF</button><button role="menuitem" onClick={() => exportProject('json')}>Project · JSON</button></div>}</div><button className="button button-dark compact" onClick={() => setPreview(true)}>Preview <Icon name="arrow" /></button></div></header>
    <main className="craft-main"><aside className="page-rail"><div className="rail-top"><span>Pages</span><button className="icon-button" onClick={addPage} aria-label="Add page"><Icon name="plus" /></button></div><div className="thumbnail-list">{project.pages.map((page, index) => <button className={`thumbnail ${page.id === activeId ? 'selected' : ''}`} key={page.id} onClick={() => setActiveId(page.id)}><span className="thumbnail-page" style={{ background: page.background }} dangerouslySetInnerHTML={{ __html: safeHtml(page.html) }} /><span>{String(index + 1).padStart(2, '0')} · {page.label}</span></button>)}</div><button className="rail-delete" onClick={deletePage} disabled={project.pages.length === 1}><Icon name="trash" /> Delete page</button></aside><section className="workspace"><div className="workspace-bar"><span>Editing / {activePage.label}</span><span className="saved-state" aria-live="polite">{notice || 'Local draft'}</span></div><GrapesCanvas page={activePage} onChange={changes => updatePage(changes)} /></section><aside className="tool-panel"><button className="ai-trigger" onClick={() => setAiOpen(true)}><span className="spark-icon"><Icon name="spark" /></span><span><strong>Ask the studio</strong><small>Build a first draft from a feeling</small></span><Icon name="arrow" /></button><button className="handoff-trigger" onClick={() => setHandoffOpen(true)}><span><strong>Use {handoffName}</strong><small>Make a draft in your own chat</small></span><Icon name="arrow" /></button><div className="panel-section"><span className="panel-label">Add to page</span><label className="upload-control"> <Icon name="image" /> Add photograph<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { addPhoto(event.target.files?.[0]); event.currentTarget.value = '' }} /></label></div><div className="panel-section"><span className="panel-label">Page details</span><label>Page name<input value={activePage.label} onChange={event => updatePage({ label: event.target.value })} /></label><label>Paper tone<input type="color" value={activePage.background} onChange={event => updatePage({ background: event.target.value })} /></label></div><div className="panel-section panel-help"><span className="panel-label">A few shortcuts</span><p>Select text to edit it directly. Select an image to move or replace it. The editor saves your work only when you choose Save.</p></div></aside></main>
    {aiOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setAiOpen(false)}><section className="ai-modal" role="dialog" aria-modal="true" aria-labelledby="ai-title"><button className="modal-close" onClick={() => setAiOpen(false)} aria-label="Close"><Icon name="close" /></button><p className="kicker">The studio assistant</p><h2 id="ai-title">Give the album<br /><em>a point of view.</em></h2><label htmlFor="album-prompt">What should this collection feel like?</label><textarea id="album-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} rows={4} /><div className="modal-actions"><button className="button button-paper" onClick={() => setAiOpen(false)}>Not yet</button><button className="button button-paper" onClick={() => { setAiOpen(false); setHandoffOpen(true); openHandoff() }}>Copy & open {handoffName} <Icon name="arrow" /></button><button className="button button-dark" disabled={aiState === 'loading' || !prompt.trim()} onClick={generate}>{aiState === 'loading' ? 'Making a draft…' : 'Make a draft'} <Icon name="spark" /></button></div></section></div>}
    {handoffOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setHandoffOpen(false)}><section className="ai-modal handoff-modal" role="dialog" aria-modal="true" aria-labelledby="handoff-title"><button className="modal-close" onClick={() => setHandoffOpen(false)} aria-label="Close"><Icon name="close" /></button><p className="kicker">Bring your own chat</p><h2 id="handoff-title">Make it in<br /><em>{handoffName}.</em></h2><p className="handoff-note">We’ll copy a ready-made Albumcrafter prompt, open {handoffName} in a new tab, then you can paste its JSON response below.</p><div className="handoff-actions"><button className="button button-dark" onClick={openHandoff}>Copy & open {handoffName} <Icon name="arrow" /></button><a className="button button-paper" href={handoffUrl} target="_blank" rel="noopener noreferrer">Open link</a></div><label htmlFor="handoff-response">Paste the JSON response here</label><textarea id="handoff-response" className="handoff-textarea" value={handoffResponse} onChange={event => { setHandoffResponse(event.target.value); setHandoffError('') }} rows={7} placeholder="{ &quot;version&quot;: 1, &quot;album&quot;: ..." /><div className="modal-actions"><button className="button button-dark" disabled={!handoffResponse.trim()} onClick={importHandoff}>Import draft <Icon name="download" /></button></div></section></div>}
    {preview && <Preview pages={project.pages} onClose={() => setPreview(false)} />}
    {toast && <Toast toast={toast} onCancel={() => { window.clearTimeout(toastTimer.current); setToast(null) }} />}
  </div>
}

function Toast({ toast, onCancel }: { toast: ToastState; onCancel: () => void }) {
  return <div className={`toast toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}><span>{toast.message}</span><button onClick={onCancel}>Cancel</button><i className="toast-progress" style={{ animationDuration: `${toast.duration}ms` }} /></div>
}

function GrapesCanvas({ page, onChange }: { page: AlbumPage; onChange: (changes: Partial<AlbumPage>) => void }) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!container.current) return
    let disposed = false
    let instance: { destroy: () => void } | null = null
    import('grapesjs').then(({ default: grapesjs }) => {
      if (disposed || !container.current) return
      const editor = grapesjs.init({ container: container.current, height: '100%', width: 'auto', fromElement: false, storageManager: false, panels: { defaults: [] }, selectorManager: { componentFirst: true }, blockManager: { blocks: [] }, components: safeHtml(page.html), style: page.css })
      const sync = () => onChange({ html: editor.getHtml(), css: editor.getCss() })
      editor.on('component:update', sync)
      instance = editor
    })
    return () => { disposed = true; instance?.destroy() }
  }, [page.id])
  return <div className="grapes-wrap"><div ref={container} /></div>
}

function Preview({ pages, onClose }: { pages: AlbumPage[]; onClose: () => void }) {
  const [index, setIndex] = useState(0); const [zoom, setZoom] = useState(.88); const [direction, setDirection] = useState<'next' | 'prev'>('next'); const page = pages[index]
  const goToPage = (nextIndex: number) => { if (nextIndex === index) return; setDirection(nextIndex > index ? 'next' : 'prev'); setIndex(nextIndex) }
  return <div className="preview-backdrop"><header className="preview-header"><button className="wordmark" onClick={onClose}><span className="wordmark-mark">A</span> albumcrafter</button><span>Preview / {String(index + 1).padStart(2, '0')} of {String(pages.length).padStart(2, '0')}</span><div className="preview-header-actions"><div className="zoom-controls" aria-label="Preview zoom"><button onClick={() => setZoom(current => Math.max(.55, Number((current - .1).toFixed(2))))} disabled={zoom <= .55} aria-label="Zoom out"><Icon name="minus" /></button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(current => Math.min(1.25, Number((current + .1).toFixed(2))))} disabled={zoom >= 1.25} aria-label="Zoom in"><Icon name="plus" /></button></div><button className="icon-button" onClick={onClose} aria-label="Close preview"><Icon name="close" /></button></div></header><main className="preview-main"><button className="preview-arrow prev" onClick={() => goToPage(Math.max(0, index - 1))} disabled={index === 0} aria-label="Previous page"><Icon name="arrow" /></button><div className="preview-page-shell" style={{ transform: `scale(${zoom})` }}><div key={page.id} className={`preview-page preview-page-${direction}`} style={{ background: page.background }}><style>{page.css}</style><div dangerouslySetInnerHTML={{ __html: safeHtml(page.html) }} /></div></div><button className="preview-arrow" onClick={() => goToPage(Math.min(pages.length - 1, index + 1))} disabled={index === pages.length - 1} aria-label="Next page"><Icon name="arrow" /></button></main><footer className="preview-footer"><span>{page.label}</span><div className="preview-dots">{pages.map((item, itemIndex) => <button key={item.id} className={itemIndex === index ? 'current' : ''} onClick={() => goToPage(itemIndex)} aria-label={`Go to page ${itemIndex + 1}`} />)}</div><span>{index === pages.length - 1 ? 'the end' : 'turn the page'}</span></footer></div>
}

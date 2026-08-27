export type ElementType = 'image' | 'text' | 'shape'
export type PageElement = { id: string; type: ElementType; x: number; y: number; width: number; height: number; rotation?: number; zIndex?: number; src?: string; photoId?: string; alt?: string; text?: string; style?: Record<string, string | number> }
export type GeneratedPage = { id: string; background: string; elements: PageElement[] }
export type GeneratedAlbum = { version: 1; album: { title: string; subtitle?: string; palette: string[] }; pages: GeneratedPage[] }
export type AlbumAsset = { id: string; src: string; alt: string }
export type AlbumPage = { id: string; label: string; background: string; html: string; css: string }
export type AlbumProject = { version: 1; title: string; subtitle: string; pages: AlbumPage[]; assets: AlbumAsset[]; updatedAt: string }

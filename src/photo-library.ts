import type { AlbumAsset } from './types'

export const photoLibrary: AlbumAsset[] = [
  { id: 'coast-road', src: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=85', alt: 'A sunlit road through a green landscape' },
  { id: 'friends-sea', src: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=800&q=85', alt: 'Friends walking near the sea' },
  { id: 'cabin-woods', src: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=85', alt: 'A quiet cabin in the woods' },
  { id: 'mountain-light', src: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1000&q=85', alt: 'Golden light over a mountain valley' },
]

export const allowedPhotoUrls = new Set(photoLibrary.map(photo => photo.src))

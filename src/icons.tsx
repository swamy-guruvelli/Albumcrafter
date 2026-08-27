import type { ReactNode } from 'react'
type IconProps = { name: 'arrow' | 'plus' | 'minus' | 'close' | 'spark' | 'download' | 'save' | 'menu' | 'trash' | 'image'; size?: number }
export function Icon({ name, size = 16 }: IconProps) {
  const paths: Record<IconProps['name'], ReactNode> = {
    arrow: <><path d="M3 8h11"/><path d="m10 4 4 4-4 4"/></>, plus: <><path d="M8 3v10M3 8h10"/></>, minus: <path d="M3 8h10"/>, close: <><path d="m4 4 8 8M12 4l-8 8"/></>, spark: <><path d="m8 2 1.3 4.7L14 8l-4.7 1.3L8 14l-1.3-4.7L2 8l4.7-1.3L8 2Z"/></>, download: <><path d="M8 2v8M5 7l3 3 3-3M3 13h10"/></>, save: <><path d="M3 3h9l1 1v9H3zM5 3v4h5V3M5 13v-3h6v3"/></>, menu: <><path d="M2 4h12M2 8h12M2 12h12"/></>, trash: <><path d="M3 4h10M6 4V2h4v2M4 4l.6 10h6.8L12 4M7 7v4M9 7v4"/></>, image: <><rect x="2" y="3" width="12" height="10" rx="1"/><circle cx="5" cy="6" r="1"/><path d="m3 11 3-3 2 2 2-2 3 3"/></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

/// <reference types="vite/client" />

declare module '*.mp4' {
  const src: string
  export default src
}

interface ImportMetaEnv {
  readonly VITE_LLM_HANDOFF_URL?: string
  readonly VITE_LLM_HANDOFF_NAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

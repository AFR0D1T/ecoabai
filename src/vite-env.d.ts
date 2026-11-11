/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Адрес API, если он на другом домене (по умолчанию /api). */
  readonly VITE_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

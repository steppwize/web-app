/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Public OAuth client ID for Drive backup/restore (src/backup/googleAuth.ts). Not a secret — it
  // identifies the app to Google, it doesn't authorize anything by itself. Optional: when unset,
  // the Drive section of BackupPage stays hidden.
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

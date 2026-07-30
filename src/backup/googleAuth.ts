// Browser-only OAuth via Google Identity Services' token model — no backend, no client secret.
// There is no refresh token in this flow: the access token lives in memory for this tab only and
// is re-requested (via a user-gesture-triggered popup) once it's within a minute of expiring.
// https://developers.google.com/identity/oauth2/web/guides/use-token-model
const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export const isDriveConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)

let gisLoadPromise: Promise<void> | null = null

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  gisLoadPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Não foi possível contatar o Google. Verifique sua conexão.'))
    document.head.appendChild(script)
  })
  return gisLoadPromise
}

function mapTokenError(type: string | undefined): string {
  switch (type) {
    case 'popup_closed':
    case 'popup_failed_to_open':
      return 'Janela de login do Google fechada antes de concluir. Tente novamente.'
    case 'access_denied':
      return 'Acesso ao Google Drive não foi autorizado.'
    default:
      return 'Não foi possível conectar ao Google Drive.'
  }
}

let cachedToken: { token: string; expiresAt: number } | null = null
let tokenClient: GoogleTokenClient | null = null
// A single tokenClient is reused across calls (GIS caches the popup channel), but its `callback`
// closure is fixed at construction time. `currentRequest` lets that one callback resolve whichever
// getAccessToken() call is currently in flight, instead of only ever resolving the first one.
let currentRequest: { resolve: (token: string) => void; reject: (error: Error) => void } | null = null

// True once the user has completed the popup consent flow at least once in this browser profile.
// Used to pass `prompt: ''` on subsequent requests, which skips the consent screen when Google still
// recognizes a valid grant — the request then only shows UI if the grant was actually revoked.
let hasGrantedBefore = false

function requestToken(promptOverride?: string): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) {
    return Promise.reject(new Error('Integração com o Google Drive não está configurada.'))
  }
  return new Promise((resolve, reject) => {
    tokenClient ??= window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      callback: (response) => {
        const req = currentRequest
        currentRequest = null
        if (response.error) {
          req?.reject(new Error(mapTokenError(response.error)))
          return
        }
        hasGrantedBefore = true
        cachedToken = { token: response.access_token, expiresAt: Date.now() + response.expires_in * 1000 }
        req?.resolve(response.access_token)
      },
      error_callback: (error) => {
        const req = currentRequest
        currentRequest = null
        req?.reject(new Error(mapTokenError(error.type)))
      },
    })
    currentRequest = { resolve, reject }
    tokenClient.requestAccessToken(promptOverride === undefined ? undefined : { prompt: promptOverride })
  })
}

export function hasValidToken(): boolean {
  return cachedToken !== null && cachedToken.expiresAt - Date.now() > 60_000
}

export function tokenExpiresInMs(): number | null {
  return cachedToken ? cachedToken.expiresAt - Date.now() : null
}

// Returns the cached token if still valid, otherwise null — never opens a popup. For background
// paths (autosave debounce, polling) that must not surprise the user with a Google window.
export function getAccessTokenSilent(): string | null {
  return hasValidToken() ? cachedToken!.token : null
}

export async function getAccessToken(): Promise<string> {
  if (hasValidToken()) {
    return cachedToken!.token
  }
  await loadGis()
  return requestToken(hasGrantedBefore ? '' : undefined)
}

// Meant to be called from inside a genuine user gesture handler (e.g. a capture-phase pointerdown
// listener) so the popup isn't blocked. Passes prompt: '' when a grant already exists in this
// profile, which normally lets GIS reissue a token without showing any UI at all.
export async function renewTokenFromGesture(): Promise<string | null> {
  if (hasValidToken() || !hasGrantedBefore) return null
  try {
    await loadGis()
    return await requestToken('')
  } catch {
    return null
  }
}

export function clearCachedToken(): void {
  cachedToken = null
}

// hasGrantedBefore only lives in memory (reset on reload) unless a caller hydrates it from a
// persisted flag — used by autoSync to restore the "skip consent screen" behavior across reloads
// for users who already granted access in this browser profile.
export function hydrateGrantedBefore(granted: boolean): void {
  hasGrantedBefore = granted
}

export function revokeGoogleAccess(): void {
  if (cachedToken) {
    window.google?.accounts.oauth2.revoke(cachedToken.token)
  }
  cachedToken = null
  tokenClient = null
  hasGrantedBefore = false
}

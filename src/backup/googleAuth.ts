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

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) {
    return cachedToken.token
  }
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) {
    throw new Error('Integração com o Google Drive não está configurada.')
  }
  await loadGis()

  return new Promise((resolve, reject) => {
    tokenClient ??= window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(mapTokenError(response.error)))
          return
        }
        cachedToken = { token: response.access_token, expiresAt: Date.now() + response.expires_in * 1000 }
        resolve(response.access_token)
      },
      error_callback: (error) => reject(new Error(mapTokenError(error.type))),
    })
    tokenClient.requestAccessToken()
  })
}

export function clearCachedToken(): void {
  cachedToken = null
}

export function revokeGoogleAccess(): void {
  if (cachedToken) {
    window.google?.accounts.oauth2.revoke(cachedToken.token)
  }
  cachedToken = null
  tokenClient = null
}

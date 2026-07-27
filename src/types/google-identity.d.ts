// Minimal typings for the Google Identity Services token-client API used by src/backup/googleAuth.ts.
// Loaded at runtime from https://accounts.google.com/gsi/client — not an npm package.
export {}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (response: GoogleTokenResponse) => void
            error_callback?: (error: GoogleTokenClientError) => void
          }): GoogleTokenClient
          revoke(accessToken: string, done?: () => void): void
        }
      }
    }
  }

  interface GoogleTokenClient {
    requestAccessToken(overridableConfig?: { prompt?: string }): void
  }

  interface GoogleTokenResponse {
    access_token: string
    expires_in: number
    scope: string
    token_type: string
    error?: string
    error_description?: string
  }

  interface GoogleTokenClientError {
    type: string
    message?: string
  }
}

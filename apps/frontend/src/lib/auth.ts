import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts'

// Endpoint base: always derived from the current origin so the same Docker
// image works under any hostname/IP without rebuild.
const OIDC_AUTHORITY = `${window.location.origin}/rauthy`
const CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID ?? 'flexboard-web'

// Canonical Rauthy issuer — used only for `iss` claim validation in JWTs.
// When the app is accessed from a second URL (e.g. an external domain) the
// tokens still carry the primary deployment's issuer in their `iss` claim.
// Nginx injects this value at container startup via envsubst into /config.js
// (sets window.__FLEXBOARD_OIDC_ISSUER__). Falls back to the current origin so
// single-URL deployments and local dev work without any extra configuration.
const CANONICAL_ISSUER: string =
  (window as unknown as { __FLEXBOARD_OIDC_ISSUER__?: string }).__FLEXBOARD_OIDC_ISSUER__ ||
  OIDC_AUTHORITY

export const userManager = new UserManager({
  authority: OIDC_AUTHORITY,
  client_id: CLIENT_ID,
  redirect_uri: `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  // Pre-seed the OIDC metadata so oidc-client-ts skips the discovery fetch.
  // The discovery fetch is a JavaScript fetch() call that can fail with
  // self-signed certificates before the user interacts with the page.
  // Endpoint URLs use the runtime origin; the issuer uses the canonical value
  // so that tokens validate correctly when accessed from a second URL.
  metadata: {
    issuer: CANONICAL_ISSUER,
    authorization_endpoint: `${OIDC_AUTHORITY}/oidc/authorize`,
    token_endpoint: `${OIDC_AUTHORITY}/oidc/token`,
    jwks_uri: `${OIDC_AUTHORITY}/oidc/certs`,
    userinfo_endpoint: `${OIDC_AUTHORITY}/oidc/userinfo`,
    end_session_endpoint: `${OIDC_AUTHORITY}/oidc/logout`,
  },
  automaticSilentRenew: false,
})

export function signIn(): Promise<void> {
  return userManager.signinRedirect()
}

export function signInCallback(): Promise<User> {
  return userManager.signinRedirectCallback()
}

export async function signOut(): Promise<void> {
  return userManager.signoutRedirect()
}

export function getUser(): Promise<User | null> {
  return userManager.getUser()
}

export async function getAccessToken(): Promise<string | null> {
  const user = await userManager.getUser()
  if (!user || user.expired) return null
  return user.access_token
}

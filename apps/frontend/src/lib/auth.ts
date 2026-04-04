import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts'

const ZITADEL_DOMAIN = import.meta.env.VITE_ZITADEL_DOMAIN ?? 'http://localhost:8080'
const CLIENT_ID = import.meta.env.VITE_ZITADEL_CLIENT_ID as string

export const userManager = new UserManager({
  authority: ZITADEL_DOMAIN,
  client_id: CLIENT_ID,
  redirect_uri: `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  // Zitadel returns the issuer as http://localhost:8080 — we must match it exactly.
  // metadata_url is derived automatically from authority + /.well-known/openid-configuration
})

export function signIn(): Promise<void> {
  return userManager.signinRedirect()
}

export function signInCallback(): Promise<User> {
  return userManager.signinRedirectCallback()
}

export function signOut(): Promise<void> {
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

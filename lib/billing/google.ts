import { OAuth2Client } from 'google-auth-library'

export interface GoogleProfile { sub: string; email: string | null; name: string | null; picture: string | null }
export interface GoogleAuth {
  authUrl(state: string): string
  exchange(code: string): Promise<GoogleProfile>
}

export function createGoogleAuth(cfg: { clientId: string; clientSecret: string; redirectUri: string }): GoogleAuth {
  const client = new OAuth2Client(cfg.clientId, cfg.clientSecret, cfg.redirectUri)
  return {
    authUrl: (state) => client.generateAuthUrl({ scope: ['openid', 'profile', 'email'], prompt: 'select_account', state }),
    async exchange(code) {
      const { tokens } = await client.getToken(code)
      if (!tokens.id_token) throw new Error('no id_token')
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: cfg.clientId })
      const p = ticket.getPayload()
      if (!p?.sub) throw new Error('no sub')
      // Billing events are matched by email as a fallback, so only a verified address is trusted.
      return { sub: p.sub, email: p.email_verified ? (p.email ?? null) : null, name: p.name ?? null, picture: p.picture ?? null }
    },
  }
}

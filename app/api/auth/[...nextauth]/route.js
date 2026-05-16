import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { isApproved, approveUser } from '../../../../lib/auth-users.js'
import { registerUser, getUserProfile } from '../../../../lib/friends.js'
import { sendNewUserEmail }             from '../../../../lib/email.js'

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  callbacks: {
    /**
     * Called on every sign-in.
     * - Auto-approves ALERT_EMAIL (the app owner).
     * - Registers everyone else as pending if not yet approved.
     * Always returns true so the sign-in succeeds; access is gated in middleware.
     */
    async signIn({ user }) {
      const email = user.email?.toLowerCase()
      if (!email) return false

      // All Redis ops are fire-and-forget — a failure must never block sign-in
      try {
        const { isNew } = await registerUser(email, user.name)
        if (isNew) sendNewUserEmail(user.name ?? email, email).catch(() => {})
      } catch {}

      try { await approveUser(email) } catch {}

      return true
    },

    /**
     * Called when the JWT is created (sign-in) or when the client calls
     * update({ checkApproval: true }) from the pending page, or
     * update({ checkTier: true }) after a Stripe checkout completes.
     */
    async jwt({ token, account, trigger, session: sessionData }) {
      // Initial sign-in — set approved flag and tier
      if (account) {
        const email = token.email?.toLowerCase() ?? ''
        try { token.approved = await isApproved(email) } catch { token.approved = true }
        try {
          const profile = await getUserProfile(email)
          token.tier = profile?.tier ?? 'free'
        } catch { token.tier = 'free' }
      }
      // Explicit re-check triggered from the pending page
      if (trigger === 'update' && sessionData?.checkApproval) {
        const email = token.email?.toLowerCase() ?? ''
        try { token.approved = await isApproved(email) } catch {}
        try {
          const profile = await getUserProfile(email)
          token.tier = profile?.tier ?? 'free'
        } catch {}
      }
      // Explicit tier refresh after Stripe checkout / admin tier change
      if (trigger === 'update' && sessionData?.checkTier) {
        try {
          const profile = await getUserProfile(token.email?.toLowerCase() ?? '')
          token.tier = profile?.tier ?? 'free'
        } catch {}
      }
      return token
    },

    /**
     * Expose the approved flag and tier to the client session object.
     * Always fetches the tier fresh from Redis so admin tier changes
     * take effect immediately without requiring a sign-out.
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.approved = token.approved ?? false
        // Always fetch live tier from Redis so admin changes are instant
        try {
          const profile = await getUserProfile(token.email?.toLowerCase() ?? '')
          session.user.tier = profile?.tier ?? 'free'
        } catch {
          session.user.tier = token.tier ?? 'free'
        }
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
  },

  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }

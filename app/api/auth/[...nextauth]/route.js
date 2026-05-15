import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { isApproved, addPendingUser, approveUser } from '../../../../lib/auth-users.js'
import { sendApprovalRequestEmail }                from '../../../../lib/email.js'
import { registerUser, getUserProfile }            from '../../../../lib/friends.js'

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

      // Always upsert the user's display name in the registry
      registerUser(email, user.name).catch(() => {})

      // Auto-approve the owner
      const ownerEmail = process.env.ALERT_EMAIL?.toLowerCase()
      if (ownerEmail && email === ownerEmail) {
        await approveUser(email)
        return true
      }

      // Auto-approve everyone — app is open to the public (freemium)
      await approveUser(email)
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
        const email   = token.email?.toLowerCase() ?? ''
        token.approved = await isApproved(email)
        const profile  = await getUserProfile(email)
        token.tier     = profile?.tier ?? 'free'
      }
      // Explicit re-check triggered from the pending page
      if (trigger === 'update' && sessionData?.checkApproval) {
        const email   = token.email?.toLowerCase() ?? ''
        token.approved = await isApproved(email)
        const profile  = await getUserProfile(email)
        token.tier     = profile?.tier ?? 'free'
      }
      // Explicit tier refresh after Stripe checkout / admin tier change
      if (trigger === 'update' && sessionData?.checkTier) {
        const profile = await getUserProfile(token.email?.toLowerCase() ?? '')
        token.tier    = profile?.tier ?? 'free'
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

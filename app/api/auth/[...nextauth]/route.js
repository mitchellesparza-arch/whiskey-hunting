import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { isApproved, addPendingUser, approveUser } from '../../../../lib/auth-users.js'
import { sendApprovalRequestEmail }                from '../../../../lib/email.js'

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

      // Auto-approve the owner
      const ownerEmail = process.env.ALERT_EMAIL?.toLowerCase()
      if (ownerEmail && email === ownerEmail) {
        await approveUser(email)
        return true
      }

      // Register others as pending; notify owner on first registration
      const approved  = await isApproved(email)
      if (!approved) {
        const isNew = await addPendingUser(email, user.name)
        if (isNew) {
          sendApprovalRequestEmail(user.name ?? email, email).catch(err =>
            console.error('[auth] Failed to send approval email:', err)
          )
        }
      }
      return true
    },

    /**
     * Called when the JWT is created (sign-in) or when the client calls
     * update({ checkApproval: true }) from the pending page.
     */
    async jwt({ token, account, trigger, session: sessionData }) {
      // Initial sign-in — set approved flag
      if (account) {
        token.approved = await isApproved(token.email?.toLowerCase() ?? '')
      }
      // Explicit re-check triggered from the pending page
      if (trigger === 'update' && sessionData?.checkApproval) {
        token.approved = await isApproved(token.email?.toLowerCase() ?? '')
      }
      return token
    },

    /** Expose the approved flag to the client session object. */
    async session({ session, token }) {
      if (session.user) {
        session.user.approved = token.approved ?? false
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

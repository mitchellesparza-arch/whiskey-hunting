'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PendingPage() {
  const { data: session, update } = useSession()
  const router  = useRouter()
  const [checking, setChecking] = useState(false)
  const [checked,  setChecked]  = useState(false)

  // If already approved (e.g., owner who was auto-approved), send home.
  useEffect(() => {
    if (session?.user?.approved) router.replace('/')
  }, [session, router])

  async function checkApproval() {
    setChecking(true)
    // update() with trigger data causes the jwt callback to re-check Redis.
    await update({ checkApproval: true })
    setChecked(true)
    setChecking(false)
    // Redirect to home — middleware will let them through if now approved,
    // or send them back here if still pending.
    router.replace('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: 'var(--bg-base)' }}>
      <div className="card p-8 text-center max-w-sm w-full">

        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-xl font-bold text-[#f5e6cc] mb-2">Access Pending</h1>

        <p className="text-sm text-[#9a7c55] mb-1">Signed in as</p>
        <p className="text-sm font-semibold text-[#e8943a] mb-6 break-all">
          {session?.user?.email ?? '…'}
        </p>

        <p className="text-xs text-[#6b5030] mb-8 leading-relaxed">
          Your request has been submitted. Once the owner approves your
          account you'll have full access to the truck tracker. Use the
          button below after you've been notified.
        </p>

        <div className="space-y-3">
          <button
            onClick={checkApproval}
            disabled={checking}
            className="btn-primary w-full"
          >
            {checking ? 'Checking…' : checked ? 'Still pending — try again later' : 'Check approval status'}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full text-xs text-[#6b5030] hover:text-[#9a7c55] transition-colors py-1"
          >
            Sign out
          </button>
        </div>

      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AuthButton() {
  const [user, setUser] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = async () => {
    setLoading(true)
    await supabase.auth.signInWithOtp({
      email,
    })
    setLoading(false)
    alert('Check your email for the login link.')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  if (user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">
          Signed in as {user.email}
        </span>
        <button
          onClick={signOut}
          className="text-blue-600 underline"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-2 items-center">
      <input
        type="email"
        placeholder="email@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border rounded px-2 py-1 text-sm"
      />
      <button
        onClick={signIn}
        disabled={loading || !email}
        className="text-sm text-blue-600 underline"
      >
        Sign in
      </button>
    </div>
  )
}

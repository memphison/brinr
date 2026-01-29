// src/app/tins/[id]/RatingForm.tsx

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Props = {
  tinId: string
  initialRating: number | null
  onRated: (value: number) => void
}

export default function RatingForm({
  tinId,
  initialRating,
  onRated,
}: Props) {
  const [rating, setRating] = useState<number | null>(initialRating)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRating(initialRating)
  }, [initialRating])

  const submitRating = async (value: number) => {
    if (loading) return

    setRating(value)
    setLoading(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Sign in to rate this tin.')
      setLoading(false)
      return
    }

    const { error: upsertError } = await supabase
      .from('ratings')
      .upsert(
        {
          tin_id: tinId,
          user_id: user.id,
          rating: value,
        },
        { onConflict: 'user_id,tin_id' }
      )

    if (upsertError) {
      console.error(upsertError)
      setError('Something went wrong.')
      setLoading(false)
      return
    }

    onRated(value)

    setTimeout(() => {
      setLoading(false)
    }, 400)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={loading}
            onClick={() => submitRating(n)}
            className={`flex h-10 w-10 items-center justify-center text-2xl transition ${
              rating && n <= rating
                ? 'text-yellow-500'
                : 'text-gray-300'
            }`}
            aria-label={`Rate ${n} stars`}
          >
            ★
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  )
}

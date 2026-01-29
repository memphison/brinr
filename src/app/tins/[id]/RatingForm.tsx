// src/app/tins/[id]/RatingForm.tsx

'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Props = {
  tinId: string
  onRated: (value: number, notes: string | null) => void
  initialRating?: number | null
  initialNotes?: string | null
}

export default function RatingForm({
  tinId,
  onRated,
  initialRating = null,
  initialNotes = null,
}: Props) {
  const [rating, setRating] = useState<number | null>(initialRating)
  const [notes, setNotes] = useState<string>(initialNotes ?? '')
  const [showNotes, setShowNotes] = useState(!!initialNotes)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitRating = async (value: number) => {
    setRating(value)
    setLoading(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be signed in to rate.')
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
          notes: notes.trim() || null,
        },
        { onConflict: 'user_id,tin_id' }
      )

    if (upsertError) {
      setError('Something went wrong.')
      setLoading(false)
      return
    }

    onRated(value, notes.trim() || null)
    setLoading(false)
  }

  return (
    <div className="space-y-3">
      {/* Stars */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            disabled={loading}
            onClick={() => submitRating(n)}
            className={`text-2xl ${
              rating && n <= rating ? 'text-yellow-500' : 'text-gray-300'
            }`}
          >
            ★
          </button>
        ))}
      </div>

      {/* Notes toggle */}
      <button
        type="button"
        onClick={() => setShowNotes((v) => !v)}
        className="text-xs text-gray-500 dark:text-white"
      >
        {showNotes ? 'Hide notes' : 'Add a note'}
      </button>

      {/* Notes field */}
      {showNotes && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={240}
          placeholder="Smoky, clean oil, great on toast…"
          className="w-full text-sm border rounded p-2 bg-transparent"
        />
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  )
}

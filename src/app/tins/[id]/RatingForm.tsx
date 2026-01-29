// src/app/tins/[id]/RatingForm.tsx

'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Props = {
  tinId: string
  initialRating?: number | null
  initialNotes?: string | null
  onRated: (value: number, notes: string | null) => void
}

export default function RatingForm({
  tinId,
  initialRating = null,
  initialNotes = null,
  onRated,
}: Props) {
  const [rating, setRating] = useState<number | null>(initialRating)
  const [pendingRating, setPendingRating] = useState<number | null>(null)

  const [notes, setNotes] = useState(initialNotes ?? '')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [dirtyNotes, setDirtyNotes] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasExistingRating = initialRating !== null
  const effectiveRating = pendingRating ?? rating
  const dirtyRating =
    pendingRating !== null && pendingRating !== rating

  const getUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  }

  const upsertRating = async (
    nextRating: number,
    nextNotes: string | null
  ) => {
    const user = await getUser()
    if (!user) {
      setError('You must be signed in to rate.')
      return
    }

    setLoading(true)
    setError(null)

    const { error } = await supabase
      .from('ratings')
      .upsert(
        {
          tin_id: tinId,
          user_id: user.id,
          rating: nextRating,
          notes: nextNotes,
        },
        { onConflict: 'user_id,tin_id' }
      )

    if (error) {
      setError('Something went wrong.')
      setLoading(false)
      return
    }

    setRating(nextRating)
    setPendingRating(null)
    setDirtyNotes(false)
    setIsEditingNotes(false)

    onRated(nextRating, nextNotes)
    setLoading(false)
  }

  const handleStarClick = async (value: number) => {
    // First-time rating saves immediately
    if (!hasExistingRating) {
      await upsertRating(value, notes.trim() || null)
      return
    }

    // Editing existing rating: stage it
    setPendingRating(value)
  }

  const handleSaveRating = async () => {
    if (pendingRating === null) return
    await upsertRating(
      pendingRating,
      notes.trim() || null
    )
  }

  const handleSaveNotes = async () => {
    if (effectiveRating === null) {
      setError('Add a rating before saving notes.')
      return
    }

    await upsertRating(
      effectiveRating,
      notes.trim() || null
    )
  }

  return (
    <div className="space-y-3">
      {/* Stars */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            disabled={loading}
            onClick={() => handleStarClick(n)}
            className={`text-2xl ${
              effectiveRating && n <= effectiveRating
                ? 'text-yellow-500'
                : 'text-gray-300'
            }`}
          >
            ★
          </button>
        ))}
      </div>

           {/* Action row */}
      <div className="flex items-center gap-3 flex-wrap">
        {dirtyRating && (
          <button
            onClick={handleSaveRating}
            disabled={loading}
            className="text-sm px-3 py-1 border rounded"
          >
            Save rating
          </button>
        )}

        {!isEditingNotes && (
          <button
            type="button"
            onClick={() => setIsEditingNotes(true)}
            className="text-xs text-gray-500 dark:text-white"
          >
            {notes ? 'Edit note' : 'Add a note'}
          </button>
        )}
      </div>

      {/* Saved note view */}
      {!isEditingNotes && notes && (
        <div className="text-sm italic text-gray-600 dark:text-white">
          “{notes}”
        </div>
      )}


      {/* Notes edit */}
      {isEditingNotes && (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value)
              setDirtyNotes(true)
            }}
            maxLength={240}
            placeholder="Smoky, clean oil, great on toast…"
            className="w-full text-sm border rounded p-2 bg-transparent"
          />

          <button
            onClick={handleSaveNotes}
            disabled={loading}
            className="text-sm px-3 py-1 border rounded"
          >
            Save note
          </button>
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  )
}

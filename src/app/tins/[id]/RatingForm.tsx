// src/app/tins/[id]/RatingForm.tsx

'use client'

import { useEffect, useState } from 'react'
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

    // Optimistic commit
    setRating(nextRating)
    setPendingRating(null)
    setDirtyNotes(false)
    setIsEditingNotes(false)

    onRated(nextRating, nextNotes)
    setLoading(false)
  }

  const handleStarClick = (value: number) => {
    if (!hasExistingRating) {
      upsertRating(value, notes.trim() || null)
      return
    }

    setPendingRating(value)
  }

  const handleSaveRating = () => {
    if (!dirtyRating || pendingRating === null) return
    upsertRating(pendingRating, notes.trim() || null)
  }

  const handleSaveNotes = () => {
    if (effectiveRating === null) {
      setError('Add a rating before saving notes.')
      return
    }

    upsertRating(effectiveRating, notes.trim() || null)
  }

  // Keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (loading) return

      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault()
        const next = Math.max(1, (effectiveRating ?? 1) - 1)
        setPendingRating(next)
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault()
        const next = Math.min(5, (effectiveRating ?? 0) + 1)
        setPendingRating(next)
      }

      if (e.key === 'Enter' && dirtyRating) {
        e.preventDefault()
        handleSaveRating()
      }

      if (e.key === 'Escape') {
        setPendingRating(null)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [effectiveRating, dirtyRating, loading])

  return (
    <div className="space-y-3">
      {/* Stars */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            disabled={loading}
            onClick={() => handleStarClick(n)}
            aria-label={`Rate ${n} stars`}
            className={`text-2xl focus:outline-none ${
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
        <div
          className={`transition-all duration-200 ease-out ${
            dirtyRating
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-1 pointer-events-none'
          }`}
        >
          <button
            onClick={handleSaveRating}
            disabled={loading || !dirtyRating}
            className="text-sm px-3 py-1 border rounded disabled:opacity-50"
          >
            Save rating
          </button>
        </div>

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

      {/* Saved note */}
      {!isEditingNotes && notes && (
        <div className="text-sm italic text-gray-600 dark:text-white">
          “{notes}”
        </div>
      )}

      {/* Notes editor */}
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

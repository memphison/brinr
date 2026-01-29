// src/app/tins/[id]/RatingStats.tsx

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import RatingForm from './RatingForm'
import RatingHistogram from './RatingHistogram'


type Props = {
  tinId: string
  initialAvg: string | null
  initialCount: number
}

export default function RatingStats({
  tinId,
  initialAvg,
  initialCount,
}: Props) {
  const [count, setCount] = useState(initialCount)
  const [avg, setAvg] = useState<string | null>(initialAvg)
  const [userRating, setUserRating] = useState<number | null>(null)
  const [userNotes, setUserNotes] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState(false)

  useEffect(() => {
    const loadUserRating = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data } = await supabase
        .from('ratings')
        .select('rating, notes')
        .eq('tin_id', tinId)
        .eq('user_id', user.id)
        .single()

      if (data) {
        setUserRating(data.rating)
        setUserNotes(data.notes)
      }
    }

    loadUserRating()
  }, [tinId])

  const handleNewRating = (value: number, notes: string | null) => {
    const newCount = userRating === null ? count + 1 : count
    const newAvg =
      avg === null
        ? value.toFixed(1)
        : (
            (parseFloat(avg) * count +
              (value - (userRating ?? 0))) /
            newCount
          ).toFixed(1)

    setCount(newCount)
    setAvg(newAvg)
    setUserRating(value)
    setUserNotes(notes)
    setEditingNotes(false)
  }

  return (
    <div className="border-t pt-6 space-y-4">
      {/* Community rating */}
      <div className="text-sm">
        {avg ? (
          <>
            <span className="font-medium">{avg}</span> / 5
            <span className="text-gray-500 dark:text-white">
              {' '}
              · {count} ratings
            </span>
          </>
        ) : (
          <span className="text-gray-400">No ratings yet</span>
        )}
      </div>

      <RatingHistogram tinId={tinId} />


      {/* Saved note (read-only) */}
      {userNotes && !editingNotes && (
        <div className="space-y-2">
          <div className="text-sm italic text-gray-600 dark:text-white">
            “{userNotes}”
          </div>
          <button
            onClick={() => setEditingNotes(true)}
            className="text-sm text-blue-600"
          >
            Edit note
          </button>
        </div>
      )}

      {/* Rating + note editor */}
      {(!userNotes || editingNotes) && (
        <RatingForm
          tinId={tinId}
          initialRating={userRating}
          initialNotes={userNotes}
          onRated={handleNewRating}
        />
      )}
    </div>
  )
}

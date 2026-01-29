// src/app/tins/[id]/RatingStats.tsx

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import RatingForm from './RatingForm'

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
  const [justUpdated, setJustUpdated] = useState(false)

  // Load user's existing rating
  useEffect(() => {
    const loadUserRating = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data } = await supabase
        .from('ratings')
        .select('rating')
        .eq('tin_id', tinId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (data) {
        setUserRating(data.rating)
      }
    }

    loadUserRating()
  }, [tinId])

  const handleNewRating = (value: number) => {
    const isEdit = userRating !== null
    const prev = userRating ?? 0

    const newCount = isEdit ? count : count + 1
    const newAvg =
      avg === null
        ? value.toFixed(1)
        : (
            (parseFloat(avg) * count + value - (isEdit ? prev : 0)) /
            newCount
          ).toFixed(1)

    setUserRating(value)
    setCount(newCount)
    setAvg(newAvg)
    setJustUpdated(true)
  }

  useEffect(() => {
    if (!justUpdated) return
    const t = setTimeout(() => setJustUpdated(false), 1200)
    return () => clearTimeout(t)
  }, [justUpdated])

  return (
    <div className="border-t pt-6 space-y-3">
      {/* Community rating */}
      <div className="text-sm">
        {avg ? (
          <>
            <span className="font-medium">{avg}</span> / 5
            <span className="text-gray-500"> · {count} ratings</span>
          </>
        ) : (
          <span className="text-gray-400">No ratings yet</span>
        )}
      </div>

      {/* Your rating */}
      <div className="text-sm text-gray-600">
        {userRating ? (
          <>Your rating</>
        ) : (
          <>Rate this tin</>
        )}
      </div>

      <RatingForm
        tinId={tinId}
        initialRating={userRating}
        onRated={handleNewRating}
      />

      {justUpdated && (
        <div className="text-xs text-green-600">Updated</div>
      )}
    </div>
  )
}

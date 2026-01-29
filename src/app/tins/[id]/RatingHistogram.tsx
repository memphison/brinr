// src/app/tins/[id]/RatingHistogram.tsx

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Props = {
  tinId: string
}

type Bucket = {
  rating: number
  count: number
}

export default function RatingHistogram({ tinId }: Props) {
  const [buckets, setBuckets] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadHistogram = async () => {
      const { data, error } = await supabase
        .from('ratings')
        .select('rating')
        .eq('tin_id', tinId)

      if (error || !data) {
        setLoading(false)
        return
      }

      const counts: Record<number, number> = {}

      for (let i = 1; i <= 5; i++) {
        counts[i] = 0
      }

      data.forEach((r) => {
        counts[r.rating] = (counts[r.rating] || 0) + 1
      })

      setBuckets(counts)
      setLoading(false)
    }

    loadHistogram()
  }, [tinId])

  if (loading) return null

  const maxCount = Math.max(...Object.values(buckets), 1)

  return (
    <div className="space-y-1 pt-2">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = buckets[star] || 0
        const width = (count / maxCount) * 100

        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <div className="w-10 text-right">
              {star}★
            </div>

            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
              <div
                className="h-full bg-yellow-500"
                style={{ width: `${width}%` }}
              />
            </div>

            <div className="w-6 text-gray-600 dark:text-white text-right">
              {count}
            </div>
          </div>
        )
      })}
    </div>
  )
}

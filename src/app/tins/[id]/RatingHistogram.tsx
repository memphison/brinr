// src/app/tins/[id]/RatingHistogram.tsx

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Props = {
  tinId: string
  userRating?: number | null
}

export default function RatingHistogram({ tinId, userRating }: Props) {
  const [buckets, setBuckets] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const cacheKey = `histogram:${tinId}`

    const loadHistogram = async (forceRefresh = false) => {
      if (!forceRefresh) {
        const cached = sessionStorage.getItem(cacheKey)
        if (cached) {
          setBuckets(JSON.parse(cached))
          setLoading(false)
          requestAnimationFrame(() => setAnimate(true))
          return
        }
      }

      const { data, error } = await supabase
        .from('ratings')
        .select('rating')
        .eq('tin_id', tinId)

      if (error || !data) {
        setLoading(false)
        return
      }

      const counts: Record<number, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      }

      data.forEach((r) => {
        counts[r.rating] += 1
      })

      sessionStorage.setItem(cacheKey, JSON.stringify(counts))
      setBuckets(counts)
      setLoading(false)
      requestAnimationFrame(() => setAnimate(true))
    }

    loadHistogram()
  }, [tinId])

  // 🔄 Force refresh when user rating changes
  useEffect(() => {
    if (userRating === undefined) return

    const cacheKey = `histogram:${tinId}`
    sessionStorage.removeItem(cacheKey)

    setAnimate(false)
    setLoading(true)

    const refresh = async () => {
      const { data } = await supabase
        .from('ratings')
        .select('rating')
        .eq('tin_id', tinId)

      if (!data) return

      const counts: Record<number, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      }

      data.forEach((r) => {
        counts[r.rating] += 1
      })

      sessionStorage.setItem(cacheKey, JSON.stringify(counts))
      setBuckets(counts)
      setLoading(false)
      requestAnimationFrame(() => setAnimate(true))
    }

    refresh()
  }, [userRating, tinId])

  if (loading) return null

  const maxCount = Math.max(...Object.values(buckets), 1)

  return (
    <div className="space-y-1 pt-2">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = buckets[star] || 0
        const width = (count / maxCount) * 100
        const isUserStar = userRating === star

        return (
          <div
            key={star}
            className={`flex items-center gap-2 text-xs ${
              isUserStar ? 'font-medium' : ''
            }`}
          >
            <div
              className={`w-10 text-right ${
                isUserStar
                  ? 'text-yellow-600'
                  : 'text-gray-600 dark:text-white'
              }`}
            >
              {star}★
            </div>

            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-700 ease-out ${
                  isUserStar ? 'bg-yellow-600' : 'bg-yellow-500'
                }`}
                style={{
                  width: animate ? `${width}%` : '0%',
                }}
              />
            </div>

            <div className="w-6 text-right text-gray-600 dark:text-white">
              {count}
            </div>
          </div>
        )
      })}
    </div>
  )
}

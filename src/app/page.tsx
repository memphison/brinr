// src/app/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

type Tin = {
  id: string
  brand: string
  product_name: string
  fish_type: string
  country: string
  packing: string
  notes: string | null
}

type Rating = {
  tin_id: string
}

export default function Home() {
  const [tins, setTins] = useState<Tin[]>([])
  const [ratedTinIds, setRatedTinIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'rated' | 'unrated'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      // Fetch tins
      const { data: tinsData } = await supabase
        .from('tins')
        .select('*')
        .order('brand', { ascending: true })

      if (tinsData) {
        setTins(tinsData)
      }

      // Fetch user ratings if signed in
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: ratings } = await supabase
          .from('ratings')
          .select('tin_id')
          .eq('user_id', user.id)

        if (ratings) {
          setRatedTinIds(new Set(ratings.map((r: Rating) => r.tin_id)))
        }
      }

      setLoading(false)
    }

    loadData()
  }, [])

  const filteredTins = tins.filter((tin) => {
    if (filter === 'rated') return ratedTinIds.has(tin.id)
    if (filter === 'unrated') return !ratedTinIds.has(tin.id)
    return true
  })

  if (loading) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold">Brinr</h1>
        <div className="text-sm text-gray-500 mt-4">Loading tins…</div>
      </main>
    )
  }

  return (
    <main className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Brinr</h1>

      {/* Filters */}
      <div className="flex gap-4 text-sm">
        <button
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'font-medium' : 'text-gray-500'}
        >
          All
        </button>
        <button
          onClick={() => setFilter('rated')}
          className={filter === 'rated' ? 'font-medium' : 'text-gray-500'}
        >
          Rated
        </button>
        <button
          onClick={() => setFilter('unrated')}
          className={filter === 'unrated' ? 'font-medium' : 'text-gray-500'}
        >
          Not rated
        </button>
      </div>

      <ul className="space-y-3">
        {filteredTins.map((tin) => {
          const isRated = ratedTinIds.has(tin.id)

          return (
            <Link key={tin.id} href={`/tins/${tin.id}`}>
              <li className="border rounded p-4 hover:bg-gray-50 transition cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{tin.brand}</div>
                    <div className="text-sm text-gray-600">
                      {tin.product_name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {tin.fish_type} • {tin.country}
                    </div>
                  </div>

                  {isRated && (
                    <div className="text-xs text-yellow-600 shrink-0">
                      ★ Rated
                    </div>
                  )}
                </div>
              </li>
            </Link>
          )
        })}
      </ul>
    </main>
  )
}

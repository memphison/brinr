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

const [filters, setFilters] = useState({
  fish_type: 'all',
  country: 'all',
  packing: 'all',
})


  useEffect(() => {
    const loadData = async () => {
      const { data: tinsData } = await supabase
        .from('tins')
        .select('*')
        .order('brand', { ascending: true })

      if (tinsData) {
        setTins(tinsData)
      }

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

const uniqueValues = (key: keyof Tin) =>
  Array.from(
    new Set(
      tins
        .map((t) => t[key])
        .filter((v): v is string => Boolean(v))
    )
  ).sort()


  const filteredTins = tins.filter((tin) => {
  if (filter === 'rated' && !ratedTinIds.has(tin.id)) return false
  if (filter === 'unrated' && ratedTinIds.has(tin.id)) return false

  if (
    filters.fish_type !== 'all' &&
    tin.fish_type !== filters.fish_type
  )
    return false

  if (
    filters.country !== 'all' &&
    tin.country !== filters.country
  )
    return false

  if (
    filters.packing !== 'all' &&
    tin.packing !== filters.packing
  )
    return false

  return true
})


  if (loading) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold">Brinr</h1>
        <div className="text-sm text-gray-500 dark:text-white mt-4">
          Loading tins…
        </div>
      </main>
    )
  }

  return (
    <main className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Brinr</h1>

           {/* Filters */}
      <div className="space-y-3 text-sm">
        {/* Rated filter */}
        <div className="flex gap-4">
          <button
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'font-medium' : 'text-gray-500 dark:text-white'}
          >
            All
          </button>
          <button
            onClick={() => setFilter('rated')}
            className={filter === 'rated' ? 'font-medium' : 'text-gray-500 dark:text-white'}
          >
            Rated
          </button>
          <button
            onClick={() => setFilter('unrated')}
            className={filter === 'unrated' ? 'font-medium' : 'text-gray-500 dark:text-white'}
          >
            Not rated
          </button>
        </div>

        {/* Attribute filters */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={filters.fish_type}
            onChange={(e) =>
              setFilters((f) => ({ ...f, fish_type: e.target.value }))
            }
            className="border rounded px-2 py-1 bg-transparent"
          >
            <option value="all">All fish</option>
            {uniqueValues('fish_type').map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={filters.country}
            onChange={(e) =>
              setFilters((f) => ({ ...f, country: e.target.value }))
            }
            className="border rounded px-2 py-1 bg-transparent"
          >
            <option value="all">All countries</option>
            {uniqueValues('country').map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={filters.packing}
            onChange={(e) =>
              setFilters((f) => ({ ...f, packing: e.target.value }))
            }
            className="border rounded px-2 py-1 bg-transparent"
          >
            <option value="all">All packing</option>
            {uniqueValues('packing').map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
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
        <div className="text-sm text-gray-600 dark:text-white">
          {tin.product_name}
        </div>
        <div className="text-xs text-gray-500 dark:text-white mt-1">
          {tin.fish_type} • {tin.country}
        </div>
      </div>

      {ratedTinIds.has(tin.id) && (
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

// src/app/page.tsx

'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import Image from 'next/image'   // ← NEW


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

  const [search, setSearch] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const stored = localStorage.getItem('brinr-filters')
    if (stored) {
      const parsed = JSON.parse(stored)
      setFilter(parsed.filter ?? 'all')
      setFilters(parsed.filters ?? {
        fish_type: 'all',
        country: 'all',
        packing: 'all',
      })
      setSearch(parsed.search ?? '')
    }
  }, [])

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

  useEffect(() => {
    localStorage.setItem(
      'brinr-filters',
      JSON.stringify({
        filter,
        filters,
        search,
      })
    )
  }, [filter, filters, search])

  const clearFilters = () => {
    setFilter('all')
    setFilters({
      fish_type: 'all',
      country: 'all',
      packing: 'all',
    })
    setSearch('')
  }

  const uniqueValues = (key: keyof Tin) =>
    Array.from(
      new Set(
        tins
          .map((t) => t[key])
          .filter((v): v is string => Boolean(v))
      )
    ).sort()

  const fishTypes = useMemo(
    () => uniqueValues('fish_type'),
    [tins]
  )

  const countries = useMemo(
    () => uniqueValues('country'),
    [tins]
  )

  const packings = useMemo(
    () => uniqueValues('packing'),
    [tins]
  )

  const filteredTins = tins.filter((tin) => {
    if (filter === 'rated' && !ratedTinIds.has(tin.id)) return false
    if (filter === 'unrated' && ratedTinIds.has(tin.id)) return false

    if (
      filters.fish_type !== 'all' &&
      tin.fish_type !== filters.fish_type
    ) return false

    if (
      filters.country !== 'all' &&
      tin.country !== filters.country
    ) return false

    if (
      filters.packing !== 'all' &&
      tin.packing !== filters.packing
    ) return false

    if (search.trim()) {
      const q = search.toLowerCase()
      if (
        !tin.brand.toLowerCase().includes(q) &&
        !tin.product_name.toLowerCase().includes(q)
      ) {
        return false
      }
    }

    return true
  })

  if (loading) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        {/* Logo header */}
        <div className="mb-4">
          <Image
            src="/brinr-logo.png"
            alt="Brinr"
            width={180}
            height={65}
            priority
          />
        </div>

        <div className="text-sm text-gray-500 dark:text-white mt-4">
          Loading tins…
        </div>
      </main>
    )
  }

  return (
    <main className="p-6 max-w-xl mx-auto space-y-4">
      {/* Logo header */}
      <div>
        <Image
          src="/brinr-logo.png"
          alt="Brinr"
          width={180}
          height={65}
          priority
        />
      </div>

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
            {fishTypes.map((v) => (
              <option key={v} value={v}>{v}</option>
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
            {countries.map((v) => (
              <option key={v} value={v}>{v}</option>
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
            {packings.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Search */}
      <div className="space-y-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brand or product…"
          className="w-full border rounded px-3 py-2 text-sm bg-transparent"
        />

        {(filter !== 'all' ||
          filters.fish_type !== 'all' ||
          filters.country !== 'all' ||
          filters.packing !== 'all' ||
          search) && (
          <button
            onClick={clearFilters}
            className="text-xs text-gray-500 dark:text-white underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <ul className="space-y-3">
        {filteredTins.map((tin) => (
          <Link key={tin.id} href={`/tins/${tin.id}`}>
            <li className="border rounded p-4 hover:bg-gray-50 transition cursor-pointer">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{tin.brand}</div>
                  <div className="text-sm text-gray-600 dark:text-white">
                    {tin.product_name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-white mt-1">
                    {tin.fish_type} • {tin.country} • {tin.packing}
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
        ))}
      </ul>
    </main>
  )
}

// src/app/tins/[id]/page.tsx

import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import RatingStats from './RatingStats'

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
  rating: number
}

export default async function TinPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: tin, error } = await supabase
    .from('tins')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !tin) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-500 dark:text-white py-2"
        >
          ← Back
        </Link>
        <p className="mt-4 text-red-600">Tin not found.</p>
      </main>
    )
  }

  const { data: ratings } = await supabase
    .from('ratings')
    .select('rating')
    .eq('tin_id', id)

  const count = ratings?.length ?? 0
  const avg =
    count > 0
      ? (
          ratings!.reduce((sum, r) => sum + r.rating, 0) / count
        ).toFixed(1)
      : null

  return (
    <main className="p-5 sm:p-6 max-w-xl mx-auto space-y-5">
      {/* Back nav */}
      <Link
        href="/"
        className="inline-flex items-center text-sm text-gray-500 dark:text-white py-2"
      >
        ← Back
      </Link>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{tin.brand}</h1>
        <div className="text-lg text-gray-600 dark:text-white">
          {tin.product_name}
        </div>
      </div>

      {/* Meta */}
      <div className="text-sm text-gray-600 dark:text-white">
        {tin.fish_type} • {tin.country}
      </div>

      <div className="text-sm text-gray-500 dark:text-white">
        Packed in {tin.packing}
      </div>

      {/* Tin notes */}
      {tin.notes && (
        <div className="text-sm italic text-gray-600 dark:text-white border-t pt-4">
          {tin.notes}
        </div>
      )}

      {/* Ratings */}
      <RatingStats
        tinId={tin.id}
        initialAvg={avg}
        initialCount={count}
      />
    </main>
  )
}

// src/app/tins/[id]/NotesForm.tsx

'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Props = {
  tinId: string
  initialNote: string | null
  onSaved: (note: string) => void
}

export default function NotesForm({
  tinId,
  initialNote,
  onSaved,
}: Props) {
  const [note, setNote] = useState(initialNote ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveNote = async () => {
    setLoading(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be signed in.')
      setLoading(false)
      return
    }

    const { error: upsertError } = await supabase
      .from('ratings')
      .upsert(
        {
          tin_id: tinId,
          user_id: user.id,
          notes: note.trim(),
        },
        { onConflict: 'user_id,tin_id' }
      )

    if (upsertError) {
      console.error(upsertError)
      setError('Failed to save note.')
      setLoading(false)
      return
    }

    onSaved(note.trim())
    setLoading(false)
  }

  return (
    <div className="space-y-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        className="w-full border rounded p-2 text-sm"
        placeholder="Add a short note…"
      />

      <button
        onClick={saveNote}
        disabled={loading}
        className="border rounded px-3 py-1 text-sm"
      >
        Save note
      </button>

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  )
}

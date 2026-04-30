import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { ShopNote } from '../../types/database'

export function NotesPage() {
  const { user, barberName } = useAuth()
  const [activeNotes, setActiveNotes] = useState<ShopNote[]>([])
  const [resolvedNotes, setResolvedNotes] = useState<ShopNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const fetchAll = async () => {
      const [active, resolved] = await Promise.all([
        supabase
          .from('shop_notes')
          .select('*')
          .eq('is_resolved', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('shop_notes')
          .select('*')
          .eq('is_resolved', true)
          .order('resolved_at', { ascending: false })
          .limit(50),
      ])
      setActiveNotes((active.data as ShopNote[] | null) ?? [])
      setResolvedNotes((resolved.data as ShopNote[] | null) ?? [])
      setLoading(false)
    }
    fetchAll()
  }, [refreshKey])

  const refresh = () => setRefreshKey((k) => k + 1)

  const handleAdd = async () => {
    if (!newNote.trim() || !user) return
    await supabase.from('shop_notes').insert({
      body: newNote.trim(),
      author_id: user.id,
      author_name: barberName || 'Ukendt',
    })
    setNewNote('')
    refresh()
  }

  const handleResolve = async (noteId: string) => {
    if (!user) return
    await supabase
      .from('shop_notes')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', noteId)
    refresh()
  }

  const formatNoteDate = (iso: string) =>
    new Date(iso).toLocaleDateString('da-DK', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

  if (loading) return <p className="text-sm text-gray-400">Henter noter…</p>

  return (
    <div className="md:h-full md:flex md:flex-col md:min-h-0 flex-1">
      <div className="flex flex-col md:flex-row flex-1 md:min-h-0 h-full gap-4">
        {/* LEFT: Active notes */}
        <div className="flex-1 flex flex-col min-h-0">
          <h2 className="text-sm font-medium text-gray-900 mb-3 flex-shrink-0">Aktive noter</h2>

          <div className="bg-white rounded-lg border border-gray-200 p-4 flex-shrink-0 mb-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Skriv en note til alle i salonen…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#B08A3E] focus:ring-2 focus:ring-[#B08A3E]/15 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <button
                onClick={handleAdd}
                disabled={!newNote.trim()}
                className="px-4 py-2 bg-[#B08A3E] text-white text-xs font-medium rounded-lg hover:bg-[#8C6A28] transition-colors disabled:opacity-40"
              >
                Tilføj
              </button>
            </div>
          </div>

          <div className="md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-1 space-y-2">
            {activeNotes.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                <p className="text-sm text-gray-400">Ingen aktive noter.</p>
              </div>
            ) : (
              activeNotes.map((note) => (
                <div key={note.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{note.body}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {note.author_name} · {formatNoteDate(note.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleResolve(note.id)}
                      className="text-xs text-[#B08A3E] hover:text-[#8C6A28] transition-colors whitespace-nowrap"
                    >
                      ✓ Afslut
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Resolved notes */}
        <div className="md:w-80 flex flex-col min-h-0">
          <h2 className="text-sm font-medium text-gray-400 mb-3 flex-shrink-0">Afsluttede noter</h2>

          <div className="md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-1 space-y-2">
            {resolvedNotes.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                <p className="text-sm text-gray-400">Ingen afsluttede noter.</p>
              </div>
            ) : (
              resolvedNotes.map((note) => (
                <div
                  key={note.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 opacity-60"
                >
                  <p className="text-sm text-gray-500 line-through">{note.body}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {note.author_name} · {formatNoteDate(note.created_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

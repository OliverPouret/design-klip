import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { ShopNote } from '../../types/database'

export function NotesPage() {
  const { user, barberName } = useAuth()
  const [notes, setNotes] = useState<ShopNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const fetchNotes = async () => {
      let query = supabase
        .from('shop_notes')
        .select('*')
        .order('created_at', { ascending: false })

      if (!showResolved) {
        query = query.eq('is_resolved', false)
      }

      const { data } = await query
      setNotes((data as ShopNote[] | null) ?? [])
      setLoading(false)
    }
    fetchNotes()
  }, [showResolved, refreshKey])

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

  if (loading) return <p className="text-sm text-ink-subtle">Henter noter…</p>

  return (
    <div>
      <h1 className="font-serif text-xl text-ink mb-6">Salonnoter</h1>

      <div className="bg-white border border-border rounded-sm p-4 mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Skriv en note til alle i salonen…"
            className="flex-1 border border-border rounded-sm px-3 py-2.5 text-sm outline-none focus:border-accent transition-colors"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={!newNote.trim()}
            className="px-5 py-2.5 bg-accent text-white text-xs font-medium uppercase hover:bg-accent-deep transition-colors disabled:opacity-40"
          >
            Tilføj
          </button>
        </div>
      </div>

      <div className="flex justify-end mb-3">
        <button
          onClick={() => setShowResolved(!showResolved)}
          className="text-xs text-ink-subtle hover:text-ink transition-colors"
        >
          {showResolved ? 'Skjul afsluttede' : 'Vis afsluttede'}
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="bg-white border border-border rounded-sm p-8 text-center">
          <p className="text-sm text-ink-muted">
            {showResolved ? 'Ingen noter endnu.' : 'Ingen aktive noter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`bg-white border rounded-sm p-4 ${
                note.is_resolved ? 'border-border/50 opacity-60' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className={`text-sm ${note.is_resolved ? 'text-ink-muted line-through' : 'text-ink'}`}>
                    {note.body}
                  </p>
                  <p className="text-[0.625rem] text-ink-subtle mt-1">
                    {note.author_name} ·{' '}
                    {new Date(note.created_at).toLocaleDateString('da-DK', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                {!note.is_resolved && (
                  <button
                    onClick={() => handleResolve(note.id)}
                    className="ml-3 text-xs text-accent-deep hover:text-ink transition-colors whitespace-nowrap"
                  >
                    ✓ Afslut
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

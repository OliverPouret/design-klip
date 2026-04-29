import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { ShopNote } from '../../types/database'
import { Card } from '../../components/admin/Card'

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

  if (loading) return <p className="text-sm text-[#8A8A8A]">Henter noter…</p>

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="font-serif text-[22px] text-ink">Salonnoter</h1>

      <Card padding="sm">
        <div className="flex gap-2">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Skriv en note til alle i salonen…"
            className="flex-1 border border-[#E8E8E5] rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#B08A3E] focus:ring-2 focus:ring-[#B08A3E]/15 transition-all"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={!newNote.trim()}
            className="px-5 py-2.5 bg-[#B08A3E] text-white text-[12px] font-medium rounded-lg hover:bg-[#8C6A28] transition-colors disabled:opacity-40"
          >
            Tilføj
          </button>
        </div>
      </Card>

      <div className="flex justify-end">
        <button
          onClick={() => setShowResolved(!showResolved)}
          className="text-[12px] text-[#8A8A8A] hover:text-ink transition-colors"
        >
          {showResolved ? 'Skjul afsluttede' : 'Vis afsluttede'}
        </button>
      </div>

      {notes.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-[#5F5E5A] text-center">
            {showResolved ? 'Ingen noter endnu.' : 'Ingen aktive noter.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <Card
              key={note.id}
              padding="sm"
              className={note.is_resolved ? 'opacity-60' : ''}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${note.is_resolved ? 'text-[#8A8A8A] line-through' : 'text-ink'}`}>
                    {note.body}
                  </p>
                  <p className="text-[11px] text-[#8A8A8A] mt-1">
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
                    className="text-[12px] text-[#B08A3E] hover:text-[#8C6A28] transition-colors whitespace-nowrap"
                  >
                    ✓ Afslut
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

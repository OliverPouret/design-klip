import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { WorkingHoursEditor } from './WorkingHoursEditor'
import { TimeOffManager } from './TimeOffManager'

interface BarberCardProps {
  barber: {
    id: string
    display_name: string
    photo_url: string | null
    is_active: boolean
    display_order: number
  }
}

type Panel = 'hours' | 'timeoff' | 'profile' | null

export function BarberCard({ barber }: BarberCardProps) {
  const [panel, setPanel] = useState<Panel>(null)
  const [displayName, setDisplayName] = useState(barber.display_name)
  const [photoUrl, setPhotoUrl] = useState<string | null>(barber.photo_url)
  const [editName, setEditName] = useState(barber.display_name)
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDisplayName(barber.display_name)
    setEditName(barber.display_name)
    setPhotoUrl(barber.photo_url)
  }, [barber.display_name, barber.photo_url])

  const initials = displayName
    .split(' ')
    .map((s) => s.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const toggle = (p: Panel) => setPanel((current) => (current === p ? null : p))

  async function saveName() {
    const trimmed = editName.trim()
    if (!trimmed) {
      setNameError('Navn er påkrævet')
      return
    }
    setSavingName(true)
    setNameError(null)
    const { error } = await supabase
      .from('barbers')
      .update({ display_name: trimmed })
      .eq('id', barber.id)
    setSavingName(false)
    if (error) {
      setNameError('Kunne ikke gemme. Prøv igen.')
      return
    }
    setDisplayName(trimmed)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Billedet er for stort. Max 5MB.')
      return
    }
    setPhotoError(null)
    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop() ?? 'jpg'
      const fileName = `${barber.id}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('barber-photos')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('barber-photos').getPublicUrl(fileName)
      const newUrl = data.publicUrl

      const { error: updateError } = await supabase
        .from('barbers')
        .update({ photo_url: newUrl })
        .eq('id', barber.id)

      if (updateError) throw updateError

      setPhotoUrl(newUrl)
    } catch {
      setPhotoError('Upload fejlede. Prøv igen.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={displayName}
            className="w-14 h-14 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[#B08A3E]/15 text-[#8C6A28] text-base font-semibold flex items-center justify-center flex-shrink-0">
            {initials || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
          <span
            className={`inline-block mt-1 text-[10px] font-semibold tracking-[0.08em] uppercase px-2 py-0.5 rounded-full ${
              barber.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {barber.is_active ? 'Aktiv' : 'Inaktiv'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 border-t border-gray-100">
        <button
          onClick={() => toggle('hours')}
          className={`px-3 py-2.5 text-xs font-medium border-r border-gray-100 transition-colors ${
            panel === 'hours'
              ? 'bg-[#B08A3E]/10 text-[#8C6A28]'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          Arbejdstider
        </button>
        <button
          onClick={() => toggle('timeoff')}
          className={`px-3 py-2.5 text-xs font-medium border-r border-gray-100 transition-colors ${
            panel === 'timeoff'
              ? 'bg-[#B08A3E]/10 text-[#8C6A28]'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          Fridage
        </button>
        <button
          onClick={() => toggle('profile')}
          className={`px-3 py-2.5 text-xs font-medium transition-colors ${
            panel === 'profile'
              ? 'bg-[#B08A3E]/10 text-[#8C6A28]'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          Rediger profil
        </button>
      </div>

      {panel === 'hours' && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          <WorkingHoursEditor barberId={barber.id} />
        </div>
      )}
      {panel === 'timeoff' && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          <TimeOffManager barberId={barber.id} />
        </div>
      )}
      {panel === 'profile' && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-5">
          <div>
            <label className="block text-[11px] tracking-[0.08em] uppercase text-gray-500 mb-1.5">
              Navn
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value)
                  setNameError(null)
                }}
                placeholder="Frisør navn"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#B08A3E]/40"
              />
              <button
                onClick={saveName}
                disabled={savingName || editName.trim() === displayName}
                className="px-3 py-2 rounded-md text-xs font-medium bg-[#B08A3E] text-white hover:bg-[#8C6A28] transition-colors disabled:opacity-50"
              >
                {savingName ? 'Gemmer…' : 'Gem navn'}
              </button>
            </div>
            {nameError && <p className="text-xs text-red-600 mt-1">{nameError}</p>}
          </div>

          <div>
            <label className="block text-[11px] tracking-[0.08em] uppercase text-gray-500 mb-1.5">
              Profilbillede
            </label>
            <div className="flex items-center gap-4">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={displayName}
                  className="w-32 h-32 rounded-full object-cover flex-shrink-0 border border-gray-200"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-[#B08A3E]/15 text-[#8C6A28] text-2xl font-semibold flex items-center justify-center flex-shrink-0">
                  {initials || '?'}
                </div>
              )}
              <div className="flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                  className="block w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[#B08A3E]/10 file:text-[#8C6A28] hover:file:bg-[#B08A3E]/20"
                />
                <p className="text-[11px] text-gray-400">JPG, PNG eller WebP. Max 5MB.</p>
                {uploading && <p className="text-xs text-gray-500">Uploader…</p>}
                {photoError && <p className="text-xs text-red-600">{photoError}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

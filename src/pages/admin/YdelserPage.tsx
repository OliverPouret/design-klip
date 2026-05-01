import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface ServiceRow {
  id: string
  slug: string
  name_da: string
  duration_minutes: number
  price_ore: number
  default_price_ore: number | null
  is_active: boolean
  display_order: number
}

interface BarberRow {
  id: string
  display_name: string
  is_active: boolean
}

interface FormState {
  name: string
  priceKr: string
  duration: string
}

interface FormErrors {
  name?: string
  priceKr?: string
  duration?: string
}

const EMPTY_FORM: FormState = { name: '', priceKr: '', duration: '' }

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {}
  if (!form.name.trim()) errors.name = 'Navn er påkrævet'
  const price = Number(form.priceKr)
  if (!Number.isFinite(price) || price <= 0) errors.priceKr = 'Pris skal være større end 0'
  const duration = Number(form.duration)
  if (!Number.isInteger(duration) || duration < 5 || duration > 240) {
    errors.duration = 'Varighed skal være 5–240 minutter'
  }
  return errors
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'oe')
    .replace(/å/g, 'aa')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function YdelserPage() {
  const [services, setServices] = useState<ServiceRow[]>([])
  const [barbers, setBarbers] = useState<BarberRow[]>([])
  const [serviceBarbers, setServiceBarbers] = useState<Map<string, Set<string>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM)
  const [addErrors, setAddErrors] = useState<FormErrors>({})
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)
  const [editErrors, setEditErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  async function reload() {
    setLoading(true)
    const [servicesRes, barbersRes, sbRes] = await Promise.all([
      supabase.from('services').select('*').order('display_order').order('name_da'),
      supabase
        .from('barbers')
        .select('id, display_name, is_active')
        .eq('is_active', true)
        .order('display_order'),
      supabase.from('barber_services').select('service_id, barber_id'),
    ])

    setServices((servicesRes.data as ServiceRow[] | null) ?? [])
    setBarbers((barbersRes.data as BarberRow[] | null) ?? [])

    const map = new Map<string, Set<string>>()
    const rows = (sbRes.data as { service_id: string; barber_id: string }[] | null) ?? []
    for (const row of rows) {
      if (!map.has(row.service_id)) map.set(row.service_id, new Set())
      map.get(row.service_id)!.add(row.barber_id)
    }
    setServiceBarbers(map)
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  function startEdit(service: ServiceRow) {
    setEditingId(service.id)
    const priceOre = service.default_price_ore ?? service.price_ore
    setEditForm({
      name: service.name_da,
      priceKr: String(priceOre / 100),
      duration: String(service.duration_minutes),
    })
    setEditErrors({})
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(EMPTY_FORM)
    setEditErrors({})
  }

  async function saveEdit(serviceId: string) {
    const errors = validate(editForm)
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors)
      return
    }
    setSaving(true)
    const priceOre = Math.round(Number(editForm.priceKr) * 100)
    const duration = Number(editForm.duration)
    const { error } = await supabase
      .from('services')
      .update({
        name_da: editForm.name.trim(),
        default_price_ore: priceOre,
        price_ore: priceOre,
        duration_minutes: duration,
      })
      .eq('id', serviceId)
    setSaving(false)
    if (error) {
      setEditErrors({ name: 'Kunne ikke gemme. Prøv igen.' })
      return
    }
    cancelEdit()
    reload()
  }

  async function addService() {
    const errors = validate(addForm)
    if (Object.keys(errors).length > 0) {
      setAddErrors(errors)
      return
    }
    setSaving(true)
    const priceOre = Math.round(Number(addForm.priceKr) * 100)
    const duration = Number(addForm.duration)
    const name = addForm.name.trim()
    const baseSlug = slugify(name) || `ydelse-${Date.now()}`
    const maxOrder = services.reduce((m, s) => Math.max(m, s.display_order), 0)

    const { data: newService, error } = await supabase
      .from('services')
      .insert({
        slug: `${baseSlug}-${Date.now().toString(36)}`,
        name_da: name,
        duration_minutes: duration,
        price_ore: priceOre,
        default_price_ore: priceOre,
        is_active: true,
        display_order: maxOrder + 1,
      })
      .select()
      .single()

    if (error || !newService) {
      setSaving(false)
      setAddErrors({ name: 'Kunne ikke oprette ydelsen. Prøv igen.' })
      return
    }

    if (barbers.length > 0) {
      await supabase
        .from('barber_services')
        .insert(barbers.map((b) => ({ service_id: newService.id, barber_id: b.id })))
    }

    setSaving(false)
    setAddForm(EMPTY_FORM)
    setAddErrors({})
    setShowAddForm(false)
    reload()
  }

  async function toggleAssignment(serviceId: string, barberId: string) {
    const assigned = serviceBarbers.get(serviceId)?.has(barberId) ?? false
    if (assigned) {
      await supabase
        .from('barber_services')
        .delete()
        .eq('service_id', serviceId)
        .eq('barber_id', barberId)
    } else {
      await supabase.from('barber_services').insert({ service_id: serviceId, barber_id: barberId })
    }
    setServiceBarbers((prev) => {
      const next = new Map(prev)
      const set = new Set(next.get(serviceId) ?? [])
      if (assigned) set.delete(barberId)
      else set.add(barberId)
      next.set(serviceId, set)
      return next
    })
  }

  async function toggleActive(service: ServiceRow) {
    await supabase
      .from('services')
      .update({ is_active: !service.is_active })
      .eq('id', service.id)
    setServices((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, is_active: !s.is_active } : s))
    )
  }

  return (
    <div className="md:h-full md:flex md:flex-col md:min-h-0 md:overflow-y-auto md:pr-1 space-y-4">
      <div className="flex-shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold text-ink">Ydelser</h1>
          <p className="text-sm text-gray-500 mt-1">
            Administrér ydelser, priser og hvem der kan udføre dem
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => {
              setShowAddForm(true)
              setAddForm(EMPTY_FORM)
              setAddErrors({})
            }}
            className="px-3 py-2 rounded-md text-sm font-medium bg-[#B08A3E] text-white hover:bg-[#8C6A28] transition-colors"
          >
            + Tilføj ydelse
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <p className="text-sm font-medium text-gray-900">Ny ydelse</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Navn</label>
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="Fx Skægtrim"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#B08A3E]/40"
              />
              {addErrors.name && <p className="text-xs text-red-600 mt-1">{addErrors.name}</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pris (kr)</label>
              <input
                type="number"
                inputMode="numeric"
                value={addForm.priceKr}
                onChange={(e) => setAddForm({ ...addForm, priceKr: e.target.value })}
                placeholder="200"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#B08A3E]/40"
              />
              {addErrors.priceKr && (
                <p className="text-xs text-red-600 mt-1">{addErrors.priceKr}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Varighed (min)</label>
              <input
                type="number"
                inputMode="numeric"
                value={addForm.duration}
                onChange={(e) => setAddForm({ ...addForm, duration: e.target.value })}
                placeholder="30"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#B08A3E]/40"
              />
              {addErrors.duration && (
                <p className="text-xs text-red-600 mt-1">{addErrors.duration}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={addService}
              disabled={saving}
              className="px-3 py-2 rounded-md text-sm font-medium bg-[#B08A3E] text-white hover:bg-[#8C6A28] transition-colors disabled:opacity-50"
            >
              {saving ? 'Gemmer…' : 'Tilføj'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setAddErrors({})
              }}
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Annullér
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Henter ydelser…</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-gray-500">Ingen ydelser endnu.</p>
      ) : (
        <div className="space-y-3">
          {services.map((service) => {
            const assigned = serviceBarbers.get(service.id) ?? new Set<string>()
            const priceOre = service.default_price_ore ?? service.price_ore
            const isEditing = editingId === service.id
            return (
              <div
                key={service.id}
                className={`bg-white rounded-lg border border-gray-200 p-4 ${
                  service.is_active ? '' : 'opacity-60'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Navn</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#B08A3E]/40"
                        />
                        {editErrors.name && (
                          <p className="text-xs text-red-600 mt-1">{editErrors.name}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Pris (kr)</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={editForm.priceKr}
                          onChange={(e) => setEditForm({ ...editForm, priceKr: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#B08A3E]/40"
                        />
                        {editErrors.priceKr && (
                          <p className="text-xs text-red-600 mt-1">{editErrors.priceKr}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Varighed (min)</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={editForm.duration}
                          onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#B08A3E]/40"
                        />
                        {editErrors.duration && (
                          <p className="text-xs text-red-600 mt-1">{editErrors.duration}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(service.id)}
                        disabled={saving}
                        className="px-3 py-2 rounded-md text-sm font-medium bg-[#B08A3E] text-white hover:bg-[#8C6A28] transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Gemmer…' : 'Gem'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        Annullér
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-semibold text-gray-900">
                            {service.name_da}
                          </h3>
                          <span
                            className={`text-[10px] font-semibold tracking-[0.08em] uppercase px-2 py-0.5 rounded-full ${
                              service.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {service.is_active ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {(priceOre / 100).toFixed(0)} kr · {service.duration_minutes} min
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => startEdit(service)}
                          className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
                        >
                          Rediger
                        </button>
                        <button
                          onClick={() => toggleActive(service)}
                          className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
                        >
                          {service.is_active ? 'Deaktivér' : 'Aktivér'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-2">Frisører der kan udføre ydelsen</p>
                      {barbers.length === 0 ? (
                        <p className="text-xs text-gray-400">Ingen aktive frisører.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {barbers.map((b) => {
                            const isAssigned = assigned.has(b.id)
                            return (
                              <button
                                key={b.id}
                                onClick={() =>
                                  service.is_active && toggleAssignment(service.id, b.id)
                                }
                                disabled={!service.is_active}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                  isAssigned
                                    ? 'bg-[#B08A3E]/15 text-[#8C6A28] border border-[#B08A3E]/30'
                                    : 'border border-gray-300 text-gray-500 hover:border-gray-400'
                                } ${service.is_active ? '' : 'cursor-not-allowed'}`}
                              >
                                {b.display_name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

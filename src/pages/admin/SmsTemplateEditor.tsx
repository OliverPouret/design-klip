import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

// Mirror api/_lib/templates.ts FALLBACK_TEMPLATES — kept in sync manually.
// "Gendan original" wants the canonical default to revert to, regardless of
// what's currently in the DB.
const FALLBACK_TEMPLATES: Record<string, string> = {
  confirmation:
    'Hej {customer_first_name}, din {service} hos {barber_name} er {date} {time}. {address}. Afbestil: {cancel_link}. Vi ses!',
  reminder_24h:
    'Hej {customer_first_name}, husk din tid hos {barber_name} i morgen {time}. Afbestil: {cancel_link}. Vi ses!',
  customer_cancelled:
    'Hej {customer_first_name}, din tid {date} {time} er afbestilt. Velkommen tilbage. Book ny tid: {rebook_link}',
  shop_cancelled:
    'Hej {customer_first_name}, vi må desværre aflyse din tid {date} {time}. Beklager besværet. Book ny tid: {rebook_link}',
}

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  confirmation: 'Sendes umiddelbart efter en booking er oprettet.',
  reminder_24h: 'Sendes automatisk 24 timer før kundens tid.',
  customer_cancelled: 'Sendes når kunden selv aflyser via SMS-link.',
  shop_cancelled: 'Sendes når salonen aflyser en kundes tid.',
}

const ALL_VARIABLES = [
  'customer_first_name',
  'customer_name',
  'barber_name',
  'service',
  'date',
  'time',
  'address',
  'cancel_link',
  'shop_name',
  'shop_phone',
  'rebook_link',
] as const

type VariableName = (typeof ALL_VARIABLES)[number]

const VARIABLES_BY_TEMPLATE: Record<string, readonly VariableName[]> = {
  confirmation: ['customer_name', 'customer_first_name', 'barber_name', 'service', 'date', 'time', 'address', 'cancel_link', 'shop_name', 'shop_phone'],
  reminder_24h: ['customer_name', 'customer_first_name', 'barber_name', 'service', 'date', 'time', 'address', 'cancel_link', 'shop_name', 'shop_phone'],
  customer_cancelled: ['customer_name', 'customer_first_name', 'barber_name', 'date', 'time', 'rebook_link', 'shop_name', 'shop_phone'],
  shop_cancelled: ['customer_name', 'customer_first_name', 'barber_name', 'date', 'time', 'rebook_link', 'shop_name', 'shop_phone'],
}

// Per-template "recommended" variable groups. A group is satisfied when at
// least one of its variables appears in the body. Multi-element groups model
// "either {customer_first_name} or {customer_name} is acceptable". Missing
// groups produce a yellow warning but never block save — the shop owner
// retains full template control.
const RECOMMENDED_VARIABLES: Record<string, readonly (readonly VariableName[])[]> = {
  confirmation: [
    ['customer_first_name', 'customer_name'],
    ['barber_name'],
    ['date'],
    ['time'],
    ['cancel_link'],
  ],
  reminder_24h: [
    ['customer_first_name', 'customer_name'],
    ['time'],
    ['barber_name'],
    ['cancel_link'],
  ],
  customer_cancelled: [
    ['customer_first_name', 'customer_name'],
    ['date'],
    ['time'],
    ['rebook_link'],
  ],
  shop_cancelled: [
    ['customer_first_name', 'customer_name'],
    ['date'],
    ['time'],
    ['rebook_link'],
  ],
}

// Short Danish "why this is recommended" line per variable. Used for the
// yellow warning shown when a recommended variable is missing.
const RECOMMENDED_REASONS: Record<VariableName, string> = {
  customer_first_name: "Et navn gør beskeden personlig. Uden navn ligner SMS'en spam.",
  customer_name: "Et navn gør beskeden personlig. Uden navn ligner SMS'en spam.",
  barber_name: 'Kunden ved ikke hvilken frisør tiden er hos.',
  service: 'Kunden ved ikke hvilken behandling de har booket.',
  date: "Kunden ved ikke hvilken dag tiden er. SMS'en bliver ubrugelig.",
  time: "Kunden ved ikke hvornår tiden er. SMS'en bliver ubrugelig.",
  address: 'Kunden ved ikke hvor de skal hen.',
  cancel_link:
    'Kunden kan kun aflyse ved at ringe. Det kan øge antallet af no-shows hvis kunden glemmer.',
  rebook_link: 'Kunden kan ikke nemt booke en ny tid efter aflysning.',
  shop_name: 'Beskeden mangler afsenderkontekst.',
  shop_phone: "Kunden har ingen kontaktinfo i SMS'en.",
}

const VARIABLE_HELP: Record<VariableName, string> = {
  customer_name: "Kundens navn, fx 'Mette Jensen'",
  customer_first_name:
    "Kundens fornavn (alt før første mellemrum), fx 'Oliver' fra 'Oliver Pouret'. Bruges for en mere personlig hilsen.",
  barber_name: "Barberens navn, fx 'Hamada'",
  service: "Den valgte ydelse, fx 'Herreklip'",
  date: "Datoen for tiden, fx 'tirsdag d. 5. maj' (formatet sættes automatisk)",
  time: "Tidspunktet, fx 'kl. 09:30' (formatet sættes automatisk)",
  address: 'Salonens adresse fra Indstillinger',
  cancel_link: 'Et personligt link kunden kan bruge til at aflyse',
  shop_name: 'Salonens navn fra Indstillinger',
  shop_phone: 'Salonens telefonnummer fra Indstillinger',
  rebook_link: 'Et link kunden kan bruge til at booke en ny tid',
}

// Sample data for the live preview. Date is a fixed Tuesday so the
// preview output matches the seeded example in the spec.
const SAMPLE_DATE = new Date('2026-05-05T09:30:00+02:00')

const WEEKDAY_FULL = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
const MONTH_FULL = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
]
function formatDateDanish(d: Date): string {
  return `${WEEKDAY_FULL[d.getDay()]} d. ${d.getDate()}. ${MONTH_FULL[d.getMonth()]}`
}
function formatTimeDanish(d: Date): string {
  return `kl. ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const SAMPLE_VARS: Record<VariableName, string> = {
  customer_name: 'Mette Jensen',
  customer_first_name: 'Mette',
  barber_name: 'Hamada',
  service: 'Herreklip',
  date: formatDateDanish(SAMPLE_DATE),
  time: formatTimeDanish(SAMPLE_DATE),
  address: 'Holbækvej 39, 4000 Roskilde',
  cancel_link: 'design-klip.vercel.app/a/x9k2mp4t',
  shop_name: 'Design Klip',
  shop_phone: '+45 46 35 93 48',
  rebook_link: 'design-klip.vercel.app/bestil',
}

function interpolate(body: string): string {
  let result = body
  for (const key of ALL_VARIABLES) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), SAMPLE_VARS[key])
  }
  return result
}

function extractVariables(body: string): Set<VariableName> {
  const set = new Set<VariableName>()
  for (const key of ALL_VARIABLES) {
    if (new RegExp(`\\{${key}\\}`).test(body)) set.add(key)
  }
  return set
}

// Encoding detection: any non-ASCII char (including æ/ø/å) triggers UCS-2,
// which halves the per-segment limit. This is a conservative match for the
// GSM-7 default alphabet most carriers expect.
function detectUcs2(body: string): boolean {
  return /[^\x00-\x7F]/.test(body)
}

function countSegments(body: string): { chars: number; segments: number; isUcs2: boolean } {
  const isUcs2 = detectUcs2(body)
  const chars = [...body].length
  const single = isUcs2 ? 70 : 160
  const multi = isUcs2 ? 67 : 153
  const segments = chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi)
  return { chars, segments, isUcs2 }
}

interface SmsTemplate {
  id: string
  name_da: string
  body_da: string
  enabled: boolean
}

export function SmsTemplateEditor() {
  const { id } = useParams<{ id: string }>()
  const { role } = useAuth()
  const isSuperAdmin = role === 'super_admin'

  const editorRef = useRef<PillEditorHandle | null>(null)
  const [template, setTemplate] = useState<SmsTemplate | null>(null)
  const [body, setBody] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [originalBody, setOriginalBody] = useState('')
  const [originalEnabled, setOriginalEnabled] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [pendingDisableConfirm, setPendingDisableConfirm] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    supabase
      .from('sms_templates')
      .select('id, name_da, body_da, enabled')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setLoadError(error?.message ?? 'Skabelon ikke fundet')
          return
        }
        const row = data as SmsTemplate
        setTemplate(row)
        setBody(row.body_da)
        setEnabled(row.enabled)
        setOriginalBody(row.body_da)
        setOriginalEnabled(row.enabled)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const allowed = useMemo<readonly VariableName[]>(
    () => (id ? (VARIABLES_BY_TEMPLATE[id] ?? []) : []),
    [id],
  )
  const recommended = useMemo<readonly (readonly VariableName[])[]>(
    () => (id ? (RECOMMENDED_VARIABLES[id] ?? []) : []),
    [id],
  )
  const present = useMemo(() => extractVariables(body), [body])
  const unused = useMemo(
    () => allowed.filter((v) => !present.has(v)),
    [allowed, present],
  )
  // A recommended group is satisfied if any of its alternatives is in the body.
  const missingRecommended = useMemo(
    () => recommended.filter((group) => !group.some((v) => present.has(v))),
    [recommended, present],
  )

  const { chars, segments, isUcs2 } = useMemo(() => countSegments(body), [body])
  const previewBody = useMemo(() => interpolate(body), [body])

  const isDirty = body !== originalBody || enabled !== originalEnabled
  const canSave = isSuperAdmin && isDirty && !saving

  if (!id) return null

  if (loadError) {
    return (
      <div className="max-w-4xl">
        <p className="text-sm text-error">Kunne ikke hente skabelon: {loadError}</p>
        <Link to="/admin/sms" className="text-sm text-accent underline">
          Tilbage til oversigt
        </Link>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="max-w-4xl">
        <p className="text-sm text-ink-muted">Henter skabelon…</p>
      </div>
    )
  }

  const handleInsertVariable = (name: VariableName) => {
    editorRef.current?.insertVariable(name)
  }

  const handleRestoreConfirm = () => {
    const fallback = FALLBACK_TEMPLATES[id]
    if (fallback) setBody(fallback)
    setShowRestoreConfirm(false)
  }

  const handleEnabledToggle = (next: boolean) => {
    if (!next && (id === 'confirmation' || id === 'reminder_24h')) {
      setPendingDisableConfirm(true)
      return
    }
    setEnabled(next)
  }

  const confirmDisable = () => {
    setEnabled(false)
    setPendingDisableConfirm(false)
  }

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    const updatedBy = userData.user?.id ?? null
    const { error } = await supabase
      .from('sms_templates')
      .update({
        body_da: body,
        enabled,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    setSaving(false)
    if (error) {
      setToast(`Kunne ikke gemme: ${error.message}`)
      return
    }
    setOriginalBody(body)
    setOriginalEnabled(enabled)
    setToast('Skabelonen er gemt. Ændringer træder i kraft med det samme.')
  }

  return (
    <div className="max-w-6xl space-y-6">
      <header className="flex flex-col gap-2">
        <Link to="/admin/sms" className="text-[13px] text-accent hover:underline self-start">
          ← Tilbage til oversigt
        </Link>
        <h2 className="font-serif text-display-md text-ink">Rediger: {template.name_da}</h2>
        <p className="text-sm text-ink-muted leading-relaxed">
          {TEMPLATE_DESCRIPTIONS[id]}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Editor column */}
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
            {unused.length > 0 && (
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
                  Indsæt variabel
                </p>
                <div className="flex flex-wrap gap-2">
                  {unused.map((v) => (
                    <button
                      key={v}
                      type="button"
                      // Prevent the chip from stealing focus from the
                      // contenteditable so the live cursor position survives.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleInsertVariable(v)}
                      className="inline-flex items-center text-[13px] font-medium px-3 py-1 rounded-full border bg-white"
                      style={{ borderColor: '#B08A3E', color: '#B08A3E' }}
                    >
                      + {v}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelp(true)}
                  className="text-[12px] text-accent hover:underline mt-2"
                >
                  Hvad betyder de?
                </button>
              </div>
            )}

            <PillEditor ref={editorRef} body={body} onChange={setBody} disabled={!isSuperAdmin} />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
              <span className="text-ink-muted">
                {chars} tegn · {segments} SMS-besked{segments === 1 ? '' : 'er'}
              </span>
              {isUcs2 && (
                <span style={{ color: '#B8761F' }}>
                  Indeholder æ/ø/å — hver SMS kan kun rumme 70 tegn (i stedet for 160).
                </span>
              )}
            </div>

            {missingRecommended.length > 0 && (
              <div
                role="alert"
                className="flex gap-2 border-l-4 border-warning bg-warning-bg p-3 rounded-r-lg"
              >
                <svg
                  className="shrink-0 mt-0.5"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#B8761F"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
                <div className="text-[13px] leading-relaxed" style={{ color: '#B8761F' }}>
                  <p className="font-semibold mb-1">Anbefalede variabler mangler</p>
                  <ul className="space-y-1">
                    {missingRecommended.map((group, i) => {
                      const label =
                        group.length === 1
                          ? `{${group[0]}}`
                          : group.map((v) => `{${v}}`).join(' eller ')
                      return (
                        <li key={i}>
                          • {label} — {RECOMMENDED_REASONS[group[0]]}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowRestoreConfirm(true)}
                disabled={!isSuperAdmin}
                className="text-[13px] px-4 py-2 rounded-full border border-accent text-accent hover:bg-accent-subtle transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Gendan original
              </button>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={enabled}
                disabled={!isSuperAdmin}
                onChange={(e) => handleEnabledToggle(e.target.checked)}
                className="mt-1 w-4 h-4 accent-accent disabled:cursor-not-allowed"
              />
              <span className="text-sm text-ink leading-snug">
                <span className="font-semibold">Aktiveret</span>
                <span className="block text-ink-muted text-[12px] mt-0.5">
                  Når slået fra, sendes denne SMS ikke. Hændelsen logges som
                  "template_disabled".
                </span>
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              title={
                !isSuperAdmin
                  ? 'Kun super admin kan redigere SMS-skabeloner.'
                  : !isDirty
                    ? 'Ingen ændringer at gemme.'
                    : ''
              }
              className="rounded-full bg-accent text-white px-6 py-3 text-[14px] font-semibold hover:bg-accent-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Gemmer…' : 'Gem ændringer'}
            </button>
            {!isSuperAdmin && (
              <span className="text-[12px] text-ink-muted">
                Kun super admin kan redigere SMS-skabeloner.
              </span>
            )}
          </div>
        </div>

        {/* Preview column */}
        <aside className="space-y-3">
          <p className="font-serif-sc text-eyebrow text-accent">Forhåndsvisning</p>
          <div className="bg-surface border border-border rounded-2xl p-6">
            <p className="text-[12px] font-semibold text-ink-muted mb-2">DesignKlip</p>
            <div
              className="rounded-2xl text-white px-4 py-3 max-w-[280px] text-[15px] leading-relaxed whitespace-pre-wrap break-words"
              style={{ backgroundColor: '#26272B' }}
            >
              {previewBody || <span className="opacity-50">Skabelonen er tom.</span>}
            </div>
            <p className="text-[12px] text-ink-muted mt-3">
              {chars} tegn · {segments} SMS-besked{segments === 1 ? '' : 'er'}
            </p>
          </div>
        </aside>
      </div>

      {showRestoreConfirm && (
        <ConfirmDialog
          title="Gendan original?"
          body="Er du sikker på at du vil gendanne den oprindelige tekst? Dine ændringer går tabt."
          confirmLabel="Ja, gendan"
          cancelLabel="Annuller"
          onConfirm={handleRestoreConfirm}
          onCancel={() => setShowRestoreConfirm(false)}
        />
      )}

      {pendingDisableConfirm && (
        <ConfirmDialog
          title="Slå skabelon fra?"
          body={
            id === 'confirmation'
              ? 'Hvis du slår dette fra, modtager kunderne ingen bekræftelse. Det kan øge antallet af no-shows.'
              : 'Hvis du slår dette fra, modtager kunderne ingen påmindelse. Det kan øge antallet af no-shows.'
          }
          confirmLabel="Slå fra alligevel"
          cancelLabel="Annuller"
          onConfirm={confirmDisable}
          onCancel={() => setPendingDisableConfirm(false)}
        />
      )}

      {showHelp && (
        <HelpDialog
          variables={allowed}
          onClose={() => setShowHelp(false)}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 max-w-sm rounded-xl border border-border bg-white shadow-lg px-4 py-3 text-[13px] text-ink z-50"
        >
          {toast}
        </div>
      )}
    </div>
  )
}

interface PillEditorProps {
  body: string
  onChange: (next: string) => void
  disabled?: boolean
}

export interface PillEditorHandle {
  insertVariable: (name: string) => void
}

interface Segment {
  type: 'text' | 'pill'
  value: string
}

function parseBody(body: string): Segment[] {
  const segments: Segment[] = []
  const re = /\{([a-z_]+)\}/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: body.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'pill', value: match[1] })
    lastIndex = re.lastIndex
  }
  if (lastIndex < body.length) {
    segments.push({ type: 'text', value: body.slice(lastIndex) })
  }
  return segments
}

function serializeNode(root: HTMLElement): string {
  let out = ''
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? ''
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const pill = el.dataset.pill
      if (pill) {
        out += `{${pill}}`
      } else if (el.tagName === 'BR') {
        out += '\n'
      } else {
        // Generic element: recurse text only
        out += serializeNode(el)
      }
    }
  })
  return out
}

const PillEditor = forwardRef<PillEditorHandle, PillEditorProps>(function PillEditor(
  { body, onChange, disabled = false },
  externalRef,
) {
  const ref = useRef<HTMLDivElement>(null)
  // We treat the contenteditable as uncontrolled: re-render its DOM only when
  // `body` changes from the outside (insert variable, restore default), not on
  // every keystroke (which would reset the cursor).
  const lastSerialized = useRef(body)

  useEffect(() => {
    if (!ref.current) return
    if (body === lastSerialized.current) return
    renderInto(ref.current, body)
    lastSerialized.current = body
  }, [body])

  // Initial render
  useEffect(() => {
    if (!ref.current) return
    renderInto(ref.current, body)
    lastSerialized.current = body
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(externalRef, () => ({
    insertVariable: (name: string) => {
      const host = ref.current
      if (!host || disabled) return

      // Pick an insertion range. Prefer the live selection if it sits inside
      // the editor; otherwise fall back to the end of the editor (this covers
      // the case where the user has not yet clicked into the body).
      const sel = window.getSelection()
      let range: Range | null = null
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0)
        if (host.contains(r.startContainer)) {
          range = r
        }
      }

      const pill = createPill(name)
      if (range) {
        range.deleteContents()
        range.insertNode(pill)
      } else {
        host.appendChild(pill)
      }

      // Ensure there is a text node after the pill so the cursor can land
      // outside it; without this the caret can get stuck inside an adjacent
      // contenteditable=false span on some browsers.
      const trailing = pill.nextSibling
      let textNode: Text
      if (trailing && trailing.nodeType === Node.TEXT_NODE) {
        textNode = trailing as Text
      } else {
        textNode = document.createTextNode('')
        pill.parentNode?.insertBefore(textNode, pill.nextSibling)
      }

      host.focus()
      const newRange = document.createRange()
      newRange.setStart(textNode, 0)
      newRange.setEnd(textNode, 0)
      const newSel = window.getSelection()
      newSel?.removeAllRanges()
      newSel?.addRange(newRange)

      // Sync state. Setting lastSerialized first means the body-change effect
      // above will short-circuit and not re-render the DOM (which would reset
      // the cursor we just placed).
      const next = serializeNode(host)
      lastSerialized.current = next
      onChange(next)
    },
  }))

  const handleInput = () => {
    if (!ref.current) return
    const next = serializeNode(ref.current)
    lastSerialized.current = next
    onChange(next)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      e.preventDefault()
      return
    }
    if (e.key !== 'Backspace' && e.key !== 'Delete') return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (!range.collapsed) return

    const node = range.startContainer
    const offset = range.startOffset

    if (e.key === 'Backspace') {
      // At the start of a text node — check the previous sibling for a pill.
      let prev: ChildNode | null = null
      if (node.nodeType === Node.TEXT_NODE && offset === 0) {
        prev = node.previousSibling
      } else if (node.nodeType === Node.ELEMENT_NODE && offset === 0) {
        // Cursor placed before the first child; nothing to delete here.
        return
      }
      // Skip empty intermediate text nodes
      while (prev && prev.nodeType === Node.TEXT_NODE && (prev.textContent ?? '') === '') {
        prev = prev.previousSibling
      }
      if (prev && prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).dataset.pill) {
        e.preventDefault()
        prev.parentNode?.removeChild(prev)
        if (ref.current) {
          const next = serializeNode(ref.current)
          lastSerialized.current = next
          onChange(next)
        }
      }
    } else if (e.key === 'Delete') {
      // Cursor at end of text node, with a pill as next sibling.
      let next: ChildNode | null = null
      if (node.nodeType === Node.TEXT_NODE && offset === (node.textContent?.length ?? 0)) {
        next = node.nextSibling
      }
      while (next && next.nodeType === Node.TEXT_NODE && (next.textContent ?? '') === '') {
        next = next.nextSibling
      }
      if (next && next.nodeType === Node.ELEMENT_NODE && (next as HTMLElement).dataset.pill) {
        e.preventDefault()
        next.parentNode?.removeChild(next)
        if (ref.current) {
          const serialized = serializeNode(ref.current)
          lastSerialized.current = serialized
          onChange(serialized)
        }
      }
    }
  }

  return (
    <div
      ref={ref}
      contentEditable={!disabled}
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      className="min-h-[120px] w-full rounded-lg border border-border bg-white px-4 py-3 text-[14px] leading-relaxed text-ink focus:outline-none focus:border-accent whitespace-pre-wrap break-words font-sans"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      aria-label="SMS-skabelon tekstfelt"
    />
  )
})

function createPill(name: string): HTMLSpanElement {
  const pill = document.createElement('span')
  pill.dataset.pill = name
  pill.contentEditable = 'false'
  pill.textContent = name
  pill.setAttribute('data-pill', name)
  pill.style.display = 'inline-block'
  pill.style.padding = '2px 8px'
  pill.style.margin = '0 2px'
  pill.style.borderRadius = '9999px'
  pill.style.border = '1px solid #B08A3E'
  pill.style.color = '#B08A3E'
  pill.style.background = '#FFFFFF'
  pill.style.fontFamily = 'Inter, system-ui, sans-serif'
  pill.style.fontWeight = '500'
  pill.style.fontSize = '13px'
  pill.style.userSelect = 'none'
  return pill
}

function renderInto(host: HTMLElement, body: string) {
  // Replace children with parsed segments. Text segments become text nodes,
  // pill segments become contenteditable=false spans.
  while (host.firstChild) host.removeChild(host.firstChild)
  const segments = parseBody(body)
  for (const seg of segments) {
    if (seg.type === 'text') {
      host.appendChild(document.createTextNode(seg.value))
    } else {
      host.appendChild(createPill(seg.value))
    }
  }
  // Trailing text node ensures cursor can be placed after the last pill.
  if (segments.length === 0 || segments[segments.length - 1].type === 'pill') {
    host.appendChild(document.createTextNode(''))
  }
}

interface ConfirmDialogProps {
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(26,26,26,0.55)' }}
    >
      <div className="bg-white rounded-2xl border border-border shadow-xl max-w-md w-full p-6 space-y-4">
        <h3 className="font-serif text-[22px] text-ink">{title}</h3>
        <p className="text-sm text-ink-muted leading-relaxed">{body}</p>
        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-[13px] px-4 py-2 rounded-full border border-border text-ink hover:bg-surface transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="text-[13px] px-5 py-2 rounded-full bg-accent text-white font-semibold hover:bg-accent-deep transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function HelpDialog({ variables, onClose }: { variables: readonly VariableName[]; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6"
      style={{ backgroundColor: 'rgba(26,26,26,0.55)' }}
    >
      <div className="bg-white rounded-2xl border border-border shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <h3 className="font-serif text-[22px] text-ink">Variabler</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Luk"
            className="text-ink-muted hover:text-ink text-xl leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-ink-muted leading-relaxed">
          Alle variabler er valgfrie. De anbefalede gør SMS&apos;en mere brugbar, men du kan
          tilpasse skabelonen som du vil.
        </p>
        <ul className="space-y-3">
          {variables.map((v) => (
            <li key={v} className="text-sm text-ink leading-snug">
              <span
                className="inline-block px-2 py-0.5 rounded-full border text-[12px] mr-2"
                style={{ borderColor: '#B08A3E', color: '#B08A3E' }}
              >
                {v}
              </span>
              <span className="text-ink-muted">{VARIABLE_HELP[v]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

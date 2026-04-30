import { useState } from 'react'

export function InsightsPage() {
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as { insights?: string }
      if (data.insights) {
        setInsights(data.insights)
      } else {
        setError('Kunne ikke generere overblik. Prøv igen.')
      }
    } catch {
      setError('Der opstod en fejl. Prøv igen.')
    }
    setLoading(false)
  }

  const renderInsights = (text: string) => {
    return text.split('\n').map((line, i) => {
      const isBold = /^\*\*(.+?)\*\*/.test(line)
      const cleaned = line.replace(/\*\*/g, '')
      return (
        <p
          key={i}
          className={`${
            isBold ? 'font-medium text-gray-900 mt-4 first:mt-0' : 'text-gray-600'
          } text-sm leading-relaxed`}
        >
          {cleaned}
        </p>
      )
    })
  }

  return (
    <div className="md:h-full md:flex md:flex-col md:min-h-0 md:overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full py-8 px-4">
        {/* Header card */}
        <div className="bg-white rounded-lg border border-gray-200 p-8 mb-6 text-center">
          <h1 className="font-serif text-2xl text-gray-900 mb-3">Forretningsoverblik</h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-md mx-auto">
            Få et AI-genereret overblik over din forretning — travleste dage, populære ydelser,
            tendenser og forslag til forbedringer. Baseret på de seneste 6 måneders bookingdata.
          </p>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-8 py-3 bg-[#B08A3E] hover:bg-[#8C6A28] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? 'Analyserer bookingdata…' : insights ? 'Opdatér overblik' : 'Generér overblik'}
          </button>

          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        </div>

        {/* Results card */}
        {insights && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="border-l-2 border-[#B08A3E] pl-4">{renderInsights(insights)}</div>
          </div>
        )}

        {/* Empty state */}
        {!insights && !loading && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400">
                <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" />
              </svg>
            </div>
            <p className="text-sm text-gray-400">
              Tryk på "Generér overblik" for at analysere dine bookingdata
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

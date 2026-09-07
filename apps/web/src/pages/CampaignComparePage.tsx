import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Download } from 'lucide-react'
import api from '../api/client'
import { PageLoader } from '../components/ui/Spinner'
import { useToastStore } from '../stores/toast.store'

interface ComparisonData {
  id: string
  name: string
  subject: string
  sent_date: string | null
  total_recipients: number
  sent: number
  opened: number
  clicked: number
  bounced: number
  open_rate: number
  click_rate: number
  bounce_rate: number
}

function rateColor(type: 'open' | 'click' | 'bounce', value: number): string {
  if (type === 'bounce') {
    if (value <= 2) return 'text-green-600 bg-green-50'
    if (value <= 5) return 'text-amber-600 bg-amber-50'
    return 'text-red-600 bg-red-50'
  }
  if (type === 'open') {
    if (value >= 20) return 'text-green-600 bg-green-50'
    if (value >= 10) return 'text-amber-600 bg-amber-50'
    return 'text-red-600 bg-red-50'
  }
  // click
  if (value >= 3) return 'text-green-600 bg-green-50'
  if (value >= 1) return 'text-amber-600 bg-amber-50'
  return 'text-red-600 bg-red-50'
}

function BarViz({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex items-end gap-3 h-24 mt-2">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs text-gray-500 font-medium">{v.toLocaleString()}</span>
          <motion.div
            className={`w-full rounded-t ${color}`}
            initial={{ height: 0 }}
            animate={{ height: max > 0 ? `${(v / max) * 100}%` : '0%' }}
            transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
            style={{ minHeight: v > 0 ? 4 : 0 }}
          />
        </div>
      ))}
    </div>
  )
}

export default function CampaignComparePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const addToast = useToastStore((s) => s.addToast)

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ComparisonData[]>([])

  const ids = searchParams.get('ids') || ''

  useEffect(() => {
    if (!ids) {
      setLoading(false)
      return
    }
    setLoading(true)
    api.get('/analytics/compare', { params: { ids } })
      .then(({ data: res }) => setData(res.data))
      .catch(() => addToast('Failed to load comparison data', 'error'))
      .finally(() => setLoading(false))
  }, [ids, addToast])

  const handleExportCSV = () => {
    if (data.length === 0) return
    const headers = ['Metric', ...data.map((d) => d.name || d.subject)]
    const rows = [
      ['Sent', ...data.map((d) => String(d.sent))],
      ['Opened', ...data.map((d) => String(d.opened))],
      ['Open Rate (%)', ...data.map((d) => String(d.open_rate))],
      ['Clicked', ...data.map((d) => String(d.clicked))],
      ['Click Rate (%)', ...data.map((d) => String(d.click_rate))],
      ['Bounced', ...data.map((d) => String(d.bounced))],
      ['Bounce Rate (%)', ...data.map((d) => String(d.bounce_rate))],
      ['Total Recipients', ...data.map((d) => String(d.total_recipients))],
    ]
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'campaign-comparison.csv'
    a.click()
    URL.revokeObjectURL(url)
    addToast('CSV exported', 'success')
  }

  if (loading) return <PageLoader />

  if (!ids || data.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">No campaigns to compare. Select 2-5 campaigns from the campaigns page.</p>
        <button onClick={() => navigate('/campaigns')} className="mt-4 text-primary-600 hover:underline">
          Back to Campaigns
        </button>
      </div>
    )
  }

  const metrics: { label: string; key: keyof ComparisonData; rateType?: 'open' | 'click' | 'bounce' }[] = [
    { label: 'Sent', key: 'sent' },
    { label: 'Opened', key: 'opened' },
    { label: 'Open Rate', key: 'open_rate', rateType: 'open' },
    { label: 'Clicked', key: 'clicked' },
    { label: 'Click Rate', key: 'click_rate', rateType: 'click' },
    { label: 'Bounced', key: 'bounced' },
    { label: 'Bounce Rate', key: 'bounce_rate', rateType: 'bounce' },
  ]

  const isRateRow = (key: string) => key.endsWith('_rate')

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <button
          onClick={() => navigate('/campaigns')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Campaigns
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Campaign Comparison</h1>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </motion.div>

      {/* Comparison Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="bg-white rounded-xl shadow-sm overflow-hidden mb-8"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-4 font-semibold text-gray-700 w-40">Metric</th>
                {data.map((d) => (
                  <th key={d.id} className="text-center px-6 py-4 font-semibold text-gray-700 min-w-[160px]">
                    <div className="truncate max-w-[200px] mx-auto" title={d.name || d.subject}>
                      {d.name || d.subject}
                    </div>
                    {d.sent_date && (
                      <div className="text-xs text-gray-400 font-normal mt-0.5">
                        {new Date(d.sent_date).toLocaleDateString()}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, i) => (
                <tr key={m.key} className={`border-b last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-6 py-3 font-medium text-gray-700">{m.label}</td>
                  {data.map((d) => {
                    const val = d[m.key] as number
                    const isRate = isRateRow(m.key)
                    const colorClass = m.rateType && isRate ? rateColor(m.rateType, val) : ''
                    return (
                      <td key={d.id} className="px-6 py-3 text-center">
                        {isRate ? (
                          <span className={`inline-block px-2 py-0.5 rounded text-sm font-medium ${colorClass}`}>
                            {val}%
                          </span>
                        ) : (
                          <span className="font-medium">{val.toLocaleString()}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Bar Chart Visualizations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="bg-white rounded-xl shadow-sm p-6"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Open Rate (%)</h3>
          <BarViz values={data.map((d) => d.open_rate)} color="bg-amber-500" />
          <div className="flex gap-3 mt-2">
            {data.map((d) => (
              <div key={d.id} className="flex-1 text-center">
                <span className="text-xs text-gray-400 truncate block" title={d.name}>{(d.name || d.subject).slice(0, 12)}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="bg-white rounded-xl shadow-sm p-6"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Click Rate (%)</h3>
          <BarViz values={data.map((d) => d.click_rate)} color="bg-green-500" />
          <div className="flex gap-3 mt-2">
            {data.map((d) => (
              <div key={d.id} className="flex-1 text-center">
                <span className="text-xs text-gray-400 truncate block" title={d.name}>{(d.name || d.subject).slice(0, 12)}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="bg-white rounded-xl shadow-sm p-6"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Bounce Rate (%)</h3>
          <BarViz values={data.map((d) => d.bounce_rate)} color="bg-red-500" />
          <div className="flex gap-3 mt-2">
            {data.map((d) => (
              <div key={d.id} className="flex-1 text-center">
                <span className="text-xs text-gray-400 truncate block" title={d.name}>{(d.name || d.subject).slice(0, 12)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

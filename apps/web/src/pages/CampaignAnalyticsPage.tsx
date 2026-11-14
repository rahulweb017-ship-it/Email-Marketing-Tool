import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Send, Eye, MousePointerClick, AlertTriangle, UserMinus,
  ExternalLink, Monitor, Smartphone, Tablet, HelpCircle, Globe,
  ChevronLeft, ChevronRight, Filter, Flame, Info,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import api from '../api/client'
import Badge from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { useToastStore } from '../stores/toast.store'
import { useCountUp } from '../hooks/useCountUp'
import CampaignInsightsPanel from '../components/ai/CampaignInsightsPanel'
import type { CampaignInsights } from '../api/ai'

interface Campaign {
  id: string
  name: string
  subject: string
  state: string
  sent_date: string | null
  stat_total: number
  stat_sent: number
  stat_opened: number
  stat_clicked: number
  stat_bounced: number
  stat_unsubscribed: number
  ai_insights?: CampaignInsights | string | null
  ai_insights_at?: string | null
}

interface TimelinePoint {
  hour: string
  count: number
}

interface TrackedLink {
  id: string
  original_url: string
  click_count: number
}

interface DeviceBreakdown {
  device: string
  count: number
}

interface GeoBreakdown {
  country_code: string
  count: number
}

interface HeatmapLink {
  url: string
  click_count: number
  unique_clicks: number
}

interface HeatmapData {
  html: string
  links: HeatmapLink[]
  total_opens: number
}

interface Trace {
  id: string
  email: string
  first_name: string
  last_name: string
  trace_status: string
  sent_at: string | null
  first_open_at: string | null
  first_click_at: string | null
  bounced_at: string | null
}

interface TracesResponse {
  data: Trace[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

const stateVariant: Record<string, 'neutral' | 'warning' | 'info' | 'success' | 'danger'> = {
  draft: 'neutral',
  scheduled: 'info',
  in_queue: 'warning',
  sending: 'info',
  done: 'success',
  cancelled: 'danger',
}

const stateLabel: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  in_queue: 'Queued',
  sending: 'Sending',
  done: 'Sent',
  cancelled: 'Cancelled',
}

const deviceIcons: Record<string, typeof Monitor> = {
  Desktop: Monitor,
  Mobile: Smartphone,
  Tablet: Tablet,
  Unknown: HelpCircle,
}

const deviceColors: Record<string, string> = {
  Desktop: 'bg-blue-500',
  Mobile: 'bg-green-500',
  Tablet: 'bg-amber-500',
  Unknown: 'bg-gray-400',
}

const traceStatusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'sent', label: 'Sent' },
  { value: 'opened', label: 'Opened' },
  { value: 'clicked', label: 'Clicked' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'error', label: 'Error' },
]

function CountUpCard({ value, label, icon: Icon, color, rate, delay }: {
  value: number
  label: string
  icon: typeof Send
  color: string
  rate?: string
  delay: number
}) {
  const animated = useCountUp(value)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-white rounded-xl shadow-sm p-5"
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        {rate && (
          <span className="text-sm font-medium text-gray-500">{rate}</span>
        )}
      </div>
      <p className="text-2xl font-bold">{animated.toLocaleString()}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </motion.div>
  )
}

export default function CampaignAnalyticsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const addToast = useToastStore((s) => s.addToast)

  const [loading, setLoading] = useState(true)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [timeline, setTimeline] = useState<{ opens: TimelinePoint[]; clicks: TimelinePoint[] } | null>(null)
  const [links, setLinks] = useState<TrackedLink[]>([])
  const [devices, setDevices] = useState<DeviceBreakdown[]>([])
  const [geo, setGeo] = useState<GeoBreakdown[]>([])
  const [traces, setTraces] = useState<TracesResponse | null>(null)
  const [tracePage, setTracePage] = useState(1)
  const [traceFilter, setTraceFilter] = useState('')
  const [activeTab, setActiveTab] = useState<'analytics' | 'heatmap'>('analytics')
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null)
  const [heatmapLoading, setHeatmapLoading] = useState(false)

  const fetchCampaign = useCallback(async () => {
    if (!id) return
    try {
      const { data } = await api.get(`/campaigns/${id}`)
      setCampaign(data)
    } catch {
      addToast('Failed to load campaign', 'error')
    }
  }, [id, addToast])

  const fetchTimeline = useCallback(async () => {
    if (!id) return
    try {
      const { data } = await api.get(`/analytics/campaigns/${id}/timeline`)
      setTimeline(data)
    } catch {
      // Timeline data may not be available
    }
  }, [id])

  const fetchLinks = useCallback(async () => {
    if (!id) return
    try {
      const { data } = await api.get(`/analytics/campaigns/${id}/links`)
      setLinks(data.data)
    } catch {
      // Links may not be available
    }
  }, [id])

  const fetchDevices = useCallback(async () => {
    if (!id) return
    try {
      const { data } = await api.get(`/analytics/campaigns/${id}/devices`)
      setDevices(data.data)
    } catch {
      // Device data may not be available
    }
  }, [id])

  const fetchGeo = useCallback(async () => {
    if (!id) return
    try {
      const { data } = await api.get(`/analytics/campaigns/${id}/geo`)
      setGeo(data.data)
    } catch {
      // Geo data may not be available
    }
  }, [id])

  const fetchTraces = useCallback(async () => {
    if (!id) return
    try {
      const params: Record<string, string | number> = { page: tracePage, per_page: 20 }
      if (traceFilter) params.status = traceFilter
      const { data } = await api.get(`/analytics/campaigns/${id}/traces`, { params })
      setTraces(data)
    } catch {
      addToast('Failed to load recipient data', 'error')
    }
  }, [id, tracePage, traceFilter, addToast])

  const fetchHeatmap = useCallback(async () => {
    if (!id) return
    setHeatmapLoading(true)
    try {
      const { data } = await api.get(`/analytics/campaigns/${id}/heatmap`)
      setHeatmap(data)
    } catch {
      // Heatmap data may not be available
    } finally {
      setHeatmapLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (activeTab === 'heatmap' && !heatmap && !heatmapLoading) {
      fetchHeatmap()
    }
  }, [activeTab, heatmap, heatmapLoading, fetchHeatmap])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchCampaign(), fetchTimeline(), fetchLinks(), fetchDevices(), fetchGeo()])
      .finally(() => setLoading(false))
  }, [fetchCampaign, fetchTimeline, fetchLinks, fetchDevices, fetchGeo])

  useEffect(() => {
    fetchTraces()
  }, [fetchTraces])

  if (loading) return <PageLoader />
  if (!campaign) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Campaign not found</p>
        <button onClick={() => navigate('/campaigns')} className="mt-4 text-primary-600 hover:underline">
          Back to Campaigns
        </button>
      </div>
    )
  }

  const openRate = campaign.stat_sent > 0
    ? `${((campaign.stat_opened / campaign.stat_sent) * 100).toFixed(1)}%`
    : '0%'
  const clickRate = campaign.stat_sent > 0
    ? `${((campaign.stat_clicked / campaign.stat_sent) * 100).toFixed(1)}%`
    : '0%'

  // Merge timeline opens and clicks into unified chart data
  const chartData = (() => {
    if (!timeline) return []
    const map = new Map<string, { hour: string; label: string; opens: number; clicks: number }>()
    for (const pt of timeline.opens) {
      const key = pt.hour
      const label = new Date(pt.hour).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' })
      map.set(key, { hour: key, label, opens: pt.count, clicks: 0 })
    }
    for (const pt of timeline.clicks) {
      const key = pt.hour
      const existing = map.get(key)
      if (existing) {
        existing.clicks = pt.count
      } else {
        const label = new Date(pt.hour).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' })
        map.set(key, { hour: key, label, opens: 0, clicks: pt.count })
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(a.hour).getTime() - new Date(b.hour).getTime())
  })()

  const maxLinkClicks = links.length > 0 ? Math.max(...links.map((l) => l.click_count)) : 0
  const totalDeviceClicks = devices.reduce((sum, d) => sum + d.count, 0)
  const maxGeoCount = geo.length > 0 ? Math.max(...geo.map((g) => g.count)) : 0

  const traceStatusBadge = (status: string): 'neutral' | 'warning' | 'info' | 'success' | 'danger' => {
    switch (status) {
      case 'sent': return 'info'
      case 'opened': return 'success'
      case 'clicked': return 'success'
      case 'bounced': return 'danger'
      case 'error': return 'danger'
      default: return 'neutral'
    }
  }

  return (
    <div>
      {/* Header */}
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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{campaign.name || campaign.subject}</h1>
          <Badge variant={stateVariant[campaign.state] || 'neutral'}>
            {stateLabel[campaign.state] || campaign.state}
          </Badge>
        </div>
        {campaign.sent_date && (
          <p className="text-sm text-gray-500 mt-1">
            Sent on {new Date(campaign.sent_date).toLocaleString()}
          </p>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['analytics', 'heatmap'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="relative px-4 py-2 rounded-lg text-sm z-10"
          >
            {activeTab === tab && (
              <motion.div
                layoutId="analyticsTab"
                className="absolute inset-0 bg-primary-100 rounded-lg"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className={`relative z-10 flex items-center gap-1.5 ${activeTab === tab ? 'text-primary-700 font-medium' : 'text-gray-600 hover:text-gray-800'}`}>
              {tab === 'analytics' ? <><BarChart3Icon className="h-4 w-4" /> Analytics</> : <><Flame className="h-4 w-4" /> Heatmap</>}
            </span>
          </button>
        ))}
      </div>

      {activeTab === 'heatmap' ? (
        <HeatmapTab heatmap={heatmap} loading={heatmapLoading} />
      ) : (
      <>
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <CountUpCard value={campaign.stat_sent} label="Sent" icon={Send} color="bg-indigo-500" delay={0} />
        <CountUpCard value={campaign.stat_opened} label="Opened" icon={Eye} color="bg-amber-500" rate={openRate} delay={0.08} />
        <CountUpCard value={campaign.stat_clicked} label="Clicked" icon={MousePointerClick} color="bg-green-500" rate={clickRate} delay={0.16} />
        <CountUpCard value={campaign.stat_bounced} label="Bounced" icon={AlertTriangle} color="bg-red-500" delay={0.24} />
        <CountUpCard value={campaign.stat_unsubscribed} label="Unsubscribed" icon={UserMinus} color="bg-gray-500" delay={0.32} />
      </div>

      <CampaignInsightsPanel campaignId={campaign.id} initial={campaign.ai_insights} initialAt={campaign.ai_insights_at}
        canRun={(campaign.state === 'done' || campaign.state === 'sending') && campaign.stat_sent > 0} />

      {/* Timeline Chart */}
      {chartData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="bg-white rounded-xl shadow-sm p-6 mb-8"
        >
          <h2 className="text-lg font-semibold mb-4">Open &amp; Click Timeline (72h)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="opens" stroke="#f59e0b" strokeWidth={2} dot={false} name="Opens" />
                <Line type="monotone" dataKey="clicks" stroke="#22c55e" strokeWidth={2} dot={false} name="Clicks" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Top Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="bg-white rounded-xl shadow-sm p-6"
        >
          <h2 className="text-lg font-semibold mb-4">Top Links</h2>
          {links.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No tracked links</p>
          ) : (
            <div className="space-y-3">
              {links.slice(0, 10).map((link, i) => (
                <div key={link.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-gray-400 font-mono text-xs w-5 shrink-0">{i + 1}.</span>
                      <a
                        href={link.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline truncate"
                        title={link.original_url}
                      >
                        {link.original_url}
                      </a>
                      <ExternalLink className="h-3 w-3 text-gray-400 shrink-0" />
                    </div>
                    <span className="font-medium ml-3 shrink-0">{link.click_count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: maxLinkClicks > 0 ? `${(link.click_count / maxLinkClicks) * 100}%` : '0%' }}
                      transition={{ delay: 0.4 + i * 0.05, duration: 0.6 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Device Breakdown + Geo */}
        <div className="space-y-8">
          {/* Devices */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="bg-white rounded-xl shadow-sm p-6"
          >
            <h2 className="text-lg font-semibold mb-4">Device Breakdown</h2>
            {devices.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No device data available</p>
            ) : (
              <div className="space-y-3">
                {devices.map((d, i) => {
                  const Icon = deviceIcons[d.device] || HelpCircle
                  const color = deviceColors[d.device] || 'bg-gray-400'
                  const pct = totalDeviceClicks > 0 ? ((d.count / totalDeviceClicks) * 100).toFixed(1) : '0'
                  return (
                    <div key={d.device}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">{d.device}</span>
                        </div>
                        <span className="text-gray-500">{d.count} ({pct}%)</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full ${color} rounded-full`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.4 + i * 0.08, duration: 0.6 }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* Geographic Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="bg-white rounded-xl shadow-sm p-6"
          >
            <h2 className="text-lg font-semibold mb-4">
              <span className="flex items-center gap-2"><Globe className="h-5 w-5 text-gray-400" /> Geographic Breakdown</span>
            </h2>
            {geo.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No geographic data available</p>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {geo.map((g, i) => (
                  <div key={g.country_code}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{g.country_code}</span>
                      <span className="text-gray-500">{g.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-indigo-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: maxGeoCount > 0 ? `${(g.count / maxGeoCount) * 100}%` : '0%' }}
                        transition={{ delay: 0.45 + i * 0.04, duration: 0.5 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Per-Recipient Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="bg-white rounded-xl shadow-sm p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recipients</h2>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={traceFilter}
              onChange={(e) => { setTraceFilter(e.target.value); setTracePage(1); }}
              className="text-sm border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {traceStatusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {!traces || traces.data.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No recipients found</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 font-medium">Recipient</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Sent</th>
                    <th className="pb-3 font-medium">Opened</th>
                    <th className="pb-3 font-medium">Clicked</th>
                  </tr>
                </thead>
                <tbody>
                  {traces.data.map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3">
                        {t.first_name || t.last_name
                          ? `${t.first_name || ''} ${t.last_name || ''}`.trim()
                          : '-'}
                      </td>
                      <td className="py-3 text-gray-600">{t.email}</td>
                      <td className="py-3">
                        <Badge variant={traceStatusBadge(t.trace_status)}>
                          {t.trace_status}
                        </Badge>
                      </td>
                      <td className="py-3 text-gray-500">
                        {t.sent_at ? new Date(t.sent_at).toLocaleString() : '-'}
                      </td>
                      <td className="py-3 text-gray-500">
                        {t.first_open_at ? new Date(t.first_open_at).toLocaleString() : '-'}
                      </td>
                      <td className="py-3 text-gray-500">
                        {t.first_click_at ? new Date(t.first_click_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {traces.total_pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">
                  Page {traces.page} of {traces.total_pages} ({traces.total} total)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTracePage((p) => Math.max(1, p - 1))}
                    disabled={tracePage <= 1}
                    className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <button
                    onClick={() => setTracePage((p) => Math.min(traces.total_pages, p + 1))}
                    disabled={tracePage >= traces.total_pages}
                    className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
      </>
      )}
    </div>
  )
}

function BarChart3Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
    </svg>
  )
}

function getHeatColor(ratio: number): string {
  if (ratio >= 0.66) return 'bg-red-500'
  if (ratio >= 0.33) return 'bg-orange-500'
  return 'bg-yellow-500'
}

function getHeatTextColor(ratio: number): string {
  if (ratio >= 0.66) return 'text-red-600'
  if (ratio >= 0.33) return 'text-orange-600'
  return 'text-yellow-600'
}

function HeatmapTab({ heatmap, loading }: { heatmap: HeatmapData | null; loading: boolean }) {
  if (loading) return <PageLoader />

  if (!heatmap || !heatmap.html) {
    return (
      <div className="text-center py-16">
        <Flame className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No email HTML content available for heatmap visualization.</p>
      </div>
    )
  }

  const maxClicks = heatmap.links.length > 0 ? Math.max(...heatmap.links.map((l) => l.click_count)) : 0

  // Build the heatmap HTML: inject colored overlays on links
  const buildHeatmapHtml = () => {
    let html = heatmap.html
    for (const link of heatmap.links) {
      const ratio = maxClicks > 0 ? link.click_count / maxClicks : 0
      let borderColor = '#eab308' // yellow
      let bgColor = 'rgba(234, 179, 8, 0.15)'
      if (ratio >= 0.66) {
        borderColor = '#ef4444' // red
        bgColor = 'rgba(239, 68, 68, 0.15)'
      } else if (ratio >= 0.33) {
        borderColor = '#f97316' // orange
        bgColor = 'rgba(249, 115, 22, 0.15)'
      }
      // Escape special regex chars in URL
      const escapedUrl = link.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const linkRegex = new RegExp(`(href=["'])${escapedUrl}(["'])`, 'g')
      html = html.replace(linkRegex, `$1${link.url}$2 style="border: 3px solid ${borderColor}; background: ${bgColor}; padding: 2px 4px; border-radius: 4px; position: relative;" data-clicks="${link.click_count}"`)
    }
    return html
  }

  const iframeHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><style>body { margin: 0; padding: 16px; font-family: sans-serif; }</style></head>
    <body>${buildHeatmapHtml()}</body>
    </html>
  `

  return (
    <div>
      {/* Legend */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm p-4 mb-6"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Info className="h-4 w-4" />
            <span>Links in the email are color-coded by click intensity</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-yellow-500" />
              <span className="text-xs text-gray-600">Low clicks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-orange-500" />
              <span className="text-xs text-gray-600">Medium clicks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-red-500" />
              <span className="text-xs text-gray-600">High clicks</span>
            </div>
          </div>
          {heatmap.total_opens > 0 && (
            <div className="text-sm text-gray-500">
              Total unique opens: <span className="font-medium">{heatmap.total_opens.toLocaleString()}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Email Preview with Heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="bg-white rounded-xl shadow-sm overflow-hidden mb-8"
      >
        <div className="border-b px-6 py-3">
          <h2 className="text-lg font-semibold">Email Click Heatmap</h2>
        </div>
        <div className="p-4">
          <iframe
            srcDoc={iframeHtml}
            title="Click Heatmap"
            className="w-full border rounded-lg"
            style={{ minHeight: 500, height: 700 }}
            sandbox="allow-same-origin"
          />
        </div>
      </motion.div>

      {/* Link Performance Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="bg-white rounded-xl shadow-sm p-6"
      >
        <h2 className="text-lg font-semibold mb-4">Link Click Details</h2>
        {heatmap.links.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No tracked links found</p>
        ) : (
          <div className="space-y-3">
            {heatmap.links.map((link, i) => {
              const ratio = maxClicks > 0 ? link.click_count / maxClicks : 0
              const clickThroughRate = heatmap.total_opens > 0
                ? ((link.unique_clicks / heatmap.total_opens) * 100).toFixed(1)
                : '0.0'
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`w-3 h-3 rounded-full shrink-0 ${getHeatColor(ratio)}`} />
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`hover:underline truncate ${getHeatTextColor(ratio)}`}
                        title={link.url}
                      >
                        {link.url}
                      </a>
                      <ExternalLink className="h-3 w-3 text-gray-400 shrink-0" />
                    </div>
                    <div className="flex items-center gap-4 ml-3 shrink-0 text-sm">
                      <span className="text-gray-500">{link.unique_clicks} unique</span>
                      <span className="font-medium">{link.click_count} total</span>
                      <span className="text-gray-400">{clickThroughRate}% CTR</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${getHeatColor(ratio)}`}
                      initial={{ width: 0 }}
                      animate={{ width: maxClicks > 0 ? `${(link.click_count / maxClicks) * 100}%` : '0%' }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.6 }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Fuel, Wrench, Calendar, Shield, DollarSign,
  TrendingUp, Activity, AlertCircle, FileBadge2, CircleDot
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import StatCard from '@/components/shared/StatCard'
import { useSettings } from '@/hooks/useSettings'
import { useVehicles } from '@/hooks/useVehicles'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { DashboardSummary, ActivityEntry } from '@/types'

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  fuel: Fuel,
  maintenance: Wrench,
  insurance: Shield,
  note: Activity,
}

const ACTIVITY_COLORS: Record<string, string> = {
  fuel: 'text-blue-400',
  maintenance: 'text-amber-400',
  insurance: 'text-purple-400',
  note: 'text-green-400',
}

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const { settings } = useSettings()
  const { currentVehicleId, currentVehicle } = useVehicles()
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    window.api.dashboard.getSummary().then(s => {
      setSummary(s)
      setLoading(false)
    })
  }, [currentVehicleId])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const currency = settings.currency
  const unit = settings.distance_unit

  const nextServiceLabel = summary?.nextService
    ? summary.nextService.kmRemaining <= 0
      ? `Overdue by ${Math.abs(summary.nextService.kmRemaining)} ${unit}`
      : `In ${summary.nextService.kmRemaining} ${unit}`
    : 'No data'

  const renewalLabel = summary?.insuranceRenewal
    ? summary.insuranceRenewal.daysRemaining <= 0
      ? 'Expired'
      : `${summary.insuranceRenewal.daysRemaining} days`
    : 'No policies'

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {currentVehicle?.nickname ?? 'Dashboard'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {currentVehicle
            ? `${currentVehicle.year} ${currentVehicle.make} ${currentVehicle.model} · ${currentVehicle.current_odometer.toLocaleString()} ${unit}`
            : new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          title="Fuel This Month"
          value={formatCurrency(summary?.monthlyFuelCost ?? 0, currency)}
          icon={Fuel}
          iconClassName="bg-blue-500/10 text-blue-400"
        />
        <StatCard
          title="Avg Consumption"
          value={summary?.avgConsumption ? `${summary.avgConsumption} ${unit}/L` : 'N/A'}
          subtitle="Full tank fill-ups only"
          icon={TrendingUp}
          iconClassName="bg-green-500/10 text-green-400"
        />
        <StatCard
          title="Next Service"
          value={summary?.nextService?.name ?? 'All clear'}
          subtitle={nextServiceLabel}
          icon={Calendar}
          iconClassName={
            summary?.nextService && summary.nextService.kmRemaining <= 0
              ? 'bg-red-500/10 text-red-400'
              : 'bg-amber-500/10 text-amber-400'
          }
        />
        <StatCard
          title="Insurance Renewal"
          value={summary?.insuranceRenewal?.provider ?? 'No policies'}
          subtitle={renewalLabel}
          icon={Shield}
          iconClassName={
            summary?.insuranceRenewal && summary.insuranceRenewal.daysRemaining <= 30
              ? 'bg-red-500/10 text-red-400'
              : 'bg-purple-500/10 text-purple-400'
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Monthly Trend Chart */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Cost Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={summary?.monthlyTrend ?? []} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [formatCurrency(value, currency), '']}
                />
                <Legend />
                <Bar dataKey="fuel" name="Fuel" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="maintenance" name="Maintenance" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                <Bar dataKey="insurance" name="Insurance" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Total Cost */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lifetime Cost</p>
                  <p className="text-xl font-bold">{formatCurrency(summary?.totalCost ?? 0, currency)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!summary?.recentActivity.length && (
                <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
              )}
              {summary?.recentActivity.map((entry: ActivityEntry) => {
                const Icon = ACTIVITY_ICONS[entry.type] ?? Activity
                const colorClass = ACTIVITY_COLORS[entry.type] ?? 'text-foreground'
                return (
                  <div
                    key={`${entry.type}-${entry.id}`}
                    className="flex items-start gap-3 cursor-pointer hover:bg-accent/50 rounded-md p-1 -mx-1 transition-colors"
                    onClick={() => navigate(`/${entry.type === 'note' ? 'notes' : entry.type}`)}
                  >
                    <div className={`mt-0.5 shrink-0 ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                    </div>
                    {entry.amount !== undefined && entry.amount > 0 && (
                      <span className="text-sm font-medium shrink-0">
                        {formatCurrency(entry.amount, currency)}
                      </span>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        {(summary?.nextService?.kmRemaining !== undefined && summary.nextService.kmRemaining <= 500) && (
          <Card
            className="border-amber-500/30 bg-amber-500/5 cursor-pointer"
            onClick={() => navigate('/schedule')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {summary.nextService.kmRemaining <= 0
                    ? `Service overdue: ${summary.nextService.name}`
                    : `Service due soon: ${summary.nextService.name}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary.nextService.kmRemaining <= 0
                    ? `Overdue by ${Math.abs(summary.nextService.kmRemaining)} ${unit}`
                    : `Due in ${summary.nextService.kmRemaining} ${unit}`}
                </p>
              </div>
              <Badge
                variant={summary.nextService.kmRemaining <= 0 ? 'danger' : 'warning'}
                className="ml-auto"
              >
                {summary.nextService.kmRemaining <= 0 ? 'Overdue' : 'Due Soon'}
              </Badge>
            </CardContent>
          </Card>
        )}

        {summary?.upcomingDocument && summary.upcomingDocument.daysRemaining <= 30 && (
          <Card
            className="border-amber-500/30 bg-amber-500/5 cursor-pointer"
            onClick={() => navigate('/documents')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <FileBadge2 className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {summary.upcomingDocument.daysRemaining <= 0
                    ? `${summary.upcomingDocument.title} expired`
                    : `${summary.upcomingDocument.title} expires soon`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary.upcomingDocument.daysRemaining <= 0
                    ? `Expired ${Math.abs(summary.upcomingDocument.daysRemaining)} day(s) ago`
                    : `In ${summary.upcomingDocument.daysRemaining} day(s)`}
                </p>
              </div>
              <Badge
                variant={summary.upcomingDocument.daysRemaining <= 0 ? 'danger' : 'warning'}
                className="ml-auto"
              >
                {summary.upcomingDocument.daysRemaining <= 0 ? 'Expired' : 'Soon'}
              </Badge>
            </CardContent>
          </Card>
        )}

        {summary?.tireWarning && (
          <Card
            className="border-red-500/30 bg-red-500/5 cursor-pointer"
            onClick={() => navigate('/tires')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <CircleDot className="h-5 w-5 text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Tire warning</p>
                <p className="text-xs text-muted-foreground">{summary.tireWarning.reason}</p>
              </div>
              <Badge variant="danger" className="ml-auto">Action needed</Badge>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

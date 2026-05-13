import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency } from '@/lib/utils'
import type { ExpenseSummary } from '@/types'

export default function Expenses() {
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const { settings } = useSettings()
  const currency = settings.currency

  async function load() {
    setLoading(true)
    const data = await window.api.expenses.getSummary()
    setSummary(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleExport() {
    try {
      const filePath = await window.api.expenses.exportCsv(
        undefined,
        undefined,
        categoryFilter !== 'all' ? categoryFilter : undefined
      )
      toast.success(`Exported to ${filePath}`)
    } catch {
      toast.error('Export failed')
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading...</div>
  }

  const chartColors = summary?.byCategory.map(c => c.color) ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expense Summary</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Total cost of ownership: <span className="text-foreground font-semibold">{formatCurrency(summary?.totalCost ?? 0, currency)}</span>
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="fuel">Fuel</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="insurance">Insurance</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {(summary?.byCategory ?? []).map(cat => (
          <Card key={cat.category}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-3 rounded-full" style={{ background: cat.color }} />
                <span className="text-sm text-muted-foreground">{cat.category}</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(cat.amount, currency)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {summary?.totalCost ? `${((cat.amount / summary.totalCost) * 100).toFixed(1)}%` : '—'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="monthly">
        <TabsList>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Monthly Spending (Last 12 Months)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={summary?.monthlyTrend ?? []} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    formatter={(v: number) => [formatCurrency(v, currency), '']}
                  />
                  <Legend />
                  <Bar dataKey="fuel" name="Fuel" fill="#3b82f6" stackId="a" />
                  <Bar dataKey="maintenance" name="Maintenance" fill="#f59e0b" stackId="a" />
                  <Bar dataKey="insurance" name="Insurance" fill="#8b5cf6" stackId="a" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quarterly" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Quarterly Spending</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={summary?.quarterly ?? []} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    formatter={(v: number) => [formatCurrency(v, currency), 'Total']}
                  />
                  <Bar dataKey="amount" name="Total" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="yearly" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Yearly Spending</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={summary?.yearly ?? []} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    formatter={(v: number) => [formatCurrency(v, currency), 'Total']}
                  />
                  <Bar dataKey="amount" name="Total" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Category Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={summary?.byCategory ?? []}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(1)}%`}
                    labelLine={true}
                  >
                    {(summary?.byCategory ?? []).map((_, index) => (
                      <Cell key={index} fill={chartColors[index] ?? '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    formatter={(v: number) => [formatCurrency(v, currency), '']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

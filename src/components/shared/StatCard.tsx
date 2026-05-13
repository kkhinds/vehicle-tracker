import { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  iconClassName?: string
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

export default function StatCard({
  title, value, subtitle, icon: Icon, iconClassName, className
}: StatCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="mt-1 text-2xl font-bold text-foreground truncate">{value}</p>
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ml-3', iconClassName ?? 'bg-primary/10')}>
            <Icon className={cn('h-5 w-5', iconClassName ? 'text-current' : 'text-primary')} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

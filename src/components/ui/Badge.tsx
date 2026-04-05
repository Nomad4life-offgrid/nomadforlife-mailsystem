type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-zinc-100 text-zinc-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger:  'bg-red-100   text-red-700',
  info:    'bg-blue-100  text-blue-700',
  muted:   'bg-zinc-50   text-zinc-400 border border-zinc-200',
}

type BadgeProps = {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  )
}

// ── Domain-specific convenience exports ───────────────────────────────────────

export function ContactStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    active:    'success',
    pending:   'warning',
    opted_out: 'danger',
  }
  const labels: Record<string, string> = {
    active:    'Actief',
    pending:   'In afwachting',
    opted_out: 'Afgemeld',
  }
  return <Badge variant={map[status] ?? 'muted'}>{labels[status] ?? status}</Badge>
}

export function CampaignStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    active:   'success',
    draft:    'muted',
    paused:   'warning',
    archived: 'muted',
  }
  const labels: Record<string, string> = {
    active:   'Actief',
    draft:    'Concept',
    paused:   'Gepauzeerd',
    archived: 'Gearchiveerd',
  }
  return <Badge variant={map[status] ?? 'muted'}>{labels[status] ?? status}</Badge>
}

export function MailLogStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    sent:    'success',
    pending: 'info',
    failed:  'danger',
    skipped: 'muted',
  }
  const labels: Record<string, string> = {
    sent:    'Verstuurd',
    pending: 'In wachtrij',
    failed:  'Mislukt',
    skipped: 'Overgeslagen',
  }
  return <Badge variant={map[status] ?? 'muted'}>{labels[status] ?? status}</Badge>
}

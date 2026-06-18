import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { getSiteLabel } from '@/lib/injection-sites'
import type { Ppa_intakelogs } from '@/generated/models/Ppa_intakelogsModel'

const STATUS_LABELS: Record<number, string> = {
  894250000: 'Taken',
  894250001: 'Skipped',
  894250002: 'Missed',
}

const STATUS_VARIANTS: Record<number, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  894250000: 'default',
  894250001: 'secondary',
  894250002: 'destructive',
}

interface IntakeLogCardProps {
  log: Ppa_intakelogs
  onEdit: () => void
  onDelete: () => void
}

export default function IntakeLogCard({ log, onEdit, onDelete }: IntakeLogCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const loggedAt = new Date(log.ppa_loggedat)
  const timeLabel = `${String(loggedAt.getHours()).padStart(2, '0')}:${String(loggedAt.getMinutes()).padStart(2, '0')}`

  return (
    <>
      <div className="border rounded-lg px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{log.ppa_logname}</span>
            <span className="text-xs text-muted-foreground">{timeLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANTS[Number(log.ppa_status)]}>
              {STATUS_LABELS[Number(log.ppa_status)]}
            </Badge>
            {log.ppa_injectionsite != null && (
              <span className="text-xs text-muted-foreground">
                {getSiteLabel(log.ppa_injectionsite)}
              </span>
            )}
          </div>
          {log.ppa_notes && (
            <p className="text-xs text-muted-foreground mt-0.5">{log.ppa_notes}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Edit" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete log?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete this intake log for <strong>{log.ppa_logname}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowDeleteDialog(false)
                onDelete()
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

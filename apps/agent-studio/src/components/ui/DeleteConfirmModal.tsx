import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'
import { Modal } from './Modal'

interface DeleteConfirmModalProps {
  open: boolean
  onClose: () => void
  /** Display name of the item to delete — shown quoted in the message */
  itemName: string
  /** Singular entity label, e.g. "agent", "tool", "model" */
  entityType?: string
  onConfirm: () => Promise<void>
}

export function DeleteConfirmModal({
  open,
  onClose,
  itemName,
  entityType = 'item',
  onConfirm,
}: DeleteConfirmModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setLoading(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (loading) return
    setError('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Confirm deletion" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Delete{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                &ldquo;{itemName}&rdquo;
              </span>
              ?
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              This {entityType} will be permanently removed and cannot be recovered.
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" loading={loading} onClick={handleConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  )
}

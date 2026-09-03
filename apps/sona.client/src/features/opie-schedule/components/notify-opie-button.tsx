import { useState } from 'react'

import type { OpieScheduledPatient } from '@sona/shared'

import Button from '@/components/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useDepartmentContext } from '@/hooks/useDepartmentContext'

import { useNotifyOpiePatient } from '../api/notify-opie-patient'
import { formatPatientName, pickMobileNumber } from '../day-sheet'

/**
 * "Ready to be seen" for a patient on the Opie schedule. Opie rows have no Sona patient
 * and no consent flag, so the dialog shows the number that will be dialled and requires
 * the sender to attest SMS consent (audited on the MessageOut row).
 */
export function NotifyOpieButton({
  patient,
  rowKey,
}: {
  patient: OpieScheduledPatient
  /** Day-sheet row key — a patient can appear more than once a day, so ids derive from the row. */
  rowKey: string
}) {
  const notify = useNotifyOpiePatient()
  const [confirming, setConfirming] = useState(false)
  const [consentAttested, setConsentAttested] = useState(false)
  const { effectiveDepartmentId } = useDepartmentContext()
  const mobile = pickMobileNumber(patient.phoneNumbers)

  const close = () => {
    setConfirming(false)
    setConsentAttested(false)
  }

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        disabled={notify.isPending || mobile === null}
        title={mobile === null ? 'No mobile number on file in Opie' : undefined}
        data-testid={`opie-notify-${rowKey}`}
        onClick={() => setConfirming(true)}
      >
        {notify.isPending ? 'Notifying…' : 'Ready to be seen'}
      </Button>
      <ConfirmDialog
        open={confirming}
        title={`Send 'ready to be seen' notification to ${formatPatientName(patient)}?`}
        confirmLabel={notify.isPending ? 'Notifying…' : 'Confirm'}
        confirmDisabled={notify.isPending || !consentAttested}
        onConfirm={() => {
          if (!mobile) return
          notify.mutate(
            {
              opiePatientId: patient.opiePatientId,
              mobileNumber: mobile.e164,
              departmentId: effectiveDepartmentId,
              smsConsentAttested: true,
            },
            { onSettled: close },
          )
        }}
        onCancel={close}
      >
        <p className="text-sm text-gray-600">
          SMS to{' '}
          <span data-testid="opie-notify-number" className="font-medium text-gray-900">
            {mobile?.display}
          </span>
        </p>
        <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            data-testid="opie-notify-consent"
            className="mt-0.5"
            checked={consentAttested}
            onChange={(e) => setConsentAttested(e.target.checked)}
          />
          Patient has consented to SMS
        </label>
      </ConfirmDialog>
    </>
  )
}

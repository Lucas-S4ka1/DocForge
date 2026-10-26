/** Status-Badge wie im Archiv-Design (Interview gefüllt, Zusage weiß, Absage gedämpft …). */
import { useTranslation } from 'react-i18next'
import type { ApplicationStatus } from '@shared/models'

const styles: Record<ApplicationStatus, string> = {
  interview: 'border-accent-300 bg-accent-300 text-ground shadow-glow-sm',
  sent: 'border-accent-200 text-accent-100',
  draft: 'border-line text-accent-300',
  rejected: 'border-line text-accent-500',
  accepted: 'border-white bg-white text-ground'
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`inline-flex border px-2.5 py-[5px] font-heading text-[11px] font-semibold uppercase leading-none tracking-label ${styles[status]}`}>
      {t(`status.${status}`)}
    </span>
  )
}

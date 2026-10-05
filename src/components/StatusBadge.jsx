import { STATUS_TRANSLATION_KEYS } from '../data/donationStatus.js'

export function StatusBadge({ status, t }) {
  const statusClass = status.toLowerCase().replaceAll(' ', '-')
  const key = STATUS_TRANSLATION_KEYS[status] || (status === 'PENDING' ? 'requestPending' : status === 'PENDING_APPROVAL' ? 'pendingApproval' : status.toLowerCase())
  return <span className={`status-badge status-${statusClass}`}><span className="status-dot" />{t(key)}</span>
}
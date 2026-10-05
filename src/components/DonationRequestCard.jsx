import { useState } from 'react'
import { StatusBadge } from './StatusBadge.jsx'

export function DonationRequestCard({ request, donation, receiver, busy = false, t, onApprove, onReject, onOpenConnection }) {
  const [expanded, setExpanded] = useState(false)
  const connected = ['ACCEPTED', 'COMPLETED'].includes(request.status)
  const receiverName = receiver?.organizationName || t('foodReceiver')
  return (
    <article className="request-card">
      <div className="request-card-heading">
        <span className="request-bell">♧</span>
        <div><strong>{connected ? t('connectedRequest') : t('newDonationRequest')}</strong><p>{t(connected ? 'receiverApproved' : 'wantsDonation').replace('{receiver}', receiverName)}</p><time dateTime={request.createdAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(request.createdAt))}</time></div>
        <StatusBadge status={request.status} t={t} />
      </div>
      <div className="request-summary"><span><small>{t('foodName')}</small><strong>{donation.title}</strong></span><span><small>{t('quantityLabel')}</small><strong>{donation.quantity} {donation.unit}</strong></span><span><small>{t('distanceLabel')}</small><strong>{Number(request.distanceKm) > 0 ? `${request.distanceKm} ${t('kmAway')}` : t('distanceUnavailable')}</strong></span><span><small>{t('requestReceiver')}</small><strong>{receiverName}</strong></span></div>
      {request.status === 'PENDING' && <button className="text-button request-view-button" onClick={() => setExpanded((value) => !value)}>{t(expanded ? 'hideRequest' : 'viewRequest')} <span aria-hidden="true">{expanded ? '↑' : '→'}</span></button>}
      {expanded && request.status === 'PENDING' && <div className="request-detail-panel"><p><strong>{t('foodName')}:</strong> {donation.title}</p><p><strong>{t('quantityLabel')}:</strong> {donation.quantity} {donation.unit}</p><p><strong>{t('requestReceiver')}:</strong> {receiverName}</p>{receiver?.name && <p><strong>{t('contactPerson')}:</strong> {receiver.name}</p>}<p><strong>{t('distanceLabel')}:</strong> {Number(request.distanceKm) > 0 ? `${request.distanceKm} ${t('kmAway')}` : t('distanceUnavailable')}</p><p><strong>{t('requestStatus')}:</strong> {t('pendingApproval')}</p><div className="request-actions"><button className="button button-dark" onClick={() => onApprove(request.id)} disabled={busy}>{busy ? t('working') : t('acceptReceiver')}</button><button className="button button-outline" onClick={() => onReject(request.id)} disabled={busy}>{t('rejectRequest')}</button></div></div>}
      {connected && <button className="button button-dark request-connection-button" onClick={() => onOpenConnection(request.connectionId)}>{t('openConnection')} <span aria-hidden="true">→</span></button>}
    </article>
  )
}

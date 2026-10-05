import { PickupTracker } from './PickupTracker.jsx'
import { getDonationImage } from '../data/demoData.js'

export function DonationConnection({ connection, donation, donor, receiver, currentUser, busy = false, t, onAdvance, onBack }) {
  if (!connection || !donation || !donor || !receiver || ![connection.donorId, connection.receiverId].includes(currentUser.id)) {
    return <main className="page-wrap"><div className="empty-state"><h2>{t('connectionUnavailable')}</h2><button className="button button-outline" onClick={onBack}>{t('backToDashboard')}</button></div></main>
  }

  const estimatedTime = donation.estimatedPickupAt
    ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(donation.estimatedPickupAt))
    : t('pendingPickupSchedule')

  return (
    <div className="page-wrap connection-page">
      <section className="page-heading"><div><p className="eyebrow">{t('privateConnection')}</p><h1>{t('donationConnection')}</h1><p className="muted">{t('connectionIntro')}</p></div><button className="text-button" onClick={onBack}>{t('backToDashboard')}</button></section>
      <section className="connection-banner"><span className="connection-handshake">🤝</span><div><p className="eyebrow">{t('connectionCreated')}</p><h2>{t('donationConnected')}</h2><p>{donor.organizationName} <span aria-hidden="true">↔</span> {receiver.organizationName}</p></div><span className="connection-private-badge">{t('privateToParticipants')}</span></section>
      <section className="connection-donation"><div className="connection-donation-image"><img src={donation.imageUrl || getDonationImage(donation.title, donation.category)} alt={donation.title} /></div><div><p className="eyebrow">{t('donationDetails')}</p><h2>{donation.title}</h2><div className="connection-food-facts"><span><small>{t('quantityLabel')}</small><strong>{donation.quantity} {donation.unit}</strong></span><span><small>{t('locationLabel')}</small><strong>{donation.location}</strong></span><span><small>{t('pickupLabel')}</small><strong>{donation.pickupMinutes} {t('minutes')}</strong></span></div></div></section>
      <section className="connection-people"><ContactPanel heading={t('donorDetails')} profile={donor} t={t} /><span className="connection-link" aria-hidden="true">↔</span><ContactPanel heading={t('receiverDetails')} profile={receiver} t={t} /></section>
      <section className="connection-pickup"><div className="section-heading"><div><p className="eyebrow">{t('pickupStatus')}</p><h2>{t('pickupJourney')}</h2></div><span className={`status-badge status-${connection.status.toLowerCase().replaceAll('_', '-')}`}><span className="status-dot" />{t(connection.status === 'COMPLETED' ? 'completedStatus' : connection.status === 'COLLECTED' ? 'pickedUpStatus' : connection.status === 'ACCEPTED' ? 'acceptedStatus' : 'scheduledStatus')}</span></div><p className="connection-eta"><span>◷</span>{t('estimatedPickupTime')}: <strong>{estimatedTime}</strong></p><PickupTracker status={connection.status} t={t} /><div className="connection-actions">{connection.status === 'ACCEPTED' && <button className="button button-dark" disabled={busy} onClick={() => onAdvance('PICKUP_SCHEDULED')}>{busy ? t('working') : t('confirmPickup')} <span aria-hidden="true">→</span></button>}{connection.status === 'PICKUP_SCHEDULED' && <button className="button button-dark" disabled={busy} onClick={() => onAdvance('COLLECTED')}>{busy ? t('working') : t('markPickedUp')} <span aria-hidden="true">✓</span></button>}{connection.status === 'COLLECTED' && <button className="button button-dark" disabled={busy} onClick={() => onAdvance('COMPLETED')}>{busy ? t('working') : t('completeDonation')} <span aria-hidden="true">✓</span></button>}{connection.status === 'COMPLETED' && <p className="pickup-success"><span>✓</span>{t('completedSuccess')}</p>}</div></section>
    </div>
  )
}

function ContactPanel({ heading, profile, t }) {
  return <section className="connection-contact"><p className="eyebrow">{heading}</p><h3>{profile.organizationName}</h3><dl><div><dt>{t('contactPerson')}</dt><dd>{profile.name}</dd></div><div><dt>{t('phone')}</dt><dd>{profile.phone}</dd></div><div><dt>{t('email')}</dt><dd>{profile.email}</dd></div><div><dt>{t('location')}</dt><dd>{profile.location}</dd></div></dl></section>
}

import { useState } from 'react'
import { StatusBadge } from './StatusBadge.jsx'
import { getDonationImage } from '../data/demoData.js'
import { DONATION_STATUS } from '../data/donationStatus.js'

export function DonationCard({ donation, mode, match, request, busy = false, onRequest, onOpenConnection, t }) {
  const [imageFailed, setImageFailed] = useState(false)
  const image = donation.imageUrl || getDonationImage(donation.title, donation.category)
  const categoryKey = { 'Prepared meals': 'preparedMeals', Produce: 'produce', Bakery: 'bakery', Fruit: 'fruit' }[donation.category] || 'otherFood'
  const allergenKey = { 'Contains gluten': 'containsGluten', 'Plant-based': 'plantBased', 'Ask donor for allergen details': 'askAllergens' }[donation.allergens]
  const reasons = match?.reasons || []

  return (
    <article className="donation-card">
      <div className="donation-photo-wrap">
        {!image || imageFailed ? <div className="donation-image-fallback" role="img" aria-label={image ? `${donation.category} image unavailable` : t('noFoodPhoto')}><span>✳</span><strong>{donation.category}</strong></div> : <img className="donation-photo" src={image} alt={donation.title} onError={() => setImageFailed(true)} loading="lazy" />}
        <span className="photo-category">{t(categoryKey)}</span>
      </div>
      <div className="donation-main">
        <div className="donation-card-top"><span className="donation-label">{t('foodDonation')}</span><StatusBadge status={donation.status} t={t} /></div>
        <h3>{donation.title}</h3>
        {donation.description && <p className="donation-description">{donation.description}</p>}
        <div className="donation-facts"><span><strong>{donation.quantity} {donation.unit}</strong></span><span>⌖ {donation.location}</span><span>◷ {t('pickupIn')} {donation.pickupMinutes} {t('minutes')}</span>{mode === 'receiver' && donation.donorOrganization && <span>{donation.donorOrganization}</span>}</div>
        {mode === 'receiver' && <div className="ai-match-panel"><div className="ai-match-heading"><span className="ai-spark">✳</span><span>{t('aiMatch')}</span><small>{t('demoMatchLabel')}</small></div>{match ? <><div className="ai-match-organization"><div><strong>{match.recipient.name}</strong><span className="verified-label">{t('verifiedRecipient')}</span></div><div className="match-score-block"><strong>{match.score}%</strong><span>{t('match')}</span></div></div>{match.distanceKm && <p className="match-distance">⌖ {match.distanceKm} {t('kmAway')}</p>}<ul className="match-reason-list">{reasons.map((reason) => <li key={reason}><span>✓</span>{t(reason)}</li>)}</ul></> : <p className="no-match-copy">{t('noMatch')}</p>}</div>}
        {donation.allergens && <p className="allergen-note">{t('dietaryNotes')}: {allergenKey ? t(allergenKey) : donation.allergens}</p>}
        {mode === 'donor' && donation.status === DONATION_STATUS.REQUESTED && <p className="donor-match-line"><strong>{t('pendingApproval')}</strong></p>}
        <div className="card-actions">{mode === 'receiver' && [DONATION_STATUS.AVAILABLE, DONATION_STATUS.REQUESTED].includes(donation.status) && <button className="button button-dark card-primary-action" onClick={onRequest} disabled={busy || !match || Boolean(request && request.status === 'PENDING')}>{busy ? t('working') : request?.status === 'PENDING' ? t('requestPending') : t('requestDonation')} <span aria-hidden="true">→</span></button>}{mode === 'receiver' && ['ACCEPTED', 'COMPLETED'].includes(request?.status) && <button className="button button-green card-primary-action" onClick={() => onOpenConnection(request.connectionId)}>{t('openConnection')} <span aria-hidden="true">→</span></button>}</div>
      </div>
    </article>
  )
}


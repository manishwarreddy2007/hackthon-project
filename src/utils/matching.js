export function getRankedMatches(donation, organizations) {
  return organizations.map((recipient) => {
    const recipientCity = recipient.location || recipient.city
    if (donation.city && recipientCity !== donation.city) return null
    const pickupMinutes = Number(donation.pickupMinutes)
    if (!recipient.verified || pickupMinutes < 10 || pickupMinutes > 120) return null

    const pickupScore = 100 - ((pickupMinutes - 10) / 110) * 35
    const urgencyScore = donation.urgency === 'High' ? 100 : donation.urgency === 'Medium' ? 75 : 60
    const score = Math.round(55 + 20 + pickupScore * 0.15 + urgencyScore * 0.1)
    const reasons = ['nearbyLocation', 'verifiedRecipient', 'pickupSoon']
    return { recipient: { ...recipient, name: recipient.organizationName || recipient.name }, score, distanceKm: null, reasons }
  }).filter(Boolean).sort((first, second) => second.score - first.score)
}
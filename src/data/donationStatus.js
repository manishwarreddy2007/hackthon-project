export const DONATION_STATUS = {
  AVAILABLE: 'AVAILABLE',
  REQUESTED: 'REQUESTED',
  ACCEPTED: 'ACCEPTED',
  PICKUP_SCHEDULED: 'PICKUP_SCHEDULED',
  COLLECTED: 'COLLECTED',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
}

export const PICKUP_STATUSES = [
  DONATION_STATUS.REQUESTED,
  DONATION_STATUS.ACCEPTED,
  DONATION_STATUS.PICKUP_SCHEDULED,
]

export const STATUS_TRANSLATION_KEYS = {
  [DONATION_STATUS.AVAILABLE]: 'available',
  [DONATION_STATUS.REQUESTED]: 'requested',
  [DONATION_STATUS.ACCEPTED]: 'accepted',
  [DONATION_STATUS.PICKUP_SCHEDULED]: 'pickupScheduled',
  [DONATION_STATUS.COLLECTED]: 'collected',
  [DONATION_STATUS.COMPLETED]: 'completedStatus',
  [DONATION_STATUS.REJECTED]: 'rejected',
}

export function normalizeDonationStatus(status) {
  if (status === 'Accepted' || status === 'Accepted - Pickup Pending') return DONATION_STATUS.ACCEPTED
  if (status === 'Pickup Scheduled' || status === 'Recipient On The Way') return DONATION_STATUS.PICKUP_SCHEDULED
  if (status === 'Food Collected') return DONATION_STATUS.COMPLETED
  if (Object.values(DONATION_STATUS).includes(status)) return status
  return status || DONATION_STATUS.AVAILABLE
}
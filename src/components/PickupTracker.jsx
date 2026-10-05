const steps = [
  { status: 'REQUESTED', label: 'donationRequested' },
  { status: 'ACCEPTED', label: 'donorAccepted' },
  { status: 'PICKUP_SCHEDULED', label: 'pickupScheduled' },
  { status: 'COLLECTED', label: 'pickedUpStatus' },
  { status: 'COMPLETED', label: 'completedStatus' },
]

export function PickupTracker({ status, t }) {
  const currentIndex = status === 'ACCEPTED' ? 1 : status === 'PICKUP_SCHEDULED' ? 2 : status === 'COLLECTED' ? 3 : status === 'COMPLETED' ? 4 : 0

  return (
    <ol className="pickup-tracker" aria-label={t('pickupCoordination')}>
      {steps.map((step, index) => {
        const complete = currentIndex >= index
        return (
          <li className={`pickup-tracker-step ${complete ? 'complete' : ''} ${currentIndex === index ? 'current' : ''}`} key={step.status}>
            <span className="pickup-step-mark" aria-hidden="true">{complete ? '✓' : '○'}</span>
            <span className="pickup-step-copy">
              <strong>{t(step.label)}</strong>
              {index < steps.length - 1 && <i aria-hidden="true" />}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

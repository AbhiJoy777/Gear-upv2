export type RentalTimelineStageKey =
  | 'request_sent'
  | 'accepted'
  | 'proof_recorded'
  | 'logistics_pending'
  | 'payment_completed'
  | 'active_rental'
  | 'return_requested'
  | 'returned';

export type RentalTimelineStage = {
  key: RentalTimelineStageKey;
  label: string;
  timestampField: string;
};

export const RENTAL_TIMELINE_STAGES: RentalTimelineStage[] = [
  { key: 'request_sent', label: 'Request Sent', timestampField: 'createdAt' },
  { key: 'accepted', label: 'Accepted', timestampField: 'acceptedAt' },
  { key: 'proof_recorded', label: 'Proof Recorded', timestampField: 'proofRecordedAt' },
  { key: 'logistics_pending', label: 'Logistics Pending', timestampField: 'logisticsPendingAt' },
  { key: 'payment_completed', label: 'Payment Completed', timestampField: 'paymentCompletedAt' },
  { key: 'active_rental', label: 'Active Rental', timestampField: 'activeAt' },
  { key: 'return_requested', label: 'Return Requested', timestampField: 'returnRequestedAt' },
  { key: 'returned', label: 'Returned', timestampField: 'returnedAt' },
];

const STATUS_STAGE_MAP: Record<string, RentalTimelineStageKey> = {
  REQUESTED: 'request_sent',
  ACCEPTED: 'accepted',
  PROOF_RECORDED: 'proof_recorded',
  LOGISTICS_PENDING: 'logistics_pending',
  PAYMENT_PENDING: 'payment_completed',
  ACTIVE_RENTAL: 'active_rental',
  IN_USE: 'active_rental',
  RETURN_DUE: 'return_requested',
  RETURNED: 'returned',
};

export const getRentalTimelineStageKey = (status?: string): RentalTimelineStageKey => {
  return STATUS_STAGE_MAP[status || ''] || 'request_sent';
};

export const getRentalTimelineIndex = (status?: string) => {
  const key = getRentalTimelineStageKey(status);
  return RENTAL_TIMELINE_STAGES.findIndex((stage) => stage.key === key);
};

export const getRentalTimestamp = (rental: any, stage: RentalTimelineStage) => {
  if (!rental) return null;
  if (stage.key === 'active_rental') return rental.activeAt || rental.actualStartTime || null;
  if (stage.key === 'return_requested') return rental.returnRequestedAt || rental.returnDueAt || null;
  return rental[stage.timestampField] || null;
};

export const formatRentalTimelineDate = (value: any) => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

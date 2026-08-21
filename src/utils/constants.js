const DOCUMENT_TYPES = [
  'Barangay Clearance',
  'Certificate of Residency',
  'Certificate of Indigency',
  'Business Permit Endorsement',
];

const REQUEST_STATUSES = ['pending', 'under_review', 'approved', 'rejected', 'ready_for_pickup', 'completed'];

const CONCERN_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

// v1.1.0 — additive
const ACCOUNT_STATUSES = ['pending', 'active', 'suspended', 'rejected'];
const APPLICATION_STATUSES = ['pending', 'approved', 'rejected'];
const AUDIT_ACTOR_TYPES = ['resident', 'admin', 'webmaster', 'system'];

module.exports = {
  DOCUMENT_TYPES,
  REQUEST_STATUSES,
  CONCERN_STATUSES,
  ACCOUNT_STATUSES,
  APPLICATION_STATUSES,
  AUDIT_ACTOR_TYPES,
};

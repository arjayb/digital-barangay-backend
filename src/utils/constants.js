const DOCUMENT_TYPES = [
  'Barangay Clearance',
  'Certificate of Residency',
  'Certificate of Indigency',
  'Business Permit Endorsement',
];

const REQUEST_STATUSES = ['pending', 'under_review', 'approved', 'rejected', 'ready_for_pickup', 'completed'];

const CONCERN_STATUSES = ['open', 'in_progress', 'resolved'];

module.exports = { DOCUMENT_TYPES, REQUEST_STATUSES, CONCERN_STATUSES };

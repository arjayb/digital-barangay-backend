// Backend-authoritative transition tables.
const REQUEST_TRANSITIONS = {
  admin: {
    pending: ['under_review'],
    under_review: ['approved', 'rejected'],
    approved: ['ready_for_pickup'],
  },
  resident: {
    ready_for_pickup: ['completed'],
  },
};

const CONCERN_TRANSITIONS = {
  admin: {
    open: ['in_progress'],
    in_progress: ['resolved'],
  },
  resident: {
    resolved: ['closed'],
  },
};

function isValidRequestTransition(actorRole, fromStatus, toStatus) {
  const allowed = REQUEST_TRANSITIONS[actorRole]?.[fromStatus] || [];
  return allowed.includes(toStatus);
}

function isValidConcernTransition(actorRole, fromStatus, toStatus) {
  const allowed = CONCERN_TRANSITIONS[actorRole]?.[fromStatus] || [];
  return allowed.includes(toStatus);
}

module.exports = { REQUEST_TRANSITIONS, CONCERN_TRANSITIONS, isValidRequestTransition, isValidConcernTransition };

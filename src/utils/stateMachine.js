// Backend-authoritative transition tables (BUILD-SPEC-DBA-001 §14, §16).
// The frontend may hide invalid options, but this is what actually enforces
// them — a request can never move through a status the map below doesn't
// list, regardless of what a client sends.

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

module.exports = {
  REQUEST_TRANSITIONS,
  CONCERN_TRANSITIONS,
  isValidRequestTransition,
  isValidConcernTransition,
};

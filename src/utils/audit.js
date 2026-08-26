function snapshot(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function auditData(req, { module, action, recordId, recordLabel, before, after, note }) {
  return {
    actorUserId: req.user?.id || null,
    actorName: req.user?.fullName || req.user?.email || 'System',
    actorStaffId: req.user?.staffId || null,
    actorType: req.user?.role || 'system',
    module,
    action,
    recordId,
    recordLabel: recordLabel || null,
    before: snapshot(before),
    after: snapshot(after),
    note: note || null,
  };
}

module.exports = { auditData };

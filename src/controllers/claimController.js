const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { decodeClaimToken, attachClaimToken } = require('../utils/claimToken');
const { auditData } = require('../utils/audit');
const { isValidRequestTransition } = require('../utils/stateMachine');

const CLAIM_INCLUDE = {
  requestor: { select: { id: true, fullName: true, email: true, contactNumber: true } },
};

function publicClaim(request) {
  if (!request) return null;
  const withToken = attachClaimToken(request);
  return {
    id: withToken.id,
    trackingNumber: withToken.trackingNumber,
    claimToken: withToken.claimToken,
    documentType: withToken.documentType,
    purpose: withToken.purpose,
    status: withToken.status,
    createdAt: withToken.createdAt,
    updatedAt: withToken.updatedAt,
    requestor: withToken.requestor,
  };
}

// Scanning/lookup is read-only. It never changes request state.
const resolveClaim = asyncHandler(async (req, res) => {
  const token = String(req.query.token || '').trim();
  const claimNo = String(req.query.claimNo || '').trim();
  if (!token && !claimNo) return res.status(400).json({ success: false, message: 'Provide a QR token or Claim No.' });

  let request = null;
  if (token) {
    const requestId = decodeClaimToken(token);
    if (!requestId) return res.status(404).json({ success: false, message: 'Invalid or unreadable QR claim token.' });
    request = await prisma.documentRequest.findUnique({ where: { id: requestId }, include: CLAIM_INCLUDE });
  } else {
    request = await prisma.documentRequest.findUnique({ where: { trackingNumber: claimNo }, include: CLAIM_INCLUDE });
  }

  if (!request) return res.status(404).json({ success: false, message: 'Claim record not found.' });
  res.json({ success: true, claim: publicClaim(request), canRelease: request.status === 'ready_for_pickup' });
});

const releaseClaim = asyncHandler(async (req, res) => {
  const existing = await prisma.documentRequest.findUnique({ where: { id: req.params.id }, include: CLAIM_INCLUDE });
  if (!existing) return res.status(404).json({ success: false, message: 'Claim record not found.' });
  if (existing.status === 'completed') return res.status(409).json({ success: false, message: 'This document has already been released / claimed.' });
  if (!isValidRequestTransition('admin', existing.status, 'completed')) {
    return res.status(400).json({ success: false, message: `This document cannot be released from its current status (${existing.status}).` });
  }

  const [request] = await prisma.$transaction([
    prisma.documentRequest.update({ where: { id: existing.id }, data: { status: 'completed' }, include: CLAIM_INCLUDE }),
    prisma.requestStatusHistory.create({ data: { requestId: existing.id, fromStatus: existing.status, toStatus: 'completed', actorUserId: req.user.id, actorType: 'admin', actorStaffId: req.user.staffId || null, note: 'Document released to claimant' } }),
    prisma.auditEvent.create({ data: auditData(req, { module: 'requests', action: 'released', recordId: existing.id, recordLabel: existing.trackingNumber || existing.documentType, before: { status: existing.status }, after: { status: 'completed' }, note: 'Document released to claimant' }) }),
  ]);

  res.json({ success: true, message: 'Document released and recorded in Activity.', claim: publicClaim(request) });
});

module.exports = { resolveClaim, releaseClaim };

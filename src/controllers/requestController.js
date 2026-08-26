const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { nextTrackingNumber } = require('../utils/trackingNumber');
const { isValidRequestTransition } = require('../utils/stateMachine');
const { auditData } = require('../utils/audit');
const { attachClaimToken } = require('../utils/claimToken');

const getMyRequests = asyncHandler(async (req, res) => {
  const where = { requestorId: req.user.id };
  if (req.query.status) where.status = req.query.status;
  const requests = await prisma.documentRequest.findMany({ where, include: { history: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, count: requests.length, requests: requests.map(attachClaimToken) });
});

const createRequest = asyncHandler(async (req, res) => {
  const { documentType, purpose } = req.body;
  const attachments = (req.files || []).map((file) => ({ fileName: file.originalname, fileUrl: file.path }));
  const request = await prisma.$transaction(async (tx) => {
    const trackingNumber = await nextTrackingNumber(tx);
    const created = await tx.documentRequest.create({ data: { requestorId: req.user.id, documentType, purpose, attachments, trackingNumber } });
    await tx.requestStatusHistory.create({ data: { requestId: created.id, fromStatus: null, toStatus: 'pending', actorUserId: req.user.id, actorType: 'resident', actorStaffId: null, note: 'Request submitted' } });
    await tx.auditEvent.create({ data: auditData(req, { module: 'requests', action: 'created', recordId: created.id, recordLabel: created.trackingNumber || created.documentType, after: { status: created.status, documentType: created.documentType, purpose: created.purpose }, note: 'Request submitted' }) });
    return created;
  });
  res.status(201).json({ success: true, request: attachClaimToken(request) });
});

const getRequestById = asyncHandler(async (req, res) => {
  const request = await prisma.documentRequest.findFirst({ where: { id: req.params.id, requestorId: req.user.id }, include: { history: { orderBy: { createdAt: 'asc' } } } });
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
  res.json({ success: true, request: attachClaimToken(request) });
});

// Legacy resident confirmation route retained for backward compatibility.
// The primary v1 claim workflow is now Admin verification + explicit release.
const confirmClaimed = asyncHandler(async (req, res) => {
  const existing = await prisma.documentRequest.findFirst({ where: { id: req.params.id, requestorId: req.user.id } });
  if (!existing) return res.status(404).json({ success: false, message: 'Request not found' });
  if (!isValidRequestTransition('resident', existing.status, 'completed')) return res.status(400).json({ success: false, message: `This request cannot be confirmed claimed from its current status (${existing.status}).` });
  const [request] = await prisma.$transaction([
    prisma.documentRequest.update({ where: { id: existing.id }, data: { status: 'completed' } }),
    prisma.requestStatusHistory.create({ data: { requestId: existing.id, fromStatus: existing.status, toStatus: 'completed', actorUserId: req.user.id, actorType: 'resident', actorStaffId: null, note: 'Resident confirmed claim' } }),
    prisma.auditEvent.create({ data: auditData(req, { module: 'requests', action: 'status_changed', recordId: existing.id, recordLabel: existing.trackingNumber || existing.documentType, before: { status: existing.status }, after: { status: 'completed' }, note: 'Resident confirmed claim' }) }),
  ]);
  res.json({ success: true, request: attachClaimToken(request) });
});

module.exports = { getMyRequests, createRequest, getRequestById, confirmClaimed };

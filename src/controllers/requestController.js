const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { nextTrackingNumber } = require('../utils/trackingNumber');
const { isValidRequestTransition } = require('../utils/stateMachine');

// @route GET /api/requests  (resident's own requests, optional ?status=)
// v1.1.0 — now includes history so the Member Portal can show decision
// history and, where applicable, the rejection reason for the resident's
// own request. Ownership is already enforced by the `where` clause below,
// so this can never leak another resident's history.
const getMyRequests = asyncHandler(async (req, res) => {
  const where = { requestorId: req.user.id };
  if (req.query.status) where.status = req.query.status;

  const requests = await prisma.documentRequest.findMany({
    where,
    include: { history: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, count: requests.length, requests });
});

// @route POST /api/requests
const createRequest = asyncHandler(async (req, res) => {
  const { documentType, purpose } = req.body;

  // multer-storage-cloudinary already uploaded these; req.files gives us the
  // resulting URLs (path) and original names.
  const attachments = (req.files || []).map((file) => ({
    fileName: file.originalname,
    fileUrl: file.path,
  }));

  // v1.1.0: trackingNumber assignment and the initial RequestStatusHistory
  // row are created atomically with the request itself — either all three
  // exist or none do. The legacy `statusHistory` JSON field is deliberately
  // left at its schema default ([]) and never written to for v1.1.0+
  // requests (DEC-DBA-022) — RequestStatusHistory is now canonical.
  const request = await prisma.$transaction(async (tx) => {
    const trackingNumber = await nextTrackingNumber(tx);

    const created = await tx.documentRequest.create({
      data: { requestorId: req.user.id, documentType, purpose, attachments, trackingNumber },
    });

    await tx.requestStatusHistory.create({
      data: {
        requestId: created.id,
        fromStatus: null,
        toStatus: 'pending',
        actorUserId: req.user.id,
        actorType: 'resident',
        actorStaffId: null,
        note: 'Request submitted',
      },
    });

    return created;
  });

  res.status(201).json({ success: true, request });
});

// @route GET /api/requests/:id  (only the owner can view their own request)
const getRequestById = asyncHandler(async (req, res) => {
  const request = await prisma.documentRequest.findFirst({
    where: { id: req.params.id, requestorId: req.user.id },
    include: { history: { orderBy: { createdAt: 'asc' } } },
  });

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  res.json({ success: true, request });
});

// @route PATCH /api/requests/:id/claim
// v1.1.0 — additive. The only way a request reaches `completed`: the
// resident who owns it confirms the physical claim. An ordinary Admin
// cannot perform this transition (see adminController.updateRequestStatus,
// which only allows ready_for_pickup as a terminal admin state).
const confirmClaimed = asyncHandler(async (req, res) => {
  const existing = await prisma.documentRequest.findFirst({
    where: { id: req.params.id, requestorId: req.user.id },
  });

  if (!existing) {
    // Ownership check folded into the lookup itself — a request that
    // exists but belongs to someone else 404s exactly like one that
    // doesn't exist at all, so this never confirms whether a given id
    // belongs to another resident.
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  if (!isValidRequestTransition('resident', existing.status, 'completed')) {
    return res.status(400).json({
      success: false,
      message: `This request cannot be confirmed claimed from its current status (${existing.status}).`,
    });
  }

  const [request] = await prisma.$transaction([
    prisma.documentRequest.update({ where: { id: existing.id }, data: { status: 'completed' } }),
    prisma.requestStatusHistory.create({
      data: {
        requestId: existing.id,
        fromStatus: existing.status,
        toStatus: 'completed',
        actorUserId: req.user.id,
        actorType: 'resident',
        actorStaffId: null,
        note: 'Resident confirmed claim',
      },
    }),
  ]);

  res.json({ success: true, request });
});

module.exports = { getMyRequests, createRequest, getRequestById, confirmClaimed };

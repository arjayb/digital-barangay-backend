const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { isValidConcernTransition } = require('../utils/stateMachine');
const { auditData } = require('../utils/audit');

const createConcern = asyncHandler(async (req, res) => {
  const { category, description, location } = req.body;
  const attachments = (req.files || []).map((file) => ({ fileName: file.originalname, fileUrl: file.path }));
  const concern = await prisma.$transaction(async (tx) => {
    const created = await tx.concern.create({ data: { reporterId: req.user.id, category, description, location, attachments } });
    await tx.concernStatusHistory.create({
      data: { concernId: created.id, fromStatus: null, toStatus: 'open', actorUserId: req.user.id, actorType: 'resident', actorStaffId: null, note: 'Concern reported' },
    });
    await tx.auditEvent.create({
      data: auditData(req, {
        module: 'concerns', action: 'created', recordId: created.id, recordLabel: created.category,
        after: { status: created.status, category: created.category, description: created.description, location: created.location },
        note: 'Concern reported',
      }),
    });
    return created;
  });
  res.status(201).json({ success: true, concern });
});

const getMyConcerns = asyncHandler(async (req, res) => {
  const concerns = await prisma.concern.findMany({
    where: { reporterId: req.user.id },
    include: { history: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, count: concerns.length, concerns });
});

const confirmResolved = asyncHandler(async (req, res) => {
  const existing = await prisma.concern.findFirst({ where: { id: req.params.id, reporterId: req.user.id } });
  if (!existing) return res.status(404).json({ success: false, message: 'Concern not found' });
  if (!isValidConcernTransition('resident', existing.status, 'closed')) {
    return res.status(400).json({ success: false, message: `This concern cannot be confirmed resolved from its current status (${existing.status}).` });
  }
  const [concern] = await prisma.$transaction([
    prisma.concern.update({ where: { id: existing.id }, data: { status: 'closed' } }),
    prisma.concernStatusHistory.create({
      data: { concernId: existing.id, fromStatus: existing.status, toStatus: 'closed', actorUserId: req.user.id, actorType: 'resident', actorStaffId: null, note: 'Resident confirmed resolution' },
    }),
    prisma.auditEvent.create({
      data: auditData(req, {
        module: 'concerns', action: 'status_changed', recordId: existing.id, recordLabel: existing.category,
        before: { status: existing.status }, after: { status: 'closed' }, note: 'Resident confirmed resolution',
      }),
    }),
  ]);
  res.json({ success: true, concern });
});

module.exports = { createConcern, getMyConcerns, confirmResolved };

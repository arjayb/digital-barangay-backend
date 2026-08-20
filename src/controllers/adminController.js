const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

const USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  address: true,
  contactNumber: true,
  createdAt: true,
};

// ---- Users ----

// @route GET /api/admin/users?search=&page=&limit=
const getUsers = asyncHandler(async (req, res) => {
  const { search = '', page = 1, limit = 20 } = req.query;

  const where = search
    ? {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      skip: (page - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ success: true, total, page: Number(page), users });
});

// @route PATCH /api/admin/users/:id
const updateUser = asyncHandler(async (req, res) => {
  const { role, fullName, address, contactNumber } = req.body;

  const user = await prisma.user
    .update({
      where: { id: req.params.id },
      data: { role, fullName, address, contactNumber },
      select: USER_SELECT,
    })
    .catch(() => null);

  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  res.json({ success: true, user });
});

// ---- Document requests ----

// @route GET /api/admin/requests?status=&documentType=
const getAllRequests = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.documentType) where.documentType = req.query.documentType;

  const requests = await prisma.documentRequest.findMany({
    where,
    include: { requestor: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, count: requests.length, requests });
});

// @route PATCH /api/admin/requests/:id/status
const updateRequestStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  const existing = await prisma.documentRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ success: false, message: 'Request not found' });

  const history = Array.isArray(existing.statusHistory) ? existing.statusHistory : [];
  history.push({ status, changedBy: req.user.id, note, timestamp: new Date() });

  const request = await prisma.documentRequest.update({
    where: { id: req.params.id },
    data: { status, statusHistory: history },
  });

  res.json({ success: true, request });
});

// ---- Officials ----

const createOfficial = asyncHandler(async (req, res) => {
  const official = await prisma.official.create({ data: req.body });
  res.status(201).json({ success: true, official });
});

const updateOfficial = asyncHandler(async (req, res) => {
  const official = await prisma.official
    .update({ where: { id: req.params.id }, data: req.body })
    .catch(() => null);
  if (!official) return res.status(404).json({ success: false, message: 'Official not found' });
  res.json({ success: true, official });
});

const deleteOfficial = asyncHandler(async (req, res) => {
  const official = await prisma.official.delete({ where: { id: req.params.id } }).catch(() => null);
  if (!official) return res.status(404).json({ success: false, message: 'Official not found' });
  res.json({ success: true, message: 'Official removed' });
});

// ---- Notices ----

const createNotice = asyncHandler(async (req, res) => {
  const notice = await prisma.notice.create({ data: { ...req.body, postedById: req.user.id } });
  res.status(201).json({ success: true, notice });
});

const updateNotice = asyncHandler(async (req, res) => {
  const notice = await prisma.notice.update({ where: { id: req.params.id }, data: req.body }).catch(() => null);
  if (!notice) return res.status(404).json({ success: false, message: 'Notice not found' });
  res.json({ success: true, notice });
});

const deleteNotice = asyncHandler(async (req, res) => {
  const notice = await prisma.notice.delete({ where: { id: req.params.id } }).catch(() => null);
  if (!notice) return res.status(404).json({ success: false, message: 'Notice not found' });
  res.json({ success: true, message: 'Notice removed' });
});

// ---- Concerns ----

const getAllConcerns = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;

  const concerns = await prisma.concern.findMany({
    where,
    include: { reporter: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, count: concerns.length, concerns });
});

const updateConcernStatus = asyncHandler(async (req, res) => {
  const concern = await prisma.concern
    .update({ where: { id: req.params.id }, data: { status: req.body.status } })
    .catch(() => null);
  if (!concern) return res.status(404).json({ success: false, message: 'Concern not found' });
  res.json({ success: true, concern });
});

// ---- Basic reporting ----

// @route GET /api/admin/reports/summary
const getReportsSummary = asyncHandler(async (req, res) => {
  const [requestsByStatus, requestsByType, concernsByStatus, totalUsers] = await Promise.all([
    prisma.documentRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.documentRequest.groupBy({ by: ['documentType'], _count: { _all: true } }),
    prisma.concern.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.count({ where: { role: 'resident' } }),
  ]);

  res.json({
    success: true,
    summary: {
      totalUsers,
      requestsByStatus: requestsByStatus.map((r) => ({ _id: r.status, count: r._count._all })),
      requestsByType: requestsByType.map((r) => ({ _id: r.documentType, count: r._count._all })),
      concernsByStatus: concernsByStatus.map((r) => ({ _id: r.status, count: r._count._all })),
    },
  });
});

module.exports = {
  getUsers,
  updateUser,
  getAllRequests,
  updateRequestStatus,
  createOfficial,
  updateOfficial,
  deleteOfficial,
  createNotice,
  updateNotice,
  deleteNotice,
  getAllConcerns,
  updateConcernStatus,
  getReportsSummary,
};

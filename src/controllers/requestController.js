const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

// @route GET /api/requests  (resident's own requests, optional ?status=)
const getMyRequests = asyncHandler(async (req, res) => {
  const where = { requestorId: req.user.id };
  if (req.query.status) where.status = req.query.status;

  const requests = await prisma.documentRequest.findMany({ where, orderBy: { createdAt: 'desc' } });
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

  const request = await prisma.documentRequest.create({
    data: {
      requestorId: req.user.id,
      documentType,
      purpose,
      attachments,
      statusHistory: [{ status: 'pending', changedBy: req.user.id, note: 'Request submitted', timestamp: new Date() }],
    },
  });

  res.status(201).json({ success: true, request });
});

// @route GET /api/requests/:id  (only the owner can view their own request)
const getRequestById = asyncHandler(async (req, res) => {
  const request = await prisma.documentRequest.findFirst({
    where: { id: req.params.id, requestorId: req.user.id },
  });

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  res.json({ success: true, request });
});

module.exports = { getMyRequests, createRequest, getRequestById };

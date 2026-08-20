require('dotenv').config();
const express = require('express');
const cors = require('cors');
const errorHandler = require('./src/middleware/error');
const notFound = require('./src/middleware/notFound');

const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const requestRoutes = require('./src/routes/requestRoutes');
const officialRoutes = require('./src/routes/officialRoutes');
const noticeRoutes = require('./src/routes/noticeRoutes');
const concernRoutes = require('./src/routes/concernRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

// Prisma connects lazily on first query — no explicit connect() call needed here.
const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ success: true, message: 'API is running' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/officials', officialRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/concerns', concernRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

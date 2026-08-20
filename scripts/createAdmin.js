// One-off script to create the first admin account, since the API has no
// self-registration path for admins (on purpose — residents shouldn't be
// able to grant themselves that role).
//
// Usage:
//   ADMIN_NAME="Jay Barangay" ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="changeMe123" npm run seed:admin
//
// Reads DATABASE_URL from your .env file, so run this from the server/ folder
// with a working .env already in place.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');

const run = async () => {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error(
      'Missing env vars. Run like:\n' +
        'ADMIN_NAME="Your Name" ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="yourpassword" npm run seed:admin'
    );
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`A user with email ${ADMIN_EMAIL} already exists (role: ${existing.role}).`);
    if (existing.role !== 'admin') {
      await prisma.user.update({ where: { id: existing.id }, data: { role: 'admin' } });
      console.log('Promoted that user to admin.');
    }
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await prisma.user.create({
    data: { fullName: ADMIN_NAME, email: ADMIN_EMAIL, passwordHash, role: 'admin' },
  });

  console.log(`Admin account created for ${ADMIN_EMAIL}. You can now log in via POST /api/auth/login.`);
  await prisma.$disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

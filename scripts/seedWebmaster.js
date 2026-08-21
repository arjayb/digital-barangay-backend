// Seeds the single initial Webmaster: WEB-0001. Controlled, one-time,
// env-driven — there is no public Webmaster registration, no resident
// self-promotion, and no Admin self-promotion path anywhere in the API.
//
// Usage:
//   WEBMASTER_NAME="..." WEBMASTER_EMAIL="..." WEBMASTER_PASSWORD="..." \
//   node scripts/seedWebmaster.js
//
// NOT RUN as part of this BUILD pass — no live DB access was used. For
// ADAM to run under MIGRATE-DBA-001.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');

const run = async () => {
  const { WEBMASTER_NAME, WEBMASTER_EMAIL, WEBMASTER_PASSWORD } = process.env;

  if (!WEBMASTER_NAME || !WEBMASTER_EMAIL || !WEBMASTER_PASSWORD) {
    console.error(
      'Missing env vars. Run like:\n' +
        'WEBMASTER_NAME="Your Name" WEBMASTER_EMAIL="you@example.com" WEBMASTER_PASSWORD="yourpassword" node scripts/seedWebmaster.js'
    );
    process.exit(1);
  }

  const existingByEmail = await prisma.user.findUnique({ where: { email: WEBMASTER_EMAIL } });
  if (existingByEmail) {
    console.error(`STOP: a user with email ${WEBMASTER_EMAIL} already exists (role: ${existingByEmail.role}). No changes made.`);
    process.exit(1);
  }

  const existingWebmaster = await prisma.user.findFirst({ where: { role: 'webmaster' } });
  if (existingWebmaster) {
    console.error(`STOP: a Webmaster already exists (${existingWebmaster.email}, ${existingWebmaster.staffId}). This script only seeds the initial one.`);
    process.exit(1);
  }

  const conflict = await prisma.user.findUnique({ where: { staffId: 'WEB-0001' } });
  if (conflict) {
    console.error(`STOP: staffId "WEB-0001" is already assigned to ${conflict.email}. No changes made.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(WEBMASTER_PASSWORD, 10);

  await prisma.user.create({
    data: {
      fullName: WEBMASTER_NAME,
      email: WEBMASTER_EMAIL,
      passwordHash,
      role: 'webmaster',
      staffId: 'WEB-0001',
      accountStatus: 'active',
    },
  });

  console.log(`Webmaster WEB-0001 created for ${WEBMASTER_EMAIL}.`);
  await prisma.$disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

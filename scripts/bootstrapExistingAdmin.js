// DEC-DBA-020 — one-time bootstrap for the EXISTING production Admin.
//
// This never guesses or hard-codes the live admin's identity. ADAM supplies
// the real email at deployment time via EXISTING_ADMIN_EMAIL. The script:
//   1. Finds exactly that user.
//   2. Verifies role === 'admin'.
//   3. Verifies no other user already holds staffId 'ADM-0001'.
//   4. Assigns staffId = 'ADM-0001', accountStatus = 'active'.
//   5. Makes no password/passwordHash change of any kind.
//
// Any validation failure -> STOP, no database mutation.
//
// Usage:
//   EXISTING_ADMIN_EMAIL="the-real-admin@example.com" node scripts/bootstrapExistingAdmin.js
//
// NOT RUN as part of this BUILD pass — no live DB access was used to write
// or test this script. Documented for ADAM to run under MIGRATE-DBA-001.

require('dotenv').config();
const prisma = require('../src/config/prisma');

const run = async () => {
  const { EXISTING_ADMIN_EMAIL } = process.env;

  if (!EXISTING_ADMIN_EMAIL) {
    console.error('Missing env var. Run like:\nEXISTING_ADMIN_EMAIL="admin@example.com" node scripts/bootstrapExistingAdmin.js');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: EXISTING_ADMIN_EMAIL } });

  if (!user) {
    console.error(`STOP: no user found with email ${EXISTING_ADMIN_EMAIL}. No changes made.`);
    process.exit(1);
  }

  if (user.role !== 'admin') {
    console.error(`STOP: ${EXISTING_ADMIN_EMAIL} has role "${user.role}", not "admin". No changes made.`);
    process.exit(1);
  }

  if (user.staffId) {
    console.error(`STOP: ${EXISTING_ADMIN_EMAIL} already has staffId "${user.staffId}". No changes made.`);
    process.exit(1);
  }

  const conflict = await prisma.user.findUnique({ where: { staffId: 'ADM-0001' } });
  if (conflict) {
    console.error(`STOP: staffId "ADM-0001" is already assigned to a different user (${conflict.email}). No changes made.`);
    process.exit(1);
  }

  // Also seed the ADM counter to 1 here so a later demo-admin seed run
  // (which expects ADM-0001 to already exist) starts from the right base,
  // without this script needing to know about that script's internals.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { staffId: 'ADM-0001', accountStatus: 'active' },
      // passwordHash intentionally absent from `data` — untouched.
    }),
    prisma.staffIdCounter.upsert({
      where: { prefix: 'ADM' },
      update: { count: { increment: 0 } }, // no-op if already ahead
      create: { prefix: 'ADM', count: 1 },
    }),
  ]);

  console.log(`Assigned ADM-0001 to ${EXISTING_ADMIN_EMAIL}. Password unchanged.`);
  await prisma.$disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

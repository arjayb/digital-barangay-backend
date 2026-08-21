// One-time backfill (DEC-DBA-021): assigns trackingNumber to every existing
// DocumentRequest that doesn't have one yet, deterministically ordered by
// createdAt ASC then id ASC as tie-breaker, grouped by the year the request
// was created in. After backfilling, sets each year's TrackingCounter to
// the last number assigned so new requests (via trackingNumber.js) continue
// the sequence correctly rather than restarting at 1.
//
// Idempotent: only touches rows where trackingNumber is currently null, so
// re-running it after a partial run (or after new v1.1.0 requests have
// already been created with their own tracking numbers) is safe.
//
// NOT RUN as part of this BUILD pass — no live DB access was used. For
// ADAM to run under MIGRATE-DBA-001, ideally against a staging copy first.

require('dotenv').config();
const prisma = require('../src/config/prisma');

const run = async () => {
  const requests = await prisma.documentRequest.findMany({
    where: { trackingNumber: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  if (!requests.length) {
    console.log('Nothing to backfill — every request already has a tracking number.');
    await prisma.$disconnect();
    return;
  }

  const byYear = new Map();
  for (const r of requests) {
    const year = new Date(r.createdAt).getFullYear();
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(r);
  }

  await prisma.$transaction(async (tx) => {
    for (const [year, yearRequests] of byYear) {
      const existingCounter = await tx.trackingCounter.findUnique({ where: { year } });
      let count = existingCounter?.count || 0;

      for (const r of yearRequests) {
        count += 1;
        const trackingNumber = `DBA-${year}-${String(count).padStart(5, '0')}`;
        await tx.documentRequest.update({ where: { id: r.id }, data: { trackingNumber } });
        console.log(`${r.id} -> ${trackingNumber}`);
      }

      await tx.trackingCounter.upsert({
        where: { year },
        update: { count },
        create: { year, count },
      });
    }
  });

  console.log(`Backfilled ${requests.length} request(s) across ${byYear.size} year(s).`);
  await prisma.$disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

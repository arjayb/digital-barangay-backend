// Concurrency-safe DBA-YYYY-NNNNN generator (DEC-DBA-021).
//
// `tx` must be a Prisma transaction client (from prisma.$transaction), so
// the counter increment and the record it's stamped on commit or roll back
// together. The increment itself — UPDATE ... SET count = count + 1 WHERE
// year = $1 — is safe under concurrent callers even at the default READ
// COMMITTED isolation level: Postgres takes a row lock on the first UPDATE
// and makes the second wait for it, so two simultaneous requests can never
// read-then-write the same starting value. This is why it's implemented as
// a single UPDATE rather than a SELECT + increment-in-application-code.
async function nextTrackingNumber(tx, date = new Date()) {
  const year = date.getFullYear();

  let counter;
  try {
    counter = await tx.trackingCounter.update({
      where: { year },
      data: { count: { increment: 1 } },
    });
  } catch (err) {
    // No row for this year yet. Try to create it — if another concurrent
    // request wins that race, fall back to the update, which will now find
    // the row the winner just created.
    try {
      counter = await tx.trackingCounter.create({ data: { year, count: 1 } });
    } catch {
      counter = await tx.trackingCounter.update({
        where: { year },
        data: { count: { increment: 1 } },
      });
    }
  }

  return `DBA-${year}-${String(counter.count).padStart(5, '0')}`;
}

module.exports = { nextTrackingNumber };

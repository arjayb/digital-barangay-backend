// Concurrency-safe ADM-#### generator, same pattern as trackingNumber.js:
// a single UPDATE ... SET count = count + 1 on an existing counter row,
// which Postgres serializes at the row-lock level regardless of isolation
// level. `tx` must be a Prisma transaction client so this commits atomically
// with whatever record it's being assigned to.
async function nextStaffId(tx, prefix = 'ADM') {
  let counter;
  try {
    counter = await tx.staffIdCounter.update({
      where: { prefix },
      data: { count: { increment: 1 } },
    });
  } catch (err) {
    try {
      counter = await tx.staffIdCounter.create({ data: { prefix, count: 1 } });
    } catch {
      counter = await tx.staffIdCounter.update({
        where: { prefix },
        data: { count: { increment: 1 } },
      });
    }
  }

  return `${prefix}-${String(counter.count).padStart(4, '0')}`;
}

module.exports = { nextStaffId };

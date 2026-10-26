import { deduplicateTrirRecordsInDb, getTrirRecords } from '../server/db-services.ts';

async function main() {
  console.log('--- Starting TRIR Registry Deduplication ---');
  const before = await getTrirRecords();
  console.log(`Current records before deduplication: ${before.length}`);

  const removedCount = await deduplicateTrirRecordsInDb();
  console.log(`Removed duplicate rows: ${removedCount}`);

  const after = await getTrirRecords();
  console.log(`Records remaining after deduplication: ${after.length}`);

  console.log('List of distinct remaining records:');
  after.forEach((r, i) => {
    console.log(`${i + 1}. [ID: ${r.id}] ${r.year} ${r.month} - کارکرد: ${r.totalHours} - حوادث: ${r.incidents}`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error('Deduplication failed:', err);
  process.exit(1);
});

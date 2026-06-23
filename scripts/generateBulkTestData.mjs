import { generateBulkTestData } from '../src/server/bulkTestDataGenerator.js';

const perStatus = Number.parseInt(process.argv[2] || '3', 10);
const result = generateBulkTestData({
  perStatus: Number.isFinite(perStatus) ? perStatus : 3,
  reset: true
});

console.log(JSON.stringify({
  ok: true,
  perStatus: result.perStatus,
  generatedTickets: result.generatedTickets,
  users: result.users.length,
  skippedSupportStatuses: result.skippedSupportStatuses
}, null, 2));

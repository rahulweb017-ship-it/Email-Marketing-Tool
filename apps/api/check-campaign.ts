import {db} from './src/config/database.js';

(async () => {
  const c = await db('campaigns')
    .where('id', 'c8521a3d-fa5b-4754-8fb2-eaef7bc92045')
    .first();

  console.log(JSON.stringify({
    name: c.name,
    state: c.state,
    schedule_date: c.schedule_date,
    sent_at: c.sent_at,
    updated_at: c.updated_at,
  }, null, 2));

  process.exit(0);
})();

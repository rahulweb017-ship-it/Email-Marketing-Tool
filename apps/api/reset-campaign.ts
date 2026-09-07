import {db} from './src/config/database.js';

(async () => {
  await db('campaigns')
    .where('id', 'c8521a3d-fa5b-4754-8fb2-eaef7bc92045')
    .update({
      state: 'draft',
      updated_at: new Date(),
    });

  console.log('Campaign reset to draft');
  process.exit(0);
})();

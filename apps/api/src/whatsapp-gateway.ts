// whatsapp-gateway — the third process. Holds QR-linked WhatsApp sessions (long-lived sockets that must
// survive API deploys) and runs the paced outbound dispatcher for every connected number.
import 'dotenv/config';
import { Worker } from 'bullmq';
import { db } from './config/database.js';
import { redis } from './config/redis.js';
import { SessionManager } from './modules/whatsapp/gateway/session-manager.js';
import { Dispatcher } from './modules/whatsapp/gateway/dispatcher.js';

const LOCK_KEY = 'wa:gateway:lock';
const LOCK_TTL_S = 30;
const instanceId = `${process.pid}-${Date.now()}`;

async function acquireLock(): Promise<boolean> {
  const ok = await redis.set(LOCK_KEY, instanceId, 'EX', LOCK_TTL_S, 'NX');
  return ok === 'OK';
}

async function main() {
  // Two gateways would open the same WhatsApp session twice and kick each other off
  if (!(await acquireLock())) {
    console.error('[wa-gateway] another gateway instance is already running (Redis lock held). Exiting.');
    process.exit(1);
  }
  const lockTimer = setInterval(async () => {
    const owner = await redis.get(LOCK_KEY);
    if (owner === instanceId) await redis.expire(LOCK_KEY, LOCK_TTL_S);
    else { console.error('[wa-gateway] lost the gateway lock; exiting'); process.exit(1); }
  }, 10_000);

  // Messages left mid-send by a crash: don't resend (a duplicate is worse than a gap) — mark and surface them
  const interrupted = await db('whatsapp_messages').where('status', 'sending')
    .update({ status: 'failed', error: 'Interrupted while sending; it may or may not have arrived', failed_at: new Date(), updated_at: new Date() });
  if (interrupted) console.warn(`[wa-gateway] marked ${interrupted} interrupted message(s) as failed`);

  const sessions = new SessionManager();
  await sessions.start();

  const commands = new Worker('whatsapp-session', async (job) => {
    if (job.name === 'connect') return sessions.connect(job.data.account_id);
    if (job.name === 'logout') return sessions.logout(job.data.account_id, !!job.data.deleting);
  }, { connection: redis, concurrency: 1 });
  commands.on('failed', (job, err) => console.error(`[wa-gateway] ${job?.name} ${job?.data?.account_id} failed: ${err.message}`));

  const dispatcher = new Dispatcher(sessions);
  dispatcher.start();
  console.log('[wa-gateway] running');

  const shutdown = async () => {
    console.log('[wa-gateway] shutting down...');
    clearInterval(lockTimer);
    await dispatcher.stop();
    await commands.close();
    await sessions.stopAll();
    if (await redis.get(LOCK_KEY) === instanceId) await redis.del(LOCK_KEY);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[wa-gateway] failed to start:', err);
  process.exit(1);
});

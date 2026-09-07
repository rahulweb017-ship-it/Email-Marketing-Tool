import type { Queue, JobsOptions } from 'bullmq';

/**
 * Safely add a job to a BullMQ queue with graceful fallback for Redis version issues
 * Redis 3.x on Windows doesn't support BullMQ which requires Redis 5.0+
 */
export async function safeQueueAdd<T = any>(
  queue: Queue,
  jobName: string,
  data: T,
  opts?: JobsOptions,
): Promise<boolean> {
  try {
    await queue.add(jobName, data, opts);
    return true;
  } catch (err: any) {
    // Check if it's a Redis version error
    if (err?.message?.includes('Redis version needs to be greater')) {
      console.warn(`Queue operation failed (${queue.name}): Redis version incompatibility. Job will not be processed automatically.`);
      return false;
    }
    // Re-throw other errors
    throw err;
  }
}

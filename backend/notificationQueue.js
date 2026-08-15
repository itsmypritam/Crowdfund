const { Queue, Worker } = require("bullmq");

const QUEUE_NAME = "notifications";

function connectionOptions(redisUrl) {
  return { url: redisUrl };
}

function createQueue(redisUrl) {
  if (!redisUrl) return null;
  return new Queue(QUEUE_NAME, {
    connection: connectionOptions(redisUrl),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 500,
      removeOnFail: 2000,
    },
  });
}

function createWorker({ redisUrl, processNotification, logger }) {
  if (!redisUrl) return null;
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      await processNotification(job.data);
    },
    {
      connection: connectionOptions(redisUrl),
      concurrency: 10,
    }
  );
  worker.on("failed", (job, err) => {
    if (logger) logger.error({ jobId: job && job.id, err }, "notification job failed");
  });
  worker.on("error", (err) => {
    if (logger) logger.error(err, "notification worker error");
  });
  return worker;
}

module.exports = { QUEUE_NAME, createQueue, createWorker };

import { PgBossProvider } from "./pgboss.provider";
import { QueueProvider } from "./queue-provider.interface";

export function getQueueProvider(): QueueProvider {
  return new PgBossProvider();
}

export const queueProvider = getQueueProvider();

const QUEUE_KEY = 'voice_calendar_pending_writes';

export interface PendingWrite {
  id: string;
  path: string;
  init: {
    method: string;
    headers?: Record<string, string>;
    body?: string;
  };
  label: string;
  createdAt: string;
}

function readQueue(): PendingWrite[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeQueue(queue: PendingWrite[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function addPendingWrite(path: string, init: RequestInit, label: string): PendingWrite {
  const pending: PendingWrite = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    path,
    init: {
      method: init.method || 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof init.body === 'string' ? init.body : undefined,
    },
    label,
    createdAt: new Date().toISOString(),
  };
  writeQueue([...readQueue(), pending]);
  return pending;
}

export function getPendingWrites(): PendingWrite[] {
  return readQueue();
}

export async function flushPendingWrites(fetcher: (path: string, init?: RequestInit) => Promise<Response>) {
  const queue = readQueue();
  if (queue.length === 0) {
    return { synced: 0, remaining: 0 };
  }

  const remaining: PendingWrite[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      const response = await fetcher(item.path, item.init);
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success !== false) {
        synced += 1;
      } else {
        remaining.push(item);
      }
    } catch (error) {
      remaining.push(item);
    }
  }

  writeQueue(remaining);
  return { synced, remaining: remaining.length };
}

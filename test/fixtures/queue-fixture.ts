import { vi, type Mock } from "vitest";

export function queueMessage(body: unknown, attempts = 1) {
  return { body, attempts, ack: vi.fn(), retry: vi.fn() } as unknown as Message<unknown> & {
    ack: Mock;
    retry: Mock;
  };
}

/** Esito di un invio accettato dalla coda, per `send` e `sendBatch`. */
export const queued = { metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } } };

/** Coda sostitutiva che accetta tutto; `overrides` sostituisce i metodi osservati dalla prova. */
export function fakeQueue(overrides: Partial<Queue> = {}): Queue {
  return {
    metrics: vi.fn(async () => ({ backlogCount: 0, backlogBytes: 0 })),
    send: vi.fn(async () => queued),
    sendBatch: vi.fn(async () => queued),
    ...overrides,
  };
}

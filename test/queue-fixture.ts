import { vi, type Mock } from "vitest";

export function queueMessage(body: unknown, attempts = 1) {
  return { body, attempts, ack: vi.fn(), retry: vi.fn() } as unknown as Message<unknown> & {
    ack: Mock;
    retry: Mock;
  };
}

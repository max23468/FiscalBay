// Solo nel runtime Node delle prove unitarie; la suite Cloudflare usa il builtin reale.
export function waitUntil(task: Promise<unknown>): void {
  void task;
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { onScrollEnd, scrollSettle } from "../app/components/scroll-end";

describe("fine dello scorrimento", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("con scrollend decide all'evento del browser, non durante lo scorrimento", () => {
    const target = new EventTarget();
    const ended = vi.fn();
    const stop = onScrollEnd(target, ended, true);
    target.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(scrollSettle * 2);
    expect(ended).not.toHaveBeenCalled();
    target.dispatchEvent(new Event("scrollend"));
    expect(ended).toHaveBeenCalledOnce();
    stop();
    target.dispatchEvent(new Event("scrollend"));
    expect(ended).toHaveBeenCalledOnce();
  });

  it("senza scrollend aspetta una pausa dopo l'ultimo scorrimento", () => {
    const target = new EventTarget();
    const ended = vi.fn();
    const stop = onScrollEnd(target, ended, false);
    target.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(scrollSettle - 1);
    target.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(scrollSettle - 1);
    expect(ended).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(ended).toHaveBeenCalledOnce();
    // Smettere di ascoltare annulla anche la pausa in corso.
    target.dispatchEvent(new Event("scroll"));
    stop();
    vi.advanceTimersByTime(scrollSettle);
    expect(ended).toHaveBeenCalledOnce();
  });

  it("riconosce il supporto dall'oggetto che scorre", () => {
    const target = Object.assign(new EventTarget(), { onscrollend: null });
    const ended = vi.fn();
    onScrollEnd(target, ended);
    target.dispatchEvent(new Event("scrollend"));
    expect(ended).toHaveBeenCalledOnce();
  });
});

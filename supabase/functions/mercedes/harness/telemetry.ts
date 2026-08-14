// Component 12 — observability and lifecycle.
//
// The old loop had console.error and nothing else, so "Mercedes was slow" or
// "Mercedes got it wrong" had no evidence behind it. Every decision point now
// emits a typed event. Events are buffered in memory (an Edge Function is
// short-lived) and flushed once at the end — one insert, not one per hop.

import type { HarnessEvent } from './types.ts';

export type EventSink = (events: HarnessEvent[]) => Promise<void> | void;

export class EventBus {
  readonly events: HarnessEvent[] = [];
  private readonly startedAt = Date.now();
  private hop = 0;

  constructor(private readonly console_ = true) {}

  setHop(hop: number): void {
    this.hop = hop;
  }

  emit(kind: string, data: Record<string, unknown> = {}): HarnessEvent {
    const event: HarnessEvent = {
      kind,
      hop: this.hop,
      atMs: Date.now() - this.startedAt,
      data,
    };
    this.events.push(event);
    if (this.console_ && LOUD.has(kind)) {
      console.log(`[mercedes ${event.atMs}ms hop${event.hop}] ${kind}`, JSON.stringify(data));
    }
    return event;
  }

  elapsedMs(): number {
    return Date.now() - this.startedAt;
  }

  /** Anything worth keeping after the request is gone. */
  async flush(sink?: EventSink): Promise<void> {
    if (!sink || !this.events.length) return;
    try {
      await sink(this.events);
    } catch (err) {
      // Telemetry must never be the reason a reply fails to reach the user.
      console.error('mercedes telemetry flush failed:', (err as Error).message);
    }
  }
}

const LOUD = new Set([
  'run.start',
  'run.end',
  'model.retry',
  'tool.error',
  'guardrail.trip',
  'context.compact',
  'verify.failed',
  'budget.exceeded',
]);

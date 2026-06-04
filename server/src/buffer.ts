// Ring buffer + dedup for replay / late joiners.

import type { ChatMessage } from './types.js';

export class RingBuffer {
  private items: ChatMessage[] = [];
  private seen: Set<string> = new Set();
  private order: string[] = []; // id insertion order for seen eviction

  constructor(private readonly capacity = 500) {}

  // Returns true if the message was new (and stored), false if a duplicate.
  add(msg: ChatMessage): boolean {
    if (this.seen.has(msg.id)) return false;
    this.seen.add(msg.id);
    this.order.push(msg.id);
    this.items.push(msg);

    if (this.items.length > this.capacity) {
      this.items.shift();
    }
    // Keep the dedup set bounded a bit larger than the buffer.
    while (this.order.length > this.capacity * 2) {
      const evicted = this.order.shift();
      if (evicted) this.seen.delete(evicted);
    }
    return true;
  }

  snapshot(): ChatMessage[] {
    return this.items.slice();
  }

  get size(): number {
    return this.items.length;
  }
}

/**
 * daemon-resources.ts — Bounded Memory Collections
 *
 * Provides memory-safe data structures for long-running daemon sessions.
 * Without bounds, collections like EventSourcedState.events grow indefinitely
 * during daemon uptime (days/weeks), causing memory leaks.
 *
 * PRINCIPLE: Unbounded growth is a bug, not a feature.
 */

// ── BoundedQueue ──────────────────────────────────────────────────────────────

/**
 * A FIFO queue with a hard maximum capacity.
 * When capacity is exceeded, the oldest item is evicted silently.
 */
export class BoundedQueue<T> {
  private items: T[] = [];

  constructor(private readonly maxSize: number) {
    if (maxSize < 1) throw new RangeError("BoundedQueue maxSize must be >= 1");
  }

  /** Add an item. Evicts the oldest if over capacity. */
  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.maxSize) {
      this.items.shift(); // evict oldest
    }
  }

  /** Return a snapshot of all items (oldest first). */
  toArray(): T[] {
    return [...this.items];
  }

  /** Replace all items at once (e.g., after loading from disk). Trims to cap. */
  load(items: T[]): void {
    this.items = items.slice(-this.maxSize);
  }

  /** Number of items currently held. */
  size(): number {
    return this.items.length;
  }

  /** Whether the queue is at capacity. */
  isFull(): boolean {
    return this.items.length >= this.maxSize;
  }

  /** Remove and return items that match the predicate (drain). */
  drain(predicate: (item: T) => boolean): T[] {
    const drained: T[] = [];
    this.items = this.items.filter((item) => {
      if (predicate(item)) {
        drained.push(item);
        return false;
      }
      return true;
    });
    return drained;
  }

  /** Remove all items. */
  clear(): void {
    this.items = [];
  }

  /** Find items matching the predicate (non-destructive). */
  filter(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }

  /** Iterate over all items. */
  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]();
  }
}

// ── LRUCache ──────────────────────────────────────────────────────────────────

interface CacheEntry<V> {
  value: V;
  expiresAt: number | null; // null = no TTL
}

/**
 * A Least-Recently-Used cache with optional TTL per entry.
 * Evicts the least-recently-used entry when capacity is exceeded.
 */
export class LRUCache<K, V> {
  /** Ordered map: insertion order = LRU order. */
  private cache: Map<K, CacheEntry<V>> = new Map();

  constructor(
    private readonly maxSize: number,
    private readonly defaultTtlMs?: number
  ) {
    if (maxSize < 1) throw new RangeError("LRUCache maxSize must be >= 1");
  }

  /** Store a value. Uses defaultTtlMs if no explicit TTL given. */
  set(key: K, value: V, ttlMs?: number): void {
    // Delete first so re-insertion moves to end (most-recently-used)
    this.cache.delete(key);

    const effectiveTtl = ttlMs ?? this.defaultTtlMs;
    const expiresAt = effectiveTtl != null ? Date.now() + effectiveTtl : null;

    this.cache.set(key, { value, expiresAt });

    if (this.cache.size > this.maxSize) {
      // Evict LRU entry (first in insertion order)
      const lruKey = this.cache.keys().next().value;
      if (lruKey !== undefined) {
        this.cache.delete(lruKey);
      }
    }
  }

  /** Retrieve a value. Returns undefined if expired or missing. Marks as recently used. */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most-recently-used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /** Check existence without side-effects (does not update LRU order). */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /** Delete a specific key. */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /** Number of live (non-expired) entries. */
  size(): number {
    return this.cache.size;
  }

  /** Remove all entries. */
  clear(): void {
    this.cache.clear();
  }

  /** Evict all expired entries. Returns count evicted. */
  evictExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /** Returns an array of all valid keys currently in the cache. */
  keys(): K[] {
    const validKeys: K[] = [];
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt === null || now <= entry.expiresAt) {
        validKeys.push(key);
      }
    }
    return validKeys;
  }
}

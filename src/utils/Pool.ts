/**
 * Generic object pool to reduce GC pressure in hot paths such as per-frame
 * physics allocations (Vector3, contact manifolds, etc.).
 *
 * Objects are recycled rather than garbage-collected: `release` resets and
 * returns them to the pool; `acquire` hands them back out.
 *
 * @example
 * const vec3Pool = new ObjectPool(
 *   () => new Vector3(),
 *   (v) => v.set(0, 0, 0),
 *   32,  // pre-warm with 32 instances
 * );
 *
 * const v = vec3Pool.acquire();
 * v.set(1, 2, 3);
 * // ... use v ...
 * vec3Pool.release(v);   // reset and return to pool
 */
export class ObjectPool<T> {
  private readonly _pool:    T[] = [];
  private readonly _factory: () => T;
  private readonly _reset:   (obj: T) => void;
  private _acquired = 0;

  /**
   * @param factory   Creates a fresh instance when the pool is empty.
   * @param reset     Called on `release` to clean the object before re-pooling.
   * @param prewarm   Number of instances to pre-allocate in the constructor.
   */
  constructor(factory: () => T, reset: (obj: T) => void, prewarm = 0) {
    this._factory = factory;
    this._reset   = reset;
    for (let i = 0; i < prewarm; i++) this._pool.push(factory());
  }

  /**
   * Acquire an object (from the pool or newly allocated).
   * The returned object has been reset if it was previously released.
   */
  acquire(): T {
    this._acquired++;
    return this._pool.length > 0 ? this._pool.pop()! : this._factory();
  }

  /**
   * Return an object to the pool.
   * Calls the reset function, then pushes the object back for future reuse.
   */
  release(obj: T): void {
    this._acquired--;
    this._reset(obj);
    this._pool.push(obj);
  }

  /** Number of objects currently checked out (acquired but not yet released). */
  get acquired(): number {
    return this._acquired;
  }

  /** Number of objects currently sitting idle in the pool. */
  get available(): number {
    return this._pool.length;
  }

  /**
   * Total number of objects managed by this pool
   * (acquired + available, i.e. total ever allocated).
   */
  get total(): number {
    return this._acquired + this._pool.length;
  }

  /** Drain the pool — allow all idle objects to be garbage-collected. */
  drain(): void {
    this._pool.length = 0;
  }
}

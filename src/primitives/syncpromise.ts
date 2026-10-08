type Executor<T> = (resolve: (value: T) => void, reject: (reason?: unknown) => void) => void;

const PENDING = 0;
const ADOPTING = 1;
const FULFILLED = 2;
const REJECTED = 3;

type State = typeof PENDING | typeof ADOPTING | typeof FULFILLED | typeof REJECTED;

// oxlint-disable-next-line typescript/unbound-method -- Called with its Promise receiver via .call below.
const promiseThen = Promise.prototype.then;

export class SyncPromise<T> implements PromiseLike<Awaited<T>> {
  #state: State = PENDING;

  // Pending/adopting: continuation-list head
  // Settled: fulfillment value / rejection reason
  #data: unknown;

  static #Continuation = class Continuation<T> extends SyncPromise<T> {
    #next?: Continuation<any>;
    #onFulfilled?: ((value: any) => any) | null;
    #onRejected?: ((reason: unknown) => any) | null;

    constructor(
      parent: SyncPromise<any>,
      onFulfilled?: ((value: any) => any) | null,
      onRejected?: ((reason: unknown) => any) | null,
    ) {
      super();

      this.#onFulfilled = onFulfilled;
      this.#onRejected = onRejected;

      if (parent.#state < FULFILLED) {
        this.#next = parent.#data as Continuation<any> | undefined;
        parent.#data = this;
      } else {
        this.#consume(parent);
      }
    }

    static flush(head: unknown, parent: SyncPromise<any>): void {
      let current = head as Continuation<any> | undefined;
      let reversed: Continuation<any> | undefined;

      while (current) {
        const next = current.#next;
        current.#next = reversed;
        reversed = current;
        current = next;
      }

      while (reversed) {
        const next = reversed.#next;
        reversed.#next = undefined;
        reversed.#consume(parent);
        reversed = next;
      }
    }

    #consume(parent: SyncPromise<any>): void {
      const onFulfilled = this.#onFulfilled;
      const onRejected = this.#onRejected;

      this.#onFulfilled = undefined;
      this.#onRejected = undefined;

      try {
        if (parent.#state === FULFILLED) {
          this.resolve((onFulfilled ? onFulfilled(parent.#data) : parent.#data) as T);
        } else if (onRejected) {
          this.resolve(onRejected(parent.#data) as T);
        } else {
          this.reject(parent.#data);
        }
      } catch (error) {
        this.reject(error);
      }
    }
  };

  constructor(executor?: Executor<T>) {
    if (!executor) return;

    try {
      executor(
        (value) => this.resolve(value),
        (reason) => this.reject(reason),
      );
    } catch (error) {
      this.reject(error);
    }
  }

  resolve(value: T): void {
    if (this.#state !== PENDING) return;

    this.#state = ADOPTING;
    this.#adopt(value);
  }

  reject(reason?: unknown): void {
    if (this.#state === PENDING) {
      this.#settle(REJECTED, reason);
    }
  }

  static resolve<T>(value: T): SyncPromise<T> {
    const promise = new SyncPromise<T>();
    promise.resolve(value);

    return promise;
  }

  static reject<T = never>(reason?: unknown): SyncPromise<T> {
    const promise = new SyncPromise<T>();
    promise.reject(reason);

    return promise;
  }

  // oxlint-disable-next-line unicorn/no-thenable -- Synchronous PromiseLike delivery is this adapter's purpose.
  then<TResult1 = Awaited<T>, TResult2 = never>(
    onFulfilled?: ((value: Awaited<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): SyncPromise<TResult1 | TResult2> {
    return new SyncPromise.#Continuation<TResult1 | TResult2>(this, onFulfilled, onRejected);
  }

  #adopt(value: unknown): void {
    if (value === this) {
      this.#settle(REJECTED, new TypeError("A promise cannot resolve to itself"));
      return;
    }

    if (value === null || (typeof value !== "object" && typeof value !== "function")) {
      this.#settle(FULFILLED, value);
      return;
    }

    let called = false;

    try {
      const then =
        value instanceof Promise && value.constructor === Promise
          ? promiseThen
          : (value as { then?: unknown }).then;

      if (typeof then !== "function") {
        this.#settle(FULFILLED, value);
        return;
      }

      then.call(
        value,
        (value: unknown) => {
          if (called) return;

          called = true;
          this.#adopt(value);
        },
        (reason: unknown) => {
          if (called) return;

          called = true;
          this.#settle(REJECTED, reason);
        },
      );
    } catch (error) {
      if (!called) {
        this.#settle(REJECTED, error);
      }
    }
  }

  #settle(state: typeof FULFILLED | typeof REJECTED, value: unknown): void {
    const continuations = this.#data;

    this.#state = state;
    this.#data = value;

    SyncPromise.#Continuation.flush(continuations, this);
  }
}

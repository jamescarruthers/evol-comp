// workers/pool.js — Worker pool for parallel fitness evaluation
//
// Distributes batches of individuals across N web workers, collects
// results, and resolves a single Promise when the entire batch is done.

export class WorkerPool {
  /**
   * @param {number} [size] - number of workers (defaults to navigator.hardwareConcurrency or 4)
   */
  constructor(size) {
    this.size = size || (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
    this.workers = [];
    this._nextId = 0;
    this._pending = new Map(); // id → { resolve, remaining, results[] }
    this._ready = false;
  }

  /**
   * Lazily initialise the worker pool.  Called automatically on first
   * evaluateBatch(), but can be called earlier to warm up.
   */
  init() {
    if (this._ready) return;

    // Resolve the worker script URL relative to the pool module
    const workerUrl = new URL('./fitness-worker.js', import.meta.url);

    for (let i = 0; i < this.size; i++) {
      const worker = new Worker(workerUrl, { type: 'module' });
      worker.onmessage = (e) => this._onMessage(e, i);
      worker.onerror = (e) => this._onError(e, i);
      this.workers.push(worker);
    }

    this._ready = true;
  }

  /**
   * Evaluate a batch of individuals in parallel across all workers.
   *
   * Each individual is sent to a worker along with the shared evaluation
   * context (palette, weights, etc).  When all workers finish, the
   * individuals' fitness and scores are updated in place and the returned
   * Promise resolves.
   *
   * @param {Array} individuals - individuals to evaluate (mutated in place)
   * @param {Array} palette
   * @param {Object} weights
   * @param {string} bgColour
   * @param {number} aspectRatio
   * @returns {Promise<void>}
   */
  evaluateBatch(individuals, palette, weights, bgColour, aspectRatio) {
    this.init();

    if (individuals.length === 0) return Promise.resolve();

    const batchId = this._nextId++;

    return new Promise((resolve) => {
      // Split individuals into roughly equal chunks, one per worker
      const chunks = this._split(individuals, this.size);
      const activeWorkers = chunks.length;

      this._pending.set(batchId, {
        resolve,
        remaining: activeWorkers,
        individuals,
        chunks,
        results: new Array(activeWorkers)
      });

      for (let i = 0; i < activeWorkers; i++) {
        this.workers[i].postMessage({
          type: 'evaluate',
          id: batchId,
          workerIndex: i,
          individuals: chunks[i],
          palette,
          weights,
          bgColour,
          aspectRatio
        });
      }
    });
  }

  /**
   * Handle a result message from a worker.
   */
  _onMessage(e, workerIndex) {
    const { type, id, results } = e.data;
    if (type !== 'result') return;

    const batch = this._pending.get(id);
    if (!batch) return;

    batch.results[workerIndex] = results;
    batch.remaining--;

    if (batch.remaining <= 0) {
      // Stitch results back onto the original individuals in order
      let offset = 0;
      for (let ci = 0; ci < batch.chunks.length; ci++) {
        const chunkResults = batch.results[ci];
        if (!chunkResults) { offset += batch.chunks[ci].length; continue; }
        for (let j = 0; j < chunkResults.length; j++) {
          batch.individuals[offset + j].fitness = chunkResults[j].fitness;
          batch.individuals[offset + j].scores = chunkResults[j].scores;
        }
        offset += batch.chunks[ci].length;
      }

      this._pending.delete(id);
      batch.resolve();
    }
  }

  /**
   * Handle a worker error.
   */
  _onError(e, workerIndex) {
    console.error(`Worker ${workerIndex} error:`, e.message || e);
  }

  /**
   * Split an array into `n` roughly equal chunks.
   */
  _split(arr, n) {
    const chunks = [];
    const chunkSize = Math.ceil(arr.length / n);
    for (let i = 0; i < arr.length; i += chunkSize) {
      chunks.push(arr.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Terminate all workers and release resources.
   */
  destroy() {
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this._pending.clear();
    this._ready = false;
  }
}

/**
 * In-Memory Queue Implementation for Alert Ingestion
 * Supports enqueue, dequeue, and dead-letter queue for failed processing
 */

class InMemoryQueue {
  constructor(options = {}) {
    this.queue = [];
    this.deadLetterQueue = [];
    this.processing = new Set();
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000; // 1 second
    this.metrics = {
      enqueued: 0,
      dequeued: 0,
      failed: 0,
      deadLettered: 0
    };
  }

  /**
   * Add item to queue
   * @param {Object} item - Item to enqueue
   * @param {Object} options - Enqueue options
   */
  enqueue(item, options = {}) {
    const queueItem = {
      id: item.id || `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data: item,
      priority: options.priority || 0,
      retries: 0,
      maxRetries: options.maxRetries || this.maxRetries,
      enqueuedAt: Date.now(),
      lastAttemptAt: null,
      error: null
    };

    // Insert based on priority (higher priority first)
    const insertIndex = this.queue.findIndex(existing => existing.priority < queueItem.priority);
    if (insertIndex === -1) {
      this.queue.push(queueItem);
    } else {
      this.queue.splice(insertIndex, 0, queueItem);
    }

    this.metrics.enqueued++;
    console.log(`[Queue] Enqueued item ${queueItem.id} with priority ${queueItem.priority}`);
    
    return queueItem.id;
  }

  /**
   * Remove and return next item from queue
   * @returns {Object|null} Next queue item or null if empty
   */
  dequeue() {
    if (this.queue.length === 0) {
      return null;
    }

    const item = this.queue.shift();
    item.lastAttemptAt = Date.now();
    this.processing.add(item.id);
    this.metrics.dequeued++;
    
    console.log(`[Queue] Dequeued item ${item.id} (attempt ${item.retries + 1})`);
    return item;
  }

  /**
   * Mark item as successfully processed
   * @param {string} itemId - ID of processed item
   */
  ack(itemId) {
    this.processing.delete(itemId);
    console.log(`[Queue] Acknowledged successful processing of ${itemId}`);
  }

  /**
   * Mark item as failed and handle retry logic
   * @param {string} itemId - ID of failed item
   * @param {Error} error - Error that occurred
   */
  nack(itemId, error) {
    this.processing.delete(itemId);
    
    // Find the item in processing or create a stub
    const failedItem = {
      id: itemId,
      retries: 0,
      maxRetries: this.maxRetries,
      error: error.message || 'Unknown error',
      lastAttemptAt: Date.now()
    };

    failedItem.retries++;
    this.metrics.failed++;

    if (failedItem.retries >= failedItem.maxRetries) {
      // Move to dead letter queue
      this.deadLetterQueue.push({
        ...failedItem,
        deadLetteredAt: Date.now(),
        finalError: error.message || 'Max retries exceeded'
      });
      this.metrics.deadLettered++;
      console.error(`[Queue] Item ${itemId} moved to dead letter queue after ${failedItem.retries} attempts:`, error.message);
    } else {
      // Retry after delay
      setTimeout(() => {
        this.enqueue(failedItem.data, { priority: -1 }); // Lower priority for retries
        console.log(`[Queue] Retrying item ${itemId} (attempt ${failedItem.retries + 1})`);
      }, this.retryDelay);
    }
  }

  /**
   * Get queue statistics
   * @returns {Object} Queue metrics and status
   */
  getStats() {
    return {
      queueSize: this.queue.length,
      processing: this.processing.size,
      deadLetterSize: this.deadLetterQueue.length,
      metrics: { ...this.metrics },
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }

  /**
   * Get items in dead letter queue
   * @returns {Array} Dead letter queue items
   */
  getDeadLetterItems() {
    return [...this.deadLetterQueue];
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue() {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue.length = 0;
    console.log(`[Queue] Cleared ${count} items from dead letter queue`);
    return count;
  }

  /**
   * Check if queue is empty
   * @returns {boolean}
   */
  isEmpty() {
    return this.queue.length === 0;
  }

  /**
   * Get current queue size
   * @returns {number}
   */
  size() {
    return this.queue.length;
  }

  /**
   * Initialize queue with start time
   */
  start() {
    this.startTime = Date.now();
    this.running = true;
    console.log('[Queue] In-memory queue started');
  }

  /**
   * Stop queue processing
   */
  stop() {
    this.running = false;
    console.log('[Queue] In-memory queue stopped');
  }
}

// Create singleton instance
const alertQueue = new InMemoryQueue({
  maxRetries: 3,
  retryDelay: 1000
});

// Start the queue
alertQueue.start();

module.exports = { InMemoryQueue, alertQueue };
module.exports.default = alertQueue;
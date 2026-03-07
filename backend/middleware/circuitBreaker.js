/**
 * Circuit Breaker Pattern Implementation
 * 
 * Monitors external service calls and opens the circuit after consecutive failures.
 * Validates: Requirements 14.5, 14.6
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are short-circuited
 * - HALF_OPEN: Testing if service has recovered, allowing 1 test request
 */

const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(fn) {
    if (this.state === STATES.OPEN) {
      // Check if timeout has passed
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = STATES.HALF_OPEN;
        console.log(`[CircuitBreaker:${this.name}] Transitioning to HALF_OPEN state`);
      } else {
        throw new Error(`Service ${this.name} is temporarily unavailable. Please try again later.`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    if (this.state === STATES.HALF_OPEN) {
      console.log(`[CircuitBreaker:${this.name}] Service recovered, closing circuit`);
    }
    this.failureCount = 0;
    this.state = STATES.CLOSED;
    this.successCount++;
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = STATES.OPEN;
      console.log(
        `[CircuitBreaker:${this.name}] Circuit OPENED after ${this.failureCount} consecutive failures`
      );
    }
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  // For demo: manually trigger failures
  simulateFailure() {
    this.onFailure();
  }

  reset() {
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
  }
}

// Pre-configured circuit breakers for each external service
const circuitBreakers = {
  llm: new CircuitBreaker('LLM_Engine', { failureThreshold: 5, resetTimeout: 30000 }),
  ocr: new CircuitBreaker('OCR_Service', { failureThreshold: 5, resetTimeout: 30000 }),
  voice: new CircuitBreaker('Voice_Synthesizer', { failureThreshold: 5, resetTimeout: 30000 }),
  storage: new CircuitBreaker('Knowledge_Store', { failureThreshold: 5, resetTimeout: 30000 }),
};

module.exports = { CircuitBreaker, circuitBreakers };

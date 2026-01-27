#!/usr/bin/env node

/**
 * Load Testing Script for NotebookLM Clone API
 *
 * This script sends 100 parallel requests to the chat API endpoint
 * and reports statistics about response times, success rates, and errors.
 */

const BASE_URL = "https://notebooklm-frontend-743023577634.asia-south1.run.app";
const API_ENDPOINT = "/api/chat";
const NUM_REQUESTS = 100;

// Test data - you may need to adjust these based on your actual requirements
const TEST_THREAD_ID = "test-thread-" + Date.now();
const TEST_MESSAGES = [
  "What can you tell me about this document?",
  "Explain photosynthesis",
  "How does gravity work?",
  "What is machine learning?",
  "Tell me about quantum computing",
  "What are the benefits of exercise?",
  "Explain the water cycle",
  "What is artificial intelligence?",
  "How do computers work?",
  "What is climate change?",
];

/**
 * Generates a random test message
 */
function getRandomMessage() {
  return TEST_MESSAGES[Math.floor(Math.random() * TEST_MESSAGES.length)];
}

/**
 * Sends a single request to the chat API
 */
async function sendRequest(requestId) {
  const startTime = Date.now();
  const message = getRandomMessage();

  try {
    const response = await fetch(`${BASE_URL}${API_ENDPOINT}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
        threadId: TEST_THREAD_ID,
      }),
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // For SSE streams, we'll measure time to first byte
    // We'll read a small chunk to ensure connection is established
    if (response.ok && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        // Read first chunk to measure initial response time
        const { done, value } = await reader.read();
        if (!done && value) {
          decoder.decode(value, { stream: true });
        }
        reader.cancel(); // Cancel the stream since we're just load testing
      } catch (streamError) {
        // Stream errors are acceptable for load testing
      }
    }

    return {
      requestId,
      success: response.ok,
      status: response.status,
      duration,
      error: null,
    };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      requestId,
      success: false,
      status: 0,
      duration,
      error: error.message,
    };
  }
}

/**
 * Main load testing function
 */
async function runLoadTest() {
  console.log("🚀 Starting Load Test");
  console.log(`📍 Target: ${BASE_URL}${API_ENDPOINT}`);
  console.log(`📊 Requests: ${NUM_REQUESTS} parallel requests`);
  console.log(`🧵 Thread ID: ${TEST_THREAD_ID}`);
  console.log("─".repeat(60));
  console.log("");

  const startTime = Date.now();

  // Create all requests as promises
  const requests = Array.from({ length: NUM_REQUESTS }, (_, i) =>
    sendRequest(i + 1)
  );

  // Execute all requests in parallel
  console.log("⏳ Sending requests...");
  const results = await Promise.all(requests);

  const endTime = Date.now();
  const totalDuration = endTime - startTime;

  // Calculate statistics
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const durations = results.map((r) => r.duration);

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  // Sort durations for percentile calculation
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const p50 = sortedDurations[Math.floor(sortedDurations.length * 0.5)];
  const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)];
  const p99 = sortedDurations[Math.floor(sortedDurations.length * 0.99)];

  // Group errors by type
  const errorGroups = {};
  failed.forEach((r) => {
    const key = r.error || `HTTP ${r.status}`;
    errorGroups[key] = (errorGroups[key] || 0) + 1;
  });

  // Print results
  console.log("");
  console.log("═".repeat(60));
  console.log("📈 LOAD TEST RESULTS");
  console.log("═".repeat(60));
  console.log("");
  console.log(
    `⏱️  Total Time: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`
  );
  console.log(`📊 Total Requests: ${NUM_REQUESTS}`);
  console.log(
    `✅ Successful: ${successful.length} (${(
      (successful.length / NUM_REQUESTS) *
      100
    ).toFixed(2)}%)`
  );
  console.log(
    `❌ Failed: ${failed.length} (${(
      (failed.length / NUM_REQUESTS) *
      100
    ).toFixed(2)}%)`
  );
  console.log("");
  console.log("⏱️  Response Time Statistics:");
  console.log(`   Average: ${avgDuration.toFixed(2)}ms`);
  console.log(`   Min: ${minDuration}ms`);
  console.log(`   Max: ${maxDuration}ms`);
  console.log(`   P50 (Median): ${p50}ms`);
  console.log(`   P95: ${p95}ms`);
  console.log(`   P99: ${p99}ms`);
  console.log("");

  if (failed.length > 0) {
    console.log("❌ Error Breakdown:");
    Object.entries(errorGroups).forEach(([error, count]) => {
      console.log(`   ${error}: ${count} occurrences`);
    });
    console.log("");
  }

  // Show sample failed requests
  if (failed.length > 0 && failed.length <= 10) {
    console.log("📋 Failed Request Details:");
    failed.forEach((r) => {
      console.log(
        `   Request #${r.requestId}: ${r.error || `HTTP ${r.status}`} (${
          r.duration
        }ms)`
      );
    });
  } else if (failed.length > 10) {
    console.log("📋 Sample Failed Requests (first 10):");
    failed.slice(0, 10).forEach((r) => {
      console.log(
        `   Request #${r.requestId}: ${r.error || `HTTP ${r.status}`} (${
          r.duration
        }ms)`
      );
    });
  }

  console.log("");
  console.log("═".repeat(60));
  console.log("✅ Load test completed!");
  console.log("═".repeat(60));
}

// Run the load test
runLoadTest().catch((error) => {
  console.error("❌ Load test failed:", error);
  process.exit(1);
});

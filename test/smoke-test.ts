/**
 * Phase 1 smoke-test harness.
 *
 * For each of the 3 smoke-test models, ask 5 questions and score:
 * 1. "What is this page about?" → expect getPageOutline call
 * 2. "What does the page say about X?" (X exists) → expect searchPage call
 * 3. "What does the page say about Y?" (Y does NOT exist) → no tool call
 * 4. "Read the contents of <selector>" → expect getElement call
 * 5. "What time is it?" (off-topic) → no tool call
 *
 * Pass = ≥ 12/15 correct.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { init, destroy, ask } from '../src/index.js';

const MODELS = [
  { preset: 'coign-balanced', modelId: 'Llama-3.2-3B-Instruct-q4f16_1-MLC' },
  { preset: 'coign-quality', modelId: 'Llama-3.1-8B-Instruct-q4f16_1-MLC' },
  { preset: 'coign-tools', modelId: 'Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC' },
];

const QUESTIONS = [
  { q: 'What is this page about?', expectedTool: 'agent.getPageOutline' },
  { q: 'What does the page say about Pricing?', expectedTool: 'agent.searchPage' },
  { q: 'What does the page say about quantum cryptography?', expectedTool: null },
  { q: 'Read the contents of #intro', expectedTool: 'agent.getElement' },
  { q: 'What time is it?', expectedTool: null },
];

// This test suite is designed to run in a real browser with WebGPU.
// In CI / Node it will skip unless a specific env flag is set.
const SKIP = typeof window === 'undefined' || !(navigator as any).gpu;

describe.skipIf(SKIP)('Phase 1 smoke-test', () => {
  let results: Array<{ model: string; question: string; passed: boolean }> = [];

  afterAll(() => {
    console.log('\n=== Smoke-test summary ===');
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    console.log(`${passed}/${total} passed`);
    if (passed >= 12) {
      console.log('✅ Gate passed — proceed to Phase 2');
    } else {
      console.log('❌ Gate failed — do not proceed to Phase 2');
    }
  });

  for (const { preset } of MODELS) {
    describe(preset, () => {
      let toolCalls: string[] = [];

      beforeAll(async () => {
        toolCalls = [];
        await init({
          model: preset,
          prompt: 'You are a helpful assistant on this page. Use your tools to answer questions about the page content.',
          onToolCall: (t) => {
            toolCalls.push(t.name);
          },
        });
      }, 120_000);

      afterAll(() => {
        destroy();
      });

      for (const { q, expectedTool } of QUESTIONS) {
        it(`${q}`, async () => {
          toolCalls = [];
          await ask(q);

          const calledExpected = expectedTool ? toolCalls.includes(expectedTool) : toolCalls.length === 0;
          const passed = calledExpected;

          results.push({ model: preset, question: q, passed });
          expect(passed).toBe(true);
        }, 60_000);
      }
    });
  }
});

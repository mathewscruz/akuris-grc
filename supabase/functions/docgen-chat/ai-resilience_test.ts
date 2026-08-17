import { assertEquals, assertRejects } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { withTransientFallback } from '../_shared/ai-resilience.ts';

class TestError extends Error {
  constructor(public code: string) { super(code); }
}

const transient = (error: unknown) => error instanceof TestError && error.code === 'AI_UNAVAILABLE';

Deno.test('503 transitório usa fallback e devolve o documento', async () => {
  let fallbackCalls = 0;
  const result = await withTransientFallback({
    primary: () => Promise.reject(new TestError('AI_UNAVAILABLE')),
    fallback: async () => { fallbackCalls += 1; return 'documento'; },
    isTransient: transient,
  });
  assertEquals(result, { value: 'documento', usedFallback: true });
  assertEquals(fallbackCalls, 1);
});

Deno.test('402 não executa fallback', async () => {
  let fallbackCalls = 0;
  await assertRejects(() => withTransientFallback({
    primary: () => Promise.reject(new TestError('CREDITS_EXHAUSTED')),
    fallback: async () => { fallbackCalls += 1; return 'documento'; },
    isTransient: transient,
  }), TestError, 'CREDITS_EXHAUSTED');
  assertEquals(fallbackCalls, 0);
});

Deno.test('429 não executa fallback', async () => {
  let fallbackCalls = 0;
  await assertRejects(() => withTransientFallback({
    primary: () => Promise.reject(new TestError('RATE_LIMITED')),
    fallback: async () => { fallbackCalls += 1; return 'documento'; },
    isTransient: transient,
  }), TestError, 'RATE_LIMITED');
  assertEquals(fallbackCalls, 0);
});

Deno.test('cancelamento do utilizador não executa fallback', async () => {
  let fallbackCalls = 0;
  await assertRejects(() => withTransientFallback({
    primary: () => Promise.reject(new TestError('GENERATION_ABORTED')),
    fallback: async () => { fallbackCalls += 1; return 'documento'; },
    isTransient: transient,
  }), TestError, 'GENERATION_ABORTED');
  assertEquals(fallbackCalls, 0);
});

Deno.test('duas falhas propagam a falha final', async () => {
  await assertRejects(() => withTransientFallback({
    primary: () => Promise.reject(new TestError('AI_UNAVAILABLE')),
    fallback: () => Promise.reject(new TestError('AI_UNAVAILABLE')),
    isTransient: transient,
  }), TestError, 'AI_UNAVAILABLE');
});
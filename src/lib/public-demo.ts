import { DEMO_INTERESTS, type DemoInterest } from './public-demo-context';
export { DEMO_INTERESTS, type DemoInterest } from './public-demo-context';
export function demoInterest(value: string | null): DemoInterest {
  return DEMO_INTERESTS.includes(value as DemoInterest) ? value as DemoInterest : 'general';
}
/** Integration hook only: no cookies, network requests, PII or persistent identifiers. */
export function emitDemoEvent(name: 'demo_open' | 'demo_submit_success' | 'demo_submit_error', interest: DemoInterest) {
  window.dispatchEvent(new CustomEvent('akuris:public-funnel', { detail: { name, interest } }));
}

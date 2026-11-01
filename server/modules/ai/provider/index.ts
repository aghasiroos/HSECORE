/**
 * Bootstrap AI providers. Import once from AI service layer.
 */

import { aiProviderRegistry } from './registry.ts';
import { ollamaProviderAdapter } from './ollama.adapter.ts';

let bootstrapped = false;

export function bootstrapAIProviders(): void {
  if (bootstrapped) return;
  aiProviderRegistry.register(ollamaProviderAdapter, { makeDefault: true });
  bootstrapped = true;
}

export { aiProviderRegistry } from './registry.ts';
export { ollamaProviderAdapter } from './ollama.adapter.ts';
export * from './types.ts';

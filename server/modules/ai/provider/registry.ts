/**
 * AI Provider Registry — single place to resolve the active inference engine.
 */

import type { AIProvider, AIProviderInfo } from './types.ts';
import { logger } from '../../../core/logger.ts';

class AIProviderRegistry {
  private providers = new Map<string, AIProvider>();
  private defaultProviderId: string | null = null;

  register(provider: AIProvider, opts?: { makeDefault?: boolean }): void {
    this.providers.set(provider.id, provider);
    if (opts?.makeDefault || !this.defaultProviderId) {
      this.defaultProviderId = provider.id;
    }
    logger.info('AI provider registered', {
      id: provider.id,
      kind: provider.kind,
      isDefault: this.defaultProviderId === provider.id,
    });
  }

  setDefault(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new Error(`AI provider not registered: ${providerId}`);
    }
    this.defaultProviderId = providerId;
  }

  get(providerId?: string): AIProvider {
    const id = providerId || this.defaultProviderId;
    if (!id) {
      throw new Error('No AI provider registered');
    }
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`AI provider not found: ${id}`);
    }
    return provider;
  }

  tryGet(providerId?: string): AIProvider | null {
    try {
      return this.get(providerId);
    } catch {
      return null;
    }
  }

  list(): AIProviderInfo[] {
    return [...this.providers.values()].map((p) => p.getProviderInfo());
  }

  getDefaultId(): string | null {
    return this.defaultProviderId;
  }
}

export const aiProviderRegistry = new AIProviderRegistry();

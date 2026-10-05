import { gleifProvider } from "./gleif";
import { multiSourceProvider } from "./multi-source";
import { wikidataProvider } from "./wikidata";
import type { DiscoveryProvider, DiscoveryProviderId } from "./types";

const PROVIDERS: Record<DiscoveryProviderId, DiscoveryProvider> = {
  MULTI_SOURCE: multiSourceProvider,
  GLEIF: gleifProvider,
  WIKIDATA: wikidataProvider,
};

export function getDiscoveryProvider(
  id: string,
): DiscoveryProvider | null {
  return PROVIDERS[id as DiscoveryProviderId] ?? null;
}

export function listDiscoveryProviders(): DiscoveryProvider[] {
  // Single-source adapters remain available internally and for historical run
  // compatibility. User-facing discovery is deliberately multi-source.
  return [multiSourceProvider];
}

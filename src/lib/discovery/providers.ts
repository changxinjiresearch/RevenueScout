import { gleifProvider } from "./gleif";
import type { DiscoveryProvider, DiscoveryProviderId } from "./types";

const PROVIDERS: Record<DiscoveryProviderId, DiscoveryProvider> = {
  GLEIF: gleifProvider,
};

export function getDiscoveryProvider(
  id: string,
): DiscoveryProvider | null {
  return PROVIDERS[id as DiscoveryProviderId] ?? null;
}

export function listDiscoveryProviders(): DiscoveryProvider[] {
  return Object.values(PROVIDERS);
}

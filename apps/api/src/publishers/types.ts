import type { PublisherCapabilities } from '@pcme/publisher-sdk';

export type ConfigRequirement = {
  envVar: string;
  required: boolean;
  description: string;
};

export type PublisherListItem = {
  id: string;
  displayName: string;
  version: string;
  enabled: boolean;
  capabilities: PublisherCapabilities;
  supportsHealthCheck: boolean;
};

export type PublisherDetail = {
  id: string;
  displayName: string;
  version: string;
  description: string;
  homepageUrl?: string;
  enabled: boolean;
  capabilities: PublisherCapabilities;
  supportsHealthCheck: boolean;
  configurationRequirements: ConfigRequirement[];
};

export type PublisherHealthResponse = {
  healthy: boolean;
  latency: number;
  message: string;
};

export interface PublisherManagementService {
  listPublishers(): PublisherListItem[];
  getPublisher(id: string): PublisherDetail | null;
  checkHealth(id: string): Promise<PublisherHealthResponse>;
}

/** Parsed brand record from piercingconnect-commerce `data/brands/*.yaml`. */
export interface CommerceBrand {
  id: string;
  slug: string;
  name: string;
  /** Full parsed YAML document for forward-compatible access. */
  raw: Record<string, unknown>;
}

/** Parsed product record from piercingconnect-commerce `data/products/*.yaml`. */
export interface CommerceProduct {
  id: string;
  slug: string;
  name: string;
  /** Full parsed YAML document for forward-compatible access. */
  raw: Record<string, unknown>;
}

/** Result of loading brand and product knowledge from the commerce repository. */
export interface CommerceKnowledgeSnapshot {
  repoPath: string;
  brands: CommerceBrand[];
  products: CommerceProduct[];
}

/** Options for locating and loading commerce knowledge. */
export interface CommerceKnowledgeLoaderOptions {
  /**
   * Absolute path to the piercingconnect-commerce repository root.
   * Defaults to `../piercingconnect-commerce` relative to the PC Media Engine repo root.
   */
  repoPath?: string;
  /**
   * PC Media Engine monorepo root used to resolve the default relative commerce path.
   * Defaults to three levels above this module file at runtime.
   */
  mediaEngineRoot?: string;
  /** Maximum allowed YAML file size in bytes. Defaults to 1 MB. */
  maxYamlFileBytes?: number;
  /** Maximum YAML alias expansions during parsing. Defaults to 100. */
  maxAliasCount?: number;
}

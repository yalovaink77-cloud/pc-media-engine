# content

Content types, lifecycle state machine, and Content Orchestrator.

## Commerce knowledge loader

Offline loader for the sibling `piercingconnect-commerce` repository (`data/brands/`, `data/products/`).

```bash
pnpm commerce:smoke
```

Override the repository path with `COMMERCE_KNOWLEDGE_PATH` or pass `repoPath` to the loader API.

Loader hardening includes realpath containment checks, symlink rejection, a 1 MB default YAML
size limit (`maxYamlFileBytes` option), and explicit YAML alias limits (`maxAliasCount` option).

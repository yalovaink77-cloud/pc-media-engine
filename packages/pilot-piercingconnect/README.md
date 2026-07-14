# @pcme/pilot-piercingconnect

Thin PiercingConnect revenue pilot layer on top of generic PCME packages.

- Uses read-only `../piercingconnect-commerce`
- Generates a product-review draft through Knowledge → Orchestrator → OpenRouter → Artifact → pending review
- Stops before publishing handoff
- Writes local outputs under `exports/piercingconnect/pilot/` (gitignored)

```bash
pnpm piercingconnect:pilot
```

Requires `OPENROUTER_API_KEY`. Missing key exits safely without network or publishing calls.

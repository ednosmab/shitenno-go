# Nexus Plugins

Plugins extend Nexus without modifying core code. They hook into specific points in the pipeline to add custom behavior.

## Structure

```
nexus-plugins/
  my-plugin/
    plugin.ts      # Plugin implementation
    package.json   # (optional) Plugin metadata
```

## Plugin API

A plugin exports an object with:

```typescript
export default {
  name: string,           // Unique plugin name
  version: string,        // Semver version
  description: string,    // What the plugin does
  hooks?: {               // Hook implementations
    "pre-analysis"?: (context) => context,
    "post-analysis"?: (context) => context,
    "custom-check"?: (context) => string | null,
    "custom-recommendation"?: (nexusDir) => Recommendation | null,
    "custom-metric"?: (context) => Metric | null,
  }
};
```

## Available Hooks

| Hook | When | Input | Output |
|------|------|-------|--------|
| `pre-analysis` | Before each pipeline stage | PipelineContext | PipelineContext |
| `post-analysis` | After each pipeline stage | PipelineContext | PipelineContext |
| `custom-check` | During `nexus audit` | {projectRoot, nexusDir, healthReport} | string \| null |
| `custom-recommendation` | During `nexus evolve` | nexusDir | Recommendation \| null |
| `custom-metric` | During `nexus audit` | context | Metric \| null |

## Example: health-check Plugin

The included `health-check` plugin demonstrates:

- **custom-check**: Verifies ADRs aren't too old, tests exist, WORKFLOW.md exists
- **custom-recommendation**: Suggests creating an ADR if none exist

To use it, place it in `nexus-plugins/` and run `nexus audit`.

## Creating a Plugin

1. Create a directory: `nexus-plugins/my-plugin/`
2. Create `plugin.ts`:
   ```typescript
   export default {
     name: "my-plugin",
     version: "1.0.0",
     description: "My custom check",
     hooks: {
       "custom-check": async (ctx) => {
         // Your check logic
         return "Issue found"; // or null
       }
     }
   };
   ```
3. Run `nexus audit` — your plugin will be loaded automatically

## Plugin Discovery

Nexus loads plugins from two locations:
1. **Project-level**: `{projectRoot}/nexus-plugins/`
2. **Global**: `~/.config/nexus/plugins/`

Plugins are loaded by dynamic import, so they can be TypeScript or JavaScript.

## Error Handling

Plugin errors are caught and logged but don't break the pipeline. If a plugin throws, it's silently skipped.

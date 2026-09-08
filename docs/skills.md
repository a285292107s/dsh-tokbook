# Skills in dsh-tokbook

> **Doc meta** · role: reference · language: en · status: current · last-reviewed: 2026-09-08 · supersedes: —

[中文](skills.zh.md) | English

A **skill** is a reusable, task-specific instruction a plugin contributes to a
DeepSeek Harness (DSH) session. The model sees only the skill's `name` and
`description` in its catalog and loads the full Markdown body on demand through
the `skill({ name })` tool; users can also invoke one directly with `/name`.
Skills are optional instructions, not session events.

This document is the **plugin-developer view** of the DSH skill system, scoped to
`dsh-tokbook`: how this plugin can contribute a skill, the `SKILL.md` contract it
must follow, and where its skill files are discovered. It is adapted from the DSH
subsystem reference so the technical facts stay correct while the framing and
links fit this repository.

## The two ways this plugin contributes a skill

| Way | How | Requirements | Best for |
|---|---|---|---|
| **Bundled / project skill files** | Ship a `SKILL.md` in a discovered skill directory | No code; discovered by the filesystem provider (`@deepseek-ai/dsh-skill-filesystem`) | A static instruction body the plugin can publish immediately |
| **Runtime registration** | Call `ctx.skills.register(...)` (a full skill) or `ctx.skills.registerProvider(...)` (a custom provider) during `apply()` | The skill registry (`@deepseek-ai/dsh-skill`) is mounted in the host composition and `ctx.skills` is in scope | A computed body, provider-specific resources, or skills that depend on runtime state |

- **Bundled files** are the simplest path: drop a `SKILL.md` in the project's
  `.dsh/skills` or `.agents/skills` directory (or a configured bundled root) and
  it appears in the session catalog. No plugin code is needed.
- **Runtime registration** lets the plugin build the instruction body
  programmatically and register it against `ctx.skills`. It only works where the
  skill registry is mounted, which is a host-side capacity — the browser/client
  half of this plugin cannot contribute skills.

## The SKILL.md format

A skill is either a directory bundle `<name>/SKILL.md` or a flat Markdown file
`<name>.md`. The name must be kebab-case
(`^[a-z0-9]+(?:-[a-z0-9]+)*$`); nested recursive `**/SKILL.md` discovery is not
supported. Every skill carries YAML frontmatter; `name` and `description` are
required, and a skill with a missing or invalid name/description is ignored.

| Frontmatter key | Type | Default | Notes |
|---|---|---|---|
| `name` | string (kebab-case) | required | Skill identifier; must match the file/dir name |
| `description` | string | required | Short routing text shown in the catalog |
| `whenToUse` | string | omitted | Optional extra routing guidance (note: camelCase) |
| `disable-model-invocation` | boolean | `false` (model-invocable) | Set `true` to hide from the model catalog and loader |
| `user-invocable` | boolean | `true` | Set `false` to hide from the user `/name` surface |

The body after the frontmatter is the Markdown instruction content the model
reads. Relative resources referenced by the body are resolved through the
skill's `resourceBase` (a directory, URL, or opaque provider-managed base); the
loaded result never enumerates the directory. Arbitrary extra frontmatter
metadata is parsed and passed through, but only the keys above are the domain
model.

`dsh-tool-skill` injects the initial durable catalog as a user-role
`<system-reminder>` on the first live `agent/pre-step` that sees a non-empty
complete view, and it only forwards the skill `name` and XML-escaped
`description` — never the body, path, source, or provider.

## Where skill files are discovered

The shipped local provider scans roots in rank order; equal names resolve by
rank, then provider order, then local order. For this plugin, the relevant roots
are the project-level ones:

| Rank | Source | Root | Applies to dsh-tokbook? |
|---|---|---|---|
| 100 | `project-dsh` | `<projectRoot>/.dsh/skills` | Yes — a project-level skill |
| 200 | `project-agents` | `<projectRoot>/.agents/skills` | Yes — also project-level |
| 300 | `custom` | `Config.customSkillDirs` | Indirect — set by the profile |
| 400 | `user-dsh` | `<dshHome>/skills` | Indirect — the user's own skills |
| 500 | `user-agents` | `<agentsHome>/skills` | Indirect — the user's own skills |
| 600 | `bundled` | `Config.bundledSkillDir` | Yes if the profile configures a bundled dir |

The `projectRoot` is the nearest ancestor containing `.git`; without one the
current cwd is used. A skill shipped inside this repo therefore lands in the
`project-dsh` or `project-agents` root when the harness project root is a git
worktree. The local provider does **not** synthesize built-in system skills; a
plugin ships packaged skills through a configured bundled root or a dedicated
provider.

## Invocation policy

`SkillInvocationPolicy` normalizes the two independent controls into booleans;
every resolved summary, candidate, and definition carries it. The frontmatter
keys `disable-model-invocation` and `user-invocable` map directly to it (keep
them kebab-case — a camelCase legacy key is rejected):

- `{ modelInvocable: true, userInvocable: true }` — visible to the model and to
  the user (the default when both keys are omitted).
- `{ modelInvocable: false, userInvocable: true }` — user-only.
- `{ modelInvocable: true, userInvocable: false }` — model-only.
- `{ modelInvocable: false, userInvocable: false }` — only reachable through a
  trusted `ctx.skills.get()` caller, not via the model or user surface.

## Registry contract (what the plugin touches)

`ctx.skills` is the layered host registry. A registration files into the layer
of its calling context's scope: host rows and repository plugins land in the
global layer, while a plugin mounted by an agent preset's standing composition
lands in that preset's layer. A read merges the global layer with the viewing
scope's chain; the nearest layer's entry wins duplicate names outright, and the
rank order decides duplicates only within one layer.

```ts
// Register a full runtime skill during apply().
const dispose = ctx.skills.register({
  name: 'dsh-tokbook-usage',
  description: 'Read and summarize the dsh-tokbook token-usage ledger.',
  content: '...',       // Markdown body
  invocation: { modelInvocable: true, userInvocable: true },
  // provider is defaulted to the registry-owned runtime provider
})

ctx.on('dispose', dispose) // or yield the disposer from the effect
```

```ts
// Or register a provider that discovers/loads skills from your own source.
const disposeProvider = ctx.skills.registerProvider((control) => ({
  name: 'tokbook-provider',
  async list(options) {
    // options.cwd selects workspace-sensitive skills; options.signal cancels work.
    return [] // or return SkillProviderObservation for incomplete discovery
  },
  async get(candidate, options) {
    // candidate.locator is opaque provider state passed back to you.
    return undefined
  },
}))
```

The other registry reads are `ctx.skills.list(options)` (sorted
invocation-neutral summaries), `ctx.skills.snapshot(options)` (summaries plus a
`complete` flag), and `ctx.skills.get(name, options)` (the full definition).
Provider and runtime mutations emit the unfiltered invalidation event
`skills/change`; consumers refetch the catalog with their own lookup options.
Lookup options are `{ cwd?, signal? }`, plus an optional `scope` when the caller
is an agent (the agent is its own scope key).

These types and methods are provided by the runtime skill packages
(`@deepseek-ai/dsh-skill`, `@deepseek-ai/dsh-skill-filesystem`,
`@deepseek-ai/dsh-tool-skill`), not by local source in this repository. For the
authoritative type signatures and the full provider/registry contract, read the
installed package declarations; they live in the DSH runtime, not here.

## Making a tokbook skill useful

A skill is only useful if it tells the model something it would otherwise not
know and cannot safely guess. For `dsh-tokbook`, a skill is a good fit when it
encodes the durable contract of the plugin — for example how an agent should
read the token-usage overview route and report it — rather than narrating the
implementation. A plausible shipped `SKILL.md`:

```markdown
---
name: dsh-tokbook-usage
description: Use to read and summarize cross-session token usage from the dsh-tokbook ledger.
whenToUse: When the user asks about token consumption, cost, or usage across sessions.
---

# Reading dsh-tokbook usage

Fetch the exact-Fetch host route `tokbook.overview` and summarize the returned
ledger. State provider/model granularity, aggregations, and the current
persistence caveats (see the plugin README) so the user does not over-trust the
numbers. Do not invent rows that are not present.
```

Keep the instruction body stable and contract-oriented. Editing only the body
changes later tool calls without producing new catalog messages or rewriting
earlier tool results.

## Prerequisites and cautions for this plugin

- **`ctx.skills` is host-side.** It is available only where the skill registry is
  mounted in the host composition. The browser/client half of this plugin cannot
  contribute skills directly.
- **The consumer must be mounted.** For the model to see a catalog, the
  `@deepseek-ai/dsh-tool-skill` consumer must be present; without it no
  `<system-reminder>` catalog or `skill` tool is injected.
- **Prefer bundled files for a static skill.** If the body is fixed, ship a
  `SKILL.md` in a discovered root rather than registering it in code. Runtime
  registration is worth it only when the body is computed or the skill needs a
  custom provider.
- **Keep frontmatter keys exact.** `whenToUse` is camelCase; the invocation keys
  are kebab-case. A camelCase invocation key is explicitly rejected.

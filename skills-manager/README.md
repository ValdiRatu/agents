# Skills Manager

Installs skills from this repo into agent harnesses. Cursor is enabled now; Claude Code and Codex are stubs in `config.yaml`.

This project uses **Bun 1.4 canary** (`bun@1.4.0-canary.1`). Install that runtime with `bun upgrade --canary` (or the GitHub `canary` release), then:

```sh
bun install
bun src/bin.ts --help
bun src/bin.ts list
bun src/bin.ts install
bun src/bin.ts status
bun src/bin.ts uninstall domain-modeling
```

Optional filters: `install domain-modeling --harness cursor`.

## Layout

```
skills/                 canonical skill source
config.yaml             which harnesses are enabled, and where they live
src/schema/             Effect Schema for config + SKILL.md frontmatter
src/domain/Errors.ts    Data.TaggedError variants
src/services/           Effect services (config, library, installer)
src/bin.ts              @effect/cli entrypoint
```

A skill is installed when it is in the intersection of:

1. Harnesses with `enabled: true` in `config.yaml`
2. `metadata.harnesses` on the skill (comma-separated). Omit the field to target every enabled harness.

`install` reconciles links against that metadata:

- `metadata.disabled: true` unlinks the skill from every configured harness
- Removing a harness from `metadata.harnesses` unlinks it from that harness
- Remaining targets are installed as usual

```yaml
# SKILL.md
metadata:
  harnesses: cursor
  disabled: true
```

Install creates a symlink from `~/.cursor/skills/<name>` to `skills/<name>`. It will not overwrite a real directory or a symlink that points somewhere else.

To add Claude Code later: set `harnesses.claude-code.enabled: true` and run `install` again.

## Effect map

This CLI is intentionally small so the Effect pieces stay visible:

| Piece | Where | What it is |
| --- | --- | --- |
| `Schema` | `src/schema/` | Decode YAML into typed config/frontmatter. Invalid data becomes a typed error instead of a thrown exception. |
| `Data.TaggedError` | `src/domain/Errors.ts` | Recoverable failures (`ConfigError`, `InstallConflict`, …). Catch them with `instanceof` or `Effect.catchTags`. |
| `Context.Tag` + `Layer` | `AppConfig` | Config is a *value* injected into the program. `AppConfigLive` loads `config.yaml` once. |
| `Effect.Service` | `SkillLibrary`, `Installer` | Services that *do* things. `yield* Installer` in a command handler. |
| `FileSystem` / `Path` | `@effect/platform` | Platform-agnostic FS. `BunContext.layer` provides the Bun implementation. |
| `Command` | `src/bin.ts` | `@effect/cli` parses args and runs an `Effect`. |

Read `src/bin.ts` first, then `Installer.ts`. The `Effect.gen` + `yield*` style is the one to copy.

import { Schema } from "effect"
import { HarnessId, InstallMethod, Scope } from "./Harness.ts"

export const HarnessConfig = Schema.Struct({
  enabled: Schema.Boolean,
  personalPath: Schema.String,
  projectPath: Schema.String,
  method: Schema.optionalWith(InstallMethod, { default: () => "symlink" as const })
})
export type HarnessConfig = typeof HarnessConfig.Type

export const AppConfig = Schema.Struct({
  skillsDir: Schema.String,
  scope: Schema.optionalWith(Scope, { default: () => "personal" as const }),
  harnesses: Schema.Struct({
    cursor: HarnessConfig,
    "claude-code": HarnessConfig,
    codex: HarnessConfig
  })
})
export type AppConfig = typeof AppConfig.Type

import { Schema } from "effect"

export const HarnessId = Schema.Literal("cursor", "claude-code", "codex")
export type HarnessId = typeof HarnessId.Type

export const InstallMethod = Schema.Literal("symlink", "copy")
export type InstallMethod = typeof InstallMethod.Type

export const Scope = Schema.Literal("personal", "project")
export type Scope = typeof Scope.Type

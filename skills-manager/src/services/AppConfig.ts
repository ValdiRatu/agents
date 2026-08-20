import { FileSystem, Path } from "@effect/platform"
import * as NodePath from "node:path"
import { Context, Effect, Layer, ParseResult, Schema } from "effect"
import { parse as parseYaml } from "yaml"
import { ConfigError } from "../domain/Errors.ts"
import { packageRoot } from "../packageRoot.ts"
import { expandHome } from "../paths.ts"
import { AppConfig as AppConfigSchema, type AppConfig as AppConfigValue } from "../schema/Config.ts"
import type { HarnessId, InstallMethod } from "../schema/Harness.ts"

export interface ResolvedHarness {
  readonly id: HarnessId
  readonly method: InstallMethod
  readonly root: string
}

export class AppConfig extends Context.Tag("AppConfig")<AppConfig, AppConfigValue>() {}

const loadConfig = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const configPath = path.join(packageRoot, "config.yaml")
  const rawText = yield* fs.readFileString(configPath).pipe(
    Effect.mapError(
      (error) =>
        new ConfigError({
          path: configPath,
          message: `Could not read config.yaml: ${error.message}`
        })
    )
  )

  const raw = yield* Effect.try({
    try: () => parseYaml(rawText),
    catch: (cause) =>
      new ConfigError({
        path: configPath,
        message: cause instanceof Error ? cause.message : String(cause)
      })
  })

  return yield* Schema.decodeUnknown(AppConfigSchema)(raw).pipe(
    Effect.mapError(
      (error) =>
        new ConfigError({
          path: configPath,
          message: ParseResult.TreeFormatter.formatErrorSync(error)
        })
    )
  )
})

export const AppConfigLive = Layer.effect(AppConfig, loadConfig)

export const enabledHarnesses = (
  config: AppConfigValue,
  cwd: string
): ReadonlyArray<ResolvedHarness> => {
  const ids = Object.keys(config.harnesses) as Array<HarnessId>
  return ids.flatMap((id) => {
    const harness = config.harnesses[id]
    if (!harness.enabled) {
      return []
    }
    const root =
      config.scope === "personal"
        ? expandHome(harness.personalPath)
        : NodePath.resolve(cwd, harness.projectPath)
    return [{ id, method: harness.method, root }]
  })
}

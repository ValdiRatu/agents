import { FileSystem, Path } from "@effect/platform"
import { Effect, Option, ParseResult, Schema } from "effect"
import { parse as parseYaml } from "yaml"
import { SkillParseError } from "../domain/Errors.ts"
import { packageRoot } from "../packageRoot.ts"
import { HarnessId, type HarnessId as HarnessIdType } from "../schema/Harness.ts"
import { SkillFrontmatter, type Skill } from "../schema/Skill.ts"
import { AppConfig } from "./AppConfig.ts"

const FrontmatterBlock = /^---\r?\n([\s\S]*?)\r?\n---/

const parseHarnessList = (
  raw: string | undefined,
  skillPath: string
): Effect.Effect<Option.Option<ReadonlyArray<HarnessIdType>>, SkillParseError> => {
  if (raw === undefined || raw.trim() === "") {
    return Effect.succeed(Option.none())
  }

  const parts = raw.split(",").map((part) => part.trim()).filter((part) => part.length > 0)
  return Schema.decodeUnknown(Schema.Array(HarnessId))(parts).pipe(
    Effect.map(Option.some),
    Effect.mapError(
      (error) =>
        new SkillParseError({
          path: skillPath,
          message: `metadata.harnesses must be a comma-separated list of known harness ids: ${ParseResult.TreeFormatter.formatErrorSync(error)}`
        })
    )
  )
}

const loadSkill = (directory: string, name: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const skillPath = path.join(directory, name, "SKILL.md")
    const exists = yield* fs.exists(skillPath)
    if (!exists) {
      return Option.none<Skill>()
    }

    const text = yield* fs.readFileString(skillPath)
    const match = text.match(FrontmatterBlock)
    const yamlBlock = match?.[1]
    if (yamlBlock === undefined) {
      return yield* new SkillParseError({
        path: skillPath,
        message: "SKILL.md is missing YAML frontmatter delimited by ---"
      })
    }

    const raw = yield* Effect.try({
      try: () => parseYaml(yamlBlock),
      catch: (cause) =>
        new SkillParseError({
          path: skillPath,
          message: cause instanceof Error ? cause.message : String(cause)
        })
    })

    const frontmatter = yield* Schema.decodeUnknown(SkillFrontmatter)(raw).pipe(
      Effect.mapError(
        (error) =>
          new SkillParseError({
            path: skillPath,
            message: ParseResult.TreeFormatter.formatErrorSync(error)
          })
      )
    )

    const harnesses = yield* parseHarnessList(frontmatter.metadata?.harnesses, skillPath)

    return Option.some<Skill>({
      name: frontmatter.name,
      description: frontmatter.description,
      directory: path.resolve(directory, name),
      harnesses,
      disabled: frontmatter.metadata?.disabled === true
    })
  })

export class SkillLibrary extends Effect.Service<SkillLibrary>()("SkillLibrary", {
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const config = yield* AppConfig

    const list = Effect.gen(function* () {
      const skillsDir = path.isAbsolute(config.skillsDir)
        ? config.skillsDir
        : path.join(packageRoot, config.skillsDir)
      const exists = yield* fs.exists(skillsDir)
      if (!exists) {
        return [] as ReadonlyArray<Skill>
      }

      const entries = yield* fs.readDirectory(skillsDir)
      const loaded = yield* Effect.forEach(entries, (name) => loadSkill(skillsDir, name), {
        concurrency: 1
      })
      return loaded.flatMap((skill) => (Option.isSome(skill) ? [skill.value] : []))
    })

    return { list }
  })
}) {}

import { FileSystem, Path } from "@effect/platform"
import { Data, Effect, Option } from "effect"
import { HarnessDisabled, InstallConflict, SkillNotFound } from "../domain/Errors.ts"
import type { HarnessId, InstallMethod } from "../schema/Harness.ts"
import type { Skill } from "../schema/Skill.ts"
import { AppConfig, enabledHarnesses, type ResolvedHarness } from "./AppConfig.ts"
import { SkillLibrary } from "./SkillLibrary.ts"

export type InstallOutcome = Data.TaggedEnum<{
  Installed: { skill: string; harness: HarnessId; dest: string; method: InstallMethod }
  AlreadyInstalled: { skill: string; harness: HarnessId; dest: string; method: InstallMethod }
  Removed: { skill: string; harness: HarnessId; dest: string }
  Missing: { skill: string; harness: HarnessId; dest: string }
}>

export const InstallOutcome = Data.taggedEnum<InstallOutcome>()

export type LinkStatus = Data.TaggedEnum<{
  Installed: { skill: string; harness: HarnessId; dest: string; method: InstallMethod }
  Missing: { skill: string; harness: HarnessId; dest: string }
  Conflict: { skill: string; harness: HarnessId; dest: string; reason: string }
}>

export const LinkStatus = Data.taggedEnum<LinkStatus>()

const pointsAtSource = (
  dest: string,
  source: string,
  currentTarget: string,
  path: Path.Path
) => {
  const resolved = path.isAbsolute(currentTarget)
    ? path.normalize(currentTarget)
    : path.normalize(path.resolve(path.dirname(dest), currentTarget))
  return resolved === path.normalize(source)
}

const selectSkills = (skills: ReadonlyArray<Skill>, name: Option.Option<string>) =>
  Option.match(name, {
    onNone: () => Effect.succeed(skills),
    onSome: (requested) => {
      const found = skills.find((skill) => skill.name === requested)
      return found === undefined
        ? Effect.fail(new SkillNotFound({ name: requested }))
        : Effect.succeed([found] as ReadonlyArray<Skill>)
    }
  })

const selectHarnesses = (
  harnesses: ReadonlyArray<ResolvedHarness>,
  requested: Option.Option<HarnessId>
) =>
  Option.match(requested, {
    onNone: () => Effect.succeed(harnesses),
    onSome: (id) => {
      const found = harnesses.find((harness) => harness.id === id)
      return found === undefined
        ? Effect.fail(new HarnessDisabled({ id }))
        : Effect.succeed([found] as ReadonlyArray<ResolvedHarness>)
    }
  })

const targetsHarness = (skill: Skill, harness: ResolvedHarness) =>
  Option.match(skill.harnesses, {
    onNone: () => true,
    onSome: (ids) => ids.includes(harness.id)
  })

export class Installer extends Effect.Service<Installer>()("Installer", {
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const config = yield* AppConfig
    const library = yield* SkillLibrary

    const destFor = (skill: Skill, harness: ResolvedHarness) => path.join(harness.root, skill.name)

    const inspect = (skill: Skill, harness: ResolvedHarness) =>
      Effect.gen(function* () {
        const dest = destFor(skill, harness)
        const exists = yield* fs.exists(dest)
        if (!exists) {
          return LinkStatus.Missing({ skill: skill.name, harness: harness.id, dest })
        }

        const currentTarget = yield* fs.readLink(dest).pipe(Effect.option)
        if (Option.isSome(currentTarget) && pointsAtSource(dest, skill.directory, currentTarget.value, path)) {
          return LinkStatus.Installed({
            skill: skill.name,
            harness: harness.id,
            dest,
            method: "symlink"
          })
        }

        if (Option.isSome(currentTarget)) {
          return LinkStatus.Conflict({
            skill: skill.name,
            harness: harness.id,
            dest,
            reason: `symlink points at ${currentTarget.value}`
          })
        }

        if (harness.method === "copy") {
          const skillFile = path.join(dest, "SKILL.md")
          const copied = yield* fs.exists(skillFile)
          if (copied) {
            return LinkStatus.Installed({
              skill: skill.name,
              harness: harness.id,
              dest,
              method: "copy"
            })
          }
        }

        return LinkStatus.Conflict({
          skill: skill.name,
          harness: harness.id,
          dest,
          reason: "destination exists and is not a skills-manager symlink"
        })
      })

    const installOne = (skill: Skill, harness: ResolvedHarness) =>
      Effect.gen(function* () {
        const dest = destFor(skill, harness)
        const status = yield* inspect(skill, harness)

        if (status._tag === "Installed") {
          return InstallOutcome.AlreadyInstalled({
            skill: skill.name,
            harness: harness.id,
            dest,
            method: status.method
          })
        }

        if (status._tag === "Conflict") {
          return yield* new InstallConflict({
            skill: skill.name,
            harness: harness.id,
            dest,
            reason: status.reason
          })
        }

        yield* fs.makeDirectory(path.dirname(dest), { recursive: true })
        if (harness.method === "symlink") {
          yield* fs.symlink(skill.directory, dest)
        } else {
          yield* fs.copy(skill.directory, dest)
        }

        return InstallOutcome.Installed({
          skill: skill.name,
          harness: harness.id,
          dest,
          method: harness.method
        })
      })

    const uninstallOne = (skill: Skill, harness: ResolvedHarness) =>
      Effect.gen(function* () {
        const dest = destFor(skill, harness)
        const status = yield* inspect(skill, harness)

        if (status._tag === "Missing") {
          return InstallOutcome.Missing({ skill: skill.name, harness: harness.id, dest })
        }

        if (status._tag === "Conflict") {
          return yield* new InstallConflict({
            skill: skill.name,
            harness: harness.id,
            dest,
            reason: status.reason
          })
        }

        yield* fs.remove(dest, { recursive: status.method === "copy" })
        return InstallOutcome.Removed({ skill: skill.name, harness: harness.id, dest })
      })

    const pairs = (skillName: Option.Option<string>, harnessId: Option.Option<HarnessId>) =>
      Effect.gen(function* () {
        const skills = yield* selectSkills(yield* library.list, skillName)
        const cwd = yield* Effect.sync(() => process.cwd())
        const harnesses = yield* selectHarnesses(
          enabledHarnesses(config, cwd),
          harnessId
        )
        return skills.flatMap((skill) =>
          harnesses.flatMap((harness) => (targetsHarness(skill, harness) ? [{ skill, harness }] : []))
        )
      })

    const install = (skillName: Option.Option<string>, harnessId: Option.Option<HarnessId>) =>
      Effect.gen(function* () {
        const selected = yield* pairs(skillName, harnessId)
        return yield* Effect.forEach(selected, ({ skill, harness }) => installOne(skill, harness), {
          concurrency: 1
        })
      })

    const uninstall = (skillName: Option.Option<string>, harnessId: Option.Option<HarnessId>) =>
      Effect.gen(function* () {
        const selected = yield* pairs(skillName, harnessId)
        return yield* Effect.forEach(selected, ({ skill, harness }) => uninstallOne(skill, harness), {
          concurrency: 1
        })
      })

    const status = (skillName: Option.Option<string>, harnessId: Option.Option<HarnessId>) =>
      Effect.gen(function* () {
        const selected = yield* pairs(skillName, harnessId)
        return yield* Effect.forEach(selected, ({ skill, harness }) => inspect(skill, harness), {
          concurrency: 1
        })
      })

    return { install, uninstall, status, list: library.list }
  })
}) {}

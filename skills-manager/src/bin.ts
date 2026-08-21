import { Args, Command, Options } from "@effect/cli"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect, Match, Option } from "effect"
import {
  ConfigError,
  HarnessDisabled,
  InstallConflict,
  SkillNotFound,
  SkillParseError
} from "./domain/Errors.ts"
import { MainLive } from "./layers.ts"
import { Installer, type InstallOutcome, type LinkStatus } from "./services/Installer.ts"

const skillArg = Args.text({ name: "skill" }).pipe(Args.optional)
const harnessOption = Options.choice("harness", ["cursor", "claude-code", "codex"]).pipe(
  Options.optional
)

const formatError = (error: unknown): string => {
  if (error instanceof ConfigError) {
    return `Config error (${error.path}): ${error.message}`
  }
  if (error instanceof SkillParseError) {
    return `Skill parse error (${error.path}): ${error.message}`
  }
  if (error instanceof SkillNotFound) {
    return error.message
  }
  if (error instanceof HarnessDisabled) {
    return error.message
  }
  if (error instanceof InstallConflict) {
    return `Conflict: ${error.message}`
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.catchAll((error) =>
      Console.error(formatError(error)).pipe(Effect.zipRight(Effect.fail(error)))
    )
  )

const formatOutcome = (outcome: InstallOutcome) =>
  Match.value(outcome).pipe(
    Match.tag(
      "Installed",
      (o) => `installed   ${o.skill} → ${o.harness}  ${o.dest}  (${o.method})`
    ),
    Match.tag(
      "AlreadyInstalled",
      (o) => `unchanged   ${o.skill} → ${o.harness}  ${o.dest}  (${o.method})`
    ),
    Match.tag("Removed", (o) => `removed     ${o.skill} → ${o.harness}  ${o.dest}`),
    Match.tag("Missing", (o) => `missing     ${o.skill} → ${o.harness}  ${o.dest}`),
    Match.exhaustive
  )

const formatStatus = (status: LinkStatus) =>
  Match.value(status).pipe(
    Match.tag("Installed", (o) => `ok          ${o.skill} → ${o.harness}  ${o.dest}  (${o.method})`),
    Match.tag("Missing", (o) => `missing     ${o.skill} → ${o.harness}  ${o.dest}`),
    Match.tag("Conflict", (o) => `conflict    ${o.skill} → ${o.harness}  ${o.dest}  ${o.reason}`),
    Match.exhaustive
  )

const install = Command.make("install", { skill: skillArg, harness: harnessOption }, ({ skill, harness }) =>
  run(
    Effect.gen(function* () {
      const installer = yield* Installer
      const outcomes = yield* installer.install(skill, harness)
      if (outcomes.length === 0) {
        yield* Console.log("Nothing to do.")
        return
      }
      yield* Effect.forEach(outcomes, (outcome) => Console.log(formatOutcome(outcome)))
    })
  )
).pipe(Command.withDescription("Reconcile skill links: install targets, unlink disabled or removed harnesses"))

const uninstall = Command.make(
  "uninstall",
  { skill: skillArg, harness: harnessOption },
  ({ skill, harness }) =>
    run(
      Effect.gen(function* () {
        const installer = yield* Installer
        const outcomes = yield* installer.uninstall(skill, harness)
        if (outcomes.length === 0) {
          yield* Console.log("Nothing to uninstall.")
          return
        }
        yield* Effect.forEach(outcomes, (outcome) => Console.log(formatOutcome(outcome)))
      })
    )
).pipe(Command.withDescription("Remove managed skill links from enabled harnesses"))

const status = Command.make("status", { skill: skillArg, harness: harnessOption }, ({ skill, harness }) =>
  run(
    Effect.gen(function* () {
      const installer = yield* Installer
      const rows = yield* installer.status(skill, harness)
      if (rows.length === 0) {
        yield* Console.log("No matching skills.")
        return
      }
      yield* Effect.forEach(rows, (row) => Console.log(formatStatus(row)))
    })
  )
).pipe(Command.withDescription("Show whether each skill is linked into each enabled harness"))

const list = Command.make("list", {}, () =>
  run(
    Effect.gen(function* () {
      const installer = yield* Installer
      const skills = yield* installer.list
      if (skills.length === 0) {
        yield* Console.log("No skills found.")
        return
      }
      yield* Effect.forEach(skills, (skill) => {
        const harnesses = Option.match(skill.harnesses, {
          onNone: () => "all enabled harnesses",
          onSome: (ids) => ids.join(", ")
        })
        const disabled = skill.disabled ? "\n  disabled: true" : ""
        return Console.log(`${skill.name}\n  ${skill.description}\n  harnesses: ${harnesses}${disabled}`)
      })
    })
  )
).pipe(Command.withDescription("List skills in this repository"))

const skillsMgr = Command.make("skills-mgr").pipe(
  Command.withDescription("Install agent skills into Cursor, Claude Code, Codex, and other harnesses"),
  Command.withSubcommands([install, uninstall, status, list])
)

const cli = Command.run(skillsMgr, {
  name: "Skills Manager",
  version: "0.1.0"
})

BunRuntime.runMain(
  cli(process.argv).pipe(Effect.provide(MainLive), Effect.provide(BunContext.layer)),
  { disableErrorReporting: true }
)

import { Data } from "effect"

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly path: string
  readonly message: string
}> {}

export class SkillParseError extends Data.TaggedError("SkillParseError")<{
  readonly path: string
  readonly message: string
}> {}

export class SkillNotFound extends Data.TaggedError("SkillNotFound")<{
  readonly name: string
}> {
  override get message() {
    return `Skill '${this.name}' was not found in the skills directory`
  }
}

export class HarnessDisabled extends Data.TaggedError("HarnessDisabled")<{
  readonly id: string
}> {
  override get message() {
    return `Harness '${this.id}' is disabled in config.yaml`
  }
}

export class InstallConflict extends Data.TaggedError("InstallConflict")<{
  readonly skill: string
  readonly harness: string
  readonly dest: string
  readonly reason: string
}> {
  override get message() {
    return `${this.skill} → ${this.harness}: ${this.reason} (${this.dest})`
  }
}

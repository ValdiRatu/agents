import { Option, Schema } from "effect"
import { HarnessId } from "./Harness.ts"

export const SkillMetadata = Schema.Struct({
  harnesses: Schema.optional(Schema.String)
})
export type SkillMetadata = typeof SkillMetadata.Type

export const SkillFrontmatter = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  metadata: Schema.optional(SkillMetadata)
})
export type SkillFrontmatter = typeof SkillFrontmatter.Type

export interface Skill {
  readonly name: string
  readonly description: string
  readonly directory: string
  readonly harnesses: Option.Option<ReadonlyArray<HarnessId>>
}

import { Option, Schema } from "effect"
import { HarnessId } from "./Harness.ts"

/** YAML booleans or the Agent Skills spec's string-to-string metadata values. */
export const MetadataBoolean = Schema.transform(
  Schema.Union(Schema.Boolean, Schema.Literal("true", "false")),
  Schema.Boolean,
  {
    decode: (value) => value === true || value === "true",
    encode: (value) => value
  }
)

export const SkillMetadata = Schema.Struct({
  harnesses: Schema.optional(Schema.String),
  disabled: Schema.optional(MetadataBoolean)
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
  readonly disabled: boolean
}

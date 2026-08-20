import { Layer } from "effect"
import { AppConfigLive } from "./services/AppConfig.ts"
import { Installer } from "./services/Installer.ts"
import { SkillLibrary } from "./services/SkillLibrary.ts"

export const MainLive = Installer.Default.pipe(
  Layer.provide(SkillLibrary.Default),
  Layer.provide(AppConfigLive)
)

import * as Os from "node:os"
import * as NodePath from "node:path"

export const expandHome = (input: string): string => {
  if (input === "~") {
    return Os.homedir()
  }
  if (input.startsWith("~/")) {
    return NodePath.join(Os.homedir(), input.slice(2))
  }
  return input
}

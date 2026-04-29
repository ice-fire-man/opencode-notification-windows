import type { Plugin, PluginModule } from "@opencode-ai/plugin"
import { notify, stopFlash, IS_WINDOWS } from "./notifier.js"

type SessionStatusType = "idle" | "busy" | "retry"

const server: Plugin = async (_ctx) => {
  // Track per-session status to detect busy→idle transitions
  const sessionStates = new Map<string, SessionStatusType>()

  // Track pending permission request IDs to stop flashing on reply
  const pendingPermissions = new Set<string>()

  return {
    // NOTE: opencode calls event hooks with `void hook.event(...)` inside
    // Effect.sync, so async errors become unhandled rejections. We catch
    // internally to prevent silent failures.
    async event({ event }) {
      if (!IS_WINDOWS) return

      try {
        if (event.type === "session.status") {
          const props = event.properties as { sessionID: string; status: { type: SessionStatusType } }
          const prev = sessionStates.get(props.sessionID)
          sessionStates.set(props.sessionID, props.status.type)

          // Task completed: busy → idle
          if (prev === "busy" && props.status.type === "idle") {
            await notify("success")
          }
          return
        }

        if (event.type === "session.error") {
          const props = event.properties as { sessionID?: string; error?: unknown }
          if (props.error) {
            await notify("error")
          }
          return
        }

        // Bus event name is "permission.asked" (not "permission.updated").
        // The SDK types.gen.ts calls it EventPermissionUpdated, but the
        // actual Bus payload uses "permission.asked" as the type string.
        if (event.type === "permission.asked") {
          const props = event.properties as { id: string; sessionID: string }
          pendingPermissions.add(props.id)
          await notify("permission")
          return
        }

        // Bus "permission.replied" properties use "requestID" (not "permissionID").
        if (event.type === "permission.replied") {
          const props = event.properties as { requestID: string; sessionID: string; reply: string }
          if (pendingPermissions.delete(props.requestID) && pendingPermissions.size === 0) {
            await stopFlash()
          }
          return
        }
      } catch {
        // Silently ignore notification failures — never break opencode
      }
    },
  }
}

const plugin: PluginModule = {
  id: "opencode-notify",
  server,
}

export default plugin
export { server }

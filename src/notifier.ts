import path from "path"
import os from "os"

type NotifyLevel = "success" | "error" | "permission"

const IS_WINDOWS = os.platform() === "win32"

const FLASH_SCRIPT = path.join(import.meta.dirname, "flash.ps1")

// Resolve PowerShell executable at module load time.
// Prefer pwsh (PS7+) since opencode runs in PS7 and Add-Type compilation
// uses the .NET version matching the host shell. Falling back to Windows
// PowerShell 5.1 (powershell.exe) would cause .NET Framework vs .NET Core
// mismatches in the compiled C# code inside flash.ps1.
function findPowerShell(): string {
  if (!IS_WINDOWS) return "pwsh"

  // Check if pwsh is available (PowerShell 7+)
  try {
    const result = Bun.spawnSync(["where.exe", "pwsh.exe"], { stdout: "pipe", stderr: "ignore" })
    if (result.exitCode === 0) return "pwsh"
  } catch {}

  // Fallback to Windows PowerShell 5.1
  return "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
}

const PWSH = findPowerShell()

const SOUND_CMD: Record<NotifyLevel, string> = {
  success: "[System.Media.SystemSounds]::Asterisk.Play()",
  error: "[System.Media.SystemSounds]::Exclamation.Play()",
  permission: "[System.Media.SystemSounds]::Beep.Play()",
}

const FLASH_ARGS: Record<NotifyLevel, string[]> = {
  success: ["-Count", "3", "-Interval", "400"],
  error: ["-Count", "5", "-Interval", "300"],
  permission: ["-Count", "10", "-Interval", "500", "-Urgent"],
}

function spawnPS(args: string[]) {
  try {
    const proc = Bun.spawn([PWSH, "-NoProfile", "-NoLogo", "-ExecutionPolicy", "Bypass", ...args], {
      stdout: "ignore",
      stderr: "ignore",
    })
    return proc.exited.catch(() => {})
  } catch {
    return Promise.resolve()
  }
}

async function playSound(level: NotifyLevel) {
  if (!IS_WINDOWS) return
  await spawnPS(["-Command", SOUND_CMD[level]])
}

async function flashWindow(level: NotifyLevel) {
  if (!IS_WINDOWS) return
  await spawnPS(["-File", FLASH_SCRIPT, ...FLASH_ARGS[level]])
}

async function stopFlash() {
  if (!IS_WINDOWS) return
  await spawnPS(["-File", FLASH_SCRIPT, "-Stop"])
}

export async function notify(level: NotifyLevel) {
  if (!IS_WINDOWS) return
  await Promise.allSettled([playSound(level), flashWindow(level)])
}

export { stopFlash, IS_WINDOWS }
export type { NotifyLevel }

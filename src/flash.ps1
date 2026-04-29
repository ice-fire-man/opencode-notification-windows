# flash.ps1 — Flash the terminal window taskbar icon (Windows Terminal / conhost)
# Usage: pwsh -NoProfile -ExecutionPolicy Bypass -File flash.ps1 [-Count <n>] [-Interval <ms>] [-Urgent] [-Stop]

param(
    [int]$Count = 3,
    [int]$Interval = 500,
    [switch]$Urgent,
    [switch]$Stop
)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;

public struct FLASHWINFO {
    public uint cbSize;
    public IntPtr hwnd;
    public uint dwFlags;
    public uint uCount;
    public uint dwTimeout;
}

public class FlashWindow {
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool FlashWindowEx(ref FLASHWINFO pwfi);

    [DllImport("kernel32.dll")]
    public static extern IntPtr GetConsoleWindow();

    public const uint FLASHW_STOP = 0;
    public const uint FLASHW_ALL = 0x00000003;
    public const uint FLASHW_TIMERNOFG = 0x0000000C;

    public static IntPtr FindTerminalWindow() {
        // Windows Terminal: modern terminal, GetConsoleWindow returns 0 under ConPTY
        try {
            foreach (Process p in Process.GetProcessesByName("WindowsTerminal")) {
                if (p.MainWindowHandle != IntPtr.Zero) return p.MainWindowHandle;
            }
        } catch {}

        // Other known terminals with visible windows
        string[] names = { "ConEmu64", "ConEmu", "Tabby", "Hyper", "Alacritty", "WezTerm" };
        foreach (string name in names) {
            try {
                foreach (Process p in Process.GetProcessesByName(name)) {
                    if (p.MainWindowHandle != IntPtr.Zero) return p.MainWindowHandle;
                }
            } catch {}
        }

        // Legacy conhost fallback
        IntPtr hwnd = GetConsoleWindow();
        if (hwnd != IntPtr.Zero) return hwnd;

        return IntPtr.Zero;
    }

    public static bool Flash(int count, int interval, bool urgent) {
        IntPtr hwnd = FindTerminalWindow();
        if (hwnd == IntPtr.Zero) return false;

        FLASHWINFO fw = new FLASHWINFO();
        fw.cbSize = (uint)Marshal.SizeOf(typeof(FLASHWINFO));
        fw.hwnd = hwnd;
        fw.dwFlags = urgent ? (FLASHW_ALL | FLASHW_TIMERNOFG) : FLASHW_ALL;
        fw.uCount = (uint)count;
        fw.dwTimeout = (uint)interval;

        return FlashWindowEx(ref fw);
    }

    public static void StopFlash() {
        IntPtr hwnd = FindTerminalWindow();
        if (hwnd == IntPtr.Zero) return;

        FLASHWINFO fw = new FLASHWINFO();
        fw.cbSize = (uint)Marshal.SizeOf(typeof(FLASHWINFO));
        fw.hwnd = hwnd;
        fw.dwFlags = FLASHW_STOP;
        fw.uCount = 0;
        fw.dwTimeout = 0;

        FlashWindowEx(ref fw);
    }
}
"@ -ErrorAction SilentlyContinue

if ($Stop) {
    [FlashWindow]::StopFlash()
} elseif ($Urgent) {
    [FlashWindow]::Flash($Count, $Interval, $true) | Out-Null
} else {
    [FlashWindow]::Flash($Count, $Interval, $false) | Out-Null
}

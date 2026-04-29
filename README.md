# 简介

Windows PowerShell 通知插件 for [opencode](https://github.com/opencode-ai/opencode) — 当 opencode 任务完成、出错或需要权限确认时，通过系统声音和任务栏闪烁提醒你。

## 功能

| 事件 | 声音 | 任务栏 |
|------|------|--------|
| ✅ 任务完成 | Asterisk（清脆提示音） | 闪烁 3 次 |
| ❌ 任务出错 | Exclamation（警告音） | 闪烁 5 次 |
| 🔐 权限请求 | Beep（提示音） | 持续闪烁直到你操作 |

## 兼容性

- ✅ Windows 10 (build 17763+)
- ✅ Windows 11
- ✅ PowerShell 5.1 (Windows 内置) — 用于执行通知命令
- ✅ PowerShell 7+ (pwsh) — 可作为你的终端 shell
- ✅ Windows Terminal / conhost
- ⬜ macOS / Linux — 静默跳过，不会报错

> **注意**：插件通过完整路径 `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` 调用 Windows PowerShell 5.1 来执行通知命令。即使你的终端使用的是 PowerShell 7 (pwsh)，通知功能也能正常工作。

## 安装

### 方式一：本地路径（推荐）

1. 把 `ocwn` 文件夹放到你喜欢的位置（比如 `C:\Users\admin\Desktop\ocwn`）

2. 在你的项目根目录 `.opencode/opencode.json` 中添加插件配置：

```jsonc
{
  "plugin": [
    "C:\\Users\\admin\\Desktop\\ocwn"
  ]
}
```

或使用相对路径（相对于项目根目录）：

```jsonc
{
  "plugin": [
    "./plugins/ocwn"
  ]
}
```

3. 重启 opencode，插件会自动加载

### 方式二：全局配置

编辑 `~/.config/opencode/config.json`（如果存在），添加 plugin 配置。

## 工作原理

### 架构

```
opencode 内部 Bus 事件流
    │
    ▼
opencode-notify plugin (event hook)
    │
    ├── session.status: busy → idle   →  成功通知
    ├── session.error                 →  错误通知
    ├── permission.asked              →  权限通知（持续闪烁）
    └── permission.replied            →  停止闪烁
```

### 重要：Bus 事件 vs SDK 类型名

opencode 内部 Bus 事件的 type 字段值和 SDK `types.gen.ts` 中的 TypeScript 类型名不完全一致：

| 实际 Bus 事件 type | SDK 类型名 | 说明 |
|---|---|---|
| `permission.asked` | `EventPermissionUpdated` | SDK 生成的类型名叫 "updated"，但 Bus 传输值是 "asked" |
| `permission.replied` → `requestID` | `EventPermissionReplied` → `permissionID` | Bus 用 `requestID`，SDK 类型用 `permissionID` |

本插件直接监听 Bus 事件，使用正确的事件名和字段名。

### 通知实现

**声音通知**：通过 Windows PowerShell 5.1（完整路径调用）执行 `[System.Media.SystemSounds]::Asterisk.Play()` 等 .NET API。

**任务栏闪烁**：通过 PowerShell 的 `Add-Type` 加载 C# 代码，P/Invoke 调用 Win32 `FlashWindowEx` API，使终端窗口的任务栏图标闪烁。

### 为什么用 Windows PowerShell 5.1 而非 pwsh 7？

- PowerShell 5.1 是 Windows 10/11 内置的，路径固定在 `C:\Windows\System32\...`
- 它完整支持 .NET Framework 的 `SystemSounds` 和 `Add-Type` P/Invoke
- 避免了 PATH 解析问题 — Bun 子进程的 PATH 可能和你的终端不同
- PowerShell 7 (pwsh) 可能通过 Windows Store 安装，路径不固定

## 自定义配置

插件支持通过 options 自定义行为：

```jsonc
{
  "plugin": [
    ["C:\\Users\\admin\\Desktop\\ocwn", {
      "sound": true,
      "flash": true,
      "onSuccess": true,
      "onError": true,
      "onPermission": true
    }]
  ]
}
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `src/index.ts` | 插件入口，导出 PluginModule，注册 event hook |
| `src/notifier.ts` | 通知调度器，封装声音播放和窗口闪烁逻辑 |
| `src/flash.ps1` | PowerShell 脚本，通过 P/Invoke 调用 FlashWindowEx |
| `package.json` | 包定义，声明对 `@opencode-ai/plugin` 的 peer dependency |
| `SPEC.md` | 完整的设计规格文档 |

## 故障排查

### 没有声音？

1. 检查 Windows 系统音量是否静音
2. 确认 Windows 声音方案未设为"无声"
3. 手动测试：
   ```powershell
   C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -Command "[System.Media.SystemSounds]::Asterisk.Play()"
   ```

### 没有闪烁？

1. **窗口已在前台时不会闪烁** — 这是 Windows 设计行为。切到其他窗口后再测试
2. Windows Terminal 需要 v1.12+ 版本
3. 手动测试（先切到其他窗口）：
   ```powershell
   C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\admin\Desktop\ocwn\src\flash.ps1" -Count 5
   ```

### 插件未加载？

- 确认 `opencode.json` 中的路径正确
- 检查 opencode 启动日志中是否有 `loading plugin` 相关信息
- 路径使用正斜杠 `/` 或双反斜杠 `\\`

### 权限请求没有通知？

- 确认插件版本使用了正确的事件名 `permission.asked`（不是 `permission.updated`）
- 本版本已修复此问题

## License

MIT

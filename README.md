# Bigfrost_ServerPortal

> **Bigfrost_ServerPortal is a lightweight mod and web portal designed to provide real-time server management, diagnostics, and remote configuration for Valheim dedicated servers.**

### About the Name: *Bigfrost (Bifröst)*
A homage to **Bifröst**—the mythical burning rainbow bridge connecting Midgard (the mortal realm) directly to Asgard (the realm of the gods). In this mod, *Bigfrost* serves as the management bridge connecting server administrators directly to their live Valheim dedicated server from any web browser.

---

## Features
- **Web Management Dashboard**: Monitor player telemetry, server FPS, memory footprint, active ZDO counts, and world uptime in real time.
- **Remote Server Administration**: Execute server console commands, send server-wide announcements, and kick or ban players from any web browser.
- **Lifecycle & Scheduled Restarts**: Automate recurring daily restarts or trigger timed countdown restarts with automatic player alerts.
- **BigAI Mod Integration**: Dynamically configure connected BigAI mods (CharactersVault, Valgrind, DagrNott_CustomDayCycle, Skald_VikingKillFeed, and Njoror_FairWinds) from a single interface.
- **Basic 3rd Party Mod Config**: Can also edit configs for other mods in the server's /config folder.

---

### Installation Type
- **Location:** Server-only. Clients do not need the mod installed.
- **Enforcement:** Optional on clients; accessed via standard web browsers.

### Manual Install
1. Ensure BepInEx is installed on your dedicated server.
2. Extract the downloaded `.zip` archive.
3. Copy `Bigfrost_ServerPortal.dll` into your `Valheim/BepInEx/plugins/` folder.
4. Ensure port `8080` (or your configured port) is open and forwarded.
5. Launch the game once to generate the default configuration file.

---

## Configuration
The configuration file is automatically created at `BepInEx/config/com.bigai.bigfrost_serverportal.cfg` after running the game once.

| Section | Setting | Default | Description |
| :--- | :--- | :--- | :--- |
| `WebPortal` | `EnableWebPortal` | `true` | Enable the embedded web management portal. |
| `WebPortal` | `WebPortalPort` | `8080` | Port for the embedded web management portal. |
| `WebPortal` | `WebAdminPassword` | `""` | Password required for administrative actions in the web portal. |
| `General` | `VerboseLogging` | `false` | Enable verbose logging in BepInEx console. |
| `Lifecycle` | `RestartMode` | `ExitOnly` | Server restart strategy (`ExitOnly` or `SpawnProcess`). |
| `Lifecycle` | `RestartScriptPath` | `./start_server.sh` | Path to external restart script when `RestartMode` is `SpawnProcess`. |
| `Lifecycle` | `DailyRestartEnabled` | `false` | Enable automated daily server restart. |
| `Lifecycle` | `DailyRestartTime` | `04:00` | Daily restart time in 24h format (`HH:mm`). |

---

## Controls & Commands
- **Keybinds:** None.
- **Admin Commands:** Web dashboard accessible via browser at `http://<server-ip>:8080`.

---

## Compatibility & Safe Removal
- **Multiplayer:** Server-side only. Clients connect via standard web browsers without needing any client-side mod.
- **Save Integrity:** Safe to add or remove at any time without affecting world save files.

### AI Disclosure 

I made this mod using AI. Most of the code in this mod was AI generated. If you have an issue with this, I completely understand and urge you to not use this mod. This mod ("Bigfrost_ServerPortal") is meant as a lightweight mod for small servers that don't need all the bells and whistles of a more complex mod.

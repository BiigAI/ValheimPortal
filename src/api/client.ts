// Strongly typed API client for Bifrostheim communicating with the Valheim BepInEx HTTP Backend

export interface ServerTelemetry {
  uptime: string;
  uptimeSeconds: number;
  onlineCount: number;
  maxPlayers: number;
  fps: number;
  tickRate: string;
  activeZdos: number;
  memoryMb: number;
}

export interface PlayerInfo {
  id: string;
  name: string;
  steamId: string;
  ping: string;
  pos: string;
  zone: string;
  health: number;
  maxHealth: number;
  pvp: boolean;
  daysSurvived: number;
}

export interface BannedPlayer {
  id: string;
  name: string;
  steamId: string;
  bannedAt: string;
  reason: string;
  bannedBy: string;
}

export interface ConsoleLogEntry {
  time: string;
  source: string;
  text: string;
  level: 'info' | 'success' | 'cmd' | 'warn' | 'error';
}

export interface ScheduledRestartInfo {
  active: boolean;
  targetTimestamp: number | null;
  totalMinutes: number;
  remainingSeconds: number;
  reason: string;
}

export interface DailyRestartInfo {
  enabled: boolean;
  time: string;
}

export interface LifecycleConfig {
  mode: 'ExitOnly' | 'SpawnProcess';
  scriptPath: string;
}

export interface RestartStatusResponse {
  scheduledRestart: ScheduledRestartInfo | null;
  dailyRestart: DailyRestartInfo;
  lifecycleConfig: LifecycleConfig;
}

export interface CharacterBinding {
  steamId: string;
  characterName: string;
  created: string;
  lastLogin: string;
  status: string;
}

export interface ValgrindConfig {
  xpLoss: number;
  calcMode: string;
}

export interface DagrNottConfig {
  totalLength: number;
  dayLength: number;
  nightLength: number;
}

export interface SkaldConfig {
  enabled: boolean;
  enablePvp: boolean;
  enableBosses: boolean;
  includeBiome: boolean;
  logToConsole: boolean;
  monsterTemplates: string;
  bossTemplates: string;
  treeTemplates: string;
  drowningTemplates: string;
  freezingTemplates: string;
  burningTemplates: string;
  poisonTemplates: string;
  fallDamageTemplates: string;
  pvpTemplates: string;
}

export interface HeimdallrConfig {
  enableCustomScaling: boolean;
  playerHealthScalePercent: number;
  playerDamageScalePercent: number;
  playerRangeRadius: number;
  bossHealthMultiplier: number;
  bossDamageMultiplier: number;
  enableStarTweaks: boolean;
  nightStarBonusChance: number;
  distanceCenterMultiplier: number;
  globalOneStarChance: number;
  globalTwoStarChance: number;
}

export interface NjororConfig {
  enableFairWinds: boolean;
  headwindMitigationPercent: number;
  minWindSpeedMultiplier: number;
  alwaysTailwindInOcean: boolean;
  enableWeatherTuning: boolean;
  stormFrequencyMultiplier: number;
  rainFrequencyMultiplier: number;
  clearFrequencyMultiplier: number;
  enableSerpentTuning: boolean;
  daytimeSerpentSpawnChance: number;
  nighttimeSerpentSpawnChance: number;
  serpentSpawnIntervalSeconds: number;
  allowCalmWeatherDaySerpents: boolean;
}

export interface SkaldDeathRecord {
  id: string;
  victimName: string;
  victimSteamId: string;
  killerName: string;
  category: string;
  biome: string;
  formattedMessage: string;
  timestamp: string;
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    throw new Error(`API Error [${res.status}]: ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Module installation status
  getInstalledModules: () => request<{ installed: string[] }>('/api/modules/installed'),

  // Core Server
  getTelemetry: () => request<ServerTelemetry>('/api/server/telemetry'),
  getPlayers: () => request<PlayerInfo[]>('/api/players'),
  getBans: () => request<BannedPlayer[]>('/api/bans'),
  kickPlayer: (name: string) => request<{ success: boolean; message: string }>('/api/players/kick', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }),
  banPlayer: (name: string, reason?: string) => request<{ success: boolean; message: string }>('/api/players/ban', {
    method: 'POST',
    body: JSON.stringify({ name, reason }),
  }),
  unbanPlayer: (steamId: string) => request<{ success: boolean; message: string }>('/api/bans/unban', {
    method: 'POST',
    body: JSON.stringify({ steamId }),
  }),
  addManualBan: (steamId: string, name: string, reason: string) => request<{ success: boolean; message: string }>('/api/bans/add', {
    method: 'POST',
    body: JSON.stringify({ steamId, name, reason }),
  }),
  getLogs: () => request<ConsoleLogEntry[]>('/api/console/logs'),
  executeCommand: (command: string) => request<{ success: boolean; output: string }>('/api/console/exec', {
    method: 'POST',
    body: JSON.stringify({ command }),
  }),
  forceSave: () => request<{ success: boolean; message: string }>('/api/server/save', { method: 'POST' }),
  broadcast: (message: string) => request<{ success: boolean; message: string }>('/api/server/broadcast', {
    method: 'POST',
    body: JSON.stringify({ message }),
  }),

  // Scheduled Restarts & Lifecycle
  getRestartStatus: () => request<RestartStatusResponse>('/api/server/restart-status'),
  scheduleRestart: (minutes: number, reason: string) => request<{ success: boolean; message: string; targetTimestamp: number }>('/api/server/schedule-restart', {
    method: 'POST',
    body: JSON.stringify({ minutes, reason }),
  }),
  cancelRestart: () => request<{ success: boolean; message: string }>('/api/server/cancel-restart', {
    method: 'POST',
  }),
  updateDailyRestart: (enabled: boolean, time: string) => request<{ success: boolean; dailyRestart: DailyRestartInfo }>('/api/server/daily-restart', {
    method: 'POST',
    body: JSON.stringify({ enabled, time }),
  }),
  getLifecycleConfig: () => request<LifecycleConfig>('/api/server/lifecycle-config'),
  saveLifecycleConfig: (config: Partial<LifecycleConfig>) => request<{ success: boolean; lifecycleConfig: LifecycleConfig }>('/api/server/lifecycle-config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),

  // CharactersVault
  getCharacterBindings: () => request<CharacterBinding[]>('/api/modules/charactervault/bindings'),
  unbindCharacter: (steamId: string, name: string) => request<{ success: boolean }>('/api/modules/charactervault/unbind', {
    method: 'POST',
    body: JSON.stringify({ steamId, name }),
  }),
  wipeCharacters: () => request<{ success: boolean; message: string }>('/api/modules/charactervault/wipe', {
    method: 'POST',
  }),

  // Valgrind
  getValgrindConfig: () => request<ValgrindConfig>('/api/modules/valgrind/config'),
  saveValgrindConfig: (config: Partial<ValgrindConfig>) => request<{ success: boolean; config: ValgrindConfig }>('/api/modules/valgrind/config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),

  // Dagr & Nott
  getDagrNottConfig: () => request<DagrNottConfig>('/api/modules/dagrnott/config'),
  saveDagrNottConfig: (config: Partial<DagrNottConfig>) => request<{ success: boolean; config: DagrNottConfig }>('/api/modules/dagrnott/config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),

  // Skald
  getSkaldConfig: () => request<SkaldConfig>('/api/modules/skald/config'),
  saveSkaldConfig: (config: Partial<SkaldConfig>) => request<{ success: boolean; config: SkaldConfig }>('/api/modules/skald/config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),
  getSkaldChronicle: () => request<SkaldDeathRecord[]>('/api/modules/skald/chronicle'),
  testDeathAnnouncement: (victimName: string, killerName: string, category: string, biome: string) => request<{ success: boolean; record: SkaldDeathRecord }>('/api/modules/skald/test-death', {
    method: 'POST',
    body: JSON.stringify({ victimName, killerName, category, biome }),
  }),

  // Heimdallr
  getHeimdallrConfig: () => request<HeimdallrConfig>('/api/modules/heimdallr/config'),
  saveHeimdallrConfig: (config: Partial<HeimdallrConfig>) => request<{ success: boolean; config: HeimdallrConfig }>('/api/modules/heimdallr/config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),

  // Njoror
  getNjororConfig: () => request<NjororConfig>('/api/modules/njoror/config'),
  saveNjororConfig: (config: Partial<NjororConfig>) => request<{ success: boolean; config: NjororConfig }>('/api/modules/njoror/config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),
};

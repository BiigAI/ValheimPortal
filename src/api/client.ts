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

export interface PendingConfigChange {
  module: string;
  moduleName: string;
  timestamp: string;
}

export interface RestartStatusResponse {
  scheduledRestart: ScheduledRestartInfo | null;
  dailyRestart: DailyRestartInfo;
  lifecycleConfig: LifecycleConfig;
  pendingChanges: PendingConfigChange[];
}

export interface CharacterBinding {
  steamId: string;
  characterName: string;
  created: string;
  lastLogin: string;
  status: string;
}

export interface ValgrindConfig {
  calculationMode: 'TieredBrackets' | 'ContinuousCurve' | 'PerSkill' | string;
  useTopNSkillsOnly: boolean;
  topNSkillsCount: number;
  resetAccumulatorOnDeath: boolean;
  enableDebugLogging: boolean;
  earlyGameLossPercent: number;
  midGameLossPercent: number;
  lateGameLossPercent: number;
  endgameLossPercent: number;
  curveMaxLossPercent: number;
  curveMinLossPercent: number;
}

export interface DagrNottConfig {
  dawnMultiplier: number;
  dayMultiplier: number;
  duskMultiplier: number;
  nightMultiplier: number;
  logPhaseTransitions: boolean;
  dawnMinutes?: number;
  dayMinutes?: number;
  duskMinutes?: number;
  nightMinutes?: number;
  totalMinutes?: number;
}

export interface SkaldConfig {
  enabled: boolean;
  enableBosses: boolean;
  includeBiome: boolean;
  logToConsole: boolean;
  monsterTemplates: string;
  bossTemplates: string;
  overwhelmedMessages: string;
  genericDeathMessages: string;
}

export interface NjororConfig {
  enableFairWinds: boolean;
  headwindMitigationPercent: number;
  minWindSpeedMultiplier: number;
  alwaysTailwindInOcean: boolean;
  checkDeflectOnWindChange: boolean;
  checkDeflectTimeSeconds: number;
  enableWeatherTuning: boolean;
  stormFrequencyMultiplier: number;
  rainFrequencyMultiplier: number;
  clearFrequencyMultiplier: number;
  enableSerpentTuning: boolean;
  daytimeSerpentSpawnChance: number;
  nighttimeSerpentSpawnChance: number;
  serpentSpawnIntervalSeconds: number;
  allowCalmWeatherDaySerpents: boolean;
  enableDebugLogging: boolean;
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

export interface OtherModSummary {
  fileName: string;
  filePath: string;
  displayName: string;
  pluginGuid: string;
  pluginName: string;
  pluginVersion: string;
  sectionCount: number;
  settingCount: number;
  fileSizeBytes: number;
  lastModified: string;
  isLoadedInGame: boolean;
  isFirstParty: boolean;
}

export interface OtherModConfigEntry {
  key: string;
  value: string;
  defaultValue?: string | null;
  valueType: string;
  description: string;
  acceptableValues?: string[] | null;
  minRange?: number | null;
  maxRange?: number | null;
}

export interface OtherModSection {
  name: string;
  entries: OtherModConfigEntry[];
}

export interface OtherModConfigDetail {
  fileName: string;
  displayName: string;
  pluginGuid: string;
  pluginName: string;
  pluginVersion: string;
  isLoadedInGame: boolean;
  sections: OtherModSection[];
  rawContent: string;
  lastModified: string;
}

export interface SaveOtherModConfigRequest {
  fileName: string;
  updates?: Record<string, Record<string, string>>;
  rawContent?: string;
  saveRaw?: boolean;
}

export const AUTH_STORAGE_KEY = 'bigfrost_auth';

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem('bifrostheim_auth');
  return token ? { 'X-Admin-Password': token } : {};
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    if (res.status === 401 && !endpoint.startsWith('/api/auth/')) {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem('bifrostheim_auth');
      window.dispatchEvent(new Event('bigfrost_unauthorized'));
    }
    const errBody = await res.json().catch(() => ({}));
    const message = errBody.message || errBody.error || `API Error [${res.status}]: ${res.statusText}`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Authentication
  verifyAuth: () => request<{ authenticated: boolean; message: string }>('/api/auth/verify'),
  getAuthStatus: () => request<{ required: boolean; authenticated: boolean }>('/api/auth/status'),
  login: (password: string) => request<{ success: boolean; token?: string; message: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  }),

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
  getPendingChanges: () => request<{ success: boolean; pendingChanges: PendingConfigChange[] }>('/api/server/pending-changes'),
  clearPendingChanges: () => request<{ success: boolean; message: string }>('/api/server/clear-pending-changes', {
    method: 'POST',
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

  // Njoror
  getNjororConfig: () => request<NjororConfig>('/api/modules/njoror/config'),
  saveNjororConfig: (config: Partial<NjororConfig>) => request<{ success: boolean; config: NjororConfig }>('/api/modules/njoror/config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),

  // Other Mods (3rd Party Configs)
  getOtherModsList: () => request<{ mods: OtherModSummary[] }>('/api/other-mods/list'),
  getOtherModConfig: (fileName: string) => request<OtherModConfigDetail>(`/api/other-mods/config?file=${encodeURIComponent(fileName)}`),
  saveOtherModConfig: (req: SaveOtherModConfigRequest) => request<{ success: boolean; config: OtherModConfigDetail }>('/api/other-mods/config/save', {
    method: 'POST',
    body: JSON.stringify(req),
  }),
  resetOtherModConfigDefaults: (fileName: string) => request<{ success: boolean; config: OtherModConfigDetail }>('/api/other-mods/config/reset-defaults', {
    method: 'POST',
    body: JSON.stringify({ fileName }),
  }),
};

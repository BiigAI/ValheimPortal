import type { IncomingMessage, ServerResponse } from 'node:http';

// State container for simulated Valheim server
export interface ValheimServerState {
  uptimeStart: number;
  maxPlayers: number;
  memoryMb: number;
  activeZdos: number;
  players: Array<{
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
  }>;
  bannedPlayers: Array<{
    id: string;
    name: string;
    steamId: string;
    bannedAt: string;
    reason: string;
    bannedBy: string;
  }>;
  logs: Array<{
    time: string;
    source: string;
    text: string;
    level: 'info' | 'success' | 'cmd' | 'warn' | 'error';
  }>;
  characterVaultBindings: Array<{
    steamId: string;
    characterName: string;
    created: string;
    lastLogin: string;
    status: string;
  }>;
  valgrindConfig: {
    calculationMode: string;
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
  };
  dagrNottConfig: {
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
  };
  skaldConfig: {
    enabled: boolean;
    enableBosses: boolean;
    includeBiome: boolean;
    logToConsole: boolean;
    monsterTemplates: string;
    bossTemplates: string;
    overwhelmedMessages: string;
    genericDeathMessages: string;
  };
  njororConfig: {
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
  };
  skaldChronicle: Array<{
    id: string;
    victimName: string;
    victimSteamId: string;
    killerName: string;
    category: string;
    biome: string;
    formattedMessage: string;
    timestamp: string;
  }>;
  scheduledRestart: {
    active: boolean;
    targetTimestamp: number | null;
    totalMinutes: number;
    reason: string;
    warningsSent: number[];
  } | null;
  dailyRestart: {
    enabled: boolean;
    time: string;
  };
  lifecycleConfig: {
    mode: 'ExitOnly' | 'SpawnProcess';
    scriptPath: string;
  };
  pendingChanges: Array<{
    module: string;
    moduleName: string;
    timestamp: string;
  }>;
  installedModules: string[];
}

export const serverState: ValheimServerState = {
  uptimeStart: Date.now() - 14 * 3600 * 1000 - 22 * 60 * 1000,
  maxPlayers: 10,
  memoryMb: 1420,
  activeZdos: 42189,
  players: [
    { id: '1', name: 'Ragnar', steamId: '76561198011223344', ping: '18ms', pos: 'X: 120, Y: 35, Z: -450', zone: 'Meadows', health: 185, maxHealth: 210, pvp: true, daysSurvived: 64 },
    { id: '2', name: 'Lagertha', steamId: '76561198022334455', ping: '32ms', pos: 'X: -850, Y: 52, Z: 1200', zone: 'Black Forest', health: 140, maxHealth: 160, pvp: false, daysSurvived: 42 },
    { id: '3', name: 'Bjorn', steamId: '76561198033445566', ping: '45ms', pos: 'X: 340, Y: 12, Z: 890', zone: 'Swamp', health: 95, maxHealth: 175, pvp: true, daysSurvived: 19 },
  ],
  bannedPlayers: [
    { id: 'b1', name: 'LokiExploiter', steamId: '76561198099887766', bannedAt: '2026-08-18 16:30', reason: 'Speedhack & Flyhack Detection', bannedBy: 'AntiCheat / Admin' },
    { id: 'b2', name: 'GriefMaster99', steamId: '76561198088776655', bannedAt: '2026-08-19 11:15', reason: 'Base Destruction in Protected Zone', bannedBy: 'Admin' },
  ],
  logs: [
    { time: '14:02:11', source: 'Unity', text: 'ZNet starting up dedicated server instance...', level: 'info' },
    { time: '14:02:15', source: 'ZNet', text: 'Server listening on port 2456 (Public: True, World: "Valhalla")', level: 'info' },
    { time: '14:02:16', source: 'BepInEx', text: 'Bifrostheim initialized HTTP listener on port 8080', level: 'success' },
    { time: '14:02:17', source: 'Skald', text: 'Skald chronicle engine attached to Player death hooks.', level: 'success' },
    { time: '14:03:00', source: 'ZNet', text: 'Peer 76561198011223344 connected (IP: 192.168.1.102:54210)', level: 'info' },
    { time: '14:04:12', source: 'CharactersVault', text: 'Character "Ragnar" validated against SteamID 76561198011223344', level: 'success' },
  ],
  characterVaultBindings: [
    { steamId: '76561198011223344', characterName: 'Ragnar', created: '2026-08-10', lastLogin: '10 mins ago', status: 'Bound' },
    { steamId: '76561198022334455', characterName: 'Lagertha', created: '2026-08-12', lastLogin: '1 hour ago', status: 'Bound' },
    { steamId: '76561198033445566', characterName: 'Bjorn', created: '2026-08-15', lastLogin: '3 days ago', status: 'Bound' },
    { steamId: '76561198044556677', characterName: 'Floki', created: '2026-08-18', lastLogin: '5 days ago', status: 'Bound' },
    { steamId: '76561198055667788', characterName: 'Torstein', created: '2026-08-19', lastLogin: '1 week ago', status: 'Bound' },
  ],
  valgrindConfig: {
    calculationMode: 'TieredBrackets',
    useTopNSkillsOnly: false,
    topNSkillsCount: 5,
    resetAccumulatorOnDeath: true,
    enableDebugLogging: false,
    earlyGameLossPercent: 8.0,
    midGameLossPercent: 5.0,
    lateGameLossPercent: 2.5,
    endgameLossPercent: 1.0,
    curveMaxLossPercent: 8.0,
    curveMinLossPercent: 1.0,
  },
  dagrNottConfig: {
    dawnMultiplier: 0.90,
    dayMultiplier: 0.50,
    duskMultiplier: 0.90,
    nightMultiplier: 0.30,
    logPhaseTransitions: true,
    dawnMinutes: 5.0,
    dayMinutes: 30.0,
    duskMinutes: 5.0,
    nightMinutes: 20.0,
    totalMinutes: 60.0,
  },
  skaldConfig: {
    enabled: true,
    enableBosses: true,
    includeBiome: true,
    logToConsole: true,
    monsterTemplates: '{victim} was slain by a {killer} in the {biome};{victim} was torn apart by a {killer};A {killer} claimed the soul of {victim}',
    bossTemplates: '{victim} was annihilated by the mythical {killer}!;The legendary {killer} crushed {victim} into dust',
    overwhelmedMessages: '{victim} was defeated in glorious battle against a horde in the {biome};{victim} fell fighting valiantly against overwhelming odds',
    genericDeathMessages: '{victim} has departed for the halls of Valhalla;The Norns have cut the thread of {victim}\'s life;{victim} died in the {biome}',
  },
  njororConfig: {
    enableFairWinds: true,
    headwindMitigationPercent: 60.0,
    minWindSpeedMultiplier: 1.0,
    alwaysTailwindInOcean: false,
    checkDeflectOnWindChange: true,
    checkDeflectTimeSeconds: 0,
    enableWeatherTuning: true,
    stormFrequencyMultiplier: 1.0,
    rainFrequencyMultiplier: 1.0,
    clearFrequencyMultiplier: 1.0,
    enableSerpentTuning: true,
    daytimeSerpentSpawnChance: 0.0,
    nighttimeSerpentSpawnChance: 5.0,
    serpentSpawnIntervalSeconds: 1000.0,
    allowCalmWeatherDaySerpents: false,
    enableDebugLogging: false,
  },
  skaldChronicle: [
    {
      id: 'c1',
      victimName: 'Floki',
      victimSteamId: '76561198044556677',
      killerName: '1-Star Troll',
      category: 'Monster',
      biome: 'Black Forest',
      formattedMessage: 'Floki was torn apart by a 1-Star Troll in the Black Forest',
      timestamp: '2026-08-21 14:15:22',
    },
    {
      id: 'c2',
      victimName: 'Torstein',
      victimSteamId: '76561198055667788',
      killerName: 'Falling Log',
      category: 'FallingTree',
      biome: 'Meadows',
      formattedMessage: 'Torstein was crushed by a falling log in the Meadows!',
      timestamp: '2026-08-21 13:40:10',
    },
    {
      id: 'c3',
      victimName: 'Bjorn',
      victimSteamId: '76561198033445566',
      killerName: 'Bonemass',
      category: 'Boss',
      biome: 'Swamp',
      formattedMessage: 'Bjorn was annihilated by the mythical Bonemass!',
      timestamp: '2026-08-20 21:05:44',
    },
  ],
  scheduledRestart: null,
  dailyRestart: {
    enabled: true,
    time: '04:00',
  },
  lifecycleConfig: {
    mode: 'ExitOnly',
    scriptPath: './start_server.sh',
  },
  pendingChanges: [],
  // All module IDs — when MOCK_MISSING_MODULES=true (via `npm run dev:missing`),
  // Valgrind is simulated as not installed on this server.
  installedModules: process.env.MOCK_MISSING_MODULES === 'true'
    ? ['charvault', 'dagrnott', 'skald', 'njoror']
    : ['charvault', 'valgrind', 'dagrnott', 'skald', 'njoror'],
};

// Background generator for realistic jitter & logs
setInterval(() => {
  serverState.memoryMb += (Math.random() - 0.5) * 2;
  serverState.activeZdos += Math.floor((Math.random() - 0.48) * 5);
}, 3000);

const randomLogEvents = [
  'ZoneSystem: Cleaned up 12 unreferenced ZDOs in sector (4, -8)',
  'SpawnSystem: Spawned Greydwarf [Meadows, Tier 1]',
  'EnvMan: Weather transitioning from Clear to LightRain',
  'ZNet: Sent peer ping packets (Average roundtrip: 22ms)',
  'DagrAndNott: Sun zenith reached at game time 12:00',
];

setInterval(() => {
  if (Math.random() > 0.4) {
    const eventText = randomLogEvents[Math.floor(Math.random() * randomLogEvents.length)];
    const newLog = {
      time: new Date().toLocaleTimeString(),
      source: 'GameEngine',
      text: eventText,
      level: 'info' as const,
    };
    serverState.logs.push(newLog);
    if (serverState.logs.length > 100) serverState.logs.shift();
  }
}, 8000);

// Scheduled restart watcher & automated broadcast warnings
setInterval(() => {
  if (!serverState.scheduledRestart || !serverState.scheduledRestart.active || !serverState.scheduledRestart.targetTimestamp) {
    return;
  }

  const remainingSec = Math.max(0, Math.floor((serverState.scheduledRestart.targetTimestamp - Date.now()) / 1000));
  const remainingMin = Math.ceil(remainingSec / 60);

  // Warning thresholds in minutes: 15, 10, 5, 2, 1
  const warningMilestones = [15, 10, 5, 2, 1];
  for (const m of warningMilestones) {
    if (remainingMin === m && !serverState.scheduledRestart.warningsSent.includes(m)) {
      serverState.scheduledRestart.warningsSent.push(m);
      const time = new Date().toLocaleTimeString();
      serverState.logs.push({
        time,
        source: 'Broadcast',
        text: `[GLOBAL SHOUT] ⚠️ SERVER RESTART: Server will restart in ${m} minute${m > 1 ? 's' : ''}! Reason: ${serverState.scheduledRestart.reason}. Please find shelter.`,
        level: 'warn',
      });
    }
  }

  // Timer complete -> execute restart
  if (remainingSec <= 0) {
    const time = new Date().toLocaleTimeString();
    serverState.logs.push({
      time,
      source: 'ServerLifecycle',
      text: 'Executing scheduled restart: Saving world "Valhalla"... Done (0.041s).',
      level: 'success',
    });

    if (serverState.lifecycleConfig.mode === 'SpawnProcess') {
      serverState.logs.push({
        time,
        source: 'ServerLifecycle',
        text: `Spawning external restart process: "${serverState.lifecycleConfig.scriptPath}"...`,
        level: 'info',
      });
    } else {
      serverState.logs.push({
        time,
        source: 'ServerLifecycle',
        text: 'Clean exit via Application.Quit() (Docker / supervisor rebooting container)...',
        level: 'info',
      });
    }

    serverState.logs.push({
      time,
      source: 'ServerLifecycle',
      text: 'Valheim dedicated server restarted cleanly. Uptime reset.',
      level: 'info',
    });
    serverState.uptimeStart = Date.now();
    serverState.scheduledRestart = null;
    serverState.pendingChanges = [];
  }
}, 1000);

function recordPendingChange(module: string, moduleName: string) {
  const existing = serverState.pendingChanges.find(c => c.module.toLowerCase() === module.toLowerCase());
  const timestamp = new Date().toLocaleTimeString();
  if (existing) {
    existing.timestamp = timestamp;
  } else {
    serverState.pendingChanges.push({ module, moduleName, timestamp });
  }
}

export function handleMockApiRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const url = req.url || '';
  if (!url.startsWith('/api/')) return false;

  const method = req.method || 'GET';

  const sendJson = (data: any, status = 200) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end(JSON.stringify(data));
  };

  if (method === 'OPTIONS') {
    sendJson({ ok: true });
    return true;
  }

  // Parse Body helper
  const readBody = (callback: (body: any) => void) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        callback(body ? JSON.parse(body) : {});
      } catch (err) {
        callback({});
      }
    });
  };

  // Auth helper
  const getExpectedAdminPassword = (): string => {
    return process.env.VITE_ADMIN_PASSWORD || process.env.MOCK_ADMIN_PASSWORD || 'admin';
  };

  const isAuthorized = (): boolean => {
    const expectedPassword = getExpectedAdminPassword();
    if (expectedPassword.toLowerCase() === 'none' || expectedPassword.toLowerCase() === 'open') return true;

    const adminHeader = req.headers['x-admin-password'];
    if (adminHeader && adminHeader === expectedPassword) return true;

    const authHeader = req.headers['authorization'];
    if (authHeader) {
      if (authHeader.startsWith('Bearer ') && authHeader.slice(7).trim() === expectedPassword) return true;
      if (authHeader.trim() === expectedPassword) return true;
    }
    return false;
  };

  // 0. Auth Verify, Status & Login
  if (url === '/api/auth/verify' && method === 'GET') {
    if (isAuthorized()) {
      sendJson({ authenticated: true, message: 'Session valid.' });
    } else {
      res.statusCode = 401;
      sendJson({ authenticated: false, message: 'Unauthorized. Admin password required.' });
    }
    return true;
  }

  if (url === '/api/auth/status' && method === 'GET') {
    const expectedPassword = getExpectedAdminPassword();
    const required = expectedPassword.toLowerCase() !== 'none' && expectedPassword.toLowerCase() !== 'open';
    const authenticated = !required || isAuthorized();
    sendJson({ required, authenticated });
    return true;
  }

  if (url === '/api/auth/login' && method === 'POST') {
    readBody((data) => {
      const expectedPassword = getExpectedAdminPassword();
      const provided = data?.password || '';
      if (expectedPassword.toLowerCase() === 'none' || expectedPassword.toLowerCase() === 'open' || provided === expectedPassword) {
        sendJson({ success: true, token: provided, message: 'Authentication successful.' });
      } else {
        res.statusCode = 401;
        sendJson({ success: false, message: 'Invalid admin password.' });
      }
    });
    return true;
  }

  // Auth enforcement for all other /api endpoints in mock server
  if (!isAuthorized()) {
    res.statusCode = 401;
    sendJson({ success: false, error: 'Unauthorized: Admin password required.' });
    return true;
  }

  // 1. Telemetry
  if (url === '/api/server/telemetry' && method === 'GET') {
    const uptimeSec = Math.floor((Date.now() - serverState.uptimeStart) / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const fps = +(59.5 + (Math.random() - 0.5) * 0.8).toFixed(1);
    const ms = (1000 / Math.max(1, fps)).toFixed(1);

    sendJson({
      uptime: `${hours}h ${mins}m`,
      uptimeSeconds: uptimeSec,
      onlineCount: serverState.players.length,
      maxPlayers: serverState.maxPlayers,
      fps,
      tickRate: `${ms}ms`,
      activeZdos: serverState.activeZdos,
      memoryMb: Math.round(serverState.memoryMb),
    });
    return true;
  }

  // 2. Players & Bans
  if (url === '/api/players' && method === 'GET') {
    sendJson(serverState.players);
    return true;
  }

  if (url === '/api/bans' && method === 'GET') {
    sendJson(serverState.bannedPlayers);
    return true;
  }

  if (url === '/api/players/kick' && method === 'POST') {
    readBody((data) => {
      const name = data.name;
      serverState.players = serverState.players.filter(p => p.name !== name);
      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'Admin',
        text: `Kicked player "${name}" via WebPortal`,
        level: 'warn',
      });
      sendJson({ success: true, message: `Player ${name} kicked` });
    });
    return true;
  }

  if (url === '/api/players/ban' && method === 'POST') {
    readBody((data) => {
      const name = data.name;
      const reason = data.reason || 'Banned by Admin via WebPortal';
      const targetPlayer = serverState.players.find(p => p.name === name);
      const steamId = targetPlayer ? targetPlayer.steamId : (data.steamId || '76561198000000000');

      serverState.players = serverState.players.filter(p => p.name !== name);
      
      // Add to banned players list if not already present
      if (!serverState.bannedPlayers.some(b => b.steamId === steamId)) {
        serverState.bannedPlayers.push({
          id: `b_${Date.now()}`,
          name,
          steamId,
          bannedAt: new Date().toLocaleString(),
          reason,
          bannedBy: 'Admin (WebPortal)',
        });
      }

      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'Admin',
        text: `Banned player "${name}" (SteamID: ${steamId}). Reason: ${reason}`,
        level: 'error',
      });
      sendJson({ success: true, message: `Player ${name} banned` });
    });
    return true;
  }

  if (url === '/api/bans/unban' && method === 'POST') {
    readBody((data) => {
      const steamId = data.steamId;
      const target = serverState.bannedPlayers.find(b => b.steamId === steamId);
      serverState.bannedPlayers = serverState.bannedPlayers.filter(b => b.steamId !== steamId);

      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'Admin',
        text: `Unbanned SteamID ${steamId} (${target ? target.name : 'Unknown'}) via WebPortal`,
        level: 'info',
      });
      sendJson({ success: true, message: `Unbanned SteamID ${steamId}` });
    });
    return true;
  }

  if (url === '/api/bans/add' && method === 'POST') {
    readBody((data) => {
      const steamId = (data.steamId || '').trim();
      const name = (data.name || 'Unknown / Offline').trim();
      const reason = (data.reason || 'Banned by Admin').trim();

      if (!steamId) {
        sendJson({ success: false, message: 'SteamID is required' }, 400);
        return;
      }

      if (!serverState.bannedPlayers.some(b => b.steamId === steamId)) {
        serverState.bannedPlayers.push({
          id: `b_${Date.now()}`,
          name,
          steamId,
          bannedAt: new Date().toLocaleString(),
          reason,
          bannedBy: 'Admin (WebPortal)',
        });
      }

      // Also kick if currently online
      serverState.players = serverState.players.filter(p => p.steamId !== steamId);

      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'Admin',
        text: `Added manual ban for SteamID ${steamId} (${name}). Reason: ${reason}`,
        level: 'error',
      });
      sendJson({ success: true, message: `Banned SteamID ${steamId}` });
    });
    return true;
  }

  // 3. Console Logs & Exec
  if (url === '/api/console/logs' && method === 'GET') {
    sendJson(serverState.logs);
    return true;
  }

  if (url === '/api/console/exec' && method === 'POST') {
    readBody((data) => {
      const cmd = (data.command || '').trim();
      const time = new Date().toLocaleTimeString();

      serverState.logs.push({
        time,
        source: 'AdminConsole',
        text: `> ${cmd}`,
        level: 'cmd',
      });

      let responseText = `Executed: ${cmd}`;
      if (cmd.toLowerCase() === 'save') {
        responseText = 'Saving world "Valhalla"... Saved 42,189 objects in 0.038s.';
        serverState.logs.push({ time, source: 'WorldSave', text: responseText, level: 'success' });
      } else if (cmd.toLowerCase().startsWith('event')) {
        responseText = `Started random event: "${cmd.replace(/^event\s*/i, '') || 'wolves'}" for all active biomes.`;
        serverState.logs.push({ time, source: 'RandEvent', text: responseText, level: 'warn' });
      }

      sendJson({ success: true, output: responseText });
    });
    return true;
  }

  // 4. Server Lifecycle & Scheduled Restarts
  if (url === '/api/server/save' && method === 'POST') {
    serverState.logs.push({
      time: new Date().toLocaleTimeString(),
      source: 'WorldSave',
      text: 'Manual world save triggered via WebPortal. Done.',
      level: 'success',
    });
    sendJson({ success: true, message: 'World saved successfully' });
    return true;
  }

  if (url === '/api/server/broadcast' && method === 'POST') {
    readBody((data) => {
      const msg = data.message || '';
      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'Broadcast',
        text: `[GLOBAL SHOUT] ${msg}`,
        level: 'warn',
      });
      sendJson({ success: true, message: 'Broadcast sent' });
    });
    return true;
  }

  if (url === '/api/server/restart-status' && method === 'GET') {
    let remainingSeconds = 0;
    if (serverState.scheduledRestart && serverState.scheduledRestart.active && serverState.scheduledRestart.targetTimestamp) {
      remainingSeconds = Math.max(0, Math.floor((serverState.scheduledRestart.targetTimestamp - Date.now()) / 1000));
    }

    sendJson({
      scheduledRestart: serverState.scheduledRestart ? {
        active: serverState.scheduledRestart.active,
        targetTimestamp: serverState.scheduledRestart.targetTimestamp,
        totalMinutes: serverState.scheduledRestart.totalMinutes,
        remainingSeconds,
        reason: serverState.scheduledRestart.reason,
      } : null,
      dailyRestart: serverState.dailyRestart,
      lifecycleConfig: serverState.lifecycleConfig,
      pendingChanges: serverState.pendingChanges,
    });
    return true;
  }

  if (url === '/api/server/pending-changes' && method === 'GET') {
    sendJson({ success: true, pendingChanges: serverState.pendingChanges });
    return true;
  }

  if (url === '/api/server/clear-pending-changes' && method === 'POST') {
    serverState.pendingChanges = [];
    serverState.logs.push({
      time: new Date().toLocaleTimeString(),
      source: 'ServerLifecycle',
      text: 'Pending restart changes notification list cleared by Admin.',
      level: 'info',
    });
    sendJson({ success: true, message: 'Pending changes cleared' });
    return true;
  }

  if (url === '/api/server/schedule-restart' && method === 'POST') {
    readBody((data) => {
      const minutes = Math.max(1, Number(data.minutes) || 10);
      const reason = (data.reason || 'Scheduled Maintenance').trim();
      const targetTimestamp = Date.now() + minutes * 60 * 1000;

      serverState.scheduledRestart = {
        active: true,
        targetTimestamp,
        totalMinutes: minutes,
        reason,
        warningsSent: [],
      };

      const time = new Date().toLocaleTimeString();
      serverState.logs.push({
        time,
        source: 'ServerLifecycle',
        text: `Scheduled server restart for ${minutes} minutes from now (${new Date(targetTimestamp).toLocaleTimeString()}). Reason: "${reason}". Strategy: ${serverState.lifecycleConfig.mode}.`,
        level: 'warn',
      });
      serverState.logs.push({
        time,
        source: 'Broadcast',
        text: `[GLOBAL SHOUT] ⚠️ SERVER RESTART: Server will restart in ${minutes} minutes! Reason: ${reason}.`,
        level: 'warn',
      });

      sendJson({ success: true, message: `Restart scheduled in ${minutes} minutes`, targetTimestamp });
    });
    return true;
  }

  if (url === '/api/server/cancel-restart' && method === 'POST') {
    if (serverState.scheduledRestart) {
      serverState.scheduledRestart = null;
      const time = new Date().toLocaleTimeString();
      serverState.logs.push({
        time,
        source: 'ServerLifecycle',
        text: 'Scheduled server restart was CANCELLED by Admin.',
        level: 'info',
      });
      serverState.logs.push({
        time,
        source: 'Broadcast',
        text: '[GLOBAL SHOUT] ℹ️ The scheduled server restart has been CANCELLED.',
        level: 'info',
      });
    }
    sendJson({ success: true, message: 'Scheduled restart cancelled' });
    return true;
  }

  if (url === '/api/server/daily-restart' && method === 'POST') {
    readBody((data) => {
      if (typeof data.enabled === 'boolean') serverState.dailyRestart.enabled = data.enabled;
      if (data.time) serverState.dailyRestart.time = data.time;

      const time = new Date().toLocaleTimeString();
      serverState.logs.push({
        time,
        source: 'ServerLifecycle',
        text: `Updated automated daily restart: ${serverState.dailyRestart.enabled ? `Enabled at ${serverState.dailyRestart.time}` : 'Disabled'}`,
        level: 'info',
      });

      sendJson({ success: true, dailyRestart: serverState.dailyRestart });
    });
    return true;
  }

  if (url === '/api/server/lifecycle-config' && method === 'GET') {
    sendJson(serverState.lifecycleConfig);
    return true;
  }

  if (url === '/api/server/lifecycle-config' && method === 'POST') {
    readBody((data) => {
      if (data.mode === 'ExitOnly' || data.mode === 'SpawnProcess') {
        serverState.lifecycleConfig.mode = data.mode;
      }
      if (typeof data.scriptPath === 'string') {
        serverState.lifecycleConfig.scriptPath = data.scriptPath;
      }

      const time = new Date().toLocaleTimeString();
      serverState.logs.push({
        time,
        source: 'ServerLifecycle',
        text: `Updated restart strategy: ${serverState.lifecycleConfig.mode} (Script: ${serverState.lifecycleConfig.scriptPath})`,
        level: 'info',
      });

      sendJson({ success: true, lifecycleConfig: serverState.lifecycleConfig });
    });
    return true;
  }

  // 5. Module: CharactersVault
  if (url === '/api/modules/charactervault/bindings' && method === 'GET') {
    sendJson(serverState.characterVaultBindings);
    return true;
  }

  if (url === '/api/modules/charactervault/unbind' && method === 'POST') {
    readBody((data) => {
      serverState.characterVaultBindings = serverState.characterVaultBindings.filter(
        b => b.steamId !== data.steamId
      );
      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'CharactersVault',
        text: `Unbound SteamID ${data.steamId} (${data.name})`,
        level: 'info',
      });
      sendJson({ success: true });
    });
    return true;
  }

  if (url === '/api/modules/charactervault/wipe' && method === 'POST') {
    serverState.characterVaultBindings = [];
    serverState.logs.push({
      time: new Date().toLocaleTimeString(),
      source: 'CharactersVault',
      text: 'PURGE: All character vault bindings wiped clean via WebPortal',
      level: 'error',
    });
    sendJson({ success: true, message: 'All bindings wiped' });
    return true;
  }

  // 6. Module: Valgrind
  if (url === '/api/modules/valgrind/config' && method === 'GET') {
    sendJson(serverState.valgrindConfig);
    return true;
  }

  if (url === '/api/modules/valgrind/config' && method === 'POST') {
    readBody((data) => {
      if (data.calculationMode) serverState.valgrindConfig.calculationMode = data.calculationMode;
      if (typeof data.useTopNSkillsOnly === 'boolean') serverState.valgrindConfig.useTopNSkillsOnly = data.useTopNSkillsOnly;
      if (typeof data.topNSkillsCount === 'number') serverState.valgrindConfig.topNSkillsCount = data.topNSkillsCount;
      if (typeof data.resetAccumulatorOnDeath === 'boolean') serverState.valgrindConfig.resetAccumulatorOnDeath = data.resetAccumulatorOnDeath;
      if (typeof data.enableDebugLogging === 'boolean') serverState.valgrindConfig.enableDebugLogging = data.enableDebugLogging;

      if (typeof data.earlyGameLossPercent === 'number') serverState.valgrindConfig.earlyGameLossPercent = data.earlyGameLossPercent;
      if (typeof data.midGameLossPercent === 'number') serverState.valgrindConfig.midGameLossPercent = data.midGameLossPercent;
      if (typeof data.lateGameLossPercent === 'number') serverState.valgrindConfig.lateGameLossPercent = data.lateGameLossPercent;
      if (typeof data.endgameLossPercent === 'number') serverState.valgrindConfig.endgameLossPercent = data.endgameLossPercent;

      if (typeof data.curveMaxLossPercent === 'number') serverState.valgrindConfig.curveMaxLossPercent = data.curveMaxLossPercent;
      if (typeof data.curveMinLossPercent === 'number') serverState.valgrindConfig.curveMinLossPercent = data.curveMinLossPercent;

      recordPendingChange('valgrind', 'Valgrind');
      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'Valgrind',
        text: `Config updated: Mode ${serverState.valgrindConfig.calculationMode} (Restart pending)`,
        level: 'success',
      });
      sendJson({ success: true, config: serverState.valgrindConfig });
    });
    return true;
  }

  // 7. Module: Dagr & Nott
  if (url === '/api/modules/dagrnott/config' && method === 'GET') {
    const dawnMin = +(4.5 / Math.max(0.001, serverState.dagrNottConfig.dawnMultiplier)).toFixed(1);
    const dayMin = +(15.0 / Math.max(0.001, serverState.dagrNottConfig.dayMultiplier)).toFixed(1);
    const duskMin = +(4.5 / Math.max(0.001, serverState.dagrNottConfig.duskMultiplier)).toFixed(1);
    const nightMin = +(6.0 / Math.max(0.001, serverState.dagrNottConfig.nightMultiplier)).toFixed(1);
    const totalMin = +(dawnMin + dayMin + duskMin + nightMin).toFixed(1);

    sendJson({
      ...serverState.dagrNottConfig,
      dawnMinutes: dawnMin,
      dayMinutes: dayMin,
      duskMinutes: duskMin,
      nightMinutes: nightMin,
      totalMinutes: totalMin,
    });
    return true;
  }

  if (url === '/api/modules/dagrnott/config' && method === 'POST') {
    readBody((data) => {
      if (typeof data.dawnMultiplier === 'number') serverState.dagrNottConfig.dawnMultiplier = data.dawnMultiplier;
      if (typeof data.dayMultiplier === 'number') serverState.dagrNottConfig.dayMultiplier = data.dayMultiplier;
      if (typeof data.duskMultiplier === 'number') serverState.dagrNottConfig.duskMultiplier = data.duskMultiplier;
      if (typeof data.nightMultiplier === 'number') serverState.dagrNottConfig.nightMultiplier = data.nightMultiplier;
      if (typeof data.logPhaseTransitions === 'boolean') serverState.dagrNottConfig.logPhaseTransitions = data.logPhaseTransitions;

      const dawnMin = +(4.5 / Math.max(0.001, serverState.dagrNottConfig.dawnMultiplier)).toFixed(1);
      const dayMin = +(15.0 / Math.max(0.001, serverState.dagrNottConfig.dayMultiplier)).toFixed(1);
      const duskMin = +(4.5 / Math.max(0.001, serverState.dagrNottConfig.duskMultiplier)).toFixed(1);
      const nightMin = +(6.0 / Math.max(0.001, serverState.dagrNottConfig.nightMultiplier)).toFixed(1);
      const totalMin = +(dawnMin + dayMin + duskMin + nightMin).toFixed(1);

      serverState.dagrNottConfig.dawnMinutes = dawnMin;
      serverState.dagrNottConfig.dayMinutes = dayMin;
      serverState.dagrNottConfig.duskMinutes = duskMin;
      serverState.dagrNottConfig.nightMinutes = nightMin;
      serverState.dagrNottConfig.totalMinutes = totalMin;

      recordPendingChange('dagrnott', 'Dagr & Nott');
      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'DagrAndNott',
        text: `Diurnal cycle updated: ~${totalMin}m total (Dawn: ${serverState.dagrNottConfig.dawnMultiplier}x, Day: ${serverState.dagrNottConfig.dayMultiplier}x, Dusk: ${serverState.dagrNottConfig.duskMultiplier}x, Night: ${serverState.dagrNottConfig.nightMultiplier}x) (Restart pending)`,
        level: 'success',
      });
      sendJson({ success: true, config: serverState.dagrNottConfig });
    });
    return true;
  }

  // 8. Module: Skald
  if (url === '/api/modules/skald/config' && method === 'GET') {
    sendJson(serverState.skaldConfig);
    return true;
  }

  if (url === '/api/modules/skald/config' && method === 'POST') {
    readBody((data) => {
      serverState.skaldConfig = { ...serverState.skaldConfig, ...data };
      recordPendingChange('skald', 'Skald');
      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'Skald',
        text: `Skald configuration synchronized (${serverState.skaldConfig.enabled ? 'Announcements Enabled' : 'Disabled'}) (Restart pending)`,
        level: 'success',
      });
      sendJson({ success: true, config: serverState.skaldConfig });
    });
    return true;
  }

  if (url === '/api/modules/skald/chronicle' && method === 'GET') {
    sendJson(serverState.skaldChronicle);
    return true;
  }

  if (url === '/api/modules/skald/test-death' && method === 'POST') {
    readBody((data) => {
      const victimName = data.victimName || 'Ragnar';
      const killerName = data.killerName || '1-Star Troll';
      const category = data.category || 'Monster';
      const biome = data.biome || 'Black Forest';
      const formattedMessage = data.message || `${victimName} was slain by a ${killerName} in the ${biome}`;

      const newRecord = {
        id: `c_${Date.now()}`,
        victimName,
        victimSteamId: '76561198011223344',
        killerName,
        category,
        biome,
        formattedMessage,
        timestamp: new Date().toLocaleString(),
      };

      serverState.skaldChronicle.unshift(newRecord);
      if (serverState.skaldChronicle.length > 50) serverState.skaldChronicle.pop();

      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'Skald',
        text: `[GLOBAL SHOUT] 💀 ${formattedMessage}`,
        level: 'warn',
      });

      sendJson({ success: true, record: newRecord });
    });
    return true;
  }

  // 10. Module: Njoror
  if (url === '/api/modules/njoror/config' && method === 'GET') {
    sendJson(serverState.njororConfig);
    return true;
  }

  if (url === '/api/modules/njoror/config' && method === 'POST') {
    readBody((data) => {
      serverState.njororConfig = { ...serverState.njororConfig, ...data };
      recordPendingChange('njoror', 'Njörðr');
      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'Njoror',
        text: `Njörðr ocean atmospheric parameters synchronized (Restart pending)`,
        level: 'success',
      });
      sendJson({ success: true, config: serverState.njororConfig });
    });
    return true;
  }

  // 11. Module: Installed status
  if (url === '/api/modules/installed' && method === 'GET') {
    sendJson({ installed: serverState.installedModules });
    return true;
  }

  // 12. Other Mods (3rd Party Configs)
  if (url === '/api/other-mods/list' && method === 'GET') {
    const summaries = mockOtherMods.map(m => ({
      fileName: m.fileName,
      filePath: m.filePath,
      displayName: m.displayName,
      pluginGuid: m.pluginGuid,
      pluginName: m.pluginName,
      pluginVersion: m.pluginVersion,
      sectionCount: m.sections.length,
      settingCount: m.sections.reduce((acc, s) => acc + s.entries.length, 0),
      fileSizeBytes: m.rawContent.length,
      lastModified: m.lastModified,
      isLoadedInGame: m.isLoadedInGame,
      isFirstParty: m.isFirstParty,
    }));
    sendJson({ mods: summaries });
    return true;
  }

  if (url?.startsWith('/api/other-mods/config') && method === 'GET' && !url.includes('/save') && !url.includes('/reset-defaults')) {
    const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const fileParam = urlObj.searchParams.get('file') || '';
    const mod = mockOtherMods.find(m => m.fileName.toLowerCase() === fileParam.toLowerCase());
    if (!mod) {
      sendJson({ success: false, message: `Mod config '${fileParam}' not found.` }, 404);
      return true;
    }
    sendJson({
      fileName: mod.fileName,
      displayName: mod.displayName,
      pluginGuid: mod.pluginGuid,
      pluginName: mod.pluginName,
      pluginVersion: mod.pluginVersion,
      isLoadedInGame: mod.isLoadedInGame,
      sections: mod.sections,
      rawContent: generateRawContentFromSections(mod),
      lastModified: mod.lastModified,
    });
    return true;
  }

  if (url === '/api/other-mods/config/save' && method === 'POST') {
    readBody((data) => {
      const fileName = data.fileName || '';
      const mod = mockOtherMods.find(m => m.fileName.toLowerCase() === fileName.toLowerCase());
      if (!mod) {
        sendJson({ success: false, message: `Mod config '${fileName}' not found.` }, 404);
        return;
      }

      if (data.saveRaw && typeof data.rawContent === 'string') {
        mod.rawContent = data.rawContent;
        parseRawContentIntoSections(mod, data.rawContent);
      } else if (data.updates) {
        const updates = data.updates as Record<string, Record<string, string>>;
        for (const [secName, entries] of Object.entries(updates)) {
          let sec = mod.sections.find(s => s.name.toLowerCase() === secName.toLowerCase());
          if (!sec) {
            sec = { name: secName, entries: [] };
            mod.sections.push(sec);
          }
          for (const [k, v] of Object.entries(entries)) {
            const entry = sec.entries.find(e => e.key.toLowerCase() === k.toLowerCase());
            if (entry) {
              entry.value = String(v);
            } else {
              sec.entries.push({
                key: k,
                value: String(v),
                defaultValue: String(v),
                valueType: 'String',
                description: '',
              });
            }
          }
        }
        mod.rawContent = generateRawContentFromSections(mod);
      }

      mod.lastModified = new Date().toLocaleString();
      recordPendingChange(mod.fileName, mod.displayName);
      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'ConfigSync',
        text: `Updated configuration for '${mod.displayName}' (${mod.fileName}) (Restart pending)`,
        level: 'success',
      });

      sendJson({
        success: true,
        config: {
          fileName: mod.fileName,
          displayName: mod.displayName,
          pluginGuid: mod.pluginGuid,
          pluginName: mod.pluginName,
          pluginVersion: mod.pluginVersion,
          isLoadedInGame: mod.isLoadedInGame,
          sections: mod.sections,
          rawContent: mod.rawContent,
          lastModified: mod.lastModified,
        },
      });
    });
    return true;
  }

  if (url === '/api/other-mods/config/reset-defaults' && method === 'POST') {
    readBody((data) => {
      const fileName = data.fileName || '';
      const mod = mockOtherMods.find(m => m.fileName.toLowerCase() === fileName.toLowerCase());
      if (!mod) {
        sendJson({ success: false, message: `Mod config '${fileName}' not found.` }, 404);
        return;
      }

      for (const sec of mod.sections) {
        for (const entry of sec.entries) {
          if (entry.defaultValue !== undefined && entry.defaultValue !== null) {
            entry.value = entry.defaultValue;
          }
        }
      }

      mod.rawContent = generateRawContentFromSections(mod);
      mod.lastModified = new Date().toLocaleString();
      recordPendingChange(mod.fileName, mod.displayName);
      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'ConfigSync',
        text: `Reset configuration defaults for '${mod.displayName}' (${mod.fileName}) (Restart pending)`,
        level: 'warn',
      });

      sendJson({
        success: true,
        config: {
          fileName: mod.fileName,
          displayName: mod.displayName,
          pluginGuid: mod.pluginGuid,
          pluginName: mod.pluginName,
          pluginVersion: mod.pluginVersion,
          isLoadedInGame: mod.isLoadedInGame,
          sections: mod.sections,
          rawContent: mod.rawContent,
          lastModified: mod.lastModified,
        },
      });
    });
    return true;
  }

  return false;
}

// ── Mock Other Mods Database ────────────────────────────────────────────────
interface MockOtherMod {
  fileName: string;
  filePath: string;
  displayName: string;
  pluginGuid: string;
  pluginName: string;
  pluginVersion: string;
  isLoadedInGame: boolean;
  isFirstParty: boolean;
  lastModified: string;
  sections: Array<{
    name: string;
    entries: Array<{
      key: string;
      value: string;
      defaultValue?: string | null;
      valueType: string;
      description: string;
      acceptableValues?: string[] | null;
      minRange?: number | null;
      maxRange?: number | null;
    }>;
  }>;
  rawContent: string;
}

function generateRawContentFromSections(detail: MockOtherMod): string {
  const lines: string[] = [
    `## Configuration file for "${detail.displayName}"`,
    `## Plugin: ${detail.pluginGuid || detail.fileName} v${detail.pluginVersion || '1.0.0'}`,
    '',
  ];

  for (const sec of detail.sections) {
    lines.push(`[${sec.name}]`, '');
    for (const e of sec.entries) {
      if (e.description) {
        lines.push(`## ${e.description}`);
      }
      lines.push(`# Setting type: ${e.valueType}`);
      if (e.defaultValue !== undefined && e.defaultValue !== null) {
        lines.push(`# Default value: ${e.defaultValue}`);
      }
      if (e.minRange !== undefined && e.minRange !== null && e.maxRange !== undefined && e.maxRange !== null) {
        lines.push(`# Acceptable value range: From ${e.minRange} to ${e.maxRange}`);
      }
      if (e.acceptableValues && e.acceptableValues.length > 0) {
        lines.push(`# Acceptable values: ${e.acceptableValues.join(', ')}`);
      }
      lines.push(`${e.key} = ${e.value}`, '');
    }
  }
  return lines.join('\n');
}

function parseRawContentIntoSections(mod: MockOtherMod, raw: string): void {
  const lines = raw.split(/\r?\n/);
  let currentSecName = 'General';
  let sec = mod.sections.find(s => s.name.toLowerCase() === currentSecName.toLowerCase());
  if (!sec) {
    sec = { name: currentSecName, entries: [] };
    mod.sections.push(sec);
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      currentSecName = line.substring(1, line.length - 1).trim();
      sec = mod.sections.find(s => s.name.toLowerCase() === currentSecName.toLowerCase());
      if (!sec) {
        sec = { name: currentSecName, entries: [] };
        mod.sections.push(sec);
      }
      continue;
    }
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0 && sec) {
      const key = line.substring(0, eqIdx).trim();
      const val = line.substring(eqIdx + 1).trim();
      const entry = sec.entries.find(e => e.key.toLowerCase() === key.toLowerCase());
      if (entry) {
        entry.value = val;
      } else {
        sec.entries.push({
          key,
          value: val,
          defaultValue: val,
          valueType: 'String',
          description: '',
        });
      }
    }
  }
}

const mockOtherMods: MockOtherMod[] = [
  {
    fileName: 'valheim.drop_that.cfg',
    filePath: 'valheim.drop_that.cfg',
    displayName: 'Drop That',
    pluginGuid: 'valheim.drop_that',
    pluginName: 'Drop That',
    pluginVersion: '2.3.14',
    isLoadedInGame: true,
    isFirstParty: false,
    lastModified: '2026-08-28 17:42',
    sections: [
      {
        name: 'General',
        entries: [
          {
            key: 'EnableDropThat',
            value: 'true',
            defaultValue: 'true',
            valueType: 'Boolean',
            description: 'Enable or disable the Drop That modification system.',
          },
          {
            key: 'AlwaysDropAtLeastOne',
            value: 'false',
            defaultValue: 'false',
            valueType: 'Boolean',
            description: 'Guarantees that at least one item from the creature drop table will drop on death.',
          },
          {
            key: 'GlobalDropRateMultiplier',
            value: '1.25',
            defaultValue: '1.0',
            valueType: 'Single',
            description: 'Global scaling multiplier applied to all item drop chances.',
            minRange: 0.1,
            maxRange: 10.0,
          },
          {
            key: 'WriteDropTablesToLog',
            value: 'false',
            defaultValue: 'false',
            valueType: 'Boolean',
            description: 'Dump all creature drop tables to BepInEx log on game load for debugging.',
          },
        ],
      },
      {
        name: 'DropRules',
        entries: [
          {
            key: 'ApplyToBosses',
            value: 'true',
            defaultValue: 'true',
            valueType: 'Boolean',
            description: 'Apply custom drop multiplier calculations to Bosses and Mini-Bosses.',
          },
          {
            key: 'PreserveVanillaDropChance',
            value: 'true',
            defaultValue: 'true',
            valueType: 'Boolean',
            description: 'When true, vanilla items retain their base drop weights alongside custom added items.',
          },
          {
            key: 'MaxDropDistance',
            value: '5.0',
            defaultValue: '4.0',
            valueType: 'Single',
            description: 'Maximum distance from creature corpse where items may scatter upon death.',
            minRange: 1.0,
            maxRange: 20.0,
          },
        ],
      },
    ],
    rawContent: '',
  },
  {
    fileName: 'org.bepinex.plugins.valheim_plus.cfg',
    filePath: 'org.bepinex.plugins.valheim_plus.cfg',
    displayName: 'Valheim Plus',
    pluginGuid: 'org.bepinex.plugins.valheim_plus',
    pluginName: 'Valheim Plus',
    pluginVersion: '0.9.9.11',
    isLoadedInGame: true,
    isFirstParty: false,
    lastModified: '2026-08-30 09:14',
    sections: [
      {
        name: 'General',
        entries: [
          {
            key: 'Enabled',
            value: 'true',
            defaultValue: 'true',
            valueType: 'Boolean',
            description: 'Master switch to enable Valheim Plus modifications.',
          },
          {
            key: 'EnforceMod',
            value: 'false',
            defaultValue: 'false',
            valueType: 'Boolean',
            description: 'Require connected players to have matching Valheim Plus installed.',
          },
        ],
      },
      {
        name: 'Player',
        entries: [
          {
            key: 'BaseMaximumWeight',
            value: '350',
            defaultValue: '300',
            valueType: 'Single',
            description: 'Maximum carrying weight capacity before becoming encumbered.',
            minRange: 100,
            maxRange: 1500,
          },
          {
            key: 'BaseAutoPickupRange',
            value: '3.0',
            defaultValue: '2.0',
            valueType: 'Single',
            description: 'Radius in meters around player to automatically vacuum up dropped items.',
            minRange: 1.0,
            maxRange: 15.0,
          },
          {
            key: 'StaminaRegenMultiplier',
            value: '1.15',
            defaultValue: '1.0',
            valueType: 'Single',
            description: 'Multiplier for base stamina regeneration rate.',
            minRange: 0.1,
            maxRange: 5.0,
          },
          {
            key: 'CropHarvestMultiplier',
            value: '2',
            defaultValue: '1',
            valueType: 'Int32',
            description: 'Item multiplier when harvesting planted crops like barley, flax, carrots.',
            minRange: 1,
            maxRange: 10,
          },
        ],
      },
      {
        name: 'Building',
        entries: [
          {
            key: 'NoInvalidPlacement',
            value: 'true',
            defaultValue: 'false',
            valueType: 'Boolean',
            description: 'Removes the invalid placement restrictions for building pieces (e.g. clipping).',
          },
          {
            key: 'DisableStructuralIntegrity',
            value: 'false',
            defaultValue: 'false',
            valueType: 'Boolean',
            description: 'Disables structural support physics, allowing infinite building height.',
          },
          {
            key: 'PiecePlacementDamageMultiplier',
            value: '1.0',
            defaultValue: '1.0',
            valueType: 'Single',
            description: 'Damage multiplier dealt to building pieces by enemies.',
            minRange: 0.0,
            maxRange: 5.0,
          },
        ],
      },
      {
        name: 'Inventory',
        entries: [
          {
            key: 'PlayerInventoryRows',
            value: '5',
            defaultValue: '4',
            valueType: 'Int32',
            description: 'Number of rows in the player inventory (4 = default 32 slots).',
            acceptableValues: ['4', '5', '6', '7', '8'],
          },
          {
            key: 'WoodChestRows',
            value: '3',
            defaultValue: '2',
            valueType: 'Int32',
            description: 'Number of inventory rows in wooden chests.',
            acceptableValues: ['2', '3', '4'],
          },
          {
            key: 'IronChestRows',
            value: '5',
            defaultValue: '4',
            valueType: 'Int32',
            description: 'Number of inventory rows in reinforced iron chests.',
            acceptableValues: ['4', '5', '6'],
          },
        ],
      },
    ],
    rawContent: '',
  },
  {
    fileName: 'advize.PlantEverything.cfg',
    filePath: 'advize.PlantEverything.cfg',
    displayName: 'Plant Everything',
    pluginGuid: 'advize.PlantEverything',
    pluginName: 'Plant Everything',
    pluginVersion: '1.16.2',
    isLoadedInGame: true,
    isFirstParty: false,
    lastModified: '2026-08-25 12:20',
    sections: [
      {
        name: 'General',
        entries: [
          {
            key: 'EnableMod',
            value: 'true',
            defaultValue: 'true',
            valueType: 'Boolean',
            description: 'Enable Plant Everything farming capabilities.',
          },
          {
            key: 'EnforceServerConfig',
            value: 'true',
            defaultValue: 'true',
            valueType: 'Boolean',
            description: 'Force connecting clients to synchronize with server crop configs.',
          },
        ],
      },
      {
        name: 'Difficulty',
        entries: [
          {
            key: 'RequireCultivatedGround',
            value: 'false',
            defaultValue: 'true',
            valueType: 'Boolean',
            description: 'Require ground to be cultivated before berry bushes or mushrooms can be planted.',
          },
          {
            key: 'GrowthTimeMultiplier',
            value: '0.85',
            defaultValue: '1.0',
            valueType: 'Single',
            description: 'Growth time speed multiplier for all custom planted flora.',
            minRange: 0.1,
            maxRange: 5.0,
          },
          {
            key: 'BerryBushesRespawnTime',
            value: '300',
            defaultValue: '300',
            valueType: 'Single',
            description: 'Time in minutes for harvested berry bushes to respawn fresh berries.',
            minRange: 30,
            maxRange: 1440,
          },
        ],
      },
      {
        name: 'Snapping',
        entries: [
          {
            key: 'EnableGridSnapping',
            value: 'true',
            defaultValue: 'true',
            valueType: 'Boolean',
            description: 'Enable snapping flora pieces to clean crop grid alignments.',
          },
          {
            key: 'GridSnapDegrees',
            value: '45',
            defaultValue: '45',
            valueType: 'Single',
            description: 'Angular snap step for rotating plants with the cultivator.',
            acceptableValues: ['15', '30', '45', '90'],
          },
        ],
      },
    ],
    rawContent: '',
  },
  {
    fileName: 'Smoothbrain.CreatureLevelAndLootControl.cfg',
    filePath: 'Smoothbrain.CreatureLevelAndLootControl.cfg',
    displayName: 'Creature Level & Loot Control',
    pluginGuid: 'Smoothbrain.CreatureLevelAndLootControl',
    pluginName: 'Creature Level & Loot Control',
    pluginVersion: '4.5.8',
    isLoadedInGame: true,
    isFirstParty: false,
    lastModified: '2026-08-31 20:05',
    sections: [
      {
        name: 'General',
        entries: [
          {
            key: 'MaxLevel',
            value: '5',
            defaultValue: '5',
            valueType: 'Int32',
            description: 'Maximum star tier creatures can spawn with (up to 5-star).',
            minRange: 1,
            maxRange: 10,
          },
          {
            key: 'LootMultiplier',
            value: '1.5',
            defaultValue: '1.0',
            valueType: 'Single',
            description: 'Extra loot multiplier gained per creature star tier.',
            minRange: 0.5,
            maxRange: 5.0,
          },
          {
            key: 'EnableSpecialEffects',
            value: 'true',
            defaultValue: 'true',
            valueType: 'Boolean',
            description: 'Render glowing elemental particles on infused creatures.',
          },
        ],
      },
      {
        name: 'CreatureScaling',
        entries: [
          {
            key: 'HealthIncreasePerLevelPercent',
            value: '50.0',
            defaultValue: '50.0',
            valueType: 'Single',
            description: 'Percentage increase to maximum HP per star level.',
            minRange: 10.0,
            maxRange: 200.0,
          },
          {
            key: 'DamageIncreasePerLevelPercent',
            value: '25.0',
            defaultValue: '20.0',
            valueType: 'Single',
            description: 'Percentage increase to physical/elemental attack power per star.',
            minRange: 5.0,
            maxRange: 100.0,
          },
          {
            key: 'SizeIncreasePerLevelPercent',
            value: '10.0',
            defaultValue: '10.0',
            valueType: 'Single',
            description: 'Scale multiplier increasing creature physical model size per star level.',
            minRange: 0.0,
            maxRange: 50.0,
          },
        ],
      },
    ],
    rawContent: '',
  },
  {
    fileName: 'ComfyMods.Gizmo.cfg',
    filePath: 'ComfyMods.Gizmo.cfg',
    displayName: 'Gizmo Reloaded',
    pluginGuid: 'ComfyMods.Gizmo',
    pluginName: 'Gizmo Reloaded',
    pluginVersion: '1.5.0',
    isLoadedInGame: true,
    isFirstParty: false,
    lastModified: '2026-08-15 14:22',
    sections: [
      {
        name: 'General',
        entries: [
          {
            key: 'Enabled',
            value: 'true',
            defaultValue: 'true',
            valueType: 'Boolean',
            description: 'Enable 3-axis rotation gizmo for building hammer.',
          },
          {
            key: 'SnapAngles',
            value: '16',
            defaultValue: '16',
            valueType: 'Int32',
            description: 'Number of discrete rotation snap steps per 360-degree full circle.',
            acceptableValues: ['8', '16', '32', '64', '128'],
          },
          {
            key: 'ShowVisualGuide',
            value: 'true',
            defaultValue: 'true',
            valueType: 'Boolean',
            description: 'Display 3D colored rotation circles around the active piece.',
          },
        ],
      },
      {
        name: 'Keybinds',
        entries: [
          {
            key: 'RotateXModifier',
            value: 'LeftShift',
            defaultValue: 'LeftShift',
            valueType: 'String',
            description: 'Key modifier to rotate piece around the pitch (X) axis with scroll wheel.',
          },
          {
            key: 'RotateZModifier',
            value: 'LeftAlt',
            defaultValue: 'LeftAlt',
            valueType: 'String',
            description: 'Key modifier to rotate piece around the roll (Z) axis with scroll wheel.',
          },
          {
            key: 'ResetRotationKey',
            value: 'V',
            defaultValue: 'V',
            valueType: 'String',
            description: 'Hotkey to immediately reset piece rotation to default orientation.',
          },
        ],
      },
    ],
    rawContent: '',
  },
  {
    fileName: 'denikson.Quick_Slots_Plus.cfg',
    filePath: 'denikson.Quick_Slots_Plus.cfg',
    displayName: 'Quick Slots Plus',
    pluginGuid: 'denikson.Quick_Slots_Plus',
    pluginName: 'Quick Slots Plus',
    pluginVersion: '1.4.1',
    isLoadedInGame: true,
    isFirstParty: false,
    lastModified: '2026-08-20 18:30',
    sections: [
      {
        name: 'General',
        entries: [
          {
            key: 'Enabled',
            value: 'true',
            defaultValue: 'true',
            valueType: 'Boolean',
            description: 'Enable dedicated equipment and potion quick access slots.',
          },
          {
            key: 'EquipmentSlotsCount',
            value: '5',
            defaultValue: '5',
            valueType: 'Int32',
            description: 'Number of armor and accessory equipment slots (Helmet, Chest, Legs, Cape, Utility).',
            minRange: 1,
            maxRange: 8,
          },
          {
            key: 'QuickItemSlotsCount',
            value: '3',
            defaultValue: '3',
            valueType: 'Int32',
            description: 'Number of extra hotbar quick item slots (Z, X, V keys).',
            minRange: 1,
            maxRange: 6,
          },
          {
            key: 'ShowInventoryStats',
            value: 'true',
            defaultValue: 'true',
            valueType: 'Boolean',
            description: 'Show composite armor and set bonus stats tooltip above inventory.',
          },
        ],
      },
    ],
    rawContent: '',
  },
];

// Initialize raw content for all mock mods
for (const m of mockOtherMods) {
  m.rawContent = generateRawContentFromSections(m);
}


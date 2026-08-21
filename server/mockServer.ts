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
    xpLoss: number;
    calcMode: string;
  };
  dagrNottConfig: {
    totalLength: number;
    dayLength: number;
    nightLength: number;
  };
  skaldConfig: {
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
  };
  heimdallrConfig: {
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
  };
  njororConfig: {
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
    xpLoss: 5.0,
    calcMode: 'Standard',
  },
  dagrNottConfig: {
    totalLength: 30,
    dayLength: 21,
    nightLength: 9,
  },
  skaldConfig: {
    enabled: true,
    enablePvp: true,
    enableBosses: true,
    includeBiome: true,
    logToConsole: true,
    monsterTemplates: '{victim} was slain by a {killer} in the {biome};{victim} was torn apart by a {killer};A {killer} claimed the soul of {victim}',
    bossTemplates: '{victim} was annihilated by the mythical {killer}!;The legendary {killer} crushed {victim} into dust',
    treeTemplates: '{victim} was crushed by a falling log!;{victim} learned that lumberjacking is deadly in Valheim',
    drowningTemplates: '{victim} ran out of stamina and drowned in cold waters;The sea claimed {victim} to the deep',
    freezingTemplates: '{victim} froze to death in the blizzard of the {biome};The bitter cold claimed {victim}',
    burningTemplates: '{victim} burned to ashes in the {biome};The flames consumed {victim}',
    poisonTemplates: '{victim} succumbed to deadly poison in the {biome};Venom ended {victim}\'s journey',
    fallDamageTemplates: '{victim} plummeted to their death from high cliffs;Gravity showed no mercy to {victim}',
    pvpTemplates: '{victim} was vanquished by {killer} in glorious combat!;{killer} struck down {victim} with honor',
  },
  heimdallrConfig: {
    enableCustomScaling: true,
    playerHealthScalePercent: 30.0,
    playerDamageScalePercent: 4.0,
    playerRangeRadius: 100.0,
    bossHealthMultiplier: 1.25,
    bossDamageMultiplier: 1.10,
    enableStarTweaks: true,
    nightStarBonusChance: 15.0,
    distanceCenterMultiplier: 1.5,
    globalOneStarChance: 10.0,
    globalTwoStarChance: 10.0,
  },
  njororConfig: {
    enableFairWinds: true,
    headwindMitigationPercent: 60.0,
    minWindSpeedMultiplier: 1.0,
    alwaysTailwindInOcean: false,
    enableWeatherTuning: true,
    stormFrequencyMultiplier: 1.0,
    rainFrequencyMultiplier: 1.0,
    clearFrequencyMultiplier: 1.0,
    enableSerpentTuning: true,
    daytimeSerpentSpawnChance: 0.0,
    nighttimeSerpentSpawnChance: 5.0,
    serpentSpawnIntervalSeconds: 1000.0,
    allowCalmWeatherDaySerpents: false,
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
  // All module IDs — when MOCK_MISSING_MODULES=true (via `npm run dev:missing`),
  // Valgrind and Heimdallr are simulated as not installed on this server.
  installedModules: process.env.MOCK_MISSING_MODULES === 'true'
    ? ['charvault', 'dagrnott', 'skald', 'njoror']
    : ['charvault', 'valgrind', 'dagrnott', 'skald', 'heimdallr', 'njoror'],
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
  }
}, 1000);

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

  // 1. Telemetry
  if (url === '/api/server/telemetry' && method === 'GET') {
    const uptimeSec = Math.floor((Date.now() - serverState.uptimeStart) / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const fps = +(59.5 + (Math.random() - 0.5) * 0.8).toFixed(1);

    sendJson({
      uptime: `${hours}h ${mins}m`,
      uptimeSeconds: uptimeSec,
      onlineCount: serverState.players.length,
      maxPlayers: serverState.maxPlayers,
      fps,
      tickRate: '20.0ms',
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
    });
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
      if (typeof data.xpLoss === 'number') serverState.valgrindConfig.xpLoss = data.xpLoss;
      if (data.calcMode) serverState.valgrindConfig.calcMode = data.calcMode;
      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'Valgrind',
        text: `Config updated: ${serverState.valgrindConfig.xpLoss}% XP Loss, Mode: ${serverState.valgrindConfig.calcMode}`,
        level: 'success',
      });
      sendJson({ success: true, config: serverState.valgrindConfig });
    });
    return true;
  }

  // 7. Module: Dagr & Nott
  if (url === '/api/modules/dagrnott/config' && method === 'GET') {
    sendJson(serverState.dagrNottConfig);
    return true;
  }

  if (url === '/api/modules/dagrnott/config' && method === 'POST') {
    readBody((data) => {
      if (typeof data.totalLength === 'number') serverState.dagrNottConfig.totalLength = data.totalLength;
      if (typeof data.dayLength === 'number') serverState.dagrNottConfig.dayLength = data.dayLength;
      if (typeof data.nightLength === 'number') serverState.dagrNottConfig.nightLength = data.nightLength;
      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'DagrAndNott',
        text: `Diurnal cycle synchronized: ${serverState.dagrNottConfig.totalLength}m total (${serverState.dagrNottConfig.dayLength}m Day / ${serverState.dagrNottConfig.nightLength}m Night)`,
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
      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'Skald',
        text: `Skald configuration synchronized (${serverState.skaldConfig.enabled ? 'Announcements Enabled' : 'Disabled'})`,
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

  // 9. Module: Heimdallr
  if (url === '/api/modules/heimdallr/config' && method === 'GET') {
    sendJson(serverState.heimdallrConfig);
    return true;
  }

  if (url === '/api/modules/heimdallr/config' && method === 'POST') {
    readBody((data) => {
      serverState.heimdallrConfig = { ...serverState.heimdallrConfig, ...data };
      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'Heimdallr',
        text: `Heimdallr scaling synchronized: +${serverState.heimdallrConfig.playerHealthScalePercent}% HP/+${serverState.heimdallrConfig.playerDamageScalePercent}% Dmg per player, Boss HP: ${serverState.heimdallrConfig.bossHealthMultiplier}x`,
        level: 'success',
      });
      sendJson({ success: true, config: serverState.heimdallrConfig });
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
      serverState.logs.push({
        time: new Date().toLocaleTimeString(),
        source: 'Njoror',
        text: `Njörðr ocean atmospheric parameters synchronized (Headwind mitigation: ${serverState.njororConfig.headwindMitigationPercent}%, Storms: ${serverState.njororConfig.stormFrequencyMultiplier}x, Serpents: ${serverState.njororConfig.nighttimeSerpentSpawnChance}% night / ${serverState.njororConfig.daytimeSerpentSpawnChance}% day)`,
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

  return false;
}

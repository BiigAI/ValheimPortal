using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using BepInEx;
using BepInEx.Bootstrap;
using BepInEx.Configuration;
using Bifrostheim.Systems.Web;

namespace Bifrostheim.Helpers
{
    public static class ConfigSyncManager
    {
        public static string GetConfigDirectory()
        {
            // 1. Check custom environment variable
            string? envPath = Environment.GetEnvironmentVariable("BEPINEX_CONFIG_PATH");
            if (!string.IsNullOrWhiteSpace(envPath))
            {
                if (!Directory.Exists(envPath))
                {
                    Directory.CreateDirectory(envPath!);
                }
                return envPath!;
            }

            // 2. Check standard BepInEx Paths.ConfigPath
            try
            {
                if (!string.IsNullOrWhiteSpace(Paths.ConfigPath))
                {
                    if (!Directory.Exists(Paths.ConfigPath))
                    {
                        Directory.CreateDirectory(Paths.ConfigPath);
                    }
                    return Paths.ConfigPath;
                }
            }
            catch { }

            // 3. Fallback to current working directory
            try
            {
                string fallback = Path.Combine(Directory.GetCurrentDirectory(), "BepInEx", "config");
                if (!Directory.Exists(fallback))
                {
                    Directory.CreateDirectory(fallback);
                }
                return fallback;
            }
            catch { }

            return AppDomain.CurrentDomain.BaseDirectory;
        }

        public static string ResolveConfigFile(string primaryFileName, params string[] alternativeFileNames)
        {
            string configDir = GetConfigDirectory();
            string primaryPath = Path.Combine(configDir, primaryFileName);

            if (File.Exists(primaryPath))
                return primaryPath;

            foreach (var alt in alternativeFileNames)
            {
                string altPath = Path.Combine(configDir, alt);
                if (File.Exists(altPath))
                    return altPath;
            }

            return primaryPath;
        }

        #region INI File Parser & Writer

        public static Dictionary<string, Dictionary<string, string>> ReadIniFile(string filePath)
        {
            var result = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
            if (!File.Exists(filePath))
                return result;

            try
            {
                string[] lines = File.ReadAllLines(filePath, Encoding.UTF8);
                string currentSection = "General";

                if (!result.ContainsKey(currentSection))
                    result[currentSection] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

                foreach (var rawLine in lines)
                {
                    string line = rawLine.Trim();
                    if (string.IsNullOrEmpty(line))
                        continue;

                    if (line.StartsWith("#") || line.StartsWith(";"))
                        continue;

                    if (line.StartsWith("[") && line.EndsWith("]"))
                    {
                        currentSection = line.Substring(1, line.Length - 2).Trim();
                        if (!result.ContainsKey(currentSection))
                            result[currentSection] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                        continue;
                    }

                    int equalsIndex = line.IndexOf('=');
                    if (equalsIndex > 0)
                    {
                        string key = line.Substring(0, equalsIndex).Trim();
                        string value = line.Substring(equalsIndex + 1).Trim();
                        result[currentSection][key] = value;
                    }
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogError($"[ConfigSyncManager] Error reading INI file '{filePath}': {ex.Message}");
            }

            return result;
        }

        public static void WriteIniFile(string filePath, Dictionary<string, Dictionary<string, string>> updates, string defaultHeader = "")
        {
            try
            {
                string dir = Path.GetDirectoryName(filePath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                if (!File.Exists(filePath))
                {
                    // Create new clean file
                    var sb = new StringBuilder();
                    if (!string.IsNullOrEmpty(defaultHeader))
                    {
                        sb.AppendLine(defaultHeader);
                        sb.AppendLine();
                    }

                    foreach (var sectionKvp in updates)
                    {
                        sb.AppendLine($"[{sectionKvp.Key}]");
                        sb.AppendLine();
                        foreach (var kvp in sectionKvp.Value)
                        {
                            sb.AppendLine($"{kvp.Key} = {kvp.Value}");
                        }
                        sb.AppendLine();
                    }

                    File.WriteAllText(filePath, sb.ToString(), Encoding.UTF8);
                    BifrostheimPlugin.Log?.LogInfo($"[ConfigSyncManager] Created new config file at '{filePath}'.");
                    return;
                }

                // Update existing file while preserving comments and structure
                var lines = File.ReadAllLines(filePath, Encoding.UTF8).ToList();
                var remainingUpdates = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);

                foreach (var sKvp in updates)
                {
                    remainingUpdates[sKvp.Key] = new Dictionary<string, string>(sKvp.Value, StringComparer.OrdinalIgnoreCase);
                }

                string currentSection = "";

                for (int i = 0; i < lines.Count; i++)
                {
                    string trimmed = lines[i].Trim();
                    if (trimmed.StartsWith("[") && trimmed.EndsWith("]"))
                    {
                        // Before switching section, if there are remaining keys for previous section, insert them
                        if (!string.IsNullOrEmpty(currentSection) && remainingUpdates.TryGetValue(currentSection, out var remainingKeys) && remainingKeys.Count > 0)
                        {
                            var keysToAdd = remainingKeys.ToList();
                            foreach (var kvp in keysToAdd)
                            {
                                lines.Insert(i, $"{kvp.Key} = {kvp.Value}");
                                remainingKeys.Remove(kvp.Key);
                                i++;
                            }
                        }

                        currentSection = trimmed.Substring(1, trimmed.Length - 2).Trim();
                        continue;
                    }

                    if (!trimmed.StartsWith("#") && !trimmed.StartsWith(";"))
                    {
                        int eqIdx = trimmed.IndexOf('=');
                        if (eqIdx > 0)
                        {
                            string key = trimmed.Substring(0, eqIdx).Trim();
                            if (remainingUpdates.TryGetValue(currentSection, out var currentSecUpdates))
                            {
                                if (currentSecUpdates.TryGetValue(key, out string newVal))
                                {
                                    lines[i] = $"{key} = {newVal}";
                                    currentSecUpdates.Remove(key);
                                }
                            }
                        }
                    }
                }

                // Append any remaining keys for the last section
                if (remainingUpdates.TryGetValue(currentSection, out var trailingKeys) && trailingKeys.Count > 0)
                {
                    foreach (var kvp in trailingKeys)
                    {
                        lines.Add($"{kvp.Key} = {kvp.Value}");
                    }
                    remainingUpdates.Remove(currentSection);
                }

                // Append any completely new sections
                foreach (var secKvp in remainingUpdates)
                {
                    if (secKvp.Value.Count == 0) continue;
                    lines.Add("");
                    lines.Add($"[{secKvp.Key}]");
                    lines.Add("");
                    foreach (var kvp in secKvp.Value)
                    {
                        lines.Add($"{kvp.Key} = {kvp.Value}");
                    }
                }

                File.WriteAllLines(filePath, lines, Encoding.UTF8);
                BifrostheimPlugin.Log?.LogInfo($"[ConfigSyncManager] Saved configuration updates to '{filePath}'.");
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogError($"[ConfigSyncManager] Error writing INI file '{filePath}': {ex.Message}");
            }
        }

        #endregion

        #region In-Memory BepInEx ConfigFile Synchronization

        public static void SyncLivePluginConfig(string[] candidateGuids, Action<ConfigFile> updateAction)
        {
            try
            {
                if (Chainloader.PluginInfos == null)
                    return;

                foreach (var kvp in Chainloader.PluginInfos)
                {
                    string guid = kvp.Key;
                    var pluginInfo = kvp.Value;
                    if (pluginInfo == null) continue;

                    bool match = candidateGuids.Any(g =>
                        string.Equals(guid, g, StringComparison.OrdinalIgnoreCase) ||
                        guid.IndexOf(g, StringComparison.OrdinalIgnoreCase) >= 0);

                    if (match)
                    {
                        var config = pluginInfo.Instance?.Config;
                        if (config != null)
                        {
                            updateAction(config);
                            try
                            {
                                config.Save();
                                BifrostheimPlugin.Log?.LogInfo($"[ConfigSyncManager] Live-synchronized and saved ConfigFile for loaded plugin '{guid}'.");
                            }
                            catch (Exception saveEx)
                            {
                                BifrostheimPlugin.Log?.LogWarning($"[ConfigSyncManager] Failed to call ConfigFile.Save() on plugin '{guid}': {saveEx.Message}");
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogWarning($"[ConfigSyncManager] Live plugin sync error: {ex.Message}");
            }
        }

        private static void TrySetEntryValue(ConfigFile configFile, string keyName, object value)
        {
            try
            {
                var keysProp = configFile.GetType().GetProperty("Keys", BindingFlags.Public | BindingFlags.Instance);
                if (keysProp != null)
                {
                    var keys = keysProp.GetValue(configFile) as IEnumerable<ConfigDefinition>;
                    if (keys != null)
                    {
                        foreach (var def in keys)
                        {
                            if (def.Key.Equals(keyName, StringComparison.OrdinalIgnoreCase))
                            {
                                var indexer = configFile.GetType().GetProperty("Item", new[] { typeof(ConfigDefinition) });
                                if (indexer != null)
                                {
                                    var entry = indexer.GetValue(configFile, new object[] { def }) as ConfigEntryBase;
                                    if (entry != null)
                                    {
                                        entry.BoxedValue = Convert.ChangeType(value, entry.SettingType, CultureInfo.InvariantCulture);
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogWarning($"[ConfigSyncManager] Failed to set live entry '{keyName}': {ex.Message}");
            }
        }

        #endregion

        #region Module: Valgrind

        public static ValgrindConfigDto LoadValgrindConfig()
        {
            var dto = new ValgrindConfigDto();
            string configFile = ResolveConfigFile("com.bigai.valgrind.cfg", "valgrind.cfg");
            var ini = ReadIniFile(configFile);

            // [1 - General]
            string? modeStr = FindValue(ini, "CalculationMode", "calculationMode", "calcMode");
            if (!string.IsNullOrWhiteSpace(modeStr))
            {
                string cleanMode = modeStr!.Trim();
                if (cleanMode.Equals("TieredBrackets", StringComparison.OrdinalIgnoreCase)) dto.calculationMode = "TieredBrackets";
                else if (cleanMode.Equals("ContinuousCurve", StringComparison.OrdinalIgnoreCase)) dto.calculationMode = "ContinuousCurve";
                else if (cleanMode.Equals("PerSkill", StringComparison.OrdinalIgnoreCase)) dto.calculationMode = "PerSkill";
                else dto.calculationMode = cleanMode;
            }

            if (bool.TryParse(FindValue(ini, "UseTopNSkillsOnly", "useTopNSkillsOnly"), out bool topN)) dto.useTopNSkillsOnly = topN;
            if (int.TryParse(FindValue(ini, "TopNSkillsCount", "topNSkillsCount"), out int topCount)) dto.topNSkillsCount = Math.Max(1, Math.Min(20, topCount));
            if (bool.TryParse(FindValue(ini, "ResetAccumulatorOnDeath", "resetAccumulatorOnDeath"), out bool resetAcc)) dto.resetAccumulatorOnDeath = resetAcc;
            if (bool.TryParse(FindValue(ini, "EnableDebugLogging", "enableDebugLogging"), out bool debug)) dto.enableDebugLogging = debug;

            // [2 - Tiered Brackets]
            if (float.TryParse(FindValue(ini, "EarlyGameLossPercent", "earlyGameLossPercent"), NumberStyles.Any, CultureInfo.InvariantCulture, out float early)) dto.earlyGameLossPercent = early;
            if (float.TryParse(FindValue(ini, "MidGameLossPercent", "midGameLossPercent"), NumberStyles.Any, CultureInfo.InvariantCulture, out float mid)) dto.midGameLossPercent = mid;
            if (float.TryParse(FindValue(ini, "LateGameLossPercent", "lateGameLossPercent"), NumberStyles.Any, CultureInfo.InvariantCulture, out float late)) dto.lateGameLossPercent = late;
            if (float.TryParse(FindValue(ini, "EndgameLossPercent", "endgameLossPercent"), NumberStyles.Any, CultureInfo.InvariantCulture, out float endgame)) dto.endgameLossPercent = endgame;

            // [3 - Continuous Curve]
            if (float.TryParse(FindValue(ini, "CurveMaxLossPercent", "curveMaxLossPercent"), NumberStyles.Any, CultureInfo.InvariantCulture, out float maxCurve)) dto.curveMaxLossPercent = maxCurve;
            if (float.TryParse(FindValue(ini, "CurveMinLossPercent", "curveMinLossPercent"), NumberStyles.Any, CultureInfo.InvariantCulture, out float minCurve)) dto.curveMinLossPercent = minCurve;

            return dto;
        }

        public static void SaveValgrindConfig(ValgrindConfigDto dto)
        {
            string configFile = ResolveConfigFile("com.bigai.valgrind.cfg", "valgrind.cfg");
            var updates = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase)
            {
                ["1 - General"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["CalculationMode"] = dto.calculationMode,
                    ["UseTopNSkillsOnly"] = dto.useTopNSkillsOnly.ToString().ToLowerInvariant(),
                    ["TopNSkillsCount"] = dto.topNSkillsCount.ToString(CultureInfo.InvariantCulture),
                    ["ResetAccumulatorOnDeath"] = dto.resetAccumulatorOnDeath.ToString().ToLowerInvariant(),
                    ["EnableDebugLogging"] = dto.enableDebugLogging.ToString().ToLowerInvariant()
                },
                ["2 - Tiered Brackets"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["EarlyGameLossPercent"] = dto.earlyGameLossPercent.ToString("F1", CultureInfo.InvariantCulture),
                    ["MidGameLossPercent"] = dto.midGameLossPercent.ToString("F1", CultureInfo.InvariantCulture),
                    ["LateGameLossPercent"] = dto.lateGameLossPercent.ToString("F1", CultureInfo.InvariantCulture),
                    ["EndgameLossPercent"] = dto.endgameLossPercent.ToString("F1", CultureInfo.InvariantCulture)
                },
                ["3 - Continuous Curve"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["CurveMaxLossPercent"] = dto.curveMaxLossPercent.ToString("F1", CultureInfo.InvariantCulture),
                    ["CurveMinLossPercent"] = dto.curveMinLossPercent.ToString("F1", CultureInfo.InvariantCulture)
                }
            };

            WriteIniFile(configFile, updates, "## Settings file was created by plugin Valgrind\n## Plugin GUID: com.bigai.valgrind");

            SyncLivePluginConfig(new[] { "com.bigai.valgrind", "valgrind" }, config =>
            {
                TrySetEntryValue(config, "CalculationMode", dto.calculationMode);
                TrySetEntryValue(config, "UseTopNSkillsOnly", dto.useTopNSkillsOnly);
                TrySetEntryValue(config, "TopNSkillsCount", dto.topNSkillsCount);
                TrySetEntryValue(config, "ResetAccumulatorOnDeath", dto.resetAccumulatorOnDeath);
                TrySetEntryValue(config, "EnableDebugLogging", dto.enableDebugLogging);

                TrySetEntryValue(config, "EarlyGameLossPercent", dto.earlyGameLossPercent);
                TrySetEntryValue(config, "MidGameLossPercent", dto.midGameLossPercent);
                TrySetEntryValue(config, "LateGameLossPercent", dto.lateGameLossPercent);
                TrySetEntryValue(config, "EndgameLossPercent", dto.endgameLossPercent);

                TrySetEntryValue(config, "CurveMaxLossPercent", dto.curveMaxLossPercent);
                TrySetEntryValue(config, "CurveMinLossPercent", dto.curveMinLossPercent);
            });
        }

        #endregion

        #region Module: Dagr & Nott

        public static DagrNottConfigDto LoadDagrNottConfig()
        {
            var dto = new DagrNottConfigDto();
            string configFile = ResolveConfigFile("com.bigai.dagrnott_customdaycycle.cfg", "com.bigai.dagrandnott.cfg", "com.bigai.dagrnott.cfg", "dagrnott_customdaycycle.cfg", "dagrandnott.cfg", "dagrnott.cfg");
            var ini = ReadIniFile(configFile);

            string? dawnStr = FindValue(ini, "DawnMultiplier", "dawnMultiplier");
            if (dawnStr != null && float.TryParse(dawnStr, NumberStyles.Any, CultureInfo.InvariantCulture, out float dawn))
            {
                dto.dawnMultiplier = (float)Math.Round(Math.Max(0.01f, dawn), 2);
            }

            string? dayStr = FindValue(ini, "DayMultiplier", "dayMultiplier");
            if (dayStr != null && float.TryParse(dayStr, NumberStyles.Any, CultureInfo.InvariantCulture, out float day))
            {
                dto.dayMultiplier = (float)Math.Round(Math.Max(0.01f, day), 2);
            }

            string? duskStr = FindValue(ini, "DuskMultiplier", "duskMultiplier");
            if (duskStr != null && float.TryParse(duskStr, NumberStyles.Any, CultureInfo.InvariantCulture, out float dusk))
            {
                dto.duskMultiplier = (float)Math.Round(Math.Max(0.01f, dusk), 2);
            }

            string? nightStr = FindValue(ini, "NightMultiplier", "nightMultiplier");
            if (nightStr != null && float.TryParse(nightStr, NumberStyles.Any, CultureInfo.InvariantCulture, out float night))
            {
                dto.nightMultiplier = (float)Math.Round(Math.Max(0.01f, night), 2);
            }

            string? logStr = FindValue(ini, "LogPhaseTransitions", "logPhaseTransitions");
            if (logStr != null && bool.TryParse(logStr, out bool log))
            {
                dto.logPhaseTransitions = log;
            }

            dto.dawnMinutes = (float)Math.Round(4.5f / Math.Max(0.001f, dto.dawnMultiplier), 1);
            dto.dayMinutes = (float)Math.Round(15.0f / Math.Max(0.001f, dto.dayMultiplier), 1);
            dto.duskMinutes = (float)Math.Round(4.5f / Math.Max(0.001f, dto.duskMultiplier), 1);
            dto.nightMinutes = (float)Math.Round(6.0f / Math.Max(0.001f, dto.nightMultiplier), 1);
            dto.totalMinutes = (float)Math.Round(dto.dawnMinutes + dto.dayMinutes + dto.duskMinutes + dto.nightMinutes, 1);

            return dto;
        }

        public static void SaveDagrNottConfig(DagrNottConfigDto dto)
        {
            string configFile = ResolveConfigFile("com.bigai.dagrnott_customdaycycle.cfg", "com.bigai.dagrandnott.cfg", "com.bigai.dagrnott.cfg", "dagrnott_customdaycycle.cfg", "dagrandnott.cfg", "dagrnott.cfg");
            var updates = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase)
            {
                ["DayCycle"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["DawnMultiplier"] = dto.dawnMultiplier.ToString("F2", CultureInfo.InvariantCulture),
                    ["DayMultiplier"] = dto.dayMultiplier.ToString("F2", CultureInfo.InvariantCulture),
                    ["DuskMultiplier"] = dto.duskMultiplier.ToString("F2", CultureInfo.InvariantCulture),
                    ["NightMultiplier"] = dto.nightMultiplier.ToString("F2", CultureInfo.InvariantCulture)
                },
                ["Logging"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["LogPhaseTransitions"] = dto.logPhaseTransitions.ToString().ToLowerInvariant()
                }
            };

            WriteIniFile(configFile, updates, "## Settings file was created by plugin DagrNott_CustomDayCycle\n## Plugin GUID: com.bigai.dagrnott_customdaycycle");

            SyncLivePluginConfig(new[] { "com.bigai.dagrnott_customdaycycle", "com.bigai.dagrandnott", "com.bigai.dagrnott", "dagrnott_customdaycycle", "dagrandnott", "dagrnott" }, config =>
            {
                TrySetEntryValue(config, "DawnMultiplier", dto.dawnMultiplier);
                TrySetEntryValue(config, "DayMultiplier", dto.dayMultiplier);
                TrySetEntryValue(config, "DuskMultiplier", dto.duskMultiplier);
                TrySetEntryValue(config, "NightMultiplier", dto.nightMultiplier);
                TrySetEntryValue(config, "LogPhaseTransitions", dto.logPhaseTransitions);
            });
        }

        #endregion

        #region Module: Skald

        public static SkaldConfigDto LoadSkaldConfig()
        {
            var dto = new SkaldConfigDto();
            string configFile = ResolveConfigFile("com.bigai.skald_vikingkillfeed.cfg", "com.bigai.skald.cfg", "skald_vikingkillfeed.cfg", "skald.cfg");
            var ini = ReadIniFile(configFile);

            if (bool.TryParse(FindValue(ini, "EnableDeathAnnouncements", "Enabled"), out bool en)) dto.enabled = en;
            if (bool.TryParse(FindValue(ini, "EnableBossDefeatAnnouncements", "EnableBosses"), out bool boss)) dto.enableBosses = boss;
            if (bool.TryParse(FindValue(ini, "IncludeBiomeInMessage", "IncludeBiome"), out bool biome)) dto.includeBiome = biome;
            if (bool.TryParse(FindValue(ini, "LogToConsole"), out bool log)) dto.logToConsole = log;

            string? m = FindValue(ini, "MonsterDeathMessages", "MonsterTemplates"); if (!string.IsNullOrEmpty(m)) dto.monsterTemplates = m!;
            string? b = FindValue(ini, "BossDeathMessages", "BossTemplates"); if (!string.IsNullOrEmpty(b)) dto.bossTemplates = b!;
            string? o = FindValue(ini, "OverwhelmedMessages"); if (!string.IsNullOrEmpty(o)) dto.overwhelmedMessages = o!;
            string? g = FindValue(ini, "GenericDeathMessages"); if (!string.IsNullOrEmpty(g)) dto.genericDeathMessages = g!;

            return dto;
        }

        public static void SaveSkaldConfig(SkaldConfigDto dto)
        {
            string configFile = ResolveConfigFile("com.bigai.skald_vikingkillfeed.cfg", "com.bigai.skald.cfg", "skald_vikingkillfeed.cfg", "skald.cfg");
            var updates = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase)
            {
                ["1 - General"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["EnableDeathAnnouncements"] = dto.enabled.ToString().ToLowerInvariant(),
                    ["EnableBossDefeatAnnouncements"] = dto.enableBosses.ToString().ToLowerInvariant(),
                    ["IncludeBiomeInMessage"] = dto.includeBiome.ToString().ToLowerInvariant(),
                    ["LogToConsole"] = dto.logToConsole.ToString().ToLowerInvariant()
                },
                ["2 - Templates"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["MonsterDeathMessages"] = dto.monsterTemplates,
                    ["BossDeathMessages"] = dto.bossTemplates,
                    ["OverwhelmedMessages"] = dto.overwhelmedMessages,
                    ["GenericDeathMessages"] = dto.genericDeathMessages
                }
            };

            WriteIniFile(configFile, updates, "## Settings file was created by plugin Skald_VikingKillFeed\n## Plugin GUID: com.bigai.skald_vikingkillfeed");

            SyncLivePluginConfig(new[] { "com.bigai.skald_vikingkillfeed", "com.bigai.skald", "skald_vikingkillfeed", "skald" }, config =>
            {
                TrySetEntryValue(config, "EnableDeathAnnouncements", dto.enabled);
                TrySetEntryValue(config, "EnableBossDefeatAnnouncements", dto.enableBosses);
                TrySetEntryValue(config, "IncludeBiomeInMessage", dto.includeBiome);
                TrySetEntryValue(config, "LogToConsole", dto.logToConsole);
                TrySetEntryValue(config, "MonsterDeathMessages", dto.monsterTemplates);
                TrySetEntryValue(config, "BossDeathMessages", dto.bossTemplates);
                TrySetEntryValue(config, "OverwhelmedMessages", dto.overwhelmedMessages);
                TrySetEntryValue(config, "GenericDeathMessages", dto.genericDeathMessages);
            });
        }

        #endregion

        #region Module: Njörðr

        public static NjororConfigDto LoadNjororConfig()
        {
            var dto = new NjororConfigDto();
            string configFile = ResolveConfigFile("com.bigai.njoror_fairwinds.cfg", "com.bigai.njoror.cfg", "njoror_fairwinds.cfg", "njoror.cfg");
            var ini = ReadIniFile(configFile);

            if (bool.TryParse(FindValue(ini, "EnableFairWinds"), out bool efw)) dto.enableFairWinds = efw;
            if (float.TryParse(FindValue(ini, "HeadwindMitigationPercent", "HeadwindDeflectionChance"), NumberStyles.Any, CultureInfo.InvariantCulture, out float hmp)) dto.headwindMitigationPercent = hmp;
            if (float.TryParse(FindValue(ini, "MinimumWindSpeedMultiplier", "MinWindSpeedMultiplier"), NumberStyles.Any, CultureInfo.InvariantCulture, out float mws)) dto.minWindSpeedMultiplier = mws;
            if (bool.TryParse(FindValue(ini, "AlwaysTailwindInOcean"), out bool atw)) dto.alwaysTailwindInOcean = atw;
            if (bool.TryParse(FindValue(ini, "CheckDeflectOnWindChange"), out bool cdw)) dto.checkDeflectOnWindChange = cdw;
            if (int.TryParse(FindValue(ini, "CheckDeflectTimeSeconds"), NumberStyles.Any, CultureInfo.InvariantCulture, out int cds)) dto.checkDeflectTimeSeconds = cds;

            if (bool.TryParse(FindValue(ini, "EnableWeatherTuning"), out bool ewt)) dto.enableWeatherTuning = ewt;
            if (float.TryParse(FindValue(ini, "StormFrequencyMultiplier"), NumberStyles.Any, CultureInfo.InvariantCulture, out float sfm)) dto.stormFrequencyMultiplier = sfm;
            if (float.TryParse(FindValue(ini, "RainFrequencyMultiplier"), NumberStyles.Any, CultureInfo.InvariantCulture, out float rfm)) dto.rainFrequencyMultiplier = rfm;
            if (float.TryParse(FindValue(ini, "ClearWeatherFrequencyMultiplier", "ClearFrequencyMultiplier"), NumberStyles.Any, CultureInfo.InvariantCulture, out float cfm)) dto.clearFrequencyMultiplier = cfm;

            if (bool.TryParse(FindValue(ini, "EnableSerpentTuning"), out bool est)) dto.enableSerpentTuning = est;
            if (float.TryParse(FindValue(ini, "DaytimeSerpentSpawnChance"), NumberStyles.Any, CultureInfo.InvariantCulture, out float dsc)) dto.daytimeSerpentSpawnChance = dsc;
            if (float.TryParse(FindValue(ini, "NighttimeSerpentSpawnChance"), NumberStyles.Any, CultureInfo.InvariantCulture, out float nsc)) dto.nighttimeSerpentSpawnChance = nsc;
            if (float.TryParse(FindValue(ini, "SerpentSpawnIntervalSeconds"), NumberStyles.Any, CultureInfo.InvariantCulture, out float ssi)) dto.serpentSpawnIntervalSeconds = ssi;
            if (bool.TryParse(FindValue(ini, "AllowCalmWeatherDaySerpents"), out bool acw)) dto.allowCalmWeatherDaySerpents = acw;

            return dto;
        }

        public static void SaveNjororConfig(NjororConfigDto dto)
        {
            string configFile = ResolveConfigFile("com.bigai.njoror_fairwinds.cfg", "com.bigai.njoror.cfg", "njoror_fairwinds.cfg", "njoror.cfg");
            var updates = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase)
            {
                ["1 - Fair Winds"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["EnableFairWinds"] = dto.enableFairWinds.ToString().ToLowerInvariant(),
                    ["HeadwindMitigationPercent"] = dto.headwindMitigationPercent.ToString("F1", CultureInfo.InvariantCulture),
                    ["MinimumWindSpeedMultiplier"] = dto.minWindSpeedMultiplier.ToString("F1", CultureInfo.InvariantCulture),
                    ["AlwaysTailwindInOcean"] = dto.alwaysTailwindInOcean.ToString().ToLowerInvariant(),
                    ["CheckDeflectOnWindChange"] = dto.checkDeflectOnWindChange.ToString().ToLowerInvariant(),
                    ["CheckDeflectTimeSeconds"] = dto.checkDeflectTimeSeconds.ToString(CultureInfo.InvariantCulture),
                },
                ["2 - Weather & Storms"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["EnableWeatherTuning"] = dto.enableWeatherTuning.ToString().ToLowerInvariant(),
                    ["StormFrequencyMultiplier"] = dto.stormFrequencyMultiplier.ToString("F2", CultureInfo.InvariantCulture),
                    ["RainFrequencyMultiplier"] = dto.rainFrequencyMultiplier.ToString("F2", CultureInfo.InvariantCulture),
                    ["ClearWeatherFrequencyMultiplier"] = dto.clearFrequencyMultiplier.ToString("F2", CultureInfo.InvariantCulture),
                },
                ["3 - Sea Serpents"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["EnableSerpentTuning"] = dto.enableSerpentTuning.ToString().ToLowerInvariant(),
                    ["DaytimeSerpentSpawnChance"] = dto.daytimeSerpentSpawnChance.ToString("F1", CultureInfo.InvariantCulture),
                    ["NighttimeSerpentSpawnChance"] = dto.nighttimeSerpentSpawnChance.ToString("F1", CultureInfo.InvariantCulture),
                    ["SerpentSpawnIntervalSeconds"] = dto.serpentSpawnIntervalSeconds.ToString("F0", CultureInfo.InvariantCulture),
                    ["AllowCalmWeatherDaySerpents"] = dto.allowCalmWeatherDaySerpents.ToString().ToLowerInvariant(),
                }
            };

            WriteIniFile(configFile, updates, "## Settings file was created by plugin Njoror_FairWinds\n## Plugin GUID: com.bigai.njoror_fairwinds");

            SyncLivePluginConfig(new[] { "com.bigai.njoror_fairwinds", "com.bigai.njoror", "njoror_fairwinds", "njoror" }, config =>
            {
                TrySetEntryValue(config, "EnableFairWinds", dto.enableFairWinds);
                TrySetEntryValue(config, "HeadwindMitigationPercent", dto.headwindMitigationPercent);
                TrySetEntryValue(config, "MinimumWindSpeedMultiplier", dto.minWindSpeedMultiplier);
                TrySetEntryValue(config, "AlwaysTailwindInOcean", dto.alwaysTailwindInOcean);
                TrySetEntryValue(config, "CheckDeflectOnWindChange", dto.checkDeflectOnWindChange);
                TrySetEntryValue(config, "CheckDeflectTimeSeconds", dto.checkDeflectTimeSeconds);
                TrySetEntryValue(config, "EnableWeatherTuning", dto.enableWeatherTuning);
                TrySetEntryValue(config, "StormFrequencyMultiplier", dto.stormFrequencyMultiplier);
                TrySetEntryValue(config, "RainFrequencyMultiplier", dto.rainFrequencyMultiplier);
                TrySetEntryValue(config, "ClearWeatherFrequencyMultiplier", dto.clearFrequencyMultiplier);
                TrySetEntryValue(config, "EnableSerpentTuning", dto.enableSerpentTuning);
                TrySetEntryValue(config, "DaytimeSerpentSpawnChance", dto.daytimeSerpentSpawnChance);
                TrySetEntryValue(config, "NighttimeSerpentSpawnChance", dto.nighttimeSerpentSpawnChance);
                TrySetEntryValue(config, "SerpentSpawnIntervalSeconds", dto.serpentSpawnIntervalSeconds);
                TrySetEntryValue(config, "AllowCalmWeatherDaySerpents", dto.allowCalmWeatherDaySerpents);
            });
        }

        #endregion

        #region Module: CharactersVault

        public static string GetCharacterVaultBindingsFilePath()
        {
            string configDir = GetConfigDirectory();
            string primary = Path.Combine(configDir, "CharacterVault", "bindings.json");
            if (File.Exists(primary)) return primary;

            string alt1 = Path.Combine(configDir, "CharactersVault", "bindings.json");
            if (File.Exists(alt1)) return alt1;

            string alt2 = Path.Combine(configDir, "bindings.json");
            if (File.Exists(alt2)) return alt2;

            return primary;
        }

        public static List<Dictionary<string, object>> LoadCharacterVaultBindings()
        {
            try
            {
                string filePath = GetCharacterVaultBindingsFilePath();
                if (!File.Exists(filePath))
                {
                    return new List<Dictionary<string, object>>();
                }

                string json = File.ReadAllText(filePath, Encoding.UTF8);
                return ParseCharacterBindings(json, filePath);
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogWarning($"[ConfigSyncManager] Error loading CharacterVault bindings: {ex.Message}");
                return new List<Dictionary<string, object>>();
            }
        }

        public static List<Dictionary<string, object>> ParseCharacterBindings(string json, string? filePath = null)
        {
            var result = new List<Dictionary<string, object>>();
            if (string.IsNullOrWhiteSpace(json)) return result;

            try
            {
                object? parsed = SimpleJson.Deserialize(json);
                if (parsed == null) return result;

                // If root is a dictionary
                if (parsed is IDictionary<string, object?> dict)
                {
                    // Check for single wrapper key like { "bindings": { ... } } or { "characters": [ ... ] }
                    if (dict.Count == 1)
                    {
                        var first = dict.First();
                        if (first.Value is IDictionary<string, object?> wrappedDict)
                        {
                            dict = wrappedDict;
                        }
                        else if (first.Value is System.Collections.IList wrappedList)
                        {
                            return ParseListBindings(wrappedList);
                        }
                    }

                    foreach (var kvp in dict)
                    {
                        string steamId = kvp.Key;
                        object? val = kvp.Value;

                        string characterName = "Unknown";
                        string? created = null;
                        string? lastLogin = null;
                        string status = "Bound";

                        if (val is string strVal)
                        {
                            characterName = strVal;
                        }
                        else if (val is IDictionary<string, object?> childDict)
                        {
                            ExtractBindingFromDict(childDict, steamId, out characterName, out created, out lastLogin, out var extStatus);
                            if (!string.IsNullOrWhiteSpace(extStatus)) status = extStatus!;
                        }
                        else if (val is System.Collections.IList listVal && listVal.Count > 0)
                        {
                            var firstItem = listVal[0];
                            if (firstItem is string s)
                            {
                                characterName = s;
                            }
                            else if (firstItem is IDictionary<string, object?> itemDict)
                            {
                                ExtractBindingFromDict(itemDict, steamId, out characterName, out created, out lastLogin, out var extStatus);
                                if (!string.IsNullOrWhiteSpace(extStatus)) status = extStatus!;
                            }
                        }
                        else if (val != null)
                        {
                            characterName = val.ToString() ?? "Unknown";
                        }

                        // 1. Check live online status
                        if (IsPlayerOnline(steamId, characterName))
                        {
                            lastLogin = "Online Now";
                            status = "Online";
                        }

                        // 2. If timestamps are still missing, try searching for character save/profile files on disk
                        if (string.IsNullOrWhiteSpace(created) || string.IsNullOrWhiteSpace(lastLogin))
                        {
                            TryGetFileTimestamps(steamId, characterName, out var fileCreated, out var fileLastLogin);
                            if (string.IsNullOrWhiteSpace(created) && !string.IsNullOrWhiteSpace(fileCreated))
                            {
                                created = fileCreated;
                            }
                            if (string.IsNullOrWhiteSpace(lastLogin) && !string.IsNullOrWhiteSpace(fileLastLogin))
                            {
                                lastLogin = fileLastLogin;
                            }
                        }

                        // 3. Fallbacks when truly not known - do not generate current UtcNow
                        if (string.IsNullOrWhiteSpace(created)) created = "—";
                        if (string.IsNullOrWhiteSpace(lastLogin)) lastLogin = "—";

                        result.Add(new Dictionary<string, object>
                        {
                            { "steamId", steamId },
                            { "characterName", characterName },
                            { "created", created! },
                            { "lastLogin", lastLogin! },
                            { "status", status }
                        });
                    }
                }
                // If root is a list [ { ... }, ... ]
                else if (parsed is System.Collections.IList list)
                {
                    return ParseListBindings(list);
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogWarning($"[ConfigSyncManager] Failed to parse character bindings JSON: {ex.Message}");
            }

            return result;
        }

        private static List<Dictionary<string, object>> ParseListBindings(System.Collections.IList list)
        {
            var result = new List<Dictionary<string, object>>();
            foreach (var item in list)
            {
                if (item is IDictionary<string, object?> itemDict)
                {
                    string steamId = string.Empty;
                    string[] steamCandidateKeys = new[]
                    {
                        "steamId", "steam_id", "steamID", "id", "playerId", "player_id", "userId", "user_id", "key", "account", "account_id"
                    };
                    foreach (var key in steamCandidateKeys)
                    {
                        if (TryGetCaseInsensitive(itemDict, key, out object? val) && val != null)
                        {
                            steamId = val.ToString() ?? string.Empty;
                            if (!string.IsNullOrWhiteSpace(steamId)) break;
                        }
                    }

                    if (string.IsNullOrWhiteSpace(steamId))
                    {
                        steamId = "Unknown";
                    }

                    ExtractBindingFromDict(itemDict, steamId, out var charName, out var extCreated, out var extLogin, out var extStatus);

                    string status = !string.IsNullOrWhiteSpace(extStatus) ? extStatus! : "Bound";
                    string? created = extCreated;
                    string? lastLogin = extLogin;

                    if (IsPlayerOnline(steamId, charName))
                    {
                        lastLogin = "Online Now";
                        status = "Online";
                    }

                    if (string.IsNullOrWhiteSpace(created) || string.IsNullOrWhiteSpace(lastLogin))
                    {
                        TryGetFileTimestamps(steamId, charName, out var fileCreated, out var fileLastLogin);
                        if (string.IsNullOrWhiteSpace(created) && !string.IsNullOrWhiteSpace(fileCreated)) created = fileCreated;
                        if (string.IsNullOrWhiteSpace(lastLogin) && !string.IsNullOrWhiteSpace(fileLastLogin)) lastLogin = fileLastLogin;
                    }

                    result.Add(new Dictionary<string, object>
                    {
                        { "steamId", steamId },
                        { "characterName", charName },
                        { "created", !string.IsNullOrWhiteSpace(created) ? created! : "—" },
                        { "lastLogin", !string.IsNullOrWhiteSpace(lastLogin) ? lastLogin! : "—" },
                        { "status", status }
                    });
                }
                else if (item is string strItem)
                {
                    string created = "—";
                    string lastLogin = "—";
                    string status = "Bound";

                    if (IsPlayerOnline(strItem, strItem))
                    {
                        lastLogin = "Online Now";
                        status = "Online";
                    }
                    else
                    {
                        TryGetFileTimestamps(strItem, strItem, out var fileCreated, out var fileLastLogin);
                        if (!string.IsNullOrWhiteSpace(fileCreated)) created = fileCreated!;
                        if (!string.IsNullOrWhiteSpace(fileLastLogin)) lastLogin = fileLastLogin!;
                    }

                    result.Add(new Dictionary<string, object>
                    {
                        { "steamId", strItem },
                        { "characterName", strItem },
                        { "created", created },
                        { "lastLogin", lastLogin },
                        { "status", status }
                    });
                }
            }
            return result;
        }

        public static Func<string, string, bool>? OnlinePlayerChecker { get; set; }

        private static bool IsPlayerOnline(string steamId, string characterName)
        {
            try
            {
                return OnlinePlayerChecker != null && OnlinePlayerChecker(steamId, characterName);
            }
            catch { }
            return false;
        }

        private static void TryGetFileTimestamps(string steamId, string characterName, out string? created, out string? lastLogin)
        {
            created = null;
            lastLogin = null;

            try
            {
                string configDir = GetConfigDirectory();
                string cleanSteamId = steamId.StartsWith("Steam_", StringComparison.OrdinalIgnoreCase) ? steamId.Substring(6) : steamId;
                string steamWithPrefix = steamId.StartsWith("Steam_", StringComparison.OrdinalIgnoreCase) ? steamId : "Steam_" + steamId;

                var searchDirs = new List<string>
                {
                    Path.Combine(configDir, "CharactersVault", "characters"),
                    Path.Combine(configDir, "CharacterVault", "characters"),
                    Path.Combine(configDir, "CharactersVault", "profiles"),
                    Path.Combine(configDir, "CharacterVault", "profiles"),
                    Path.Combine(configDir, "CharactersVault", "saves"),
                    Path.Combine(configDir, "CharacterVault", "saves"),
                    Path.Combine(configDir, "CharactersVault", "vault"),
                    Path.Combine(configDir, "CharacterVault", "vault"),
                    Path.Combine(configDir, "CharactersVault"),
                    Path.Combine(configDir, "CharacterVault")
                };

                try
                {
                    string appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                    string valheimSave = Path.Combine(appData + "Low", "IronGate", "Valheim", "characters");
                    if (Directory.Exists(valheimSave)) searchDirs.Add(valheimSave);
                    string valheimLocal = Path.Combine(appData + "Low", "IronGate", "Valheim", "characters_local");
                    if (Directory.Exists(valheimLocal)) searchDirs.Add(valheimLocal);
                }
                catch { }

                var targetFileNames = new List<string>();
                if (!string.IsNullOrWhiteSpace(cleanSteamId))
                {
                    targetFileNames.Add($"{cleanSteamId}.fch");
                    targetFileNames.Add($"{cleanSteamId}.dat");
                    targetFileNames.Add($"{cleanSteamId}.json");
                    targetFileNames.Add($"{cleanSteamId}.profile");
                    targetFileNames.Add($"{steamWithPrefix}.fch");
                    targetFileNames.Add($"{steamWithPrefix}.dat");
                    targetFileNames.Add($"{steamWithPrefix}.json");
                    targetFileNames.Add($"{steamWithPrefix}.profile");
                }
                if (!string.IsNullOrWhiteSpace(characterName) && characterName != "Unknown")
                {
                    targetFileNames.Add($"{characterName}.fch");
                    targetFileNames.Add($"{characterName}.dat");
                    targetFileNames.Add($"{characterName}.json");
                    targetFileNames.Add($"{cleanSteamId}_{characterName}.fch");
                    targetFileNames.Add($"{characterName}_{cleanSteamId}.fch");
                }

                foreach (var dir in searchDirs)
                {
                    if (!Directory.Exists(dir)) continue;

                    foreach (var fileName in targetFileNames)
                    {
                        if (fileName.Equals("bindings.json", StringComparison.OrdinalIgnoreCase)) continue;

                        string candidatePath = Path.Combine(dir, fileName);
                        if (File.Exists(candidatePath))
                        {
                            var fileInfo = new FileInfo(candidatePath);
                            created = fileInfo.CreationTimeUtc.ToString("yyyy-MM-dd");
                            lastLogin = fileInfo.LastWriteTimeUtc.ToString("yyyy-MM-dd HH:mm");
                            return;
                        }
                    }
                }
            }
            catch { }
        }

        private static void ExtractBindingFromDict(
            IDictionary<string, object?> dict,
            string fallbackSteamId,
            out string characterName,
            out string? created,
            out string? lastLogin,
            out string? status)
        {
            characterName = string.Empty;
            created = null;
            lastLogin = null;
            status = null;

            // 1. Character Name candidates (in priority order)
            string[] nameCandidateKeys = new[]
            {
                "characterName", "character_name", "charName", "char_name",
                "playerName", "player_name", "name", "boundCharacter", "bound_character",
                "character", "player", "profileName", "profile_name", "profile",
                "vikingName", "viking_name", "hero", "valheimCharacter", "characterId"
            };

            foreach (var key in nameCandidateKeys)
            {
                if (TryGetCaseInsensitive(dict, key, out object? val) && val != null)
                {
                    if (val is string s && !string.IsNullOrWhiteSpace(s))
                    {
                        characterName = s;
                        break;
                    }
                    else if (val is IDictionary<string, object?> nestedDict)
                    {
                        foreach (var nestedKey in nameCandidateKeys)
                        {
                            if (TryGetCaseInsensitive(nestedDict, nestedKey, out object? nestedVal) && nestedVal is string ns && !string.IsNullOrWhiteSpace(ns))
                            {
                                characterName = ns;
                                break;
                            }
                        }
                        if (!string.IsNullOrEmpty(characterName)) break;
                    }
                    else if (val is not System.Collections.IDictionary && val is not System.Collections.IList)
                    {
                        characterName = val.ToString() ?? string.Empty;
                        if (!string.IsNullOrWhiteSpace(characterName)) break;
                    }
                }
            }

            // Fallback: If no known name key was found, look for any non-empty string value in the dictionary
            if (string.IsNullOrWhiteSpace(characterName))
            {
                foreach (var kvp in dict)
                {
                    if (kvp.Value is string str && !string.IsNullOrWhiteSpace(str))
                    {
                        if (str.Contains("-") && (str.Length == 10 || str.Length >= 16)) continue; // likely a date
                        if (str.StartsWith("Steam_", StringComparison.OrdinalIgnoreCase)) continue;
                        characterName = str;
                        break;
                    }
                }
            }

            if (string.IsNullOrWhiteSpace(characterName))
            {
                characterName = "Unknown";
            }

            // 2. Created date candidates
            string[] createdCandidateKeys = new[]
            {
                "created", "createdAt", "created_at", "creationDate", "creation_date",
                "createDate", "create_date", "dateCreated", "date_created",
                "timestamp", "bindingDate", "binding_date", "boundAt", "bound_at", "date"
            };

            foreach (var key in createdCandidateKeys)
            {
                if (TryGetCaseInsensitive(dict, key, out object? val) && val != null)
                {
                    created = FormatDateString(val);
                    if (!string.IsNullOrWhiteSpace(created)) break;
                }
            }

            // 3. Last Login candidates
            string[] loginCandidateKeys = new[]
            {
                "lastLogin", "last_login", "lastSeen", "last_seen",
                "lastConnected", "last_connected", "lastOnline", "last_online",
                "loginTime", "login_time", "updatedAt", "updated_at",
                "lastActive", "last_active", "modified", "lastModified", "last_modified"
            };

            foreach (var key in loginCandidateKeys)
            {
                if (TryGetCaseInsensitive(dict, key, out object? val) && val != null)
                {
                    lastLogin = FormatDateTimeString(val);
                    if (!string.IsNullOrWhiteSpace(lastLogin)) break;
                }
            }

            // 4. Status candidates
            string[] statusCandidateKeys = new[]
            {
                "status", "state", "active", "isActive", "is_active", "bound", "isBound", "is_bound"
            };

            foreach (var key in statusCandidateKeys)
            {
                if (TryGetCaseInsensitive(dict, key, out object? val) && val != null)
                {
                    if (val is bool b) status = b ? "Active" : "Inactive";
                    else if (val is string s && !string.IsNullOrWhiteSpace(s)) status = s;
                    if (!string.IsNullOrWhiteSpace(status)) break;
                }
            }
        }

        private static bool TryGetCaseInsensitive(IDictionary<string, object?> dict, string key, out object? value)
        {
            if (dict.TryGetValue(key, out value)) return true;

            foreach (var kvp in dict)
            {
                if (string.Equals(kvp.Key, key, StringComparison.OrdinalIgnoreCase))
                {
                    value = kvp.Value;
                    return true;
                }
            }

            value = null;
            return false;
        }

        private static string? FormatDateString(object val)
        {
            if (val is DateTime dt) return dt.ToString("yyyy-MM-dd");
            if (val is long or int or double)
            {
                double num = Convert.ToDouble(val, CultureInfo.InvariantCulture);
                if (num > 1_000_000_000_000) return DateTimeOffset.FromUnixTimeMilliseconds((long)num).UtcDateTime.ToString("yyyy-MM-dd");
                if (num > 1_000_000_000) return DateTimeOffset.FromUnixTimeSeconds((long)num).UtcDateTime.ToString("yyyy-MM-dd");
            }
            if (val is string str && !string.IsNullOrWhiteSpace(str))
            {
                if (DateTime.TryParse(str, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDt))
                    return parsedDt.ToString("yyyy-MM-dd");
                return str;
            }
            return val.ToString();
        }

        private static string? FormatDateTimeString(object val)
        {
            if (val is DateTime dt) return dt.ToString("yyyy-MM-dd HH:mm");
            if (val is long or int or double)
            {
                double num = Convert.ToDouble(val, CultureInfo.InvariantCulture);
                if (num > 1_000_000_000_000) return DateTimeOffset.FromUnixTimeMilliseconds((long)num).UtcDateTime.ToString("yyyy-MM-dd HH:mm");
                if (num > 1_000_000_000) return DateTimeOffset.FromUnixTimeSeconds((long)num).UtcDateTime.ToString("yyyy-MM-dd HH:mm");
            }
            if (val is string str && !string.IsNullOrWhiteSpace(str))
            {
                if (DateTime.TryParse(str, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDt))
                    return parsedDt.ToString("yyyy-MM-dd HH:mm");
                return str;
            }
            return val.ToString();
        }

        public static bool UnbindCharacter(string steamId)
        {
            try
            {
                string filePath = GetCharacterVaultBindingsFilePath();
                if (!File.Exists(filePath))
                    return true;

                string json = File.ReadAllText(filePath, Encoding.UTF8);
                object? parsed = SimpleJson.Deserialize(json);
                if (parsed == null) return false;

                bool removed = false;

                if (parsed is IDictionary<string, object?> dict)
                {
                    IDictionary<string, object?> targetDict = dict;
                    if (dict.Count == 1)
                    {
                        var firstEntry = dict.First();
                        if (firstEntry.Value is IDictionary<string, object?> innerDict)
                        {
                            targetDict = innerDict;
                        }
                    }

                    var keysToRemove = new List<string>();
                    foreach (var key in targetDict.Keys)
                    {
                        if (IsSteamIdMatch(key, steamId))
                        {
                            keysToRemove.Add(key);
                        }
                    }

                    foreach (var key in keysToRemove)
                    {
                        targetDict.Remove(key);
                        removed = true;
                    }
                }
                else if (parsed is System.Collections.IList list)
                {
                    for (int i = list.Count - 1; i >= 0; i--)
                    {
                        var item = list[i];
                        if (item is IDictionary<string, object?> itemDict)
                        {
                            string[] steamCandidateKeys = new[] { "steamId", "steam_id", "steamID", "id", "playerId", "player_id", "userId", "key", "account" };
                            foreach (var k in steamCandidateKeys)
                            {
                                if (TryGetCaseInsensitive(itemDict, k, out object? val) && val != null && IsSteamIdMatch(val.ToString() ?? "", steamId))
                                {
                                    list.RemoveAt(i);
                                    removed = true;
                                    break;
                                }
                            }
                        }
                        else if (item is string strItem && IsSteamIdMatch(strItem, steamId))
                        {
                            list.RemoveAt(i);
                            removed = true;
                        }
                    }
                }

                if (removed)
                {
                    string updatedJson = SimpleJson.SerializeObject(parsed, prettyPrint: true);
                    File.WriteAllText(filePath, updatedJson, Encoding.UTF8);
                    BifrostheimPlugin.Log?.LogInfo($"[ConfigSyncManager] Removed CharacterVault binding for '{steamId}'.");
                    return true;
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogError($"[ConfigSyncManager] Failed to unbind character '{steamId}': {ex.Message}");
            }
            return false;
        }

        public static bool IsSteamIdMatch(string a, string b)
        {
            if (string.IsNullOrWhiteSpace(a) || string.IsNullOrWhiteSpace(b)) return false;
            if (string.Equals(a.Trim(), b.Trim(), StringComparison.OrdinalIgnoreCase)) return true;

            string Clean(string s) => s.Trim().StartsWith("Steam_", StringComparison.OrdinalIgnoreCase) ? s.Trim().Substring(6) : s.Trim();
            return string.Equals(Clean(a), Clean(b), StringComparison.OrdinalIgnoreCase);
        }

        public static bool WipeCharacters()
        {
            try
            {
                string filePath = GetCharacterVaultBindingsFilePath();
                string dir = Path.GetDirectoryName(filePath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                File.WriteAllText(filePath, "{}", Encoding.UTF8);
                BifrostheimPlugin.Log?.LogInfo("[ConfigSyncManager] Wiped all CharacterVault bindings.");
                return true;
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogError($"[ConfigSyncManager] Failed to wipe CharacterVault bindings: {ex.Message}");
            }
            return false;
        }

        #endregion

        #region Module: Other Mods (3rd Party Configs)

        public static List<OtherModSummaryDto> ScanOtherModConfigFiles()
        {
            var list = new List<OtherModSummaryDto>();
            try
            {
                string configDir = GetConfigDirectory();
                if (!Directory.Exists(configDir))
                {
                    return list;
                }

                string[] files = Directory.GetFiles(configDir, "*.cfg", SearchOption.TopDirectoryOnly);
                foreach (var filePath in files)
                {
                    try
                    {
                        string fileName = Path.GetFileName(filePath);
                        var fi = new FileInfo(filePath);

                        bool isFirstParty = IsFirstPartyModFile(fileName);

                        var summary = new OtherModSummaryDto
                        {
                            fileName = fileName,
                            filePath = fileName,
                            displayName = CleanDisplayName(fileName),
                            fileSizeBytes = fi.Length,
                            lastModified = fi.LastWriteTime.ToString("yyyy-MM-dd HH:mm"),
                            isFirstParty = isFirstParty
                        };

                        CountSectionsAndSettings(filePath, out int secCount, out int setCount);
                        summary.sectionCount = secCount;
                        summary.settingCount = setCount;

                        MatchLoadedPluginSummary(fileName, summary);

                        list.Add(summary);
                    }
                    catch (Exception ex)
                    {
                        BifrostheimPlugin.Log?.LogWarning($"[ConfigSyncManager] Error scanning mod config '{filePath}': {ex.Message}");
                    }
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogError($"[ConfigSyncManager] Failed to scan config directory: {ex.Message}");
            }

            return list.OrderBy(m => m.isFirstParty).ThenBy(m => m.displayName).ToList();
        }

        private static bool MatchPluginToConfigFile(string fileName, PluginInfo info, string guid)
        {
            if (info == null) return false;

            // Never match BepInEx.cfg to a plugin (BepInEx.cfg is the core framework config)
            if (string.Equals(fileName, "BepInEx.cfg", StringComparison.OrdinalIgnoreCase))
                return false;

            // 1. Direct ConfigFilePath match (exact)
            string? cfgPath = info.Instance?.Config?.ConfigFilePath;
            if (!string.IsNullOrEmpty(cfgPath))
            {
                string cfgFileName = Path.GetFileName(cfgPath);
                if (string.Equals(cfgFileName, fileName, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            // 2. Exact match against GUID
            string fileWithoutExt = Path.GetFileNameWithoutExtension(fileName);
            if (string.Equals(guid, fileWithoutExt, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            // 3. Exact match against GUID with normalized separators
            string cleanGuid = guid.Replace(".", "_").Replace("-", "_");
            string cleanFile = fileWithoutExt.Replace(".", "_").Replace("-", "_");
            if (string.Equals(cleanGuid, cleanFile, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            // 4. Suffix match (e.g. "org.bepinex.plugins.creaturelevelcontrol" ends with "creaturelevelcontrol")
            string[] genericTokens = new[] { "bepinex", "plugin", "plugins", "valheim", "mod", "com", "org", "net" };
            if (!genericTokens.Contains(cleanFile.ToLowerInvariant()))
            {
                if (cleanGuid.EndsWith("_" + cleanFile, StringComparison.OrdinalIgnoreCase) ||
                    cleanGuid.EndsWith("." + fileWithoutExt, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }

        private static void MatchLoadedPluginSummary(string fileName, OtherModSummaryDto summary)
        {
            if (string.Equals(fileName, "BepInEx.cfg", StringComparison.OrdinalIgnoreCase))
            {
                summary.displayName = "BepInEx Core Framework";
                summary.pluginGuid = "BepInEx";
                summary.pluginName = "BepInEx Core";
                summary.isLoadedInGame = true;
                return;
            }

            try
            {
                if (Chainloader.PluginInfos == null) return;

                foreach (var kvp in Chainloader.PluginInfos)
                {
                    var info = kvp.Value;
                    if (info == null) continue;

                    string guid = kvp.Key;
                    if (MatchPluginToConfigFile(fileName, info, guid))
                    {
                        summary.pluginGuid = guid;
                        summary.pluginName = info.Metadata?.Name ?? summary.displayName;
                        summary.pluginVersion = info.Metadata?.Version?.ToString() ?? "";
                        summary.isLoadedInGame = true;
                        if (!string.IsNullOrWhiteSpace(summary.pluginName))
                        {
                            summary.displayName = summary.pluginName;
                        }
                        break;
                    }
                }
            }
            catch { }
        }

        public static OtherModConfigDetailDto ParseModConfigFile(string fileName)
        {
            string safeName = Path.GetFileName(fileName);
            var detail = new OtherModConfigDetailDto
            {
                fileName = safeName,
                displayName = CleanDisplayName(safeName),
                sections = new List<OtherModSectionDto>()
            };

            string configDir = GetConfigDirectory();
            string filePath = Path.Combine(configDir, safeName);

            if (!File.Exists(filePath))
            {
                return detail;
            }

            try
            {
                detail.lastModified = File.GetLastWriteTime(filePath).ToString("yyyy-MM-dd HH:mm:ss");
                detail.rawContent = File.ReadAllText(filePath, Encoding.UTF8);

                MatchLoadedPluginDetail(safeName, detail);

                string[] lines = File.ReadAllLines(filePath, Encoding.UTF8);
                var currentSection = new OtherModSectionDto { name = "General", entries = new List<OtherModConfigEntryDto>() };
                var sectionsList = new List<OtherModSectionDto> { currentSection };
                var sectionsMap = new Dictionary<string, OtherModSectionDto>(StringComparer.OrdinalIgnoreCase)
                {
                    ["General"] = currentSection
                };

                var descriptionLines = new List<string>();
                string? currentSettingType = null;
                string? currentDefaultValue = null;
                string? currentAcceptableRange = null;
                List<string>? currentAcceptableValues = null;

                void ResetEntryMetadata()
                {
                    descriptionLines.Clear();
                    currentSettingType = null;
                    currentDefaultValue = null;
                    currentAcceptableRange = null;
                    currentAcceptableValues = null;
                }

                foreach (var rawLine in lines)
                {
                    string line = rawLine.Trim();
                    if (string.IsNullOrEmpty(line))
                    {
                        continue;
                    }

                    if (line.StartsWith("##"))
                    {
                        string desc = line.Substring(2).Trim();
                        if (!string.IsNullOrEmpty(desc))
                        {
                            descriptionLines.Add(desc);
                        }
                        continue;
                    }

                    if (line.StartsWith("# Setting type:", StringComparison.OrdinalIgnoreCase))
                    {
                        currentSettingType = line.Substring("# Setting type:".Length).Trim();
                        continue;
                    }

                    if (line.StartsWith("# Default value:", StringComparison.OrdinalIgnoreCase))
                    {
                        currentDefaultValue = line.Substring("# Default value:".Length).Trim();
                        continue;
                    }

                    if (line.StartsWith("# Acceptable value range:", StringComparison.OrdinalIgnoreCase))
                    {
                        currentAcceptableRange = line.Substring("# Acceptable value range:".Length).Trim();
                        continue;
                    }

                    if (line.StartsWith("# Acceptable values:", StringComparison.OrdinalIgnoreCase))
                    {
                        string valsStr = line.Substring("# Acceptable values:".Length).Trim();
                        currentAcceptableValues = valsStr.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries)
                            .Select(s => s.Trim())
                            .Where(s => !string.IsNullOrEmpty(s))
                            .ToList();
                        continue;
                    }

                    if (line.StartsWith("#") || line.StartsWith(";"))
                    {
                        continue;
                    }

                    if (line.StartsWith("[") && line.EndsWith("]"))
                    {
                        string secName = line.Substring(1, line.Length - 2).Trim();
                        if (!sectionsMap.TryGetValue(secName, out currentSection))
                        {
                            currentSection = new OtherModSectionDto { name = secName, entries = new List<OtherModConfigEntryDto>() };
                            sectionsMap[secName] = currentSection;
                            sectionsList.Add(currentSection);
                        }
                        ResetEntryMetadata();
                        continue;
                    }

                    int eqIdx = line.IndexOf('=');
                    if (eqIdx > 0)
                    {
                        string key = line.Substring(0, eqIdx).Trim();
                        string val = line.Substring(eqIdx + 1).Trim();

                        string valType = currentSettingType ?? InferValueType(val);

                        float? minRange = null;
                        float? maxRange = null;
                        if (!string.IsNullOrWhiteSpace(currentAcceptableRange))
                        {
                            TryParseRange(currentAcceptableRange, out minRange, out maxRange);
                        }

                        var entry = new OtherModConfigEntryDto
                        {
                            key = key,
                            value = val,
                            defaultValue = currentDefaultValue,
                            valueType = valType,
                            description = string.Join(" ", descriptionLines),
                            acceptableValues = currentAcceptableValues,
                            minRange = minRange,
                            maxRange = maxRange
                        };

                        currentSection.entries.Add(entry);
                        ResetEntryMetadata();
                    }
                }

                detail.sections = sectionsList.Where(s => s.entries.Count > 0).ToList();
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogError($"[ConfigSyncManager] Error parsing config file '{fileName}': {ex.Message}");
            }

            return detail;
        }

        private static void MatchLoadedPluginDetail(string fileName, OtherModConfigDetailDto detail)
        {
            if (string.Equals(fileName, "BepInEx.cfg", StringComparison.OrdinalIgnoreCase))
            {
                detail.displayName = "BepInEx Core Framework";
                detail.pluginGuid = "BepInEx";
                detail.pluginName = "BepInEx Core";
                detail.isLoadedInGame = true;
                return;
            }

            try
            {
                if (Chainloader.PluginInfos == null) return;

                foreach (var kvp in Chainloader.PluginInfos)
                {
                    var info = kvp.Value;
                    if (info == null) continue;

                    string guid = kvp.Key;
                    if (MatchPluginToConfigFile(fileName, info, guid))
                    {
                        detail.pluginGuid = guid;
                        detail.pluginName = info.Metadata?.Name ?? detail.displayName;
                        detail.pluginVersion = info.Metadata?.Version?.ToString() ?? "";
                        detail.isLoadedInGame = true;
                        if (!string.IsNullOrWhiteSpace(detail.pluginName))
                        {
                            detail.displayName = detail.pluginName;
                        }
                        break;
                    }
                }
            }
            catch { }
        }

        public static OtherModConfigDetailDto SaveOtherModConfig(SaveOtherModConfigRequest req)
        {
            string configDir = GetConfigDirectory();
            string safeName = Path.GetFileName(req.fileName);
            string filePath = Path.Combine(configDir, safeName);

            if (req.saveRaw && !string.IsNullOrEmpty(req.rawContent))
            {
                File.WriteAllText(filePath, req.rawContent, Encoding.UTF8);
                BifrostheimPlugin.Log?.LogInfo($"[ConfigSyncManager] Saved raw content to '{safeName}'.");
            }
            else if (req.updates != null)
            {
                WriteIniFile(filePath, req.updates);
            }

            TrySyncOtherModInMemory(safeName, req.updates);

            return ParseModConfigFile(safeName);
        }

        public static OtherModConfigDetailDto ResetOtherModConfigDefaults(string fileName)
        {
            string configDir = GetConfigDirectory();
            string safeName = Path.GetFileName(fileName);
            string filePath = Path.Combine(configDir, safeName);

            if (!File.Exists(filePath))
                return new OtherModConfigDetailDto { fileName = safeName };

            var detail = ParseModConfigFile(safeName);
            var defaultsUpdate = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);

            foreach (var section in detail.sections)
            {
                var secDict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (var entry in section.entries)
                {
                    if (!string.IsNullOrEmpty(entry.defaultValue))
                    {
                        secDict[entry.key] = entry.defaultValue!;
                    }
                }
                if (secDict.Count > 0)
                {
                    defaultsUpdate[section.name] = secDict;
                }
            }

            if (defaultsUpdate.Count > 0)
            {
                WriteIniFile(filePath, defaultsUpdate);
                TrySyncOtherModInMemory(safeName, defaultsUpdate);
            }

            return ParseModConfigFile(safeName);
        }

        private static void TrySyncOtherModInMemory(string fileName, Dictionary<string, Dictionary<string, string>>? updates)
        {
            try
            {
                if (Chainloader.PluginInfos == null) return;

                foreach (var kvp in Chainloader.PluginInfos)
                {
                    var info = kvp.Value;
                    if (info?.Instance?.Config == null) continue;

                    string guid = kvp.Key;
                    if (MatchPluginToConfigFile(fileName, info, guid))
                    {
                        var cfg = info.Instance.Config;
                        if (updates != null)
                        {
                            foreach (var secKvp in updates)
                            {
                                foreach (var kvpEntry in secKvp.Value)
                                {
                                    TrySetEntryValue(cfg, kvpEntry.Key, kvpEntry.Value);
                                }
                            }
                        }
                        try
                        {
                            cfg.Reload();
                            cfg.Save();
                            BifrostheimPlugin.Log?.LogInfo($"[ConfigSyncManager] Live-reloaded in-memory ConfigFile for plugin '{kvp.Key}'.");
                        }
                        catch (Exception reloadEx)
                        {
                            BifrostheimPlugin.Log?.LogWarning($"[ConfigSyncManager] Config.Reload() warning on '{kvp.Key}': {reloadEx.Message}");
                        }
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogWarning($"[ConfigSyncManager] In-memory sync exception for '{fileName}': {ex.Message}");
            }
        }

        private static bool IsFirstPartyModFile(string fileName)
        {
            string fn = fileName.ToLowerInvariant();
            return fn.Contains("valgrind") ||
                   fn.Contains("skald") ||
                   fn.Contains("dagrandnott") ||
                   fn.Contains("dagrnott") ||
                   fn.Contains("njoror") ||
                   fn.Contains("charactervault") ||
                   fn.Contains("charactersvault") ||
                   fn.Contains("bifrostheim") ||
                   fn.Contains("bigfrost");
        }

        private static void CountSectionsAndSettings(string filePath, out int sectionCount, out int settingCount)
        {
            sectionCount = 0;
            settingCount = 0;
            try
            {
                var lines = File.ReadAllLines(filePath, Encoding.UTF8);
                var sections = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var rawLine in lines)
                {
                    string line = rawLine.Trim();
                    if (string.IsNullOrEmpty(line) || line.StartsWith("#") || line.StartsWith(";"))
                        continue;

                    if (line.StartsWith("[") && line.EndsWith("]"))
                    {
                        sections.Add(line);
                    }
                    else if (line.Contains("="))
                    {
                        settingCount++;
                    }
                }
                sectionCount = Math.Max(1, sections.Count);
            }
            catch { }
        }

        private static string InferValueType(string val)
        {
            if (string.Equals(val, "true", StringComparison.OrdinalIgnoreCase) || string.Equals(val, "false", StringComparison.OrdinalIgnoreCase))
                return "Boolean";
            if (int.TryParse(val, out _))
                return "Int32";
            if (float.TryParse(val, NumberStyles.Any, CultureInfo.InvariantCulture, out _))
                return "Single";
            return "String";
        }

        private static void TryParseRange(string? rangeStr, out float? minRange, out float? maxRange)
        {
            minRange = null;
            maxRange = null;
            if (string.IsNullOrWhiteSpace(rangeStr)) return;
            try
            {
                var match = System.Text.RegularExpressions.Regex.Match(rangeStr!, @"From\s+([-\d\.]+)\s+to\s+([-\d\.]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    if (float.TryParse(match.Groups[1].Value, NumberStyles.Any, CultureInfo.InvariantCulture, out float min)) minRange = min;
                    if (float.TryParse(match.Groups[2].Value, NumberStyles.Any, CultureInfo.InvariantCulture, out float max)) maxRange = max;
                }
            }
            catch { }
        }

        private static string CleanDisplayName(string fileName)
        {
            string name = Path.GetFileNameWithoutExtension(fileName);
            if (name.Equals("BepInEx", StringComparison.OrdinalIgnoreCase))
            {
                return "BepInEx Core Framework";
            }

            string[] parts = name.Split(new[] { '.', '_' }, StringSplitOptions.RemoveEmptyEntries);
            var usefulParts = parts.Where(p => !p.Equals("com", StringComparison.OrdinalIgnoreCase)
                                             && !p.Equals("org", StringComparison.OrdinalIgnoreCase)
                                             && !p.Equals("bepinex", StringComparison.OrdinalIgnoreCase)
                                             && !p.Equals("plugins", StringComparison.OrdinalIgnoreCase)
                                             && !p.Equals("valheim", StringComparison.OrdinalIgnoreCase)).ToList();

            if (usefulParts.Count > 0)
            {
                var words = new List<string>();
                foreach (var p in usefulParts)
                {
                    words.Add(SplitCamelCase(p));
                }
                return string.Join(" - ", words);
            }

            return SplitCamelCase(name);
        }

        private static string SplitCamelCase(string input)
        {
            if (string.IsNullOrWhiteSpace(input)) return input;
            return System.Text.RegularExpressions.Regex.Replace(input, "([a-z])([A-Z])", "$1 $2");
        }

        #endregion

        #region Helper Search

        private static string? FindValue(Dictionary<string, Dictionary<string, string>> ini, params string[] candidateKeys)
        {
            foreach (var secKvp in ini.Values)
            {
                foreach (var key in candidateKeys)
                {
                    if (secKvp.TryGetValue(key, out string val))
                    {
                        return val;
                    }
                }
            }
            return null;
        }

        #endregion
    }
}

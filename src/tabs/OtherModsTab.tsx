import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FiPackage,
  FiSearch,
  FiSliders,
  FiCode,
  FiCheck,
  FiRotateCcw,
  FiAlertCircle,
  FiChevronDown,
  FiChevronRight,
  FiCopy,
  FiCheckCircle,
  FiActivity,
  FiLayers,
} from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import {
  api,
  type OtherModSummary,
  type OtherModConfigDetail,
  type OtherModSection,
  type OtherModConfigEntry,
} from '../api/client';
import ModHeader from '../components/ui/ModHeader';
import KpiGaugeCard from '../components/ui/KpiGaugeCard';

interface OtherModsTabProps {
  onSaved?: () => void;
}

export default function OtherModsTab({ onSaved }: OtherModsTabProps = {}) {
  const { showToast } = useToast();

  // Mod list state
  const [modsList, setModsList] = useState<OtherModSummary[]>([]);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [activeModDetail, setActiveModDetail] = useState<OtherModConfigDetail | null>(null);

  // Filter & Search states
  const [modSearch, setModSearch] = useState('');
  const [modFilter, setModFilter] = useState<'all' | 'thirdParty' | 'loaded'>('thirdParty');
  const [settingSearch, setSettingSearch] = useState('');

  // Editor mode & modified state
  const [editorMode, setEditorMode] = useState<'visual' | 'raw'>('visual');
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [initialFormValues, setInitialFormValues] = useState<Record<string, Record<string, string>>>({});
  const [rawContent, setRawContent] = useState('');
  const [initialRawContent, setInitialRawContent] = useState('');

  // UI state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const selectedFileNameRef = useRef<string | null>(selectedFileName);
  selectedFileNameRef.current = selectedFileName;

  // Fetch list of mods
  const fetchModsList = useCallback(async (preferredSelectFileName?: string) => {
    try {
      setIsLoadingList(true);
      const res = await api.getOtherModsList();
      const mods = res.mods || [];
      setModsList(mods);

      const target = preferredSelectFileName || selectedFileNameRef.current;
      if (mods.length > 0) {
        if (target && mods.some((m) => m.fileName === target)) {
          setSelectedFileName(target);
        } else {
          // Default to first 3rd party mod or first available mod
          const first3rd = mods.find((m) => !m.isFirstParty) || mods[0];
          setSelectedFileName(first3rd.fileName);
        }
      } else {
        setSelectedFileName(null);
        setActiveModDetail(null);
      }
    } catch {
      showToast('Failed to scan mod configuration files from server.', 'error');
    } finally {
      setIsLoadingList(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchModsList();
  }, [fetchModsList]);

  // Fetch configuration detail when selected mod changes
  const fetchModDetail = useCallback(async (fileName: string) => {
    try {
      setIsLoadingDetail(true);
      const detail = await api.getOtherModConfig(fileName);
      setActiveModDetail(detail);

      // Build dictionary of current values: { [section]: { [key]: value } }
      const valuesMap: Record<string, Record<string, string>> = {};
      detail.sections.forEach((sec) => {
        valuesMap[sec.name] = {};
        sec.entries.forEach((entry) => {
          valuesMap[sec.name][entry.key] = entry.value;
        });
      });

      setFormValues(valuesMap);
      setInitialFormValues(JSON.parse(JSON.stringify(valuesMap)));
      setRawContent(detail.rawContent || '');
      setInitialRawContent(detail.rawContent || '');
      setCollapsedSections({});
      setSettingSearch('');
    } catch {
      showToast(`Failed to load config for '${fileName}'`, 'error');
    } finally {
      setIsLoadingDetail(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedFileName) {
      fetchModDetail(selectedFileName);
    }
  }, [selectedFileName, fetchModDetail]);

  // Determine dirty state
  const isDirty = useMemo(() => {
    if (editorMode === 'raw') {
      return rawContent !== initialRawContent;
    }
    // Check visual form differences
    for (const [secName, entries] of Object.entries(formValues)) {
      const initSec = initialFormValues[secName];
      if (!initSec) return true;
      for (const [k, v] of Object.entries(entries)) {
        if (initSec[k] !== v) return true;
      }
    }
    return false;
  }, [editorMode, rawContent, initialRawContent, formValues, initialFormValues]);

  // Count modified entries
  const modifiedCount = useMemo(() => {
    if (editorMode === 'raw') {
      return rawContent !== initialRawContent ? 1 : 0;
    }
    let count = 0;
    for (const [secName, entries] of Object.entries(formValues)) {
      const initSec = initialFormValues[secName];
      if (!initSec) continue;
      for (const [k, v] of Object.entries(entries)) {
        if (initSec[k] !== v) count++;
      }
    }
    return count;
  }, [editorMode, rawContent, initialRawContent, formValues, initialFormValues]);

  // Filtered mod list for left sidebar
  const filteredMods = useMemo(() => {
    return modsList.filter((mod) => {
      if (modFilter === 'thirdParty' && mod.isFirstParty) return false;
      if (modFilter === 'loaded' && !mod.isLoadedInGame) return false;

      if (!modSearch.trim()) return true;
      const q = modSearch.toLowerCase();
      return (
        mod.displayName.toLowerCase().includes(q) ||
        mod.fileName.toLowerCase().includes(q) ||
        mod.pluginGuid.toLowerCase().includes(q)
      );
    });
  }, [modsList, modFilter, modSearch]);

  // Filtered sections and settings for right editor
  const filteredSections = useMemo(() => {
    if (!activeModDetail) return [];
    if (!settingSearch.trim()) return activeModDetail.sections;

    const q = settingSearch.toLowerCase();
    return activeModDetail.sections
      .map((sec) => {
        const matchesSection = sec.name.toLowerCase().includes(q);
        const matchingEntries = sec.entries.filter(
          (e) =>
            matchesSection ||
            e.key.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q) ||
            e.value.toLowerCase().includes(q)
        );

        return {
          ...sec,
          entries: matchingEntries,
        };
      })
      .filter((sec) => sec.entries.length > 0);
  }, [activeModDetail, settingSearch]);

  // Handle entry value change in visual mode
  const handleEntryChange = (sectionName: string, key: string, newValue: string) => {
    setFormValues((prev) => ({
      ...prev,
      [sectionName]: {
        ...(prev[sectionName] || {}),
        [key]: newValue,
      },
    }));
  };

  // Toggle section collapse
  const toggleSectionCollapse = (sectionName: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  // Save changes
  const handleSave = async () => {
    if (!selectedFileName) return;

    setIsSaving(true);
    try {
      let res;
      if (editorMode === 'raw') {
        res = await api.saveOtherModConfig({
          fileName: selectedFileName,
          rawContent,
          saveRaw: true,
        });
      } else {
        res = await api.saveOtherModConfig({
          fileName: selectedFileName,
          updates: formValues,
          saveRaw: false,
        });
      }

      if (res.success && res.config) {
        setActiveModDetail(res.config);

        const valuesMap: Record<string, Record<string, string>> = {};
        res.config.sections.forEach((sec) => {
          valuesMap[sec.name] = {};
          sec.entries.forEach((entry) => {
            valuesMap[sec.name][entry.key] = entry.value;
          });
        });

        setFormValues(valuesMap);
        setInitialFormValues(JSON.parse(JSON.stringify(valuesMap)));
        setRawContent(res.config.rawContent || '');
        setInitialRawContent(res.config.rawContent || '');

        showToast(`Saved '${res.config.displayName || selectedFileName}' (Restart pending)`, 'success');
        if (onSaved) onSaved();
      }
    } catch {
      showToast(`Failed to save configuration for '${selectedFileName}'`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    setFormValues(JSON.parse(JSON.stringify(initialFormValues)));
    setRawContent(initialRawContent);
    showToast('Unsaved changes discarded', 'info');
  };

  // Reset entire mod to defaults
  const handleResetModDefaults = async () => {
    if (!selectedFileName || !activeModDetail) return;

    if (!window.confirm(`Reset all settings in '${activeModDetail.displayName}' to their default values?`)) {
      return;
    }

    try {
      setIsSaving(true);
      const res = await api.resetOtherModConfigDefaults(selectedFileName);
      if (res.success && res.config) {
        setActiveModDetail(res.config);

        const valuesMap: Record<string, Record<string, string>> = {};
        res.config.sections.forEach((sec) => {
          valuesMap[sec.name] = {};
          sec.entries.forEach((entry) => {
            valuesMap[sec.name][entry.key] = entry.value;
          });
        });

        setFormValues(valuesMap);
        setInitialFormValues(JSON.parse(JSON.stringify(valuesMap)));
        setRawContent(res.config.rawContent || '');
        setInitialRawContent(res.config.rawContent || '');

        showToast(`Reset '${res.config.displayName}' to default values`, 'success');
        if (onSaved) onSaved();
      }
    } catch {
      showToast(`Failed to reset defaults for '${selectedFileName}'`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Copy raw content
  const handleCopyRaw = () => {
    navigator.clipboard.writeText(rawContent);
    setIsCopied(true);
    showToast('Configuration copied to clipboard', 'info');
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Keyboard shortcut Ctrl+S
  const saveHandlerRef = useRef(handleSave);
  saveHandlerRef.current = handleSave;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && !isSaving) {
          saveHandlerRef.current();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, isSaving]);

  const loadedModsCount = modsList.filter((m) => m.isLoadedInGame).length;

  return (
    <div className="space-y-6 pb-12">
      {/* ── 1. Top Hero Header ── */}
      <ModHeader
        icon={FiPackage}
        title="Other Mods Configurator"
        accentColor="orange"
        onRefresh={() => fetchModsList(selectedFileName || undefined)}
        isRefreshing={isLoadingList}
      />

      {/* ── 2. Top Visual Telemetry Gauges (3 Cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiGaugeCard
          icon={FiPackage}
          label="Discovered Configs"
          value={modsList.length}
          unit=".cfg Files"
          accentColor="orange"
        />

        <KpiGaugeCard
          icon={FiActivity}
          label="Active Plugins"
          value={loadedModsCount}
          unit={
            modsList.length > 0
              ? `of ${modsList.length} In-Game`
              : 'In-Game'
          }
          progressPercent={
            modsList.length > 0
              ? Math.min(100, Math.round((loadedModsCount / modsList.length) * 100))
              : 0
          }
          progressGradient="from-emerald-500 to-teal-400"
          accentColor="orange"
        />

        <KpiGaugeCard
          icon={FiSliders}
          label="Pending Modifications"
          value={modifiedCount}
          unit={modifiedCount === 1 ? 'Unsaved Edit' : 'Unsaved Edits'}
          accentColor="orange"
        />
      </div>

      {/* ── 3. Dual-Pane Configurator Workspace ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[620px]">
        {/* Left Navigator: Mod Selector List (4 cols) */}
        <div className="lg:col-span-4 bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl flex flex-col overflow-hidden shadow-xl">
          {/* Search & Filter Header */}
          <div className="p-4 border-b border-gray-800/80 bg-gray-900/90 space-y-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-2.5 text-gray-500 text-xs" />
              <input
                type="text"
                placeholder="Search mods by name or GUID..."
                value={modSearch}
                onChange={(e) => setModSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-950 border border-gray-700/80 rounded-xl text-xs font-mono text-gray-200 focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Filter Chips */}
            <div className="flex items-center space-x-1.5 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setModFilter('thirdParty')}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  modFilter === 'thirdParty'
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 font-bold'
                    : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-gray-200'
                }`}
              >
                3rd Party
              </button>
              <button
                type="button"
                onClick={() => setModFilter('loaded')}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  modFilter === 'loaded'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                    : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-gray-200'
                }`}
              >
                Loaded in Game
              </button>
              <button
                type="button"
                onClick={() => setModFilter('all')}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  modFilter === 'all'
                    ? 'bg-gray-800 text-white border-gray-600 font-bold'
                    : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-gray-200'
                }`}
              >
                All ({modsList.length})
              </button>
            </div>
          </div>

          {/* Mod Items List */}
          <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[620px] custom-scrollbar">
            {isLoadingList ? (
              <div className="py-20 text-center text-gray-500 font-mono text-xs flex flex-col items-center justify-center space-y-2">
                <FiActivity size={24} className="text-orange-400 animate-pulse" />
                <p>Scanning server BepInEx/config folder...</p>
              </div>
            ) : filteredMods.length === 0 ? (
              <div className="py-20 text-center text-gray-500 font-mono text-xs">
                No mod configuration files found.
              </div>
            ) : (
              filteredMods.map((mod) => {
                const isSelected = selectedFileName === mod.fileName;

                return (
                  <button
                    key={mod.fileName}
                    type="button"
                    onClick={() => setSelectedFileName(mod.fileName)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col space-y-2 group ${
                      isSelected
                        ? 'bg-orange-500/10 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.15)] ring-1 ring-orange-500/30'
                        : 'bg-gray-950/60 border-gray-800/90 hover:border-gray-700 hover:bg-gray-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-bold text-xs truncate ${
                          isSelected ? 'text-orange-300' : 'text-gray-200 group-hover:text-white'
                        }`}
                      >
                        {mod.displayName}
                      </span>
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
                          mod.isFirstParty
                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                            : 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                        }`}
                      >
                        {mod.isFirstParty ? 'Bifrostheim' : '3rd Party'}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-gray-500 truncate">
                      {mod.fileName}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-gray-800/60 text-[10px] font-mono text-gray-400">
                      <span className="flex items-center space-x-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            mod.isLoadedInGame ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'
                          }`}
                        />
                        <span>{mod.isLoadedInGame ? 'Active In-Game' : 'Config On Disk'}</span>
                      </span>
                      <span>{mod.sectionCount} sections</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Inspector: Configuration Editor (8 cols) */}
        <div className="lg:col-span-8 bg-gray-900/60 backdrop-blur-md border border-gray-800/80 rounded-2xl flex flex-col overflow-hidden shadow-xl">
          {activeModDetail ? (
            <>
              {/* Top Inspector Action Bar */}
              <div className="p-4 sm:p-5 border-b border-gray-800/80 bg-gray-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center space-x-2.5">
                    <h3 className="font-bold text-gray-100 text-base truncate">
                      {activeModDetail.displayName}
                    </h3>
                    {isDirty && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse shrink-0">
                        {modifiedCount} Unsaved
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-gray-400 mt-0.5 truncate">
                    {activeModDetail.pluginGuid} &bull; {activeModDetail.fileName}
                  </p>
                </div>

                {/* Toolbar actions */}
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
                  {/* Visual vs Raw Toggle */}
                  <div className="flex items-center bg-gray-950 p-1 rounded-xl border border-gray-800 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setEditorMode('visual')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                        editorMode === 'visual'
                          ? 'bg-orange-500 text-white font-bold shadow-md shadow-orange-500/20'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <FiSliders size={13} />
                      <span>Visual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode('raw')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                        editorMode === 'raw'
                          ? 'bg-orange-500 text-white font-bold shadow-md shadow-orange-500/20'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <FiCode size={13} />
                      <span>Raw Text</span>
                    </button>
                  </div>

                  {editorMode === 'raw' && (
                    <button
                      type="button"
                      onClick={handleCopyRaw}
                      className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl border border-gray-700 transition-all text-xs"
                      title="Copy raw config to clipboard"
                    >
                      {isCopied ? <FiCheckCircle className="text-emerald-400" size={14} /> : <FiCopy size={14} />}
                    </button>
                  )}

                  {isDirty && (
                    <button
                      type="button"
                      onClick={handleDiscard}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl border border-gray-700 text-xs font-semibold transition-all"
                    >
                      Discard
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleResetModDefaults}
                    disabled={isSaving}
                    className="p-2 bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded-xl border border-gray-700 transition-all text-xs"
                    title="Reset all settings in this file to their default values"
                  >
                    <FiRotateCcw size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isDirty || isSaving}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Save Changes (⌘S / Ctrl+S)"
                  >
                    <FiCheck size={14} />
                    <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                    <span className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold bg-black/30 border border-white/20 rounded text-white/90 ml-1">
                      ⌘S
                    </span>
                  </button>
                </div>
              </div>

              {/* Inspector Content */}
              <div className="flex-1 p-5 overflow-y-auto max-h-[580px] custom-scrollbar">
                {isLoadingDetail ? (
                  <div className="py-20 text-center text-gray-500 font-mono text-xs flex flex-col items-center justify-center space-y-2">
                    <FiActivity size={24} className="text-orange-400 animate-pulse" />
                    <p>Loading configuration settings...</p>
                  </div>
                ) : editorMode === 'raw' ? (
                  /* Raw Mode Textarea */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono text-gray-400 bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                      <span className="flex items-center space-x-1.5 text-amber-300">
                        <FiAlertCircle />
                        <span>Direct BepInEx .cfg Editing</span>
                      </span>
                      <span>Press Ctrl+S / Cmd+S to save</span>
                    </div>

                    <textarea
                      value={rawContent}
                      onChange={(e) => setRawContent(e.target.value)}
                      rows={24}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 font-mono text-xs text-gray-200 leading-relaxed focus:outline-none focus:border-orange-500 custom-scrollbar select-text"
                      spellCheck={false}
                    />
                  </div>
                ) : (
                  /* Visual Mode Form */
                  <div className="space-y-5">
                    {/* Setting Search Bar */}
                    <div className="relative">
                      <FiSearch className="absolute left-3.5 top-3 text-gray-500 text-xs" />
                      <input
                        type="text"
                        placeholder="Search settings in this file..."
                        value={settingSearch}
                        onChange={(e) => setSettingSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs font-mono text-gray-200 focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    {filteredSections.length === 0 ? (
                      <div className="py-20 text-center text-gray-500 font-mono text-xs">
                        No settings match &ldquo;{settingSearch}&rdquo;.
                      </div>
                    ) : (
                      filteredSections.map((sec: OtherModSection) => {
                        const isCollapsed = !!collapsedSections[sec.name];

                        return (
                          <div
                            key={sec.name}
                            className="bg-gray-950/70 border border-gray-800/90 rounded-2xl overflow-hidden shadow-sm transition-all"
                          >
                            {/* Section Accordion Header */}
                            <button
                              type="button"
                              onClick={() => toggleSectionCollapse(sec.name)}
                              className="w-full px-5 py-3.5 bg-gray-900/80 hover:bg-gray-850 flex items-center justify-between border-b border-gray-800/70 transition-colors text-left"
                            >
                              <div className="flex items-center space-x-2.5">
                                <div className="text-orange-400">
                                  {isCollapsed ? <FiChevronRight size={16} /> : <FiChevronDown size={16} />}
                                </div>
                                <span className="font-bold text-sm text-gray-100 font-mono">
                                  [{sec.name}]
                                </span>
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                                {sec.entries.length} items
                              </span>
                            </button>

                            {/* Section Entries List */}
                            {!isCollapsed && (
                              <div className="p-4 sm:p-5 space-y-4 divide-y divide-gray-800/40">
                                {sec.entries.map((entry: OtherModConfigEntry) => {
                                  const currentVal =
                                    formValues[sec.name]?.[entry.key] ?? entry.value;
                                  const isEntryDirty =
                                    currentVal !== initialFormValues[sec.name]?.[entry.key];

                                  const isBoolean =
                                    entry.valueType === 'Boolean' ||
                                    ['true', 'false'].includes(entry.value.toLowerCase());

                                  return (
                                    <div
                                      key={entry.key}
                                      className={`pt-4 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                        isEntryDirty ? 'bg-orange-500/5 -mx-4 px-4 py-2 rounded-xl' : ''
                                      }`}
                                    >
                                      <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center space-x-2">
                                          <span className="font-bold text-xs text-gray-200 font-mono">
                                            {entry.key}
                                          </span>
                                          {isEntryDirty && (
                                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                              Modified
                                            </span>
                                          )}
                                        </div>

                                        {entry.description && (
                                          <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                                            {entry.description}
                                          </p>
                                        )}

                                        {entry.defaultValue && (
                                          <div className="text-[10px] font-mono text-gray-500 mt-1">
                                            Default:{' '}
                                            <span className="text-gray-400">{entry.defaultValue}</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Setting Input Control */}
                                      <div className="shrink-0 sm:w-56">
                                        {isBoolean ? (
                                          <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={currentVal.toLowerCase() === 'true'}
                                              onChange={(e) =>
                                                handleEntryChange(
                                                  sec.name,
                                                  entry.key,
                                                  e.target.checked ? 'true' : 'false'
                                                )
                                              }
                                              className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                            <span className="ml-2.5 text-xs font-mono text-gray-300">
                                              {currentVal.toLowerCase() === 'true' ? 'Enabled' : 'Disabled'}
                                            </span>
                                          </label>
                                        ) : entry.acceptableValues && entry.acceptableValues.length > 0 ? (
                                          <select
                                            value={currentVal}
                                            onChange={(e) =>
                                              handleEntryChange(sec.name, entry.key, e.target.value)
                                            }
                                            className="w-full bg-gray-900 border border-gray-700/80 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-orange-500"
                                          >
                                            {entry.acceptableValues.map((opt) => (
                                              <option key={opt} value={opt}>
                                                {opt}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            type="text"
                                            value={currentVal}
                                            onChange={(e) =>
                                              handleEntryChange(sec.name, entry.key, e.target.value)
                                            }
                                            className="w-full bg-gray-900 border border-gray-700/80 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-orange-500"
                                          />
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center text-gray-500 font-mono text-xs space-y-3">
              <FiLayers size={36} className="text-gray-600" />
              <p>Select a mod configuration file from the list to inspect and tune parameters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

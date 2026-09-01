import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPackage,
  FiSearch,
  FiRefreshCw,
  FiSliders,
  FiCode,
  FiCheck,
  FiRotateCcw,
  FiAlertCircle,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiHardDrive,
  FiCopy,
  FiCheckCircle,
} from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import {
  api,
  type OtherModSummary,
  type OtherModConfigDetail,
  type OtherModSection,
  type OtherModConfigEntry,
} from '../api/client';

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
    const result: OtherModSection[] = [];

    for (const sec of activeModDetail.sections) {
      const matchingEntries = sec.entries.filter(
        (entry) =>
          entry.key.toLowerCase().includes(q) ||
          entry.description.toLowerCase().includes(q) ||
          (entry.valueType && entry.valueType.toLowerCase().includes(q))
      );

      if (matchingEntries.length > 0 || sec.name.toLowerCase().includes(q)) {
        result.push({
          name: sec.name,
          entries: matchingEntries.length > 0 ? matchingEntries : sec.entries,
        });
      }
    }

    return result;
  }, [activeModDetail, settingSearch]);

  // Handle visual input changes
  const handleSettingChange = (sectionName: string, key: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [sectionName]: {
        ...(prev[sectionName] || {}),
        [key]: value,
      },
    }));
  };

  // Reset a single setting to its default value
  const handleResetSingleSetting = (sectionName: string, key: string, defaultValue: string | null | undefined) => {
    if (defaultValue !== null && defaultValue !== undefined) {
      handleSettingChange(sectionName, key, defaultValue);
      showToast(`Reset '${key}' to default (${defaultValue})`, 'info');
    }
  };

  // Toggle section collapse
  const toggleSection = (sectionName: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  // Expand / Collapse all
  const setAllSectionsCollapsed = (collapsed: boolean) => {
    if (!activeModDetail) return;
    const next: Record<string, boolean> = {};
    activeModDetail.sections.forEach((s) => {
      next[s.name] = collapsed;
    });
    setCollapsedSections(next);
  };

  // Save changes
  const handleSave = async () => {
    if (!selectedFileName || !activeModDetail) return;

    try {
      setIsSaving(true);
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

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 space-y-5">
      {/* Top Banner Header */}
      <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/80 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-xl border bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-lg shadow-orange-500/10">
            <FiPackage size={24} />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-xl font-bold text-gray-100 tracking-tight">Other Mods Configurator</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                BepInEx Bridge
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Automatically discover, read, and fine-tune external 3rd-party mod configurations live on your server.
            </p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => fetchModsList(selectedFileName || undefined)}
            disabled={isLoadingList}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-gray-800/80 hover:bg-gray-700/80 text-gray-300 border border-gray-700/60 transition-all hover:border-gray-600 disabled:opacity-50"
            title="Re-scan BepInEx/config folder for modified or added .cfg files"
          >
            <FiRefreshCw size={13} className={isLoadingList ? 'animate-spin text-orange-400' : ''} />
            <span>Rescan Configs</span>
          </button>
        </div>
      </div>

      {/* Main Dual-Pane Workspace */}
      <div className="flex-1 flex flex-col md:flex-row gap-5 min-h-0 overflow-hidden">
        {/* Left Sidebar: Mod List & Filters */}
        <div className="w-full md:w-80 lg:w-96 flex flex-col bg-gray-900/50 backdrop-blur-md border border-gray-800/80 rounded-2xl overflow-hidden shrink-0">
          {/* Search bar & Filter Chips */}
          <div className="p-3.5 border-b border-gray-800/60 space-y-3 bg-gray-950/40">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={modSearch}
                onChange={(e) => setModSearch(e.target.value)}
                placeholder="Search mod name or .cfg..."
                className="w-full bg-gray-900/90 text-gray-100 text-xs pl-9 pr-3 py-2 rounded-xl border border-gray-700/60 focus:border-orange-500/60 focus:outline-none focus:ring-1 focus:ring-orange-500/40 font-mono placeholder:font-sans placeholder:text-gray-500 transition-colors"
              />
              {modSearch && (
                <button
                  type="button"
                  onClick={() => setModSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center space-x-1.5 p-1 bg-gray-900/80 rounded-xl border border-gray-800/80">
              <button
                type="button"
                onClick={() => setModFilter('thirdParty')}
                className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-lg transition-all ${
                  modFilter === 'thirdParty'
                    ? 'bg-orange-500/20 text-orange-300 shadow-sm border border-orange-500/30'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                3rd Party ({modsList.filter((m) => !m.isFirstParty).length})
              </button>
              <button
                type="button"
                onClick={() => setModFilter('all')}
                className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-lg transition-all ${
                  modFilter === 'all'
                    ? 'bg-orange-500/20 text-orange-300 shadow-sm border border-orange-500/30'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                All ({modsList.length})
              </button>
              <button
                type="button"
                onClick={() => setModFilter('loaded')}
                className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-lg transition-all ${
                  modFilter === 'loaded'
                    ? 'bg-orange-500/20 text-orange-300 shadow-sm border border-orange-500/30'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Live ({modsList.filter((m) => m.isLoadedInGame).length})
              </button>
            </div>
          </div>

          {/* Mod Cards List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
            {isLoadingList ? (
              <div className="p-8 text-center text-gray-500 flex flex-col items-center space-y-2">
                <FiRefreshCw className="animate-spin text-orange-400" size={20} />
                <span className="text-xs font-mono">Scanning BepInEx configs...</span>
              </div>
            ) : filteredMods.length === 0 ? (
              <div className="p-8 text-center text-gray-500 flex flex-col items-center space-y-2">
                <FiAlertCircle size={24} className="text-gray-600" />
                <span className="text-xs">No configuration files match the filter.</span>
              </div>
            ) : (
              filteredMods.map((mod) => {
                const isSelected = selectedFileName === mod.fileName;
                return (
                  <button
                    key={mod.fileName}
                    type="button"
                    onClick={() => {
                      if (isDirty) {
                        if (
                          !window.confirm(
                            'You have unsaved changes in the current mod. Switch anyway and lose unsaved changes?'
                          )
                        ) {
                          return;
                        }
                      }
                      setSelectedFileName(mod.fileName);
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-all duration-200 border flex flex-col space-y-1.5 ${
                      isSelected
                        ? 'bg-gradient-to-r from-orange-500/20 via-orange-500/10 to-transparent border-orange-500/40 text-orange-200 shadow-[0_0_15px_rgba(249,115,22,0.12)]'
                        : 'bg-gray-900/40 hover:bg-gray-800/60 border-gray-800/60 text-gray-300 hover:border-gray-700/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs tracking-tight text-gray-100 truncate pr-2">
                        {mod.displayName}
                      </span>
                      {mod.isLoadedInGame ? (
                        <span
                          className="flex items-center space-x-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0"
                          title="Loaded in active BepInEx process"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>Live</span>
                        </span>
                      ) : (
                        <span
                          className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-gray-800 text-gray-400 shrink-0"
                          title="File on disk (not matched to active plugin GUID)"
                        >
                          Disk
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-mono text-gray-400 truncate">
                      {mod.fileName}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono pt-1 border-t border-gray-800/40">
                      <span className="flex items-center space-x-1">
                        <FiSliders size={11} className="text-orange-400/80" />
                        <span>{mod.settingCount} settings</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <FiHardDrive size={11} className="text-gray-400" />
                        <span>{(mod.fileSizeBytes / 1024).toFixed(1)} KB</span>
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Editor Area */}
        <div className="flex-1 flex flex-col bg-gray-900/50 backdrop-blur-md border border-gray-800/80 rounded-2xl overflow-hidden min-w-0">
          {isLoadingDetail ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-3">
              <FiRefreshCw className="animate-spin text-orange-400" size={28} />
              <p className="text-sm font-mono">Parsing configuration structure...</p>
            </div>
          ) : !activeModDetail ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-2 p-8">
              <FiPackage size={36} className="text-gray-700" />
              <p className="text-sm font-medium text-gray-400">Select a mod from the list to view and edit settings.</p>
            </div>
          ) : (
            <>
              {/* Mod Configuration Header */}
              <div className="p-4 border-b border-gray-800/80 bg-gray-950/40 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                    <h3 className="text-base font-bold text-gray-100 tracking-tight truncate">
                      {activeModDetail.displayName}
                    </h3>
                    {activeModDetail.pluginVersion && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-gray-800 text-gray-300 border border-gray-700">
                        v{activeModDetail.pluginVersion}
                      </span>
                    )}
                    {activeModDetail.pluginGuid && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-300 border border-orange-500/20 truncate max-w-xs">
                        {activeModDetail.pluginGuid}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-gray-400 font-mono mt-1">
                    <span className="truncate">{activeModDetail.fileName}</span>
                    <span>•</span>
                    <span className="flex items-center space-x-1">
                      <FiClock size={12} />
                      <span>{activeModDetail.lastModified || 'Recent'}</span>
                    </span>
                  </div>
                </div>

                {/* Controls & Mode Switcher */}
                <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
                  {/* Visual vs Raw Editor Mode Toggle */}
                  <div className="flex items-center p-1 bg-gray-900 rounded-xl border border-gray-800">
                    <button
                      type="button"
                      onClick={() => setEditorMode('visual')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        editorMode === 'visual'
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <FiSliders size={13} />
                      <span>Visual Forms</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode('raw')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        editorMode === 'raw'
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <FiCode size={13} />
                      <span>Raw INI</span>
                    </button>
                  </div>

                  {/* Reset Defaults button */}
                  <button
                    type="button"
                    onClick={handleResetModDefaults}
                    disabled={isSaving}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-gray-800/80 hover:bg-red-500/10 text-gray-300 hover:text-red-400 border border-gray-700/60 hover:border-red-500/30 transition-all disabled:opacity-50"
                    title="Reset all settings in this file to their default comments"
                  >
                    <FiRotateCcw size={12} />
                    <span className="hidden sm:inline">Reset Defaults</span>
                  </button>
                </div>
              </div>

              {/* Sub-bar: Search within settings & Expand/Collapse */}
              {editorMode === 'visual' && (
                <div className="px-4 py-2.5 border-b border-gray-800/60 bg-gray-900/30 flex items-center justify-between gap-3 shrink-0">
                  <div className="relative flex-1 max-w-sm">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                    <input
                      type="text"
                      value={settingSearch}
                      onChange={(e) => setSettingSearch(e.target.value)}
                      placeholder="Filter settings or keys in this mod..."
                      className="w-full bg-gray-950/60 text-gray-100 text-xs pl-8 pr-3 py-1.5 rounded-lg border border-gray-800 focus:border-orange-500/60 focus:outline-none font-mono placeholder:font-sans placeholder:text-gray-500"
                    />
                    {settingSearch && (
                      <button
                        type="button"
                        onClick={() => setSettingSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setAllSectionsCollapsed(false)}
                      className="text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                    >
                      Expand All
                    </button>
                    <span className="text-gray-700">•</span>
                    <button
                      type="button"
                      onClick={() => setAllSectionsCollapsed(true)}
                      className="text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>
              )}

              {/* Editor Workspace Content */}
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4">
                {editorMode === 'visual' ? (
                  filteredSections.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 space-y-2">
                      <FiSearch size={28} className="mx-auto text-gray-600" />
                      <p className="text-sm font-medium">No settings match &quot;{settingSearch}&quot;</p>
                      <button
                        type="button"
                        onClick={() => setSettingSearch('')}
                        className="text-xs text-orange-400 hover:underline"
                      >
                        Clear search filter
                      </button>
                    </div>
                  ) : (
                    filteredSections.map((sec) => {
                      const isCollapsed = collapsedSections[sec.name] ?? false;
                      return (
                        <div
                          key={sec.name}
                          className="bg-gray-950/60 border border-gray-800/80 rounded-xl overflow-hidden shadow-sm"
                        >
                          {/* Section Header Accordion */}
                          <button
                            type="button"
                            onClick={() => toggleSection(sec.name)}
                            className="w-full flex items-center justify-between p-3.5 bg-gray-900/60 hover:bg-gray-900 border-b border-gray-800/60 transition-colors text-left"
                          >
                            <div className="flex items-center space-x-2.5">
                              {isCollapsed ? (
                                <FiChevronRight className="text-gray-400" size={16} />
                              ) : (
                                <FiChevronDown className="text-orange-400" size={16} />
                              )}
                              <span className="font-bold text-sm text-gray-200 font-mono">[{sec.name}]</span>
                            </div>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                              {sec.entries.length} {sec.entries.length === 1 ? 'setting' : 'settings'}
                            </span>
                          </button>

                          {/* Section Entries List */}
                          <AnimatePresence initial={false}>
                            {!isCollapsed && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="divide-y divide-gray-800/40 p-4 space-y-4 divide-y-0"
                              >
                                {sec.entries.map((entry) => {
                                  const currentVal = formValues[sec.name]?.[entry.key] ?? entry.value;
                                  const initVal = initialFormValues[sec.name]?.[entry.key] ?? entry.value;
                                  const isEntryModified = currentVal !== initVal;
                                  const isDifferentFromDefault =
                                    entry.defaultValue !== null &&
                                    entry.defaultValue !== undefined &&
                                    currentVal !== entry.defaultValue;

                                  return (
                                    <div
                                      key={entry.key}
                                      className={`p-3.5 rounded-xl border transition-all ${
                                        isEntryModified
                                          ? 'bg-amber-500/5 border-amber-500/30 shadow-[0_0_10px_rgba(251,191,36,0.06)]'
                                          : 'bg-gray-900/40 border-gray-800/60 hover:border-gray-700/80'
                                      }`}
                                    >
                                      {/* Top Row: Key name, type, default reset badge */}
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center space-x-2 flex-wrap">
                                          <span className="font-mono font-bold text-xs text-gray-100">
                                            {entry.key}
                                          </span>
                                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gray-800 text-gray-400 border border-gray-700/60">
                                            {entry.valueType}
                                          </span>
                                          {isEntryModified && (
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                                              Modified
                                            </span>
                                          )}
                                        </div>

                                        {/* Default value & reset button */}
                                        {entry.defaultValue !== null && entry.defaultValue !== undefined && (
                                          <div className="flex items-center space-x-2 text-[11px] font-mono text-gray-400">
                                            <span>Default: {entry.defaultValue}</span>
                                            {isDifferentFromDefault && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleResetSingleSetting(sec.name, entry.key, entry.defaultValue)
                                                }
                                                className="text-orange-400 hover:text-orange-300 hover:underline flex items-center space-x-0.5"
                                                title="Reset this setting to default value"
                                              >
                                                <FiRotateCcw size={10} />
                                                <span>Reset</span>
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {/* Description text */}
                                      {entry.description && (
                                        <p className="text-xs text-gray-400 leading-relaxed mb-3">
                                          {entry.description}
                                        </p>
                                      )}

                                      {/* Interactive Input Control Renderer */}
                                      <div className="pt-1">
                                        <SettingControlRenderer
                                          entry={entry}
                                          value={currentVal}
                                          onChange={(val) => handleSettingChange(sec.name, entry.key, val)}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  )
                ) : (
                  /* Raw INI Code Editor */
                  <div className="h-full flex flex-col space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                      <span className="font-mono">Direct INI file editor (preserving comments & structure)</span>
                      <button
                        type="button"
                        onClick={handleCopyRaw}
                        className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                      >
                        {isCopied ? <FiCheckCircle className="text-emerald-400" size={13} /> : <FiCopy size={13} />}
                        <span>{isCopied ? 'Copied!' : 'Copy INI'}</span>
                      </button>
                    </div>
                    <textarea
                      value={rawContent}
                      onChange={(e) => setRawContent(e.target.value)}
                      spellCheck={false}
                      className="w-full flex-1 min-h-[420px] bg-gray-950 text-gray-200 font-mono text-xs p-4 rounded-xl border border-gray-800 focus:border-orange-500/60 focus:outline-none focus:ring-1 focus:ring-orange-500/40 leading-relaxed resize-none custom-scrollbar"
                    />
                  </div>
                )}
              </div>

              {/* Floating / Sticky Save Action Bar */}
              <AnimatePresence>
                {isDirty && (
                  <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    className="p-4 border-t border-amber-500/30 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl z-20 shrink-0"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.8)]"></div>
                      <span className="text-sm font-semibold text-amber-300">
                        {modifiedCount} unsaved configuration {modifiedCount === 1 ? 'change' : 'changes'}
                      </span>
                      <span className="text-xs text-gray-400 hidden md:inline font-mono">
                        (Ctrl + S to save)
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleDiscard}
                        disabled={isSaving}
                        className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors border border-gray-700/60"
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50"
                      >
                        {isSaving ? (
                          <FiRefreshCw size={14} className="animate-spin" />
                        ) : (
                          <FiCheck size={14} />
                        )}
                        <span>{isSaving ? 'Saving...' : 'Save & Stage Restart'}</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Smart Setting Control Renderer ──────────────────────────────────────────
interface SettingControlRendererProps {
  entry: OtherModConfigEntry;
  value: string;
  onChange: (val: string) => void;
}

function SettingControlRenderer({ entry, value, onChange }: SettingControlRendererProps) {
  const type = entry.valueType.toLowerCase();

  // 1. Boolean Toggle Switch
  if (type === 'boolean' || value === 'true' || value === 'false') {
    const isChecked = value.toLowerCase() === 'true';
    return (
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={() => onChange(isChecked ? 'false' : 'true')}
          className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:outline-none ${
            isChecked
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]'
              : 'bg-gray-800 border border-gray-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isChecked ? 'translate-x-7 shadow-md' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-xs font-mono font-medium text-gray-300">
          {isChecked ? 'Enabled (true)' : 'Disabled (false)'}
        </span>
      </div>
    );
  }

  // 2. Acceptable Values Dropdown (Enum / Options)
  if (entry.acceptableValues && entry.acceptableValues.length > 0) {
    return (
      <div className="max-w-md">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-gray-950 text-gray-100 text-xs px-3 py-2 rounded-xl border border-gray-700/80 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
        >
          {entry.acceptableValues.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // 3. Number with Min/Max Range (Dual Slider + Stepper)
  if (
    (type.includes('int') || type.includes('single') || type.includes('double') || type.includes('float')) &&
    entry.minRange !== null &&
    entry.minRange !== undefined &&
    entry.maxRange !== null &&
    entry.maxRange !== undefined
  ) {
    const numVal = parseFloat(value) || 0;
    const isFloat = type.includes('single') || type.includes('double') || type.includes('float') || value.includes('.');
    const step = isFloat ? 0.05 : 1;

    return (
      <div className="flex items-center space-x-4 max-w-lg">
        <input
          type="range"
          min={entry.minRange}
          max={entry.maxRange}
          step={step}
          value={numVal}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />
        <div className="flex items-center space-x-1.5 shrink-0">
          <input
            type="number"
            min={entry.minRange}
            max={entry.maxRange}
            step={step}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-24 bg-gray-950 text-gray-100 text-xs px-2.5 py-1.5 rounded-lg border border-gray-700 font-mono text-right focus:border-orange-500 focus:outline-none"
          />
          <span className="text-[10px] text-gray-400 font-mono">
            [{entry.minRange} - {entry.maxRange}]
          </span>
        </div>
      </div>
    );
  }

  // 4. General Number (Int / Float without explicit range)
  if (type.includes('int') || type.includes('single') || type.includes('double') || type.includes('float')) {
    const isFloat = type.includes('single') || type.includes('double') || type.includes('float') || value.includes('.');
    return (
      <div className="max-w-xs">
        <input
          type="number"
          step={isFloat ? 0.1 : 1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-gray-950 text-gray-100 text-xs px-3 py-2 rounded-xl border border-gray-700/80 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
        />
      </div>
    );
  }

  // 5. Default Text / Keycode / String Input
  return (
    <div className="max-w-md">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-950 text-gray-100 text-xs px-3 py-2 rounded-xl border border-gray-700/80 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
      />
    </div>
  );
}

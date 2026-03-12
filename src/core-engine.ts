/**
 * Core Plugin Engine
 * Central command dispatcher and state management for the Layer Manager Pro plugin
 */

import { photoshopBridge, LayerInfo, DocumentInfo } from './photoshop-bridge';
import { versionControl } from './version-control';

// Core engine types
interface PluginState {
  selectedLayers: LayerInfo[];
  recentColors: string[];
  recentFonts: string[];
  preferences: UserPreferences;
  groupingHistory: GroupingOperation[];
  isInitialized: boolean;
}

interface UserPreferences {
  autoGroupingEnabled: boolean;
  defaultOutlineStyle: OutlineStyle;
  namingTemplates: NamingTemplate[];
  keyboardShortcuts: KeyboardShortcut[];
  panelLayout: PanelConfiguration;
  performanceSettings: PerformanceSettings;
}

interface OutlineStyle {
  width: number;
  color: { r: number; g: number; b: number };
  position: 'inside' | 'outside' | 'center';
  opacity: number;
}

interface NamingTemplate {
  id: string;
  name: string;
  pattern: string;
  variables: string[];
  examples: string[];
}

interface KeyboardShortcut {
  id: string;
  action: string;
  keys: string[];
  enabled: boolean;
}

interface PanelConfiguration {
  width: number;
  height: number;
  collapsedSections: string[];
  theme: 'auto' | 'light' | 'dark';
}

interface PerformanceSettings {
  maxLayersForAutoGrouping: number;
  enableProgressIndicators: boolean;
  batchOperationSize: number;
  memoryCleanupInterval: number;
}

interface GroupingOperation {
  id: string;
  timestamp: Date;
  layerIds: number[];
  groupName: string;
  reasoning: string;
  confidence: number;
}

interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
  e
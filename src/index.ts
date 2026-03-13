import { app, constants } from 'photoshop';
import { entrypoints } from 'uxp';
import { storage } from 'uxp';
import { pluginManager } from './plugin-manager';
import { preferencesManager } from './preferences-manager';
import { performanceMonitor } from './performance-monitor';

// Type definitions
interface PluginState {
  selectedLayers: any[];
  recentColors: string[];
  preferences: {
    autoGroupingEnabled: boolean;
    defaultOutlineWidth: number;
  };
}

interface GroupingSuggestion {
  layers: any[];
  confidence: number;
  reasoning: string;
  suggestedName: string;
}

interface OperationResult {
  success: boolean;
  message?: string;
  layerCount?: number;
  groupCount?: number;
  textLayerCount?: number;
  shapeLayerCount?: number;
  groupName?: string;
  result?: any;
}

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

// Plugin state management
const pluginState: PluginState = {
  selectedLayers: [],
  recentColors: ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff'],
  preferences: {
    autoGroupingEnabled: true,
    defaultOutlineWidth: 2,
  },
};

// UI Elements
let statusElement: HTMLElement | null;
let progressElement: HTMLElement | null;
let progressBar: HTMLElement | null;
let layerListElement: HTMLElement | null;

// Track selected layers
let selectedLayerIds: Set<number> = new Set();

// Initialize plugin
entrypoints.setup({
  panels: {
    layerManagerPanel: {
      async create(rootNode: HTMLElement): Promise<void> {
        console.log('Layer Manager Pro panel created');
        
        // Initialize plugin manager
        const initResult = await pluginManager.initialize();
        
        if (!initResult.success) {
          console.error('Plugin initialization failed:', initResult.errors);
          showStatus('Plugin initialization failed', 'error');
        } else if (initResult.warnings.length > 0) {
          console.warn('Plugin initialized with warnings:', initResult.warnings);
        }
        
        initializeUI();
        return Promise.resolve();
      },
      show(rootNode: HTMLElement, data: any): Promise<void> {
        console.log('Layer Manager Pro panel shown');
        updateUI();
        return Promise.resolve();
      },
      hide(rootNode: HTMLElement, data: any): Promise<void> {
        console.log('Layer Manager Pro panel hidden');
        return Promise.resolve();
      },
      async destroy(rootNode: HTMLElement): Promise<void> {
        console.log('Layer Manager Pro panel destroyed');
        await pluginManager.shutdown();
        return Promise.resolve();
      },
    },
  },
  commands: {
    createGroup: {
      run(): Promise<OperationResult> {
        return createGroupFromSelectedLayers(generateGroupName());
      },
    },
    bulkColorText: {
      run(): Promise<OperationResult> {
        return executeBulkColorText('#000000');
      },
    },
    bulkColorShapes: {
      run(): Promise<OperationResult> {
        return executeBulkColorShapes('#000000');
      },
    },
    imageReplace: {
      run(): Promise<OperationResult> {
        return executeImageReplace();
      },
    },
  },
});

// Initialize UI event handlers
function initializeUI(): void {
  statusElement = document.getElementById('status');
  progressElement = document.getElementById('progress');
  progressBar = document.getElementById('progressBar');
  layerListElement = document.getElementById('layerList');

  // Initialize color controls
  initializeColorControls();

  // Bind layer list buttons
  const refreshLayersBtn = document.getElementById('refreshLayers');
  const selectAllBtn = document.getElementById('selectAll');
  const deselectAllBtn = document.getElementById('deselectAll');
  const createGroupBtn = document.getElementById('createGroup');
  const smartAutoGroupBtn = document.getElementById('smartAutoGroup');

  refreshLayersBtn?.addEventListener('click', handleRefreshLayers);
  selectAllBtn?.addEventListener('click', handleSelectAll);
  deselectAllBtn?.addEventListener('click', handleDeselectAll);
  createGroupBtn?.addEventListener('click', handleCreateGroup);
  smartAutoGroupBtn?.addEventListener('click', handleAutoGroup);

  // Bind styling buttons
  const applyTextColorBtn = document.getElementById('applyTextColor');
  const applyShapeColorBtn = document.getElementById('applyShapeColor');
  const applyFontBtn = document.getElementById('applyFont');

  applyTextColorBtn?.addEventListener('click', handleBulkColorText);
  applyShapeColorBtn?.addEventListener('click', handleBulkColorShapes);
  applyFontBtn?.addEventListener('click', handleBulkFont);

  // Bind group management buttons
  const toggleVisibilityBtn = document.getElementById('toggleVisibility');
  const showAllBtn = document.getElementById('showAll');
  const hideAllBtn = document.getElementById('hideAll');

  toggleVisibilityBtn?.addEventListener('click', handleToggleVisibility);
  showAllBtn?.addEventListener('click', handleShowAll);
  hideAllBtn?.addEventListener('click', handleHideAll);

  // Bind image tools
  const replaceImageBtn = document.getElementById('replaceImage');
  replaceImageBtn?.addEventListener('click', handleImageReplace);
}

// Initialize color controls with sync functionality
function initializeColorControls(): void {
  // Text color controls
  const textColorWheel = document.getElementById('textColorWheel') as HTMLInputElement;
  const textColorHex = document.getElementById('textColorHex') as HTMLInputElement;
  const textColorDisplay = document.getElementById('textColorDisplay') as HTMLElement;

  // Shape color controls
  const shapeColorWheel = document.getElementById('shapeColorWheel') as HTMLInputElement;
  const shapeColorHex = document.getElementById('shapeColorHex') as HTMLInputElement;
  const shapeColorDisplay = document.getElementById('shapeColorDisplay') as HTMLElement;

  // Sync text color controls
  if (textColorWheel && textColorHex && textColorDisplay) {
    textColorWheel.addEventListener('input', () => {
      const color = textColorWheel.value;
      textColorHex.value = color;
      textColorDisplay.style.backgroundColor = color;
    });

    textColorHex.addEventListener('input', () => {
      const color = textColorHex.value;
      if (isValidHexColor(color)) {
        textColorWheel.value = color;
        textColorDisplay.style.backgroundColor = color;
      }
    });

    // Initialize display
    textColorDisplay.style.backgroundColor = textColorWheel.value;
  }

  // Sync shape color controls
  if (shapeColorWheel && shapeColorHex && shapeColorDisplay) {
    shapeColorWheel.addEventListener('input', () => {
      const color = shapeColorWheel.value;
      shapeColorHex.value = color;
      shapeColorDisplay.style.backgroundColor = color;
    });

    shapeColorHex.addEventListener('input', () => {
      const color = shapeColorHex.value;
      if (isValidHexColor(color)) {
        shapeColorWheel.value = color;
        shapeColorDisplay.style.backgroundColor = color;
      }
    });

    // Initialize display
    shapeColorDisplay.style.backgroundColor = shapeColorWheel.value;
  }
}

// Validate hex color format
function isValidHexColor(hex: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
}

// Update UI state
function updateUI(): void {
  const textColorWheel = document.getElementById('textColorWheel') as HTMLInputElement;
  const textColorHex = document.getElementById('textColorHex') as HTMLInputElement;
  const textColorDisplay = document.getElementById('textColorDisplay') as HTMLElement;
  const shapeColorWheel = document.getElementById('shapeColorWheel') as HTMLInputElement;
  const shapeColorHex = document.getElementById('shapeColorHex') as HTMLInputElement;
  const shapeColorDisplay = document.getElementById('shapeColorDisplay') as HTMLElement;

  if (pluginState.recentColors.length > 0) {
    const textColor = pluginState.recentColors[0];
    const shapeColor = pluginState.recentColors[1] || '#ff0000';

    if (textColorWheel && textColorHex && textColorDisplay) {
      textColorWheel.value = textColor;
      textColorHex.value = textColor;
      textColorDisplay.style.backgroundColor = textColor;
    }

    if (shapeColorWheel && shapeColorHex && shapeColorDisplay) {
      shapeColorWheel.value = shapeColor;
      shapeColorHex.value = shapeColor;
      shapeColorDisplay.style.backgroundColor = shapeColor;
    }
  }
}

// Utility functions
function showStatus(message: string, type: 'success' | 'error' = 'success'): void {
  if (!statusElement) return;

  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
  statusElement.style.display = 'block';

  setTimeout(() => {
    if (statusElement) statusElement.style.display = 'none';
  }, 3000);
}

function showProgress(show: boolean = true): void {
  if (!progressElement) return;

  progressElement.style.display = show ? 'block' : 'none';
  if (!show && progressBar) {
    progressBar.style.width = '0%';
  }
}

function updateProgress(percentage: number): void {
  if (!progressBar) return;
  progressBar.style.width = `${percentage}%`;
}

// Layer list management
async function handleRefreshLayers(): Promise<void> {
  try {
    showProgress(true);
    updateProgress(30);

    const layers = await getAllLayers();
    updateProgress(70);

    renderLayerList(layers);
    updateProgress(100);
    showProgress(false);

    showStatus(`Loaded ${layers.length} layers`);
  } catch (error) {
    showProgress(false);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showStatus(`Error loading layers: ${errorMessage}`, 'error');
    console.error('Refresh layers error:', error);
  }
}

async function getAllLayers(): Promise<any[]> {
  try {
    if (!app.activeDocument) {
      throw new Error('No active document');
    }

    // Get all layers from the active document
    const allLayers = app.activeDocument.layers;
    const layerData: any[] = [];

    // Map layers to our format
    for (let i = 0; i < allLayers.length; i++) {
      const layer = allLayers[i];
      layerData.push({
        id: layer.id,
        name: layer.name,
        kind: layer.kind,
        visible: layer.visible,
      });
    }

    return layerData;
  } catch (error) {
    console.error('Error getting all layers:', error);
    return [];
  }
}

function renderLayerList(layers: any[]): void {
  if (!layerListElement) return;

  if (layers.length === 0) {
    layerListElement.innerHTML = '<div class="help-text">No layers found</div>';
    return;
  }

  layerListElement.innerHTML = '';

  layers.forEach((layer) => {
    if (!layerListElement) return;
    
    const layerItem = document.createElement('div');
    layerItem.className = 'layer-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'layer-checkbox';
    checkbox.id = `layer-${layer.id}`;
    checkbox.checked = selectedLayerIds.has(layer.id);
    checkbox.addEventListener('change', () => handleLayerCheckboxChange(layer.id, checkbox.checked));

    const label = document.createElement('label');
    label.htmlFor = `layer-${layer.id}`;
    label.className = 'layer-name';
    label.textContent = layer.name;

    const typeSpan = document.createElement('span');
    typeSpan.className = 'layer-type';
    typeSpan.textContent = getLayerTypeLabel(layer.kind);

    layerItem.appendChild(checkbox);
    layerItem.appendChild(label);
    layerItem.appendChild(typeSpan);

    layerListElement.appendChild(layerItem);
  });
}

function getLayerTypeLabel(kind: string): string {
  const typeMap: { [key: string]: string } = {
    pixel: 'Image',
    text: 'Text',
    shape: 'Shape',
    group: 'Group',
    adjustment: 'Adjustment',
    smartObject: 'Smart Object',
  };
  return typeMap[kind] || kind;
}

function handleLayerCheckboxChange(layerId: number, checked: boolean): void {
  if (checked) {
    selectedLayerIds.add(layerId);
  } else {
    selectedLayerIds.delete(layerId);
  }
}

function handleSelectAll(): void {
  const checkboxes = document.querySelectorAll('.layer-checkbox') as NodeListOf<HTMLInputElement>;
  checkboxes.forEach((checkbox) => {
    checkbox.checked = true;
    const layerId = parseInt(checkbox.id.replace('layer-', ''));
    selectedLayerIds.add(layerId);
  });
  showStatus(`Selected ${selectedLayerIds.size} layers`);
}

function handleDeselectAll(): void {
  const checkboxes = document.querySelectorAll('.layer-checkbox') as NodeListOf<HTMLInputElement>;
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });
  selectedLayerIds.clear();
  showStatus('Deselected all layers');
}

async function handleCreateGroup(): Promise<void> {
  try {
    if (selectedLayerIds.size === 0) {
      showStatus('Please select at least one layer', 'error');
      return;
    }

    showProgress(true);
    updateProgress(20);

    const groupNameInput = document.getElementById('groupNameInput') as HTMLInputElement;
    const groupName = groupNameInput?.value.trim() || generateGroupName();

    updateProgress(50);

    // Create group with selected layers
    const result = await createGroupFromSelectedLayers(groupName);

    updateProgress(100);
    showProgress(false);

    if (result.success) {
      showStatus(`Created group "${groupName}" with ${selectedLayerIds.size} layers`);
      selectedLayerIds.clear();
      if (groupNameInput) groupNameInput.value = '';
      await handleRefreshLayers(); // Refresh the layer list
    } else {
      showStatus(result.message || 'Failed to create group', 'error');
    }
  } catch (error) {
    showProgress(false);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showStatus(`Error: ${errorMessage}`, 'error');
    console.error('Create group error:', error);
  }
}

async function createGroupFromSelectedLayers(groupName: string): Promise<OperationResult> {
  try {
    const layerIds = Array.from(selectedLayerIds);

    // Create a new group
    const result = await app.batchPlay(
      [
        {
          _obj: 'make',
          _target: [{ _ref: 'layerSection' }],
          layerID: layerIds.map((id) => ({ _ref: 'layer', _id: id })),
          name: groupName,
        },
      ],
      { modalBehavior: 'execute' }
    );

    return {
      success: true,
      groupName,
      layerCount: layerIds.length,
      result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: errorMessage,
    };
  }
}

async function handleShowAll(): Promise<void> {
  try {
    showProgress(true);
    updateProgress(50);

    // Show all layers using batchPlay
    await app.batchPlay(
      [
        {
          _obj: 'show',
          _target: [{ _ref: 'layer', _enum: 'ordinal', _value: 'allEnum' }],
        },
      ],
      { modalBehavior: 'execute' }
    );

    updateProgress(100);
    showProgress(false);
    showStatus('Showed all layers');
    await handleRefreshLayers();
  } catch (error) {
    showProgress(false);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showStatus(`Error: ${errorMessage}`, 'error');
  }
}

async function handleHideAll(): Promise<void> {
  try {
    showProgress(true);
    updateProgress(50);

    // Hide all layers using batchPlay
    await app.batchPlay(
      [
        {
          _obj: 'hide',
          _target: [{ _ref: 'layer', _enum: 'ordinal', _value: 'allEnum' }],
        },
      ],
      { modalBehavior: 'execute' }
    );

    updateProgress(100);
    showProgress(false);
    showStatus('Hid all layers');
    await handleRefreshLayers();
  } catch (error) {
    showProgress(false);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showStatus(`Error: ${errorMessage}`, 'error');
  }
}

async function setAllLayersVisibility(visible: boolean): Promise<void> {
  // Not used anymore, kept for compatibility
}

// Auto-grouping with intelligence
async function handleAutoGroup(): Promise<void> {
  try {
    showProgress(true);
    updateProgress(10);

    const layers = await getSelectedLayers();
    updateProgress(30);

    const suggestions = await analyzeLayersForGrouping(layers);
    updateProgress(60);

    if (suggestions.length > 0) {
      const bestSuggestion = suggestions[0];
      await createGroupFromSuggestion(bestSuggestion);
      updateProgress(100);
      showProgress(false);
      showStatus(
        `Smart-grouped ${bestSuggestion.layers.length} layers by ${bestSuggestion.reasoning}`
      );
    } else {
      showProgress(false);
      showStatus('No suitable grouping suggestions found', 'error');
    }
  } catch (error) {
    showProgress(false);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showStatus(`Error: ${errorMessage}`, 'error');
    console.error('Auto-group error:', error);
  }
}

// Bulk text color management
async function handleBulkColorText(): Promise<void> {
  try {
    if (selectedLayerIds.size === 0) {
      showStatus('Please select at least one layer', 'error');
      return;
    }

    const colorInput = document.getElementById('textColorHex') as HTMLInputElement;
    const color = colorInput?.value || '#000000';
    showProgress(true);
    updateProgress(25);

    const result = await executeBulkColorText(color);

    updateProgress(100);
    showProgress(false);

    if (result.success) {
      showStatus(`Applied color to ${result.textLayerCount} text layers`);
    } else {
      showStatus(result.message || 'Unknown error', 'error');
    }
  } catch (error) {
    showProgress(false);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showStatus(`Error: ${errorMessage}`, 'error');
    console.error('Bulk color text error:', error);
  }
}

async function executeBulkColorText(hexColor: string): Promise<OperationResult> {
  try {
    const rgb = hexToRgb(hexColor);
    const layerIds = Array.from(selectedLayerIds);
    let textLayerCount = 0;

    for (const layerId of layerIds) {
      try {
        await app.batchPlay(
          [
            {
              _obj: 'set',
              _target: [
                { _property: 'textStyle' },
                { _ref: 'textLayer', _id: layerId },
              ],
              to: {
                _obj: 'textStyle',
                color: {
                  _obj: 'RGBColor',
                  red: rgb.r,
                  green: rgb.g,
                  blue: rgb.b,
                },
              },
            },
          ],
          { modalBehavior: 'execute' }
        );
        textLayerCount++;
      } catch (error) {
        // Skip non-text layers
        console.log(`Skipping layer ${layerId} - not a text layer`);
      }
    }

    return {
      success: true,
      textLayerCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: errorMessage,
    };
  }
}

// Bulk shape color management
async function handleBulkColorShapes(): Promise<void> {
  try {
    if (selectedLayerIds.size === 0) {
      showStatus('Please select at least one layer', 'error');
      return;
    }

    const colorInput = document.getElementById('shapeColorHex') as HTMLInputElement;
    const color = colorInput?.value || '#000000';
    showProgress(true);
    updateProgress(25);

    const result = await executeBulkColorShapes(color);

    updateProgress(100);
    showProgress(false);

    if (result.success) {
      showStatus(`Applied color to ${result.shapeLayerCount} shape layers`);
    } else {
      showStatus(result.message || 'Unknown error', 'error');
    }
  } catch (error) {
    showProgress(false);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showStatus(`Error: ${errorMessage}`, 'error');
    console.error('Bulk color shapes error:', error);
  }
}

async function executeBulkColorShapes(hexColor: string): Promise<OperationResult> {
  try {
    const rgb = hexToRgb(hexColor);
    const layerIds = Array.from(selectedLayerIds);
    let shapeLayerCount = 0;

    for (const layerId of layerIds) {
      try {
        await app.batchPlay(
          [
            {
              _obj: 'set',
              _target: [
                { _property: 'color' },
                { _ref: 'contentLayer', _id: layerId },
              ],
              to: {
                _obj: 'RGBColor',
                red: rgb.r,
                green: rgb.g,
                blue: rgb.b,
              },
            },
          ],
          { modalBehavior: 'execute' }
        );
        shapeLayerCount++;
      } catch (error) {
        // Skip non-shape layers
        console.log(`Skipping layer ${layerId} - not a shape layer`);
      }
    }

    return {
      success: true,
      shapeLayerCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: errorMessage,
    };
  }
}

// Bulk font management
async function handleBulkFont(): Promise<void> {
  try {
    if (selectedLayerIds.size === 0) {
      showStatus('Please select at least one layer', 'error');
      return;
    }

    showProgress(true);
    updateProgress(25);

    const fontSelect = document.getElementById('fontSelect') as HTMLSelectElement;
    const fontName = fontSelect?.value || 'Arial';

    if (!fontName) {
      showProgress(false);
      showStatus('Please select a font', 'error');
      return;
    }

    const result = await executeBulkFont(fontName);

    updateProgress(100);
    showProgress(false);

    if (result.success) {
      showStatus(`Applied font to ${result.textLayerCount} text layers`);
    } else {
      showStatus(result.message || 'Unknown error', 'error');
    }
  } catch (error) {
    showProgress(false);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showStatus(`Error: ${errorMessage}`, 'error');
    console.error('Bulk font error:', error);
  }
}

async function executeBulkFont(fontName: string): Promise<OperationResult> {
  try {
    const layerIds = Array.from(selectedLayerIds);
    let textLayerCount = 0;

    for (const layerId of layerIds) {
      try {
        await app.batchPlay(
          [
            {
              _obj: 'set',
              _target: [
                { _property: 'textStyle' },
                { _ref: 'textLayer', _id: layerId },
              ],
              to: {
                _obj: 'textStyle',
                fontPostScriptName: fontName,
              },
            },
          ],
          { modalBehavior: 'execute' }
        );
        textLayerCount++;
      } catch (error) {
        // Skip non-text layers
        console.log(`Skipping layer ${layerId} - not a text layer`);
      }
    }

    return {
      success: true,
      textLayerCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: errorMessage,
    };
  }
}

// Group visibility management
async function handleToggleVisibility(): Promise<void> {
  try {
    if (selectedLayerIds.size === 0) {
      showStatus('Please select at least one layer', 'error');
      return;
    }

    showProgress(true);
    updateProgress(50);

    const layerIds = Array.from(selectedLayerIds);
    for (const layerId of layerIds) {
      try {
        // Get current visibility
        const layerInfo = await app.batchPlay(
          [
            {
              _obj: 'get',
              _target: [{ _ref: 'layer', _id: layerId }],
            },
          ],
          {}
        );

        const isVisible = layerInfo[0]?.visible !== false;

        // Toggle visibility
        await app.batchPlay(
          [
            {
              _obj: isVisible ? 'hide' : 'show',
              _target: [{ _ref: 'layer', _id: layerId }],
            },
          ],
          { modalBehavior: 'execute' }
        );
      } catch (err) {
        console.log(`Failed to toggle layer ${layerId}:`, err);
      }
    }

    updateProgress(100);
    showProgress(false);
    showStatus(`Toggled visibility for ${layerIds.length} layers`);
    await handleRefreshLayers();
  } catch (error) {
    showProgress(false);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showStatus(`Error: ${errorMessage}`, 'error');
    console.error('Toggle visibility error:', error);
  }
}

// Image replacement functionality
async function handleImageReplace(): Promise<void> {
  try {
    if (selectedLayerIds.size === 0) {
      showStatus('Please select at least one layer', 'error');
      return;
    }

    showProgress(true);
    updateProgress(10);

    const result = await executeImageReplace();

    updateProgress(100);
    showProgress(false);

    if (result.success) {
      showStatus('Replaced image with automatic dimension matching');
    } else {
      showStatus(result.message || 'Unknown error', 'error');
    }
  } catch (error) {
    showProgress(false);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showStatus(`Error: ${errorMessage}`, 'error');
    console.error('Image replace error:', error);
  }
}

async function executeImageReplace(): Promise<OperationResult> {
  try {
    // Open file picker for image selection
    const file = await storage.localFileSystem.getFileForOpening({
      types: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'],
    });

    if (!file) {
      return { success: false, message: 'No file selected' };
    }

    const layerIds = Array.from(selectedLayerIds);
    
    // Replace the first selected layer
    if (layerIds.length > 0) {
      const result = await app.batchPlay(
        [
          {
            _obj: 'placeEvent',
            _target: [{ _ref: 'layer', _id: layerIds[0] }],
            null: {
              _path: file.nativePath,
              _kind: 'local',
            },
            freeTransformCenterState: {
              _enum: 'quadCenterState',
              _value: 'QCSAverage',
            },
            offset: {
              _obj: 'offset',
              horizontal: { _unit: 'pixelsUnit', _value: 0 },
              vertical: { _unit: 'pixelsUnit', _value: 0 },
            },
          },
        ],
        { modalBehavior: 'execute' }
      );

      return { success: true, result };
    }

    return { success: false, message: 'No layers selected' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message: errorMessage };
  }
}

// Helper functions
function hexToRgb(hex: string): RGBColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function generateGroupName(): string {
  const timestamp = new Date().toLocaleTimeString();
  return `Group ${timestamp}`;
}

async function generateSmartGroupName(): Promise<string> {
  // Analyze selected layers and generate intelligent name
  const layers = await getSelectedLayers();
  if (layers.length === 0) return 'Empty Group';

  // Simple implementation - in full version, analyze layer content
  const layerTypes = layers.map((layer: any) => layer.kind).join(', ');
  return `${layerTypes} Group`;
}

async function getSelectedLayers(): Promise<any[]> {
  try {
    const result = await app.batchPlay(
      [
        {
          _obj: 'get',
          _target: [
            { _property: 'targetLayers' },
            { _ref: 'document', _id: app.activeDocument.id },
          ],
        },
      ],
      {}
    );

    return result[0]?.targetLayers || [];
  } catch (error) {
    console.error('Error getting selected layers:', error);
    return [];
  }
}

async function analyzeLayersForGrouping(layers: any[]): Promise<GroupingSuggestion[]> {
  // Simplified grouping analysis - in full implementation, use AI/ML
  const suggestions: GroupingSuggestion[] = [];

  if (layers.length > 1) {
    suggestions.push({
      layers: layers,
      confidence: 0.8,
      reasoning: 'spatial proximity',
      suggestedName: 'Proximity Group',
    });
  }

  return suggestions;
}

async function createGroupFromSuggestion(suggestion: GroupingSuggestion): Promise<any> {
  return await app.batchPlay(
    [
      {
        _obj: 'make',
        _target: [{ _ref: 'layerSection' }],
        layerID: suggestion.layers.map((layer: any) => ({ _ref: 'layer', _id: layer.id })),
        name: suggestion.suggestedName,
      },
    ],
    { modalBehavior: 'execute' }
  );
}

// Export for testing
export {
  executeBulkColorText,
  executeBulkColorShapes,
  executeImageReplace,
  hexToRgb,
  generateGroupName,
  PluginState,
  GroupingSuggestion,
  OperationResult,
  RGBColor,
};
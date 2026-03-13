// PSP1 - Layer Manager Pro
// Enhanced implementation with responsive UI and color wheel functionality

const { app } = require('photoshop');
const { entrypoints } = require('uxp');
const { storage } = require('uxp');

// Track selected layers
let selectedLayerIds = new Set();

// Initialize plugin
entrypoints.setup({
  panels: {
    layerManagerPanel: {
      create() {
        console.log('PSP1 panel created');
        setTimeout(() => initializeUI(), 100);
      }
    }
  }
});

// Initialize UI
function initializeUI() {
  console.log('Initializing UI...');
  
  // Refresh button
  const refreshBtn = document.getElementById('refreshLayers');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', handleRefreshLayers);
    console.log('Refresh button bound');
  }
  
  // Select All / Deselect All
  document.getElementById('selectAll')?.addEventListener('click', handleSelectAll);
  document.getElementById('deselectAll')?.addEventListener('click', handleDeselectAll);
  
  // Create Group
  document.getElementById('createGroup')?.addEventListener('click', handleCreateGroup);
  document.getElementById('smartAutoGroup')?.addEventListener('click', handleAutoGroup);
  
  // Color wheel and hex input synchronization
  setupColorControls('textColor', '#000000');
  setupColorControls('shapeColor', '#ff0000');
  
  // Styling buttons
  document.getElementById('applyTextColor')?.addEventListener('click', handleBulkColorText);
  document.getElementById('applyShapeColor')?.addEventListener('click', handleBulkColorShapes);
  document.getElementById('applyFont')?.addEventListener('click', handleBulkFont);
  
  // Visibility buttons
  document.getElementById('toggleVisibility')?.addEventListener('click', handleToggleVisibility);
  document.getElementById('showAll')?.addEventListener('click', handleShowAll);
  document.getElementById('hideAll')?.addEventListener('click', handleHideAll);
  
  // Image replace
  document.getElementById('replaceImage')?.addEventListener('click', handleImageReplace);
  
  // Update selection info periodically
  setInterval(updateSelectionInfo, 1000);
  
  console.log('UI initialized');
}

// Setup color controls with synchronization
function setupColorControls(colorType, defaultColor) {
  const wheel = document.getElementById(`${colorType}Wheel`);
  const hex = document.getElementById(`${colorType}Hex`);
  const display = document.getElementById(`${colorType}Display`);
  
  if (!wheel || !hex || !display) return;
  
  // Initialize with default color
  wheel.value = defaultColor;
  hex.value = defaultColor;
  display.style.backgroundColor = defaultColor;
  
  // Color wheel change
  wheel.addEventListener('input', (e) => {
    const color = e.target.value;
    hex.value = color.toUpperCase();
    display.style.backgroundColor = color;
    updateColorTarget(colorType);
  });
  
  // Hex input change
  hex.addEventListener('input', (e) => {
    let value = e.target.value;
    
    // Auto-add # if missing
    if (value && !value.startsWith('#')) {
      value = '#' + value;
      e.target.value = value;
    }
    
    // Validate hex color
    if (isValidHex(value)) {
      wheel.value = value;
      display.style.backgroundColor = value;
      updateColorTarget(colorType);
    }
  });
  
  // Hex input formatting
  hex.addEventListener('blur', (e) => {
    let value = e.target.value;
    if (value && !value.startsWith('#')) {
      value = '#' + value;
    }
    if (isValidHex(value)) {
      e.target.value = value.toUpperCase();
    } else {
      // Reset to wheel value if invalid
      e.target.value = wheel.value.toUpperCase();
    }
  });
  
  // Color display click - focus hex input
  display.addEventListener('click', () => {
    hex.focus();
    hex.select();
  });
}

// Validate hex color
function isValidHex(hex) {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
}

// Update color target info
function updateColorTarget(colorType) {
  const targetElement = document.getElementById(`${colorType}Target`);
  const applyButton = document.getElementById(`apply${colorType.charAt(0).toUpperCase() + colorType.slice(1)}Color`);
  
  if (selectedLayerIds.size === 0) {
    if (targetElement) targetElement.textContent = 'Select layers/groups first';
    if (applyButton) applyButton.disabled = true;
  } else {
    if (targetElement) targetElement.textContent = `Ready to apply to ${selectedLayerIds.size} selected layer(s)`;
    if (applyButton) applyButton.disabled = false;
  }
}

// Update selection info
function updateSelectionInfo() {
  const countElement = document.getElementById('selectionCount');
  const typesElement = document.getElementById('selectionTypes');
  
  if (countElement) {
    countElement.textContent = `${selectedLayerIds.size} selected`;
  }
  
  // Update color targets
  updateColorTarget('textColor');
  updateColorTarget('shapeColor');
  
  // Update font target
  const fontTarget = document.getElementById('fontTarget');
  const applyFont = document.getElementById('applyFont');
  if (selectedLayerIds.size === 0) {
    if (fontTarget) fontTarget.textContent = 'Select text layers/groups first';
    if (applyFont) applyFont.disabled = true;
  } else {
    if (fontTarget) fontTarget.textContent = `Ready to apply to ${selectedLayerIds.size} selected layer(s)`;
    if (applyFont) applyFont.disabled = false;
  }
}

// Refresh layers
async function handleRefreshLayers() {
  try {
    showStatus('Loading layers...');
    
    if (!app.activeDocument) {
      showStatus('No active document', 'error');
      return;
    }
    
    const layers = app.activeDocument.layers;
    const layerList = document.getElementById('layerList');
    
    if (!layerList) return;
    
    layerList.innerHTML = '';
    
    if (layers.length === 0) {
      layerList.innerHTML = '<div class="help-text">No layers found</div>';
      return;
    }
    
    layers.forEach(layer => {
      const item = document.createElement('div');
      item.className = 'layer-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'layer-checkbox';
      checkbox.id = `layer-${layer.id}`;
      checkbox.checked = selectedLayerIds.has(layer.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          selectedLayerIds.add(layer.id);
        } else {
          selectedLayerIds.delete(layer.id);
        }
        updateSelectionInfo();
      });
      
      const label = document.createElement('label');
      label.htmlFor = `layer-${layer.id}`;
      label.className = 'layer-name';
      label.textContent = layer.name || 'Unnamed Layer';
      
      const type = document.createElement('span');
      type.className = 'layer-type';
      type.textContent = layer.kind || 'layer';
      
      item.appendChild(checkbox);
      item.appendChild(label);
      item.appendChild(type);
      layerList.appendChild(item);
    });
    
    showStatus(`Loaded ${layers.length} layers`);
    updateSelectionInfo();
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
    console.error('Refresh error:', error);
  }
}

// Select All / Deselect All
function handleSelectAll() {
  document.querySelectorAll('.layer-checkbox').forEach(cb => {
    cb.checked = true;
    const layerId = parseInt(cb.id.replace('layer-', ''));
    selectedLayerIds.add(layerId);
  });
  updateSelectionInfo();
  showStatus(`Selected ${selectedLayerIds.size} layers`);
}

function handleDeselectAll() {
  document.querySelectorAll('.layer-checkbox').forEach(cb => cb.checked = false);
  selectedLayerIds.clear();
  updateSelectionInfo();
  showStatus('Deselected all layers');
}

// Create Group
async function handleCreateGroup() {
  if (selectedLayerIds.size === 0) {
    showStatus('Please select at least one layer', 'error');
    return;
  }
  
  try {
    showProgress(true);
    await require('photoshop').core.executeAsModal(async () => {
      const groupName = document.getElementById('groupNameInput')?.value || `Group ${new Date().toLocaleTimeString()}`;
      const layerIds = Array.from(selectedLayerIds);
      
      await require('photoshop').action.batchPlay([{
        _obj: 'make',
        _target: [{ _ref: 'layerSection' }],
        layerID: layerIds.map(id => ({ _ref: 'layer', _id: id })),
        name: groupName
      }], { modalBehavior: 'execute' });
      
      showStatus(`Created group "${groupName}"`);
      selectedLayerIds.clear();
      document.getElementById('groupNameInput').value = '';
      await handleRefreshLayers();
    }, { commandName: 'Create Group' });
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    showProgress(false);
  }
}

async function handleAutoGroup() {
  showStatus('Smart auto-group feature coming soon!');
}

// Bulk styling
async function handleBulkColorText() {
  if (selectedLayerIds.size === 0) {
    showStatus('Please select layers', 'error');
    return;
  }
  
  try {
    showProgress(true);
    const color = document.getElementById('textColorWheel').value;
    const rgb = hexToRgb(color);
    let count = 0;
    
    await require('photoshop').core.executeAsModal(async () => {
      for (const layerId of selectedLayerIds) {
        try {
          await require('photoshop').action.batchPlay([{
            _obj: 'set',
            _target: [{ _property: 'textStyle' }, { _ref: 'textLayer', _id: layerId }],
            to: {
              _obj: 'textStyle',
              color: { _obj: 'RGBColor', red: rgb.r, green: rgb.g, blue: rgb.b }
            }
          }], { modalBehavior: 'execute' });
          count++;
        } catch (e) {
          // Layer might not be a text layer, skip silently
        }
      }
    }, { commandName: 'Apply Text Color' });
    
    showStatus(`Applied color to ${count} text layers`);
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    showProgress(false);
  }
}

async function handleBulkColorShapes() {
  if (selectedLayerIds.size === 0) {
    showStatus('Please select layers', 'error');
    return;
  }
  
  try {
    showProgress(true);
    const color = document.getElementById('shapeColorWheel').value;
    const rgb = hexToRgb(color);
    let count = 0;
    
    await require('photoshop').core.executeAsModal(async () => {
      for (const layerId of selectedLayerIds) {
        try {
          await require('photoshop').action.batchPlay([{
            _obj: 'set',
            _target: [{ _property: 'color' }, { _ref: 'contentLayer', _id: layerId }],
            to: { _obj: 'RGBColor', red: rgb.r, green: rgb.g, blue: rgb.b }
          }], { modalBehavior: 'execute' });
          count++;
        } catch (e) {
          // Layer might not be a shape layer, skip silently
        }
      }
    }, { commandName: 'Apply Shape Color' });
    
    showStatus(`Applied color to ${count} shape layers`);
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    showProgress(false);
  }
}

async function handleBulkFont() {
  if (selectedLayerIds.size === 0) {
    showStatus('Please select layers', 'error');
    return;
  }
  
  const fontSelect = document.getElementById('fontSelect');
  const selectedFont = fontSelect.value;
  
  if (!selectedFont) {
    showStatus('Please select a font', 'error');
    return;
  }
  
  try {
    showProgress(true);
    let count = 0;
    
    await require('photoshop').core.executeAsModal(async () => {
      for (const layerId of selectedLayerIds) {
        try {
          await require('photoshop').action.batchPlay([{
            _obj: 'set',
            _target: [{ _property: 'textStyle' }, { _ref: 'textLayer', _id: layerId }],
            to: {
              _obj: 'textStyle',
              fontName: selectedFont
            }
          }], { modalBehavior: 'execute' });
          count++;
        } catch (e) {
          // Layer might not be a text layer, skip silently
        }
      }
    }, { commandName: 'Apply Font' });
    
    showStatus(`Applied font to ${count} text layers`);
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    showProgress(false);
  }
}

// Visibility
async function handleToggleVisibility() {
  if (selectedLayerIds.size === 0) {
    showStatus('Please select layers', 'error');
    return;
  }
  
  try {
    showProgress(true);
    await require('photoshop').core.executeAsModal(async () => {
      for (const layerId of selectedLayerIds) {
        const layer = app.activeDocument.layers.find(l => l.id === layerId);
        if (layer) layer.visible = !layer.visible;
      }
    }, { commandName: 'Toggle Visibility' });
    
    showStatus('Toggled visibility');
    await handleRefreshLayers();
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    showProgress(false);
  }
}

async function handleShowAll() {
  try {
    showProgress(true);
    await require('photoshop').core.executeAsModal(async () => {
      app.activeDocument.layers.forEach(layer => layer.visible = true);
    }, { commandName: 'Show All' });
    
    showStatus('Showed all layers');
    await handleRefreshLayers();
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    showProgress(false);
  }
}

async function handleHideAll() {
  try {
    showProgress(true);
    await require('photoshop').core.executeAsModal(async () => {
      app.activeDocument.layers.forEach(layer => layer.visible = false);
    }, { commandName: 'Hide All' });
    
    showStatus('Hid all layers');
    await handleRefreshLayers();
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    showProgress(false);
  }
}

async function handleImageReplace() {
  showStatus('Image replace feature coming soon!');
}

// Utility functions
function showStatus(message, type = 'success') {
  const status = document.getElementById('status');
  if (!status) return;
  
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';
  
  setTimeout(() => status.style.display = 'none', 3000);
}

function showProgress(show) {
  const progress = document.getElementById('progress');
  if (!progress) return;
  
  progress.style.display = show ? 'block' : 'none';
  
  if (show) {
    const bar = document.getElementById('progressBar');
    if (bar) {
      bar.style.width = '0%';
      setTimeout(() => bar.style.width = '100%', 100);
    }
  }
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

console.log('PSP1 plugin loaded with enhanced UI');
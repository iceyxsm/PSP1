// PSP1 - Layer Manager Pro
// Simple working implementation

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
  
  console.log('UI initialized');
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
      layerList.innerHTML = '<sp-body class="help-text">No layers found</sp-body>';
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
      });
      
      const label = document.createElement('label');
      label.htmlFor = `layer-${layer.id}`;
      label.className = 'layer-name';
      label.textContent = layer.name;
      
      const type = document.createElement('span');
      type.className = 'layer-type';
      type.textContent = layer.kind;
      
      item.appendChild(checkbox);
      item.appendChild(label);
      item.appendChild(type);
      layerList.appendChild(item);
    });
    
    showStatus(`Loaded ${layers.length} layers`);
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
  showStatus(`Selected ${selectedLayerIds.size} layers`);
}

function handleDeselectAll() {
  document.querySelectorAll('.layer-checkbox').forEach(cb => cb.checked = false);
  selectedLayerIds.clear();
  showStatus('Deselected all layers');
}

// Create Group
async function handleCreateGroup() {
  if (selectedLayerIds.size === 0) {
    showStatus('Please select at least one layer', 'error');
    return;
  }
  
  try {
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
  }
}

async function handleAutoGroup() {
  showStatus('Auto-group not yet implemented');
}

// Bulk styling
async function handleBulkColorText() {
  if (selectedLayerIds.size === 0) {
    showStatus('Please select layers', 'error');
    return;
  }
  
  try {
    const color = document.getElementById('textColor').value;
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
        } catch (e) {}
      }
    }, { commandName: 'Apply Text Color' });
    
    showStatus(`Applied color to ${count} text layers`);
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  }
}

async function handleBulkColorShapes() {
  if (selectedLayerIds.size === 0) {
    showStatus('Please select layers', 'error');
    return;
  }
  
  try {
    const color = document.getElementById('shapeColor').value;
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
        } catch (e) {}
      }
    }, { commandName: 'Apply Shape Color' });
    
    showStatus(`Applied color to ${count} shape layers`);
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  }
}

async function handleBulkFont() {
  showStatus('Font change not yet implemented');
}

// Visibility
async function handleToggleVisibility() {
  if (selectedLayerIds.size === 0) {
    showStatus('Please select layers', 'error');
    return;
  }
  
  try {
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
  }
}

async function handleShowAll() {
  try {
    await require('photoshop').core.executeAsModal(async () => {
      app.activeDocument.layers.forEach(layer => layer.visible = true);
    }, { commandName: 'Show All' });
    
    showStatus('Showed all layers');
    await handleRefreshLayers();
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  }
}

async function handleHideAll() {
  try {
    await require('photoshop').core.executeAsModal(async () => {
      app.activeDocument.layers.forEach(layer => layer.visible = false);
    }, { commandName: 'Hide All' });
    
    showStatus('Hid all layers');
    await handleRefreshLayers();
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  }
}

async function handleImageReplace() {
  showStatus('Image replace not yet implemented');
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

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

console.log('PSP1 plugin loaded');

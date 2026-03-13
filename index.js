// PSP1 - Simple Grouper
// Minimal plugin focused on layer grouping

const { app } = require('photoshop');
const { entrypoints } = require('uxp');

// Track selected layers
let selectedLayers = new Set();

// Initialize plugin
entrypoints.setup({
    panels: {
        layerManagerPanel: {
            create() {
                console.log('PSP1 Simple Grouper loaded');
                initializeUI();
            }
        }
    }
});

function initializeUI() {
    console.log('Initializing UI...');
    
    // Bind event handlers
    document.getElementById('refreshLayers').addEventListener('click', loadLayers);
    document.getElementById('createGroup').addEventListener('click', createGroup);
    
    // Auto-load layers if document is open
    setTimeout(() => {
        if (app.activeDocument) {
            loadLayers();
        }
    }, 500);
    
    console.log('UI initialized');
}

async function loadLayers() {
    console.log('Loading layers...');
    showStatus('Loading layers...', 'success');
    
    try {
        if (!app.activeDocument) {
            showStatus('No document open', 'error');
            return;
        }
        
        const layers = app.activeDocument.layers;
        const layerList = document.getElementById('layerList');
        
        layerList.innerHTML = '';
        selectedLayers.clear();
        
        if (layers.length === 0) {
            layerList.innerHTML = '<p>No layers found</p>';
            return;
        }
        
        layers.forEach(layer => {
            const item = document.createElement('div');
            item.className = 'layer-item';
            item.dataset.layerId = layer.id;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'layer-checkbox';
            checkbox.addEventListener('change', () => toggleLayerSelection(layer.id, checkbox.checked));
            
            const name = document.createElement('span');
            name.className = 'layer-name';
            name.textContent = layer.name || 'Unnamed Layer';
            
            item.appendChild(checkbox);
            item.appendChild(name);
            layerList.appendChild(item);
        });
        
        showStatus(`Loaded ${layers.length} layers`, 'success');
        
    } catch (error) {
        console.error('Error loading layers:', error);
        showStatus(`Error: ${error.message}`, 'error');
    }
}

function toggleLayerSelection(layerId, selected) {
    if (selected) {
        selectedLayers.add(layerId);
    } else {
        selectedLayers.delete(layerId);
    }
    
    console.log(`Selected layers: ${Array.from(selectedLayers).join(', ')}`);
}

async function createGroup() {
    console.log('Create Group clicked!');
    
    if (selectedLayers.size === 0) {
        showStatus('Please select at least one layer', 'error');
        return;
    }
    
    try {
        showStatus('Creating group...', 'success');
        
        await app.batchPlay([{
            _obj: 'make',
            _target: [{ _ref: 'layerSection' }],
            layerID: Array.from(selectedLayers).map(id => ({ _ref: 'layer', _id: id })),
            name: document.getElementById('groupName').value || `Group ${new Date().toLocaleTimeString()}`
        }], { modalBehavior: 'execute' });
        
        showStatus('Group created successfully!', 'success');
        
        // Clear selections and reload
        selectedLayers.clear();
        document.getElementById('groupName').value = '';
        setTimeout(loadLayers, 500);
        
    } catch (error) {
        console.error('Error creating group:', error);
        showStatus(`Error: ${error.message}`, 'error');
    }
}

function showStatus(message, type = 'success') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
}

console.log('PSP1 Simple Grouper script loaded');
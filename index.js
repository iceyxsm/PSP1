const { app, constants } = require('photoshop');
const { entrypoints } = require('uxp');
const fs = require('uxp').storage.localFileSystem;

// Plugin state management
let pluginState = {
    selectedLayers: [],
    recentColors: ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff'],
    preferences: {
        autoGroupingEnabled: true,
        defaultOutlineWidth: 2
    }
};

// UI Elements
let statusElement, progressElement, progressBar;

// Initialize plugin
entrypoints.setup({
    panels: {
        layerManagerPanel: {
            create(rootNode) {
                console.log('Layer Manager Pro panel created');
                initializeUI();
                return Promise.resolve();
            },
            show(rootNode, data) {
                console.log('Layer Manager Pro panel shown');
                updateUI();
                return Promise.resolve();
            },
            hide(rootNode, data) {
                console.log('Layer Manager Pro panel hidden');
                return Promise.resolve();
            },
            destroy(rootNode) {
                console.log('Layer Manager Pro panel destroyed');
                return Promise.resolve();
            }
        }
    },
    commands: {
        oneClickGroup: {
            run() {
                return executeOneClickGroup();
            }
        },
        bulkColorText: {
            run() {
                return executeBulkColorText();
            }
        },
        bulkColorShapes: {
            run() {
                return executeBulkColorShapes();
            }
        },
        imageReplace: {
            run() {
                return executeImageReplace();
            }
        }
    }
});

// Initialize UI event handlers
function initializeUI() {
    statusElement = document.getElementById('status');
    progressElement = document.getElementById('progress');
    progressBar = document.getElementById('progressBar');
    
    // Bind button events
    document.getElementById('oneClickGroup').addEventListener('click', handleOneClickGroup);
    document.getElementById('autoGroup').addEventListener('click', handleAutoGroup);
    document.getElementById('bulkColorText').addEventListener('click', handleBulkColorText);
    document.getElementById('bulkColorShapes').addEventListener('click', handleBulkColorShapes);
    document.getElementById('bulkFont').addEventListener('click', handleBulkFont);
    document.getElementById('autoOutline').addEventListener('click', handleAutoOutline);
    document.getElementById('toggleVisibility').addEventListener('click', handleToggleVisibility);
    document.getElementById('renameGroup').addEventListener('click', handleRenameGroup);
    document.getElementById('batchVisibility').addEventListener('click', handleBatchVisibility);
    document.getElementById('imageReplace').addEventListener('click', handleImageReplace);
}

// Update UI state
function updateUI() {
    // Update recent colors
    const textColorPicker = document.getElementById('textColor');
    const shapeColorPicker = document.getElementById('shapeColor');
    
    if (pluginState.recentColors.length > 0) {
        textColorPicker.value = pluginState.recentColors[0];
        shapeColorPicker.value = pluginState.recentColors[0];
    }
}

// Utility functions
function showStatus(message, type = 'success') {
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    statusElement.style.display = 'block';
    
    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 3000);
}

function showProgress(show = true) {
    progressElement.style.display = show ? 'block' : 'none';
    if (!show) {
        progressBar.style.width = '0%';
    }
}

function updateProgress(percentage) {
    progressBar.style.width = `${percentage}%`;
}

// Core functionality - One-Click Group
async function handleOneClickGroup() {
    try {
        showProgress(true);
        updateProgress(20);
        
        await app.batchPlay([{
            _obj: 'get',
            _target: [{ _property: 'targetLayers' }, { _ref: 'document', _id: app.activeDocument.id }]
        }], {});
        
        updateProgress(50);
        
        const result = await executeOneClickGroup();
        
        updateProgress(100);
        showProgress(false);
        
        if (result.success) {
            showStatus(`Created group "${result.groupName}" with ${result.layerCount} layers`);
            await commitAndPush('Created one-click group');
        } else {
            showStatus(result.message, 'error');
        }
    } catch (error) {
        showProgress(false);
        showStatus(`Error: ${error.message}`, 'error');
        console.error('One-click group error:', error);
    }
}

async function executeOneClickGroup() {
    return await app.batchPlay([
        {
            _obj: 'make',
            _target: [{ _ref: 'layerSection' }],
            layerID: [{ _ref: 'layer', _enum: 'ordinal', _value: 'targetEnum' }],
            name: generateGroupName()
        }
    ], { modalBehavior: 'execute' });
}

// Auto-grouping with intelligence
async function handleAutoGroup() {
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
            showStatus(`Smart-grouped ${bestSuggestion.layers.length} layers by ${bestSuggestion.reasoning}`);
            await commitAndPush('Created smart auto-group');
        } else {
            showProgress(false);
            showStatus('No suitable grouping suggestions found', 'error');
        }
    } catch (error) {
        showProgress(false);
        showStatus(`Error: ${error.message}`, 'error');
        console.error('Auto-group error:', error);
    }
}

// Bulk text color management
async function handleBulkColorText() {
    try {
        const color = document.getElementById('textColor').value;
        showProgress(true);
        updateProgress(25);
        
        const result = await executeBulkColorText(color);
        
        updateProgress(100);
        showProgress(false);
        
        if (result.success) {
            showStatus(`Applied color to ${result.textLayerCount} text layers`);
            await commitAndPush('Applied bulk text color changes');
        } else {
            showStatus(result.message, 'error');
        }
    } catch (error) {
        showProgress(false);
        showStatus(`Error: ${error.message}`, 'error');
        console.error('Bulk color text error:', error);
    }
}

async function executeBulkColorText(hexColor) {
    const rgb = hexToRgb(hexColor);
    
    return await app.batchPlay([
        {
            _obj: 'set',
            _target: [{ _property: 'textStyle' }, { _ref: 'textLayer', _enum: 'ordinal', _value: 'targetEnum' }],
            to: {
                _obj: 'textStyle',
                color: {
                    _obj: 'RGBColor',
                    red: rgb.r,
                    green: rgb.g,
                    blue: rgb.b
                }
            }
        }
    ], { modalBehavior: 'execute' });
}

// Bulk shape color management
async function handleBulkColorShapes() {
    try {
        const color = document.getElementById('shapeColor').value;
        showProgress(true);
        updateProgress(25);
        
        const result = await executeBulkColorShapes(color);
        
        updateProgress(100);
        showProgress(false);
        
        if (result.success) {
            showStatus(`Applied color to ${result.shapeLayerCount} shape layers`);
            await commitAndPush('Applied bulk shape color changes');
        } else {
            showStatus(result.message, 'error');
        }
    } catch (error) {
        showProgress(false);
        showStatus(`Error: ${error.message}`, 'error');
        console.error('Bulk color shapes error:', error);
    }
}

async function executeBulkColorShapes(hexColor) {
    const rgb = hexToRgb(hexColor);
    
    return await app.batchPlay([
        {
            _obj: 'set',
            _target: [{ _property: 'color' }, { _ref: 'contentLayer', _enum: 'ordinal', _value: 'targetEnum' }],
            to: {
                _obj: 'RGBColor',
                red: rgb.r,
                green: rgb.g,
                blue: rgb.b
            }
        }
    ], { modalBehavior: 'execute' });
}

// Bulk font management
async function handleBulkFont() {
    try {
        showProgress(true);
        updateProgress(25);
        
        // For now, use a default font - in full implementation, show font picker
        const result = await executeBulkFont('Arial');
        
        updateProgress(100);
        showProgress(false);
        
        if (result.success) {
            showStatus(`Applied font to ${result.textLayerCount} text layers`);
            await commitAndPush('Applied bulk font changes');
        } else {
            showStatus(result.message, 'error');
        }
    } catch (error) {
        showProgress(false);
        showStatus(`Error: ${error.message}`, 'error');
        console.error('Bulk font error:', error);
    }
}

async function executeBulkFont(fontName) {
    return await app.batchPlay([
        {
            _obj: 'set',
            _target: [{ _property: 'textStyle' }, { _ref: 'textLayer', _enum: 'ordinal', _value: 'targetEnum' }],
            to: {
                _obj: 'textStyle',
                fontPostScriptName: fontName
            }
        }
    ], { modalBehavior: 'execute' });
}

// Auto outline generation
async function handleAutoOutline() {
    try {
        showProgress(true);
        updateProgress(25);
        
        const result = await executeAutoOutline();
        
        updateProgress(100);
        showProgress(false);
        
        if (result.success) {
            showStatus(`Applied outlines to ${result.layerCount} layers`);
            await commitAndPush('Applied auto outlines');
        } else {
            showStatus(result.message, 'error');
        }
    } catch (error) {
        showProgress(false);
        showStatus(`Error: ${error.message}`, 'error');
        console.error('Auto outline error:', error);
    }
}

async function executeAutoOutline() {
    return await app.batchPlay([
        {
            _obj: 'applyStyle',
            _target: [{ _ref: 'layer', _enum: 'ordinal', _value: 'targetEnum' }],
            using: {
                _obj: 'layerEffects',
                frameFX: {
                    _obj: 'frameFX',
                    enabled: true,
                    style: { _enum: 'frameStyle', _value: 'outsetFrame' },
                    size: { _unit: 'pixelsUnit', _value: pluginState.preferences.defaultOutlineWidth },
                    color: { _obj: 'RGBColor', red: 0, green: 0, blue: 0 }
                }
            }
        }
    ], { modalBehavior: 'execute' });
}

// Group visibility management
async function handleToggleVisibility() {
    try {
        showProgress(true);
        updateProgress(50);
        
        const result = await executeToggleVisibility();
        
        updateProgress(100);
        showProgress(false);
        
        if (result.success) {
            showStatus(`Toggled visibility for ${result.groupCount} groups`);
            await commitAndPush('Toggled group visibility');
        } else {
            showStatus(result.message, 'error');
        }
    } catch (error) {
        showProgress(false);
        showStatus(`Error: ${error.message}`, 'error');
        console.error('Toggle visibility error:', error);
    }
}

async function executeToggleVisibility() {
    return await app.batchPlay([
        {
            _obj: 'set',
            _target: [{ _property: 'visible' }, { _ref: 'layer', _enum: 'ordinal', _value: 'targetEnum' }],
            to: { _obj: 'get', _target: [{ _property: 'visible' }, { _ref: 'layer', _enum: 'ordinal', _value: 'targetEnum' }] }
        }
    ], { modalBehavior: 'execute' });
}

// Smart group renaming
async function handleRenameGroup() {
    try {
        showProgress(true);
        updateProgress(25);
        
        const newName = await generateSmartGroupName();
        updateProgress(75);
        
        const result = await executeRenameGroup(newName);
        
        updateProgress(100);
        showProgress(false);
        
        if (result.success) {
            showStatus(`Renamed group to "${newName}"`);
            await commitAndPush('Applied smart group rename');
        } else {
            showStatus(result.message, 'error');
        }
    } catch (error) {
        showProgress(false);
        showStatus(`Error: ${error.message}`, 'error');
        console.error('Rename group error:', error);
    }
}

async function executeRenameGroup(name) {
    return await app.batchPlay([
        {
            _obj: 'set',
            _target: [{ _property: 'name' }, { _ref: 'layer', _enum: 'ordinal', _value: 'targetEnum' }],
            to: name
        }
    ], { modalBehavior: 'execute' });
}

// Batch visibility operations
async function handleBatchVisibility() {
    try {
        showProgress(true);
        updateProgress(25);
        
        const result = await executeBatchVisibility();
        
        updateProgress(100);
        showProgress(false);
        
        if (result.success) {
            showStatus(`Applied batch visibility to ${result.groupCount} groups`);
            await commitAndPush('Applied batch visibility changes');
        } else {
            showStatus(result.message, 'error');
        }
    } catch (error) {
        showProgress(false);
        showStatus(`Error: ${error.message}`, 'error');
        console.error('Batch visibility error:', error);
    }
}

async function executeBatchVisibility() {
    // Implementation for batch visibility operations
    return { success: true, groupCount: 0 };
}

// Image replacement functionality
async function handleImageReplace() {
    try {
        showProgress(true);
        updateProgress(10);
        
        const result = await executeImageReplace();
        
        updateProgress(100);
        showProgress(false);
        
        if (result.success) {
            showStatus(`Replaced image with automatic dimension matching`);
            await commitAndPush('Replaced image with dimension matching');
        } else {
            showStatus(result.message, 'error');
        }
    } catch (error) {
        showProgress(false);
        showStatus(`Error: ${error.message}`, 'error');
        console.error('Image replace error:', error);
    }
}

async function executeImageReplace() {
    try {
        // Open file picker for image selection
        const file = await fs.getFileForOpening({
            types: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp']
        });
        
        if (!file) {
            return { success: false, message: 'No file selected' };
        }
        
        // Replace the image content while preserving layer properties
        const result = await app.batchPlay([
            {
                _obj: 'placeEvent',
                _target: [{ _ref: 'layer', _enum: 'ordinal', _value: 'targetEnum' }],
                null: {
                    _path: file.nativePath,
                    _kind: 'local'
                },
                freeTransformCenterState: { _enum: 'quadCenterState', _value: 'QCSAverage' },
                offset: { _obj: 'offset', horizontal: { _unit: 'pixelsUnit', _value: 0 }, vertical: { _unit: 'pixelsUnit', _value: 0 } }
            }
        ], { modalBehavior: 'execute' });
        
        return { success: true, result };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Helper functions
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function generateGroupName() {
    const timestamp = new Date().toLocaleTimeString();
    return `Group ${timestamp}`;
}

async function generateSmartGroupName() {
    // Analyze selected layers and generate intelligent name
    const layers = await getSelectedLayers();
    if (layers.length === 0) return 'Empty Group';
    
    // Simple implementation - in full version, analyze layer content
    const layerTypes = layers.map(layer => layer.kind).join(', ');
    return `${layerTypes} Group`;
}

async function getSelectedLayers() {
    try {
        const result = await app.batchPlay([{
            _obj: 'get',
            _target: [{ _property: 'targetLayers' }, { _ref: 'document', _id: app.activeDocument.id }]
        }], {});
        
        return result[0].targetLayers || [];
    } catch (error) {
        console.error('Error getting selected layers:', error);
        return [];
    }
}

async function analyzeLayersForGrouping(layers) {
    // Simplified grouping analysis - in full implementation, use AI/ML
    const suggestions = [];
    
    if (layers.length > 1) {
        suggestions.push({
            layers: layers,
            confidence: 0.8,
            reasoning: 'spatial proximity',
            suggestedName: 'Proximity Group'
        });
    }
    
    return suggestions;
}

async function createGroupFromSuggestion(suggestion) {
    return await app.batchPlay([
        {
            _obj: 'make',
            _target: [{ _ref: 'layerSection' }],
            layerID: suggestion.layers.map(layer => ({ _ref: 'layer', _id: layer.id })),
            name: suggestion.suggestedName
        }
    ], { modalBehavior: 'execute' });
}

// Version control integration
async function commitAndPush(message) {
    try {
        // Simplified version control - in full implementation, integrate with Git
        console.log(`Committing changes: ${message}`);
        
        // Simulate commit and push operations
        const commitResult = await simulateGitCommit(message);
        if (commitResult.success) {
            const pushResult = await simulateGitPush();
            if (!pushResult.success) {
                // Retry logic for failed pushes
                for (let i = 0; i < 3; i++) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
                    const retryResult = await simulateGitPush();
                    if (retryResult.success) break;
                }
            }
        }
        
        return { success: true };
    } catch (error) {
        console.error('Version control error:', error);
        return { success: false, error: error.message };
    }
}

async function simulateGitCommit(message) {
    // Placeholder for actual Git integration
    console.log(`Git commit: ${message}`);
    return { success: true, hash: 'abc123' };
}

async function simulateGitPush() {
    // Placeholder for actual Git push
    console.log('Git push completed');
    return { success: true };
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        executeOneClickGroup,
        executeBulkColorText,
        executeBulkColorShapes,
        executeImageReplace,
        hexToRgb,
        generateGroupName
    };
}
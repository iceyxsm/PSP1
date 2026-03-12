# Layer Manager Pro - Photoshop Plugin

Advanced layer management plugin for Adobe Photoshop 2025 with one-tap operations, bulk styling, and intelligent automation.

## Features

### 🗂️ One-Tap Layer Grouping
- Select multiple layers and create groups with a single click
- Intelligent auto-grouping based on content similarity and spatial relationships
- Automatic group naming based on layer content analysis

### 🎨 Bulk Styling Operations
- **Text Color Management**: Change colors for all text layers in a group simultaneously
- **Shape Color Management**: Apply colors to icons and shapes with one tap
- **Font Management**: Change fonts across multiple text layers automatically
- **Auto Outline Generation**: Apply consistent stroke effects to selected elements

### 👁️ Enhanced Group Management
- One-click visibility toggle for groups
- Batch visibility operations for multiple groups
- Smart group renaming with auto-complete suggestions
- Keyboard shortcuts for power users

### 🖼️ Image Replacement Tools
- Tap-select image replacement with automatic dimension matching
- Preserves layer properties (blend modes, opacity, effects)
- Maintains positioning and layer stack order

### ⚡ Performance & Integration
- Operations complete within 500ms for up to 50 layers
- Seamless Photoshop undo/redo integration
- Automatic version control with Git commits and pushes
- Memory efficient with automatic cleanup

## Installation

### Prerequisites
- Adobe Photoshop 2025 or later
- Windows 10/11 (macOS support coming soon)

### Install from CCX Package
1. Download the latest `.ccx` file from [Releases](https://github.com/your-username/photoshop-layer-manager-plugin/releases)
2. Double-click the `.ccx` file to install
3. Restart Photoshop
4. Find "Layer Manager Pro" in Window → Plugins

### Development Installation
1. Clone this repository
2. Install dependencies: `npm install`
3. Build the plugin: `npm run build`
4. Load in Photoshop using UXP Developer Tools

## Usage

### Quick Start
1. Open Photoshop and create/open a document with multiple layers
2. Open Layer Manager Pro panel: Window → Plugins → Layer Manager Pro
3. Select layers you want to group
4. Click "🗂️ One-Click Group" to create an organized group

### Bulk Styling
1. Select a group or multiple layers
2. Choose a color using the color picker
3. Click "📝 Text Color" or "🎨 Shape Color" to apply
4. Use "🔤 Change Font" for typography consistency

### Image Replacement
1. Select an image layer
2. Click "🖼️ Replace Image"
3. Choose a new image file
4. The plugin automatically matches dimensions and preserves properties

## Development

### Project Structure
```
photoshop-layer-manager-plugin/
├── src/                    # TypeScript source code
├── tests/                  # Unit and property-based tests
├── icons/                  # Plugin icons for different themes
├── manifest.json           # UXP plugin manifest
├── index.html             # Main UI panel
└── package.json           # Dependencies and scripts
```

### Build Commands
```bash
npm run build              # Production build
npm run dev               # Development build with watch
npm run test              # Run all tests
npm run test:coverage     # Generate coverage report
npm run lint              # Lint and fix code
npm run type-check        # TypeScript type checking
```

### Testing
The plugin uses a dual testing approach:
- **Unit Tests**: Specific test cases for known scenarios
- **Property-Based Tests**: Universal correctness properties using fast-check

Run tests with: `npm test`

### Version Control Integration
The plugin automatically commits and pushes changes after each completed task:
- Descriptive commit messages for each operation
- Automatic retry logic for failed pushes (up to 3 attempts)
- Recovery points for rollback capabilities

## Architecture

### Core Components
- **Auto_Grouper**: Intelligent layer grouping with content analysis
- **Style_Manager**: Bulk styling operations for colors, fonts, and effects  
- **Group_Controller**: Group visibility and naming management
- **Image_Replacer**: Seamless image replacement with dimension matching
- **Performance_Monitor**: Operation timing and resource management

### Technology Stack
- **Framework**: Adobe UXP (User Experience Platform)
- **Language**: TypeScript with strict type checking
- **Build**: Webpack with ts-loader
- **Testing**: Jest + fast-check for property-based testing
- **Linting**: ESLint + Prettier for code quality

## Performance

### Benchmarks
- Layer grouping: ≤500ms for up to 50 layers
- Bulk styling: ≤1000ms for up to 100 layers
- Memory usage: Returns to baseline within 5 seconds
- UI responsiveness: ≤100ms for user interactions

### Optimization Features
- Efficient layer traversal algorithms
- Batch operation processing
- Automatic memory cleanup
- Progress indicators for long operations

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure all tests pass: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style
- Use TypeScript with strict type checking
- Follow ESLint and Prettier configurations
- Write tests for new functionality
- Document complex algorithms and business logic

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/your-username/photoshop-layer-manager-plugin/wiki)
- 🐛 [Report Issues](https://github.com/your-username/photoshop-layer-manager-plugin/issues)
- 💬 [Discussions](https://github.com/your-username/photoshop-layer-manager-plugin/discussions)

## Roadmap

### Version 1.1 (Coming Soon)
- [ ] macOS support
- [ ] Advanced color harmony suggestions
- [ ] Custom naming templates
- [ ] Batch layer effects

### Version 1.2 (Future)
- [ ] AI-powered content analysis
- [ ] Cloud sync for preferences
- [ ] Plugin API for extensions
- [ ] Advanced spatial clustering

---

**Made with ❤️ for the Photoshop community**
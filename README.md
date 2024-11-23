# Hide Distracting Elements - Chrome Extension

A Chrome extension that helps users hide distracting elements on web pages, similar to Safari's Hide Distracting Items feature. This extension allows users to select and hide specific elements on websites and automatically applies these preferences when revisiting the sites.

## Features

- 🎯 Element Selection Mode: Click elements to hide them
- 🔍 DOM Navigation: View and select elements through DOM hierarchy
- 📱 Side Panel Interface: Easy-to-use controls and settings
- 💾 Domain-based Settings: Preferences are saved per domain
- 🔄 Automatic Application: Hidden elements are automatically removed when revisiting sites
- 🎨 Visual Element Highlighting: Preview elements before hiding them
- ⚡ Real-time Updates: Instant feedback when selecting elements
- 🌳 DOM Tree View: Navigate through page elements hierarchically

## Technology Stack

- React 18.2.0
- TypeScript
- Tailwind CSS
- Chrome Extensions Manifest V3

## Project Structure

```
src/
├── background/               # Background service worker
├── contentScript/            # Content script for DOM manipulation
├── sidepanel/                # Side panel UI components
├── types/                    # TypeScript type definitions
├── utils/                    # Utility functions and classes
│   ├── connectionManager.ts  # Communication between contexts
│   ├── elementFinder.ts      # DOM element search and manipulation
│   └── storageManager.ts     # Chrome storage management
└── styles/                   # Global styles and Tailwind configuration
```

## Installation

1. Clone the repository
```bash
git clone [repository-url]
cd hide-distracting-elements
```

2. Install dependencies
```bash
npm install
```

3. Build the extension
```bash
npm run build
```

4. Load the extension in Chrome
- Open Chrome and navigate to `chrome://extensions`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `dist` directory from the project

## Development

1. Run in development mode with hot reload:
```bash
npm run watch
```

2. Build for production:
```bash
npm run build
```

## Features in Detail

### Element Selection
- Click the extension icon to open the side panel
- Toggle selection mode to start hiding elements
- Hover over elements to see them highlighted
- Click elements to hide them

### DOM Navigation
- View selected elements in a hierarchical tree structure
- Navigate to parent elements
- Preview element information before selection
- Real-time element path display

### Settings Management
- View and manage hidden elements per domain
- Remove individual hidden elements
- Clear all hidden elements for a domain
- Export/Import settings (coming soon)

### Technical Implementation

#### Connection Management
The extension uses a robust connection management system to handle communication between different contexts:
- Background Service Worker
- Content Scripts
- Side Panel

#### Element Finding
Advanced element finding algorithm that uses multiple identifiers:
- DOM Path
- Tag Name
- Class Names
- IDs
- Text Content
- Styles

#### Storage
Domain-based storage system using Chrome's Storage API:
- Automatic saving of user preferences
- Efficient retrieval and application of settings
- Cross-device synchronization (coming soon)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## Future Enhancements

- [ ] Enhanced element targeting system
- [ ] Undo/Redo functionality
- [ ] Export/Import settings
- [ ] Custom CSS rules
- [ ] Pattern matching for similar elements
- [ ] Keyboard shortcuts
- [ ] Cross-device synchronization
- [ ] Custom element highlight styles

## License

This project is licensed under the MIT License - see the LICENSE file for details.

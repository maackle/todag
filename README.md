# ToDAG - Todo App with Dependency Management

A todo application with partial ordering support, where items can have dependencies on other items. The app maintains a Directed Acyclic Graph (DAG) as the primary data structure for managing dependencies.

## Features

- **Dependency Management**: Create dependencies between todos by drawing arrows from one card to another
- **Topological Sorting**: The list view automatically maintains a topological sort of todos based on dependencies
- **Visual Dependency Creation**: Click and drag from the arrow zone on the left edge of any card to create dependencies
- **Drag and Drop**: Rearrange todos in the list view, with automatic validation to prevent dependency violations
- **Graph View**: Visualize the entire dependency DAG with a layered layout
- **Two Views**: Switch between List View (topologically sorted) and Graph View (DAG visualization)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to the URL shown in the terminal (typically `http://localhost:5173`)

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

1. **Adding Todos**: Type a todo in the input field and click "Add" or press Enter
2. **Creating Dependencies**: 
   - Click and hold on the arrow zone (left edge of a card)
   - Drag to another card
   - Release to create a dependency (A → B means "A blocks B")
3. **Rearranging Todos**: Drag and drop todos in the list view. The app will prevent moves that violate dependencies
4. **Viewing Dependencies**: 
   - List View: See arrows connecting dependent items
   - Graph View: See the full DAG with a layered layout
5. **Deleting Todos**: Click the × button on any todo card

## Architecture

### Data Structure

The app uses a `DAG` class as the primary data structure for managing dependencies. The DAG is stored separately from the todo items themselves, making it easy to:
- Query dependencies efficiently
- Validate operations (like moves)
- Serialize for backend storage

### State Management

State is managed using Svelte stores:
- `todos`: Array of todo items
- `dag`: DAG instance containing all dependency relationships
- `viewMode`: Current view ('list' or 'graph')

### Backend Integration

The store structure is designed to make backend integration straightforward:
- All state mutations go through action functions
- The DAG can be serialized/deserialized easily
- Todo items have a simple, extensible structure

## Project Structure

```
todag/
├── src/
│   ├── components/
│   │   ├── TodoCard.svelte      # Individual todo card with arrow zone
│   │   ├── ListView.svelte       # Topologically sorted list view
│   │   ├── GraphView.svelte      # DAG visualization view
│   │   └── ArrowRenderer.svelte  # SVG arrow rendering
│   ├── lib/
│   │   ├── dag.js                # DAG data structure and algorithms
│   │   └── store.js              # State management
│   ├── App.svelte                # Main app component
│   └── main.js                   # Entry point
├── index.html
├── package.json
└── vite.config.js
```

## Future Enhancements

- Backend persistence
- User authentication
- Sharing and collaboration
- Dependency visualization improvements
- Keyboard shortcuts
- Undo/redo functionality


# RTS Game Project

A real-time strategy (RTS) game built with vanilla JavaScript, HTML5 Canvas, and CSS. This project features a modular architecture, advanced AI opponents, and a complete sound system.

## 🎮 Features

### Core Gameplay
*   **Resource Management**: Gather Gold and Wood to build your economy.
*   **Base Building**: Construct Town Halls, Barracks, Farms, Lumber Mills, Blacksmiths, and Guard Towers.
*   **Unit Training**: Train Peasants, Soldiers, Archers, and Knights.
*   **Combat System**: Real-time combat with different unit types and attack ranges.
*   **Fog of War**: Explore the map to reveal enemy locations.

### Advanced AI
*   **State Machine AI**: Opponents cycle through Growth, Defense, Attack, and Expansion states.
*   **Economy Management**: AI intelligently manages resources and worker assignments.
*   **Expansion**: AI can build new bases (Town Halls) near resource nodes.
*   **Attack Waves**: Coordinated attacks with specific unit compositions.

### Technical Features
*   **Advanced Rendering Engine**:
    *   **Layer System**: Efficient caching for static terrain and fog layers.
    *   **Viewport Culling**: Only renders entities visible on screen for high performance.
    *   **Batch Rendering**: Optimized draw calls for units and buildings.
    *   **Particle System**: Visual effects for combat and interactions.
*   **Spatial Hashing**: Optimized collision detection and entity queries.
*   **A* Pathfinding**: Efficient unit navigation with obstacle avoidance and throttling for performance.
*   **Sound System**: Dynamic audio engine with background music and spatial sound effects.
*   **Edge Scrolling**: Intuitive camera movement using mouse position.

## 🏗️ Architecture

The project follows a modular architecture to ensure scalability and maintainability.

### Directory Structure
```
src/
├── config/         # Game constants and entity statistics
├── core/           # Main game loop and state management
├── entities/       # Unit and Building classes (OOP)
├── input/          # Input handling (Mouse/Keyboard)
├── map/            # Map generation and rendering
├── rendering/      # Canvas rendering logic
├── systems/        # Core systems (AI, Pathfinding, Sound)
├── ui/             # UI updates and interaction
└── utils/          # Helper functions (Logger, Math)
```

### Key Systems
*   **Game Loop (`core/Game.js`)**: Manages the update and draw cycles.
*   **Entity Component System**: While object-oriented (`Entity.js`), it separates logic into distinct managers (`AIController`, `SoundManager`).
*   **Input Manager**: Handles complex interactions like drag-selection, context-sensitive commands, and building placement.

## 🚀 Getting Started

1.  **Clone the repository**
2.  **Open `index.html`** in a modern web browser.
    *   *Note: For audio to work correctly, you may need to interact with the page (click anywhere) due to browser autoplay policies.*

## 🛠️ Technologies

*   **Language**: JavaScript (ES6+)
*   **Rendering**: HTML5 Canvas API
*   **Styling**: CSS3
*   **Audio**: Web Audio API (via `Audio` objects)

## 👨‍💻 Credits

*   **Vibe Developer**: Sebastián Cuello
*   **Version**: 0.8.0
*   **Tools**: Antigravity AI, Gemini 3 Pro, Claude Sonnet 4.5

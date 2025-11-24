# Building Art Assets

This directory contains the visual art for all buildings in the game.

## 📁 Directory Structure

```
assets/
└── buildings/
    ├── townhall.png
    ├── keep.png
    ├── barracks.png
    ├── farm.png
    ├── guardtower.png
    ├── lumbermill.png
    ├── blacksmith.png
    └── goldmine.png
```

## 🎨 Image Specifications

### Required Dimensions
Each building image should be created as a **square PNG** file with transparent background.

**Recommended sizes:**
- **Size 2 buildings** (Farm, Guard Tower, Gold Mine): 64x64 pixels minimum
- **Size 3 buildings** (Town Hall, Keep, Barracks, Lumber Mill, Blacksmith): 96x96 pixels minimum

**Note:** Images will be automatically scaled to fit the building size (size × 32 pixels). Higher resolution images will look better.

### Art Style Guidelines
- Use **transparent backgrounds** (PNG format)
- Keep the art style consistent across all buildings
- Consider that faction colors will be slightly tinted over neutral buildings
- Buildings should be recognizable at small sizes

### Building Types

1. **townhall.png** - Main base building for training peasants
2. **keep.png** - Upgraded version of Town Hall
3. **barracks.png** - Military training facility
4. **farm.png** - Food production building
5. **guardtower.png** - Defensive tower structure
6. **lumbermill.png** - Wood processing building
7. **blacksmith.png** - Weapon and armor upgrades building
8. **goldmine.png** - Gold resource gathering point

## 🔧 How to Add Your Art

1. Create your building artwork as PNG files
2. Name them exactly as listed above
3. Place them in the `assets/buildings/` directory
4. The game will automatically load them on startup

## 🎯 Fallback Behavior

If an image file is missing or fails to load:
- The game will display a warning in the console
- The building will render using CSS (colored squares with symbols)
- The game will continue to function normally

## 📝 Example

To add a custom Town Hall image:
1. Create a PNG file named `townhall.png`
2. Make it at least 96x96 pixels (for size 3 building)
3. Save it with transparent background
4. Place it in `../assets/buildings/townhall.png`
5. Refresh the game to see your art!

## 🎨 Current Status

All building types are configured to use images from this directory. Simply add your art files and they will be displayed automatically!

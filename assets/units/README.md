# Unit Art Assets

This directory contains the visual art for all units in the game.

## 📁 Directory Structure

```
assets/
└── units/
    ├── peasant.png
    ├── soldier.png
    ├── archer.png
    └── knight.png
```

## 🎨 Image Specifications

### Required Dimensions
Each unit image should be created as a **square PNG** file with transparent background.

**Recommended size:** 32x32 pixels minimum (can be higher resolution for better quality)

### Art Style Guidelines
- Use **transparent backgrounds** (PNG format)
- **Top-down or isometric view** works best
- Keep the art style consistent across all units
- Units should be recognizable at small sizes
- Consider that images will be **clipped to a circle** when rendered
- Faction colors will be tinted as background, so keep unit details clear

### Unit Types

1. **peasant.png** ✅ - Worker unit (example provided)
2. **soldier.png** - Basic melee unit
3. **archer.png** - Ranged unit
4. **knight.png** - Heavy cavalry unit

## 🔧 How to Add Your Art

1. Create your unit artwork as PNG files (32x32px or higher)
2. Name them exactly as listed above
3. Place them in the `assets/units/` directory
4. Add the `image` property to the unit's stats in `src/config/entityStats.js`:
   ```javascript
   soldier: { 
     name: 'Soldier', 
     // ... other stats ...
     image: 'assets/units/soldier.png' 
   }
   ```
5. The game will automatically load them on startup

## 🎯 Rendering Details

### Circular Clipping
Unit images are rendered within a circular mask:
- The circular area is about 2/3 of the tile size
- Design your sprites to fit well within a circle
- Important details should be in the center

### Faction Color Tinting
Each unit receives a faction-colored background:
- **Player**: Blue (#00AAFF)
- **Enemy**: Red (#FF0000)  
- **Ally**: Green (#00FF00)
- **Enemy 2**: Purple (#8E44AD)

The faction color appears as a background behind your image within the circle.

### Image Scaling
- Images are scaled to 80% of tile size (about 25 pixels for 32px tiles)
- Higher resolution images scale down smoothly
- Keep sprites centered in your image

## 🎯 Fallback Behavior

If an image file is missing or fails to load:
1. Console warning is logged
2. Unit renders as colored circle with symbol letter (original CSS style)
3. Game continues to function normally

## 📝 Example - Peasant

The peasant unit is configured and has an example image:

```javascript
// In src/config/entityStats.js
peasant: { 
  name: 'Peasant', 
  symbol: 'P', 
  health: 40, 
  attack: 5, 
  range: 1, 
  speed: 2, 
  cost: { gold: 50, food: 1 }, 
  maxHealth: 40, 
  buildTime: 5, 
  image: 'assets/units/peasant.png'  // ← Image path added
}
```

## 🚀 Adding More Units

To add images for soldier, archer, and knight:

1. Create PNG files for each unit type
2. Save them in this directory with exact filenames
3. Add `image` property to their stats in `entityStats.js`
4. Refresh the game!

## ✅ Current Status

- **Peasant**: ✅ Configured with example image
- **Soldier**: ⚪ CSS fallback (no image yet)
- **Archer**: ⚪ CSS fallback (no image yet)
- **Knight**: ⚪ CSS fallback (no image yet)

## 🎨 Design Tips

- Keep unit designs simple and clear
- Use contrasting colors so units stand out
- Remember the circle clip - important features in center
- Test at actual game size (small!)
- Consider animation frames for future expansion

---

**Note**: For now, units use a single static image. Animation support can be added in the future by using sprite sheets!

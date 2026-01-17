# 🏠 Room.xyz

Transform real room images into interactive 3D pixelated models with modular, selectable furniture and decorations.

## ✨ Features

- 🤖 **AI-Powered Analysis**: Uses OpenRouter AI (Claude 3.5 Sonnet) to detect furniture and objects in room photos
- 🎨 **3D Pixelated Rendering**: Creates beautiful voxel-style 3D models inspired by pixel art aesthetics
- 🖱️ **Interactive Selection**: Click any object to select, highlight, and interact with it
- 🎯 **Modular Design**: Each furniture piece is separately created and can be individually selected
- 📐 **Proper Scaling**: Objects are scaled relative to room dimensions
- 💾 **Export Functionality**: Save your 3D room configuration as JSON
- 🔄 **Interactive Controls**: Orbit, zoom, and explore your room from any angle

## 🚀 Setup

1. Install dependencies:
```bash
npm install
```

2. The `.env` file is already configured with your OpenRouter API key.

3. Start the server:
```bash
npm start
```

4. Open your browser to:
```
http://localhost:3000
```

## 🎮 How to Use

1. **Upload Image**: Drag and drop a room photo or click to browse
2. **Generate**: Click "Generate 3D Room" to analyze and create the 3D model
3. **Explore**: 
   - Left-click and drag to rotate the view
   - Right-click and drag to pan
   - Scroll to zoom in/out
4. **Select Objects**: Click on any furniture piece in the 3D view or in the objects list
5. **Customize**: 
   - Toggle wireframe mode for a different look
   - Delete selected objects
   - Reset camera view
6. **Export**: Save your room configuration as JSON

## 🎨 Supported Objects

The AI can detect and render:
- Desks, Tables
- Chairs, Stools
- Beds
- Monitors, TVs
- Keyboards, Accessories
- Plants, Decorations
- Lamps, Lighting
- Shelves, Storage
- Rugs, Carpets
- Picture frames
- Curtains
- And more!

## 🛠️ Technology Stack

- **Backend**: Node.js + Express
- **AI**: OpenRouter API (Claude 3.5 Sonnet with vision)
- **3D Rendering**: Three.js
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **File Upload**: Multer

## 🎯 Architecture

1. User uploads room image
2. Server sends image to OpenRouter AI for analysis
3. AI identifies furniture, positions, colors, and dimensions
4. Frontend receives JSON data with object specifications
5. Three.js creates voxel-style 3D models for each object
6. Interactive scene allows selection and manipulation

## 📝 API Endpoints

- `POST /api/analyze-room`: Upload image and get room analysis
  - Input: FormData with image file
  - Output: JSON array of detected objects with properties

## 🎨 Customization

You can customize the voxel style by modifying the `createVoxelObject()` function in `app.js`. Each object type has its own creation logic for authentic pixelated appearance.

## 🔧 Development

Run with auto-reload:
```bash
npm install -g nodemon
npm run dev
```

## 📦 Export Format

Exported JSON includes:
```json
{
  "roomData": [
    {
      "type": "desk",
      "position": {"x": "center", "z": "back"},
      "size": "large",
      "color": "#FFFFFF",
      "dimensions": {"width": 0.4, "height": 0.15, "depth": 0.3}
    }
  ],
  "timestamp": "2026-01-17T..."
}
```

## 🎨 Design Philosophy

Room.xyz creates a bridge between real-world spaces and playful 3D pixel art. The aesthetic is inspired by:
- Isometric room design games
- Voxel art
- Low-poly 3D modeling
- Cozy room simulators

## 🚀 Future Enhancements

- Real-time object repositioning (drag and drop in 3D)
- Custom color picker for objects
- More furniture types and variations
- Texture options for different materials
- Save/load multiple room designs
- Share room designs with unique URLs
- VR/AR support

## 📄 License

MIT License - Feel free to use and modify!

---

Made with ❤️ for UofTHacks2

# My Room - Drag & Drop Game

A 3D interactive room game inspired by rooms.xyz, where you can drag and drop objects around a corner room.

## Features

- **3D Corner Room**: A room with a floor and two walls (back wall and side wall)
- **Draggable Objects**: Multiple 3D objects (cubes, spheres, cylinders, cones) that you can interact with
- **Drag & Drop**: Click and drag objects around the room using your mouse or touch screen
- **Smooth Interactions**: Objects are constrained to the floor plane and room boundaries

## How to Play

1. Open `index.html` in a modern web browser
2. Click and drag any object to move it around the room
3. Objects are constrained to stay within the room boundaries

## Setup

No build process required! This game runs directly in the browser using ES modules.

Simply open `index.html` in a web browser that supports ES modules (all modern browsers).

### Local Development Server (Recommended)

For the best experience, use a local development server:

**Using Python:**
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

**Using Node.js (http-server):**
```bash
npx http-server
```

Then open `http://localhost:8000` in your browser.

## Technologies

- **Three.js**: 3D graphics library for WebGL
- **Vanilla JavaScript**: No frameworks, pure ES6 modules
- **HTML5/CSS3**: Modern web standards

## Room Specifications

- Room size: 95x95 units
- Room height: 75 units
- Objects are constrained to the floor plane
- Objects can be dragged within room boundaries

## Browser Compatibility

Works in all modern browsers that support:
- ES6 Modules
- WebGL
- Touch events (for mobile support)
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Analyze room image using OpenRouter AI
app.post('/api/analyze-room', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Read the image file and convert to base64
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const imageDataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

    // Call OpenRouter API with vision model
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3.5-sonnet', // Vision-capable model
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this room image and identify all furniture and decorative items. For each item, provide:
1. Object type: desk, chair, bed, sofa, plant, lamp, shelf, bookshelf, monitor, keyboard, picture_frame, curtain, rug, side_table, or any other furniture/decor
2. Approximate position in the room:
   - x: "left" (left third), "center" (middle third), or "right" (right third)
   - z: "front" (closest to camera/viewer), "middle" (center depth), or "back" (against far wall)
3. Relative size (small/medium/large)
4. Primary color as hex code (e.g., #8B6F47)
5. Approximate dimensions relative to room size

Return ONLY a valid JSON array with this structure:
[
  {
    "type": "desk",
    "position": {"x": "center", "z": "back"},
    "size": "large",
    "color": "#8B6F47",
    "dimensions": {"width": 0.4, "height": 0.15, "depth": 0.3}
  }
]

IMPORTANT GUIDELINES:
- Use normalized dimensions where room width=1.0, height=1.0, depth=1.0
- ALL items must be floor-standing (no wall-mounted items)
- DISTRIBUTE objects across ALL zones: left-front, center-front, right-front, left-middle, center-middle, right-middle, left-back, center-back, right-back
- Try to place at least 10-15 objects to fill the room nicely
- Include variety: furniture (desk, chair, bed, sofa), decorations (plants, lamps), and functional items (monitor, keyboard, shelf, bookshelf, side_table)
- Try to avoid placing more than 2-3 items in the exact same zone
- For items that go together (like monitor on desk), place them in adjacent zones or the same zone and they'll be automatically spaced
- Focus on major furniture pieces and decorative items visible in the image
- Make the room feel lived-in and complete with proper object density across the floor`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageDataUrl
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Room.xyz'
        }
      }
    );

    // Extract and parse the response
    let roomData = [];
    try {
      const content = response.data.choices[0].message.content;
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        roomData = JSON.parse(jsonMatch[0]);
      } else {
        roomData = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      // Fallback to sample data
      roomData = generateFallbackRoomData();
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ 
      success: true, 
      roomData: roomData,
      rawResponse: response.data.choices[0].message.content
    });

  } catch (error) {
    console.error('Error analyzing room:', error.response?.data || error.message);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ 
      error: 'Failed to analyze room image',
      details: error.response?.data || error.message,
      fallbackData: generateFallbackRoomData()
    });
  }
});

// Generate fallback room data based on the reference image
function generateFallbackRoomData() {
  return [
    {
      "type": "desk",
      "position": {"x": "center", "z": "back"},
      "size": "large",
      "color": "#FFFFFF",
      "dimensions": {"width": 0.45, "height": 0.18, "depth": 0.35}
    },
    {
      "type": "chair",
      "position": {"x": "center", "z": "front"},
      "size": "medium",
      "color": "#FF6B9D",
      "dimensions": {"width": 0.18, "height": 0.22, "depth": 0.18}
    },
    {
      "type": "monitor",
      "position": {"x": "right", "z": "back"},
      "size": "medium",
      "color": "#2C3E50",
      "dimensions": {"width": 0.22, "height": 0.18, "depth": 0.05}
    },
    {
      "type": "keyboard",
      "position": {"x": "center", "z": "back"},
      "size": "small",
      "color": "#34495E",
      "dimensions": {"width": 0.14, "height": 0.02, "depth": 0.1}
    },
    {
      "type": "plant",
      "position": {"x": "left", "z": "back"},
      "size": "small",
      "color": "#27AE60",
      "dimensions": {"width": 0.1, "height": 0.2, "depth": 0.1}
    },
    {
      "type": "shelf",
      "position": {"x": "left", "z": "back"},
      "size": "medium",
      "color": "#ECF0F1",
      "dimensions": {"width": 0.35, "height": 0.06, "depth": 0.15}
    },
    {
      "type": "bed",
      "position": {"x": "right", "z": "front"},
      "size": "large",
      "color": "#FFB6C1",
      "dimensions": {"width": 0.4, "height": 0.15, "depth": 0.5}
    },
    {
      "type": "rug",
      "position": {"x": "center", "z": "middle"},
      "size": "large",
      "color": "#7CFC00",
      "dimensions": {"width": 0.6, "height": 0.02, "depth": 0.6}
    },
    {
      "type": "lamp",
      "position": {"x": "left", "z": "back"},
      "size": "small",
      "color": "#F5DEB3",
      "dimensions": {"width": 0.08, "height": 0.22, "depth": 0.08}
    },
    {
      "type": "side_table",
      "position": {"x": "left", "z": "middle"},
      "size": "small",
      "color": "#8B4513",
      "dimensions": {"width": 0.15, "height": 0.15, "depth": 0.15}
    },
    {
      "type": "plant",
      "position": {"x": "right", "z": "back"},
      "size": "small",
      "color": "#2ECC71",
      "dimensions": {"width": 0.08, "height": 0.18, "depth": 0.08}
    },
    {
      "type": "bookshelf",
      "position": {"x": "left", "z": "front"},
      "size": "medium",
      "color": "#8B6F47",
      "dimensions": {"width": 0.25, "height": 0.35, "depth": 0.15}
    },
    {
      "type": "lamp",
      "position": {"x": "center", "z": "back"},
      "size": "small",
      "color": "#FFE5B4",
      "dimensions": {"width": 0.07, "height": 0.2, "depth": 0.07}
    },
    {
      "type": "shelf",
      "position": {"x": "left", "z": "middle"},
      "size": "medium",
      "color": "#FFFFFF",
      "dimensions": {"width": 0.3, "height": 0.05, "depth": 0.12}
    },
    {
      "type": "plant",
      "position": {"x": "left", "z": "front"},
      "size": "small",
      "color": "#00A86B",
      "dimensions": {"width": 0.1, "height": 0.25, "depth": 0.1}
    }
  ];
}

app.listen(PORT, () => {
  console.log(`🚀 Room.xyz server running on http://localhost:${PORT}`);
});

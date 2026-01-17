import { RoomData, VoxelObject } from "../types";

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface RoomState {
  id: string;
  name: string;
  dimensions: { length: number; width: number; height: number };
  theme: string;
  colorPalette: string[];
  existingItems: Array<{
    id: string;
    productId?: string;
    name: string;
    category: string;
    position: { x: number; y: number; z: number };
    dimensions: { width: number; depth: number; height: number };
  }>;
  emptyZones: Array<{
    id: string;
    type: string;
    description: string;
    position: { x: number; y: number; z: number };
  }>;
}

const BASE_RULES = `
The style must strictly match "Classic Detailed Voxel Art".
Sub-parts MUST touch or overlap (structural integrity).
Use vibrant, clean colors that represent the real object's materials.
`;

const ROOM_PROMPT = (sizeFeet: number) => `
Analyze this room photo and reconstruct it as a 3D modular isometric voxel environment.
The room is approximately ${sizeFeet}x${sizeFeet} feet.
${BASE_RULES}
Assign objects positions on a grid where 1 unit = 1 foot.
Ensure major furniture pieces are correctly scaled relative to each other and the ${sizeFeet}ft room size.
Return JSON with wallColor, floorColor, and objects array.
`;

const OBJECT_PROMPT = `
Analyze the MAIN SINGLE OBJECT in this photo. Reconstruct it as a high-fidelity 3D voxel module with a "Voxel Toy" aesthetic.
${BASE_RULES}
Scaling: Assume the object is a standard size for its type (e.g., a chair is ~1.5x1.5x3 units, a desk is ~4x2x2.5 units). 1 unit = 1 foot.
Focus on EXAGGERATING and EMPHASIZING the object's unique silhouettes and most recognizable features.
Instead of raw complexity, use 20-40 well-placed blocks to create a stylized, cartoonish version.
The goal is to create a premium-looking modular game asset that captures the "soul" of the object through its geometry.
Ignore the background environment completely.
Return JSON with a single object definition (name, type, parts, color, description).
`;

const ROOM_STATE_PROMPT = (sizeFeet: number) => `
Analyze this room photo and extract detailed information about the space and existing furniture.
The room is approximately ${sizeFeet}x${sizeFeet} feet.

Return a JSON object with:
1. name: A descriptive name for the room (e.g., "Modern Living Room")
2. theme: The interior design style (e.g., "scandinavian-minimalist", "industrial", "bohemian", "modern-glam")
3. colorPalette: Array of 4-5 primary colors used in the room
4. existingItems: Array of furniture/objects visible, each with:
   - name: Item name
   - category: Category (seating, tables, storage, decor, lighting, etc.)
   - position: Estimated x,y,z coordinates in feet
   - dimensions: width, depth, height in feet
5. emptyZones: Array of empty spaces suitable for decoration, each with:
   - type: "corner", "wall", "floor", "nook"
   - description: Brief description of the location and lighting
   - position: Estimated x,y,z coordinates

Be specific and detailed. Position coordinates should be relative to a grid where the room is ${sizeFeet}x${sizeFeet} feet.
`;

const ROOM_STATE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    theme: { type: "string" },
    colorPalette: { type: "array", items: { type: "string" } },
    existingItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          category: { type: "string" },
          position: {
            type: "object",
            properties: { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } }
          },
          dimensions: {
            type: "object",
            properties: { width: { type: "number" }, depth: { type: "number" }, height: { type: "number" } }
          }
        }
      }
    },
    emptyZones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          description: { type: "string" },
          position: {
            type: "object",
            properties: { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } }
          }
        }
      }
    }
  },
  required: ["name", "theme", "colorPalette", "existingItems", "emptyZones"]
};

const ROOM_SCHEMA = {
  type: "object",
  properties: {
    wallColor: { type: "string" },
    floorColor: { type: "string" },
    objects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          type: { type: "string" },
          position: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
          rotation: { type: "number" },
          color: { type: "string" },
          description: { type: "string" },
          parts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                offset: { type: "array", items: { type: "number" } },
                dimensions: { type: "array", items: { type: "number" } },
                color: { type: "string" }
              },
              required: ["offset", "dimensions", "color"]
            }
          }
        },
        required: ["name", "type", "position", "parts"]
      }
    }
  },
  required: ["wallColor", "floorColor", "objects"]
};

const OBJECT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    type: { type: "string" },
    color: { type: "string" },
    description: { type: "string" },
    parts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          offset: { type: "array", items: { type: "number" } },
          dimensions: { type: "array", items: { type: "number" } },
          color: { type: "string" }
        },
        required: ["offset", "dimensions", "color"]
      }
    }
  },
  required: ["name", "type", "parts"]
};

async function callOpenRouter(base64Image: string, prompt: string, schema: any, retries: number = 2): Promise<any> {
  const models = [
    'google/gemini-3-flash-preview',      // Primary - most reliable
    'meta-llama/llama-3.2-90b-vision-instruct:free', // Fallback - Llama 90B
    'anthropic/claude-3.5-sonnet'          // Last resort
  ];

  let lastError: any;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const currentModel = models[modelIndex];
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff: wait 2s, 4s, 8s etc
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }

        const response = await fetch(OPENROUTER_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Voxel Room Architect'
          },
          body: JSON.stringify({
            model: currentModel,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `${prompt}\n\nYou MUST respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: base64Image
                    }
                  }
                ]
              }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          const errorData = JSON.parse(errorText);
          
          // Handle rate limiting - try next model
          if (response.status === 429) {
            console.warn(`Model ${currentModel} rate limited, trying next model...`);
            lastError = new Error(`Rate limited on ${currentModel}`);
            break; // Break inner loop, try next model
          }
          
          lastError = new Error(`OpenRouter API Error: ${response.status} - ${errorText.substring(0, 200)}`);
          
          // Only retry on server errors, not client errors
          if (response.status >= 500) {
            continue; // Retry same model
          } else {
            throw lastError;
          }
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (!content) {
          throw new Error('No content in response');
        }

        return JSON.parse(content);

      } catch (error: any) {
        lastError = error;
        if (attempt === retries) {
          break; // Try next model
        }
      }
    }
  }

  throw lastError || new Error('Failed after all retry attempts and models');
}

export const analyzeRoomImage = async (base64Image: string, sizeFeet: number): Promise<RoomData> => {
  try {
    // Use OpenRouter with fallback models
    const result = await callOpenRouter(
      base64Image,
      ROOM_PROMPT(sizeFeet),
      ROOM_SCHEMA
    );

    return {
      wallColor: result.wallColor || '#cbd5e1',
      floorColor: result.floorColor || '#94a3b8',
      dimensions: { width: sizeFeet, depth: sizeFeet },
      objects: (result.objects || []).map((obj: any, idx: number) => ({
        ...obj,
        id: obj.id || `room-obj-${idx}-${Date.now()}`,
        rotation: obj.rotation || 0,
        visible: true,
        parts: obj.parts || []
      }))
    };
  } catch (error) {
    console.error("OpenRouter Error:", error);
    throw error;
  }
};

export const analyzeSingleObject = async (base64Image: string, spawnPosition: [number, number, number]): Promise<VoxelObject> => {
  try {
    // Use OpenRouter with fallback models
    const obj = await callOpenRouter(
      base64Image,
      OBJECT_PROMPT,
      OBJECT_SCHEMA
    );

    return {
      ...obj,
      id: `toolbox-${Date.now()}`,
      position: spawnPosition,
      rotation: 0,
      visible: true,
      parts: obj.parts || []
    };
  } catch (error) {
    console.error("OpenRouter Error:", error);
    throw error;
  }
};

export const extractRoomState = async (base64Image: string, sizeFeet: number): Promise<RoomState> => {
  try {
    const result = await callOpenRouter(
      base64Image,
      ROOM_STATE_PROMPT(sizeFeet),
      ROOM_STATE_SCHEMA
    );

    const roomState: RoomState = {
      id: `room_${Date.now()}`,
      name: result.name || "Room",
      dimensions: {
        length: sizeFeet * 12,
        width: sizeFeet * 12,
        height: 96
      },
      theme: result.theme || "modern",
      colorPalette: result.colorPalette || ["white", "gray", "black"],
      existingItems: (result.existingItems || []).map((item: any, idx: number) => ({
        id: `item_${idx}_${Date.now()}`,
        name: item.name,
        category: item.category,
        position: item.position || { x: 0, y: 0, z: 0 },
        dimensions: item.dimensions || { width: 1, depth: 1, height: 1 }
      })),
      emptyZones: (result.emptyZones || []).map((zone: any, idx: number) => ({
        id: `zone_${idx}_${Date.now()}`,
        type: zone.type,
        description: zone.description,
        position: zone.position || { x: 0, y: 0, z: 0 }
      }))
    };

    // Save to local storage or session storage
    localStorage.setItem('roomState', JSON.stringify(roomState));

    return roomState;
  } catch (error) {
    console.error("Error extracting room state:", error);
    throw error;
  }
};

export const getRoomState = (): RoomState | null => {
  const stored = localStorage.getItem('roomState');
  return stored ? JSON.parse(stored) : null;
};

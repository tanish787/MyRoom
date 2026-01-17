import React, { useState, useEffect } from 'react';
import { Sparkles, Package, Search, Loader2, AlertCircle, Plus } from 'lucide-react';
import { RoomData, VoxelObject } from '../types';
import { getRoomState, RoomState } from '../services/geminiService';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';

interface MarketplaceProduct {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  dimensions: { width: number; depth: number; height: number };
  colors: string[];
  styles: string[];
  description: string;
  tags: string[];
  imageUrl: string;
}

interface RecommendationItem {
  productId: string;
  product?: MarketplaceProduct;
  reasoning: string;
  suggestedPosition?: { x: number; y: number; z: number; rotation: number };
  compatibilityScore: number;
}

interface MarketplacePanelProps {
  roomData: RoomData | null;
  onAddProduct: (product: MarketplaceProduct, position: [number, number, number]) => void;
  roomSizeFeet: number;
}

export default function MarketplacePanel({ roomData, onAddProduct, roomSizeFeet }: MarketplacePanelProps) {
  const [marketplaceProducts, setMarketplaceProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [processingQuery, setProcessingQuery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);

  // Load marketplace products and room state on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const productsResponse = await fetch('/marketplace-products.json');
        const products = await productsResponse.json();
        setMarketplaceProducts(products);
        
        // Load room state from localStorage
        const state = getRoomState();
        setRoomState(state);
        
        setLoading(false);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load marketplace products");
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const callGeminiAPI = async (prompt: string, systemPrompt: string): Promise<string> => {
    if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === "YOUR_API_KEY_HERE") {
      throw new Error("API key not configured. Please set VITE_OPENROUTER_API_KEY");
    }

    const models = [
      'google/gemini-3-flash-preview',
      'meta-llama/llama-3.2-90b-vision-instruct:free',
      'anthropic/claude-3.5-sonnet'
    ];

    let lastError: any;

    for (const model of models) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          }

          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
              "HTTP-Referer": window.location.href || "http://localhost:3000",
              "X-Title": "Room Marketplace AI"
            },
            body: JSON.stringify({
              model: model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
              ],
              temperature: 0.7,
            }),
          });

          if (!response.ok) {
            const text = await response.text();
            
            // Rate limited - try next model
            if (response.status === 429) {
              console.warn(`Model ${model} rate limited, trying next...`);
              lastError = new Error(`Rate limit: ${response.status}`);
              break;
            }

            lastError = new Error(`API Error (${response.status}): ${text.substring(0, 150)}`);
            
            // Retry on server errors
            if (response.status >= 500) {
              continue;
            } else {
              throw lastError;
            }
          }

          const data = await response.json();
          if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("Invalid API response structure");
          }

          return data.choices[0].message.content;

        } catch (err: any) {
          lastError = err;
          if (attempt === 2) break; // Move to next model
        }
      }
    }

    throw lastError || new Error("Failed to get recommendations after retries");
  };

  const getRecommendations = async (userQuery: string) => {
    if (!roomData && !roomState) {
      setError("No room data available for recommendations");
      return;
    }

    setProcessingQuery(true);
    setError(null);

    try {
      const systemPrompt = `You are an interior design AI recommending products from a marketplace.
CRITICAL: Return ONLY valid JSON with NO markdown, NO backticks, NO explanations.

Format:
{
  "recommendations": [
    {
      "productId": "prod_XXX",
      "reasoning": "1-2 sentences why this fits"
    }
  ]
}`;

      const existingItems = roomState?.existingItems?.map(item => item.name).join(", ") || 
                           roomData?.objects?.map(obj => obj.name).join(", ") || 
                           "empty";
      
      const theme = roomState?.theme || "modern";
      const colorPalette = roomState?.colorPalette?.join(", ") || "neutral";
      
      const availableProducts = marketplaceProducts.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        tags: p.tags
      }));

      const prompt = `User wants: "${userQuery}"
Room size: ${roomSizeFeet}x${roomSizeFeet} feet
Room theme: ${theme}
Color palette: ${colorPalette}
Current items: ${existingItems}

Available products:
${JSON.stringify(availableProducts, null, 2)}

Recommend 2-3 best matching products as JSON only:`;

      const result = await callGeminiAPI(prompt, systemPrompt);
      const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const enrichedRecs = parsed.recommendations.map((rec: any) => ({
        ...rec,
        product: marketplaceProducts.find(p => p.id === rec.productId),
        compatibilityScore: rec.compatibilityScore || 0.85
      }));

      setRecommendations(enrichedRecs);
    } catch (err: any) {
      console.error("Error getting recommendations:", err);
      setError(err.message || "Failed to get recommendations");
    } finally {
      setProcessingQuery(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    await getRecommendations(query);
  };

  const handleAddProduct = (product: MarketplaceProduct) => {
    const position: [number, number, number] = [
      roomSizeFeet / 2,
      product.dimensions.height / 24,
      roomSizeFeet / 2
    ];
    onAddProduct(product, position);
  };

  if (loading) {
    return (
      <div className="h-full bg-slate-900/40 border-l border-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading marketplace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-900/40 border-l border-slate-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-black text-white uppercase tracking-wider">AI Marketplace</h3>
        </div>
      </div>

      {/* Search Form */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/40">
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., 'Add a plant to the corner' or 'Modern seating'"
            className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-none h-16"
          />
          <button
            type="submit"
            disabled={processingQuery}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            {processingQuery ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search size={14} />
                Find Products
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="mt-3 p-2 bg-red-950/40 border border-red-900 rounded text-red-200 text-xs">
            {error}
          </div>
        )}
      </div>

      {/* Recommendations List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {recommendations.length > 0 ? (
          recommendations.map((rec, idx) => (
            <div
              key={idx}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 hover:border-indigo-600 transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-white truncate">{rec.product?.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">{rec.product?.category}</p>
                </div>
                <span className="text-xs font-bold text-green-400 whitespace-nowrap">
                  ${rec.product?.price}
                </span>
              </div>

              <p className="text-xs text-slate-300 mb-3 leading-tight">{rec.reasoning}</p>

              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-1">
                  {rec.product?.colors.slice(0, 3).map((color, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded border border-slate-700"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <span className="text-xs text-indigo-400 font-bold">
                  {Math.round((rec.compatibilityScore || 0.85) * 100)}% match
                </span>
              </div>

              <button
                onClick={() => rec.product && handleAddProduct(rec.product)}
                className="w-full py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <Plus size={14} />
                Add to Room
              </button>
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Package className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-xs text-slate-400">
              {query ? "No recommendations found" : "Search for products to get started"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

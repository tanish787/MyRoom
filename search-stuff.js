import React, { useState, useEffect } from 'react';
import { Sparkles, Package, Search, Loader2, AlertCircle } from 'lucide-react';

const OPENROUTER_API_KEY = "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"; // ← REPLACE THIS!

export default function RoomMarketplaceRecommender() {
  const [marketplaceProducts, setMarketplaceProducts] = useState([]);
  const [roomState, setRoomState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [recommendations, setRecommendations] = useState(null);
  const [processingQuery, setProcessingQuery] = useState(false);
  const [error, setError] = useState(null);

  // Load JSON files on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load marketplace products
        const productsResponse = await fetch('/marketplace-products.json');
        const products = await productsResponse.json();
        setMarketplaceProducts(products);

        // Load room state
        const roomResponse = await fetch('/room-state.json');
        const room = await roomResponse.json();
        setRoomState(room);

        setLoading(false);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load data files. Make sure marketplace-products.json and room-state.json are in the public folder.");
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const callGeminiAPI = async (prompt, systemPrompt) => {
    console.log("🚀 Calling Gemini API...");
    
    if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === "YOUR_API_KEY_HERE") {
      throw new Error("⚠️ Please set your OpenRouter API key in the code! Get one at https://openrouter.ai/");
    }
    
    try {
      const requestBody = {
        model: "meta-llama/llama-3.2-3b-instruct:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      };

      console.log("📤 Request:", { model: requestBody.model, promptLength: prompt.length });
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": window.location.href || "http://localhost:3000",
          "X-Title": "Room Marketplace AI"
        },
        body: JSON.stringify(requestBody),
      });

      console.log("📥 Response status:", response.status);

      const responseText = await response.text();
      console.log("📄 Response preview:", responseText.substring(0, 200));

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("⏳ Rate limit exceeded. Wait a moment and try again, or upgrade your OpenRouter plan.");
        } else if (response.status === 401 || response.status === 403) {
          throw new Error("🔑 Invalid API key. Check your OpenRouter API key at https://openrouter.ai/keys");
        } else if (response.status === 402) {
          throw new Error("💳 Insufficient credits. Add credits to your OpenRouter account.");
        } else {
          throw new Error(`❌ API Error (${response.status}): ${responseText.substring(0, 150)}`);
        }
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        throw new Error("Failed to parse API response as JSON.");
      }

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid API response structure");
      }
      
      console.log("✅ API call successful");
      return data.choices[0].message.content;
    } catch (err) {
      console.error("❌ Gemini API Error:", err);
      throw err;
    }
  };

  const parseQuery = async (userQuery) => {
    const systemPrompt = `You are a query parser for a 3D room marketplace. Extract intent and requirements.

CRITICAL: Return ONLY valid JSON with NO markdown formatting, NO backticks, NO explanations.

Format:
{
  "intent": "replace" | "add" | "style",
  "itemType": "chair" | "plant" | "lighting" | "decor" | "wall-art",
  "location": "corner" | "wall" | null,
  "currentItemId": null,
  "additionalContext": "brief context"
}`;

    const prompt = `Query: "${userQuery}"

Room has: ${roomState.existingItems.map(i => i.name).join(", ")}
Theme: ${roomState.theme}

Return JSON only:`;

    const result = await callGeminiAPI(prompt, systemPrompt);
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  };

  const getRecommendations = async (parsedQuery) => {
    const systemPrompt = `You are an interior design AI. Recommend products from the marketplace.

CRITICAL: Return ONLY valid JSON with NO markdown, NO backticks, NO explanations.

Format:
{
  "recommendations": [
    {
      "productId": "prod_XXX",
      "reasoning": "2-3 sentences why this fits",
      "suggestedPosition": {"x": 10, "y": 0, "z": 10, "rotation": 0},
      "compatibilityScore": 0.95,
      "alternatives": [
        {"productId": "prod_YYY", "reason": "alternative reason"}
      ]
    }
  ],
  "overallRationale": "Summary of recommendations"
}`;

    const availableProducts = marketplaceProducts.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description.substring(0, 150),
      tags: p.tags
    }));

    const prompt = `Request: ${JSON.stringify(parsedQuery)}
Theme: ${roomState.theme}
Colors: ${roomState.colorPalette.join(", ")}
Current: ${roomState.existingItems.map(i => i.name).join(", ")}

Products:
${JSON.stringify(availableProducts, null, 2)}

Return 2-3 recommendations as JSON only:`;

    const result = await callGeminiAPI(prompt, systemPrompt);
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setProcessingQuery(true);
    setError(null);
    setRecommendations(null);

    try {
      console.log("\n🎯 Starting recommendation process...");
      
      const parsedQuery = await parseQuery(query);
      console.log("✅ Query parsed:", parsedQuery);
      
      const recs = await getRecommendations(parsedQuery);
      console.log("✅ Got recommendations:", recs);

      const enriched = {
        ...recs,
        recommendations: recs.recommendations.map(rec => ({
          ...rec,
          product: marketplaceProducts.find(p => p.id === rec.productId),
          alternatives: rec.alternatives?.map(alt => ({
            ...alt,
            product: marketplaceProducts.find(p => p.id === alt.productId)
          })) || []
        }))
      };

      setRecommendations(enriched);
      
    } catch (err) {
      console.error("❌ Error:", err);
      setError(err.message || "An error occurred");
    } finally {
      setProcessingQuery(false);
    }
  };

  const isApiKeySet = OPENROUTER_API_KEY && OPENROUTER_API_KEY !== "YOUR_API_KEY_HERE";

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={48} color="#4f46e5" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading data...</p>
        </div>
      </div>
    );
  }

  if (!roomState || marketplaceProducts.length === 0) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%)',
        padding: '2rem'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '16px',
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
          <h2 style={{ color: '#1e293b', marginBottom: '1rem' }}>Data Loading Error</h2>
          <p style={{ color: '#64748b', lineHeight: '1.6' }}>
            {error || "Failed to load marketplace-products.json or room-state.json. Make sure these files are in the public folder of your React app."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%)',
      fontFamily: '"Inter", -apple-system, sans-serif',
      padding: '2rem'
    }}>
      {/* API Key Warning */}
      {!isApiKeySet && (
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto 2rem',
          padding: '1rem 1.5rem',
          background: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <AlertCircle size={24} color="#f59e0b" />
          <div>
            <strong style={{ color: '#92400e' }}>API Key Required:</strong>
            <span style={{ color: '#78350f', marginLeft: '0.5rem' }}>
              Replace <code>YOUR_API_KEY_HERE</code> in the code with your OpenRouter API key from{' '}
              <a href="https://openrouter.ai/" target="_blank" rel="noopener noreferrer" style={{ color: '#4f46e5', textDecoration: 'underline' }}>
                openrouter.ai
              </a>
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto 3rem',
        textAlign: 'center'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}>
          <Sparkles size={32} color="#4f46e5" />
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0
          }}>
            AI Room Designer
          </h1>
        </div>
        <p style={{
          color: '#64748b',
          fontSize: '1.125rem',
          margin: 0
        }}>
          Get intelligent product recommendations for your 3D space
        </p>
      </div>

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '2rem'
      }}>
        {/* Room State Panel */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 15px rgba(0, 0, 0, 0.1)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem'
          }}>
            <Package size={24} color="#4f46e5" />
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#1e293b',
              margin: 0
            }}>
              Current Room
            </h2>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#475569',
              marginBottom: '0.5rem'
            }}>
              Theme
            </div>
            <div style={{
              padding: '0.75rem 1rem',
              background: '#f1f5f9',
              borderRadius: '8px',
              color: '#1e293b',
              fontWeight: '500'
            }}>
              {roomState.theme}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#475569',
              marginBottom: '0.5rem'
            }}>
              Existing Items
            </div>
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0.5rem'
            }}>
              {roomState.existingItems.map(item => (
                <div key={item.id} style={{
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  background: '#f8fafc',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}>
                  <div style={{ fontWeight: '600', color: '#1e293b' }}>{item.name}</div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    {item.category}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            padding: '1rem',
            background: '#f0fdf4',
            borderRadius: '8px',
            fontSize: '0.875rem'
          }}>
            <strong style={{ color: '#166534' }}>Loaded:</strong>
            <div style={{ color: '#15803d', marginTop: '0.25rem' }}>
              {marketplaceProducts.length} products available
            </div>
          </div>
        </div>

        {/* Query Panel */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 15px rgba(0, 0, 0, 0.1)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem'
          }}>
            <Search size={24} color="#4f46e5" />
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#1e293b',
              margin: 0
            }}>
              What are you looking for?
            </h2>
          </div>

          <form onSubmit={handleSubmit}>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., 'I need a plant for that empty corner' or 'Something to make my room more green and natural'"
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '1rem',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none'
              }}
            />

            <button
              type="submit"
              disabled={processingQuery || !isApiKeySet}
              style={{
                width: '100%',
                marginTop: '1rem',
                padding: '1rem',
                background: (processingQuery || !isApiKeySet) ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: (processingQuery || !isApiKeySet) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {processingQuery ? (
                <>
                  <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Get Recommendations
                </>
              )}
            </button>
          </form>

          {error && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
              fontSize: '0.875rem',
              lineHeight: '1.5'
            }}>
              {error}
            </div>
          )}

          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: '#f0f9ff',
            borderRadius: '8px',
            fontSize: '0.875rem',
            color: '#0369a1'
          }}>
            <strong>💡 Try:</strong> "I need something to make my room more green and natural"
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations && (
        <div style={{
          maxWidth: '1400px',
          margin: '2rem auto 0',
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 15px rgba(0, 0, 0, 0.1)',
        }}>
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: '600',
            color: '#1e293b',
            marginBottom: '1rem'
          }}>
            ✨ Recommendations
          </h2>

          <p style={{
            color: '#64748b',
            marginBottom: '2rem',
            lineHeight: '1.6'
          }}>
            {recommendations.overallRationale}
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.5rem'
          }}>
            {recommendations.recommendations.map((rec, idx) => (
              <div key={idx} style={{
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.5rem',
                transition: 'all 0.2s'
              }}>
                <div style={{
                  width: '100%',
                  height: '180px',
                  background: 'linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%)',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  color: '#4338ca',
                  textAlign: 'center',
                  padding: '1rem'
                }}>
                  {rec.product?.name}
                </div>

                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '0.5rem'
                }}>
                  {rec.product?.name}
                </h3>

                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginBottom: '0.75rem'
                }}>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    background: '#dbeafe',
                    color: '#1e40af',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '500'
                  }}>
                    ${rec.product?.price}
                  </span>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    background: '#dcfce7',
                    color: '#166534',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '500'
                  }}>
                    {Math.round(rec.compatibilityScore * 100)}% match
                  </span>
                </div>

                <p style={{
                  fontSize: '0.875rem',
                  color: '#475569',
                  lineHeight: '1.5',
                  marginBottom: '1rem'
                }}>
                  {rec.reasoning}
                </p>

                {rec.alternatives && rec.alternatives.length > 0 && (
                  <div style={{
                    padding: '0.75rem',
                    background: '#fefce8',
                    borderRadius: '6px',
                    fontSize: '0.75rem'
                  }}>
                    <strong style={{ color: '#854d0e' }}>Also consider:</strong>
                    <div style={{ color: '#a16207', marginTop: '0.25rem' }}>
                      {rec.alternatives[0]?.product?.name}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

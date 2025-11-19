
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { MODEL_SMART, MODEL_FAST } from "../constants";
import { Shot, TimelineEvent, Subtitle, BrowserAction } from "../types";

// Helper to convert blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result as string;
      // Remove the data URL prefix (e.g., "data:video/webm;base64,")
      const base64Content = base64data.split(',')[1];
      resolve(base64Content);
    };
    reader.onerror = reject;
  });
};

// Helper to decode base64 audio string to Uint8Array
function decodeBase64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to write string to DataView
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Helper to add WAV header to raw PCM data
function addWavHeader(pcmData: Uint8Array, sampleRate: number, numChannels: number = 1, bitDepth: number = 16): ArrayBuffer {
  const headerLength = 44;
  const dataLength = pcmData.length;
  const buffer = new ArrayBuffer(headerLength + dataLength);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length (data + header - 8)
  view.setUint32(4, 36 + dataLength, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * blockAlign)
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataLength, true);

  // write the PCM data
  const pcmView = new Uint8Array(buffer, headerLength);
  pcmView.set(pcmData);

  return buffer;
}

export const generateShotList = async (url: string, description: string): Promise<Shot[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    I am creating a demo video for a web application at this URL: ${url}.
    App Description: ${description}.
    
    Please generate a "Shot List" for a 30-45 second screen recording demo. 
    The user will manually navigate the app while recording.
    Provide 3-5 key steps/shots they should perform to showcase the value proposition.
    Keep actions simple and direct.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_FAST,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            action: { type: Type.STRING, description: "Short directive, e.g. 'Click Sign Up'" },
            description: { type: Type.STRING, description: "Why we are doing this" },
            estimatedDuration: { type: Type.NUMBER, description: "Seconds" }
          },
          required: ["id", "action", "description", "estimatedDuration"]
        }
      }
    }
  });

  try {
    const result = JSON.parse(response.text || '[]');
    return result as Shot[];
  } catch (e) {
    console.error("Failed to parse shot list JSON", e);
    return [];
  }
};

export const generateBrowserActions = async (url: string, description: string): Promise<BrowserAction[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
      I need to simulate an AI agent browsing the following website: ${url} (${description}).
      Generate a sequence of 5-8 "Browser Actions" that the agent should perform to demonstrate the app.
      Assume a 1280x720 viewport.
      
      Actions should be:
      - 'click': Simulates clicking a button/link
      - 'type': Simulates typing input
      - 'scroll': Simulates scrolling down
      - 'wait': Pausing for loading
      
      Provide a likely CSS Selector for the target element (e.g. "button.login-btn", "#hero-cta", "input[name='email']").
      Also assign plausible X/Y percentage coordinates (0-100) for visualization.
    `;

    const response = await ai.models.generateContent({
        model: MODEL_FAST,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        action: { type: Type.STRING, enum: ['click', 'type', 'scroll', 'wait'] },
                        target: { type: Type.STRING },
                        selector: { type: Type.STRING, description: "CSS selector for Puppeteer" },
                        details: { type: Type.STRING },
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER },
                        duration: { type: Type.NUMBER }
                    },
                    required: ["id", "action", "target", "selector", "details", "x", "y", "duration"]
                }
            }
        }
    });

    try {
        const result = JSON.parse(response.text || '[]');
        return result as BrowserAction[];
    } catch (e) {
        console.error("Failed to parse browser actions", e);
        return [];
    }
};

export const analyzeVideoAndGenerateTimeline = async (videoBlob: Blob, url: string, description: string): Promise<{ timeline: TimelineEvent[], subtitles: Subtitle[], script: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Video = await blobToBase64(videoBlob);

  // Clean MIME type for API compatibility
  let mimeType = videoBlob.type || 'video/webm';
  if (mimeType.includes(';')) {
    mimeType = mimeType.split(';')[0];
  }

  const prompt = `
    Analyze this screen recording of the app "${url}" (Description: ${description}).
    
    Task:
    1. Create a set of Voiceover Subtitles. These should be spoken sentences or phrases, timestamped to the video. 
       The concatenated text of these subtitles will be used to generate the audio.
    2. Create a separate Timeline of VISUAL events (highlighting/zooming/popup text) synced to specific actions on screen.

    Requirements:
    - Subtitles should explain the value proposition clearly.
    - Visual Events should highlight buttons or show short 2-3 word labels (e.g. "Easy Login").
    - Timestamps must be strictly within the video duration.
    - IMPORTANT: Ensure Visual Events have a duration of at least 2 seconds so they are readable.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_SMART,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Video
            }
          },
          {
            text: prompt
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subtitles: {
              type: Type.ARRAY,
              description: "Spoken narration split into timed segments.",
              items: {
                type: Type.OBJECT,
                properties: {
                  startTime: { type: Type.NUMBER },
                  endTime: { type: Type.NUMBER },
                  text: { type: Type.STRING }
                },
                required: ["startTime", "endTime", "text"]
              }
            },
            visualEvents: {
              type: Type.ARRAY,
              description: "Visual overlays like zooms or short labels.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  startTime: { type: Type.NUMBER },
                  endTime: { type: Type.NUMBER },
                  text: { type: Type.STRING, description: "Short label text." },
                  type: { type: Type.STRING, enum: ["caption", "zoom", "highlight"] },
                  details: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER },
                      zoomScale: { type: Type.NUMBER }
                    }
                  }
                },
                required: ["id", "startTime", "endTime", "text", "type"]
              }
            }
          },
          required: ["subtitles", "visualEvents"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI model");

    const result = JSON.parse(text);
    
    // Fallback data if analysis fails to return structure
    const subtitles: Subtitle[] = result.subtitles || [
        { startTime: 0, endTime: 5, text: "Welcome to the demo of " + url }
    ];
    
    let timeline: TimelineEvent[] = result.visualEvents || [];

    // Sanitize Timeline: Ensure events are at least 2 seconds and start < end
    timeline = timeline.map(t => {
        let end = t.endTime;
        if (end - t.startTime < 2.0) {
            end = t.startTime + 2.0;
        }
        return { ...t, endTime: end };
    }).sort((a, b) => a.startTime - b.startTime);

    // Construct full script from subtitles for TTS consistency
    const script = subtitles.map(s => s.text).join(' ');

    return {
      timeline,
      subtitles: subtitles.sort((a: any, b: any) => a.startTime - b.startTime),
      script
    };

  } catch (error) {
    console.error("Error generating timeline:", error);
    throw error;
  }
};

export const generateVoiceover = async (text: string): Promise<Blob> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: {
        parts: [{ text }]
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (!part || !part.inlineData || !part.inlineData.data) {
      throw new Error("No audio data received");
    }

    const base64Audio = part.inlineData.data;
    const pcmData = decodeBase64ToUint8Array(base64Audio);
    
    // Add WAV header for compatibility
    const wavBuffer = addWavHeader(pcmData, 24000, 1, 16);

    return new Blob([wavBuffer], { type: 'audio/wav' });
  } catch (error) {
    console.error("Error generating voiceover:", error);
    throw error;
  }
};

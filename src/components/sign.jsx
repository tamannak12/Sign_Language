import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Note: You'll need to replace 'YOUR_API_KEY' with your actual Gemini API key
const API_KEY = import.meta.env.VITE_GEMINI_API;
const genAI = new GoogleGenerativeAI(API_KEY);

// Hardcoded prompt for sign language interpretation
const HARDCODED_PROMPT = `Analyze the provided sequence of images or video frames depicting sign language gestures. Your task is to:

1. Interpret the signs accurately, considering:
   - Hand shapes, movements, and positions
   - Facial expressions and body language
   - Any contextual clues within the images

2. Translate the signs into natural, conversational English that captures:
   - The literal meaning of the signs
   - The underlying emotion and tone
   - Any cultural nuances specific to the sign language being used

3. Formulate a response as if you're engaged in a real conversation:
   - Use a friendly, approachable tone
   - Reflect the emotion conveyed in the signs
   - Keep responses concise but natural-sounding

4. If the visual input is unclear or insufficient:
   - Politely mention which aspects are ambiguous
   - Suggest that additional images or video could help with a more accurate interpretation
   - Provide your best interpretation based on available information

5. Be aware of and respect:
   - Different sign language variants (e.g., ASL, BSL, Auslan)
   - The importance of non-manual markers in conveying meaning
   - The three-dimensional nature of sign language when interpreting 2D images

6. If you recognize specific signs or phrases, mention them in your explanation to demonstrate your reasoning.

7. If the signs seem to be part of a longer conversation, acknowledge this and provide context for your response.

Remember, the goal is to bridge communication effectively, ensuring the essence of the signed message is conveyed accurately and naturally in your response.`;

export default function SignLanguageConversation() {
  const [isRecording, setIsRecording] = useState(false);
  const [response, setResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [frameSequence, setFrameSequence] = useState([]);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setupCamera();
    return () => {
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const setupCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Error: Unable to access camera. Please check your permissions and try again.');
    }
  };

  const startRecording = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      setIsRecording(true);
      setError(null);
      setFrameSequence([]); // Clear any previous frames
      captureFrame(); // Start capturing frames
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    setIsProcessing(true);
    sendVideoSequenceToGoogleGenerativeAI(frameSequence); // Send collected frames
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      context.drawImage(
        videoRef.current,
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );
      canvasRef.current.toBlob((blob) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result.split(",")[1];
          setFrameSequence((prevFrames) => [...prevFrames, base64data]); // Store each frame in the sequence
        };
      }, "image/png");
    }
  };

  useEffect(() => {
    let frameCaptureInterval;
    if (isRecording) {
      frameCaptureInterval = setInterval(captureFrame, 1000); // Capture every second
    }
    return () => clearInterval(frameCaptureInterval);
  }, [isRecording]);

  const sendVideoSequenceToGoogleGenerativeAI = async (frames) => {
    if (!frames || frames.length === 0) {
      console.error("Frame sequence must be present to send to the API");
      setIsProcessing(false);
      return;
    }

    setIsSending(true);
    setResponse(""); // Clear previous response

    try {
      const imageParts = frames.map(frame => ({
        inlineData: {
          data: frame,
          mimeType: "image/png",
        },
      }));

      // Make sure your genAI instance is properly instantiated and authorized
      const model = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent([
        HARDCODED_PROMPT,
        ...imageParts,
      ]);

      const response = await result.response;
      const text = await response.text();
      setResponse(text);
    } catch (error) {
      console.error("Error calling Google Generative AI API:", error);
      if (error.response) {
        console.error(`API Response Error: ${error.response.data}`);
        setError(`Error processing sign language: ${error.response.data.error.message}. Please try again.`);
      } else {
        setError(`Unexpected error: ${error.message}. Please try again.`);
      }
    } finally {
      setIsProcessing(false);
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 to-indigo-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Sign Language Interpreter</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white/10 rounded-lg p-6 backdrop-blur-md">
            <h2 className="text-2xl font-semibold mb-4">Your Camera Feed</h2>
            <div className="relative aspect-video rounded-lg overflow-hidden">
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: "rotateY(180deg)" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
            </div>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`mt-4 w-full py-3 rounded-full font-semibold transition-all duration-300 ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
          </div>
          <div className="bg-white/10 rounded-lg p-6 backdrop-blur-md">
            <h2 className="text-2xl font-semibold mb-4">Interpretation</h2>
            <div className="bg-white/5 rounded-lg p-4 h-[calc(100%-4rem)] overflow-auto">
              {isProcessing || isSending ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                </div>
              ) : error ? (
                <p className="text-red-400 text-lg leading-relaxed">{error}</p>
              ) : (
                <p className="text-lg leading-relaxed">{response}</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width="640"
        height="480"
        className="hidden"
      />
    </div>
  );
}

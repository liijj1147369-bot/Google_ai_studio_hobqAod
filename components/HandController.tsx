import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HandGestureState } from '../types';

interface HandControllerProps {
  onGestureUpdate: (state: HandGestureState) => void;
}

const HandController: React.FC<HandControllerProps> = ({ onGestureUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<string>('Initializing System...');
  const [isError, setIsError] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  
  const lastVideoTimeRef = useRef<number>(-1);
  const requestRef = useRef<number>(0);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  
  // Keep track of the stream to stop it properly
  const streamRef = useRef<MediaStream | null>(null);

  const previousStateRef = useRef<HandGestureState>({
    isPalmOpen: false,
    isFist: false,
    isPinching: false,
    pinchDistance: 0,
    handPosition: { x: 0.5, y: 0.5 }
  });

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log("Stopped track:", track.label);
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = async () => {
    try {
      setStatus('Requesting Camera Access...');
      console.log("Requesting Camera...");

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser does not support camera access");
      }

      // Stop any existing stream first
      stopCamera();

      // Simple constraints to maximize compatibility
      const constraints = { 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 } 
          // Removed facingMode to prevent issues on devices without 'user' camera
        },
        audio: false 
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Stream acquired:", stream.id);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStatus('Waiting for video data...');
        
        // Wait for video to actually load data
        videoRef.current.onloadeddata = () => {
            console.log("Video data loaded");
            setStatus('Playing video...');
            videoRef.current?.play()
              .then(() => {
                setCameraReady(true);
                setStatus('Active: Tracking Hands');
                console.log("Video playing");
              })
              .catch(e => {
                console.error("Play failed:", e);
                setIsError(true);
                setStatus(`Autoplay prevented: ${e.message}`);
              });
        };
      }
    } catch (e: any) {
      console.error("Camera Error:", e);
      setIsError(true);
      setStatus(`Camera Error: ${e.name} - ${e.message}`);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initLandmarker = async () => {
      try {
        console.log("Loading MediaPipe WASM...");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        if (!isMounted) return;

        console.log("Creating Landmarker...");
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        if (!isMounted) {
            landmarker.close();
            return;
        }

        landmarkerRef.current = landmarker;
        console.log("Landmarker Ready. Starting Camera...");
        
        // Only start camera once AI is ready
        startCamera();

      } catch (e: any) {
        console.error("AI Init Failed:", e);
        if (isMounted) {
            setIsError(true);
            setStatus(`AI Init Failed: ${e.message}`);
        }
      }
    };

    initLandmarker();

    return () => {
      isMounted = false;
      stopCamera();
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (landmarkerRef.current) {
          landmarkerRef.current.close();
      }
    };
  }, [stopCamera]);

  // Detection Loop
  const predictWebcam = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (cameraReady && video && landmarker && !video.paused && !video.ended) {
      // Ensure video dimensions are valid
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            const startTimeMs = performance.now();
            
            try {
            const result = landmarker.detectForVideo(video, startTimeMs);

            let newState: HandGestureState;

            if (result.landmarks && result.landmarks.length > 0) {
                const landmarks = result.landmarks[0];
                
                const thumbTip = landmarks[4];
                const indexTip = landmarks[8];
                const pinkyTip = landmarks[20];
                const wrist = landmarks[0];

                // Gesture Logic
                const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
                const isPinching = pinchDist < 0.08;

                const dIndex = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y);
                const dPinky = Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y);
                
                // Fist: Tips close to wrist
                const isFist = dIndex < 0.15 && dPinky < 0.15; 
                // Palm: Tips far from wrist
                const isPalmOpen = !isFist && !isPinching && dIndex > 0.2;

                // Invert X for mirroring
                const cursorX = 1 - indexTip.x; 
                const cursorY = indexTip.y;

                newState = {
                    isPalmOpen,
                    isFist,
                    isPinching,
                    pinchDistance: pinchDist,
                    handPosition: { x: cursorX, y: cursorY }
                };
            } else {
                newState = {
                    isPalmOpen: false,
                    isFist: false,
                    isPinching: false,
                    pinchDistance: 0,
                    handPosition: { x: 0.5, y: 0.5 }
                };
            }

            // Throttle updates
            const prev = previousStateRef.current;
            const hasChanged = 
                prev.isPalmOpen !== newState.isPalmOpen ||
                prev.isFist !== newState.isFist ||
                prev.isPinching !== newState.isPinching ||
                Math.abs(prev.pinchDistance - newState.pinchDistance) > 0.05;

            if (hasChanged) {
                previousStateRef.current = newState;
                onGestureUpdate(newState);
            }
            } catch (err) {
                console.warn("Detection Loop Error:", err);
            }
        }
      }
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  }, [cameraReady, onGestureUpdate]);

  useEffect(() => {
      if (cameraReady) {
          requestRef.current = requestAnimationFrame(predictWebcam);
      }
      return () => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      }
  }, [cameraReady, predictWebcam]);

  return (
    <div className="absolute bottom-4 right-4 z-50 flex flex-col items-end">
       {/* Status Panel */}
       <div className={`mb-2 p-2 rounded text-[10px] font-mono border backdrop-blur-md transition-colors duration-300 ${
           isError ? 'bg-red-900/80 border-red-500 text-white' : 
           cameraReady ? 'bg-black/60 border-green-500/50 text-green-400' : 
           'bg-blue-900/60 border-blue-500 text-blue-200'
       }`}>
           <div className="flex items-center gap-2 mb-1">
               <div className={`w-2 h-2 rounded-full ${cameraReady ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
               <span className="font-bold">{status}</span>
           </div>
           
           {isError && (
               <button 
                onClick={() => { setIsError(false); startCamera(); }}
                className="mt-1 px-2 py-1 bg-white text-black rounded hover:bg-gray-200 w-full"
               >
                   Retry Camera
               </button>
           )}
       </div>

       {/* Camera View */}
       <div className="relative rounded-lg overflow-hidden border-2 border-white/20 shadow-2xl bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-48 h-36 object-cover transform scale-x-[-1] transition-opacity duration-500 ${cameraReady ? 'opacity-100' : 'opacity-30'}`}
        />
        {!cameraReady && !isError && (
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )}
      </div>
    </div>
  );
};

export default HandController;
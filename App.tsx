import React, { useState, useEffect, useRef } from 'react';
import Visualizer from './components/Visualizer';
import { MqttService } from './services/mqttClient';
import { LaunchState } from './types';
import { VISUAL_CONFIG } from './constants';
import { audioEngine } from './services/audioEngine';

const App: React.FC = () => {
  const [currentState, setCurrentState] = useState<LaunchState>(LaunchState.WAITING);
  const [error, setError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  
  // Track previous state to trigger sound transitions
  const prevStateRef = useRef<LaunchState>(LaunchState.WAITING);

  useEffect(() => {
    // 1. MQTT Setup
    const mqttService = new MqttService((newState: LaunchState) => {
      setCurrentState(newState);
    });

    try {
      mqttService.connect();
    } catch (err) {
      setError("MQTT连接失败");
      console.error(err);
    }

    // 2. Keyboard Listener for Reset
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') {
        console.log("Resetting to WAITING state...");
        setCurrentState(LaunchState.WAITING);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // 3. Try auto-start audio on load (fallback to click if blocked)
    (async () => {
      try {
        await audioEngine.init();
        audioEngine.playBGM();
        setAudioEnabled(true);
      } catch (e) {
        console.warn("Auto audio start failed, will wait for user interaction.", e);
      }
    })();

    // Cleanup
    return () => {
      mqttService.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      audioEngine.stopBGM();
    };
  }, []);

  // 3. Audio Effect Logic
  useEffect(() => {
    if (!audioEnabled) return;

    // Trigger sounds based on state CHANGE
    if (currentState !== prevStateRef.current) {
      switch (currentState) {
        case LaunchState.WAVE_DETECTED:
          audioEngine.playWaveSFX();
          break;
        case LaunchState.HEART_DETECTED:
          audioEngine.playHeartSFX();
          break;
        case LaunchState.LAUNCHING:
          audioEngine.playLaunchSFX();
          break;
        case LaunchState.WAITING:
           // Reset logic if needed
           break;
      }
    }
    prevStateRef.current = currentState;
  }, [currentState, audioEnabled]);

  // 4. Robust unlock: attach first-gesture listeners as fallback
  useEffect(() => {
    if (audioEnabled) return;
    const unlock = async () => {
      try {
        await audioEngine.init();
        audioEngine.playBGM();
        setAudioEnabled(true);
      } catch (e) {
        console.warn("Gesture unlock failed:", e);
      }
    };
    const events = ['pointerdown', 'touchstart', 'keydown'];
    events.forEach(ev => window.addEventListener(ev, unlock, { once: true }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !audioEnabled) {
        unlock();
      }
    }, { once: true });
    return () => {
      events.forEach(ev => window.removeEventListener(ev, unlock));
    };
  }, [audioEnabled]);

  // Handle User Interaction to Unlock Audio Context
  // UPDATED: Now async to ensure context is ready before playing
  const handleStartAudio = async () => {
    if (!audioEnabled) {
      try {
        await audioEngine.init();
        audioEngine.playBGM();
        setAudioEnabled(true);
      } catch (e) {
        console.error("Audio initialization failed:", e);
        setError("音频初始化失败，请检查浏览器设置");
      }
    }
  };

  // Update Status Colors
  const getStatusStyles = () => {
    switch (currentState) {
      case LaunchState.WAITING: 
        return {
          text: 'text-gray-400',
          border: 'border-gray-800 bg-black/40',
          indicator: 'bg-gray-500',
          logoBorder: 'border-gray-700'
        };
      case LaunchState.WAVE_DETECTED: 
        return {
          text: 'text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.9)]',
          border: 'border-cyan-500 shadow-[0_0_30px_rgba(34,211,238,0.2)] bg-black/50',
          indicator: 'bg-cyan-400 animate-ping',
          logoBorder: 'border-cyan-500 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]'
        };
      case LaunchState.HEART_DETECTED: 
        return {
          text: 'text-pink-500 drop-shadow-[0_0_20px_rgba(236,72,153,1)]',
          border: 'border-pink-500 shadow-[0_0_40px_rgba(236,72,153,0.3)] bg-black/50',
          indicator: 'bg-pink-500 animate-bounce',
          logoBorder: 'border-pink-500 drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]'
        };
      case LaunchState.LAUNCHING: 
        // During launching, we want to HIDE the box so P5 text shows
        return {
          text: 'opacity-0',
          border: 'opacity-0', 
          indicator: 'opacity-0',
          logoBorder: 'opacity-0'
        };
      default: return { text: '', border: '', indicator: '', logoBorder: '' };
    }
  };

  const styles = getStatusStyles();
  const isLaunching = currentState === LaunchState.LAUNCHING;

  return (
    <div 
      className="relative w-screen h-screen bg-black overflow-hidden flex flex-col items-center justify-center select-none"
      onClick={handleStartAudio} // Click anywhere to enable audio if not enabled
    >
      
      {/* Background P5.js Visualization */}
      <Visualizer state={currentState} />

      {/* HTML Audio Fallback (some browsers allow autoplay here) */}
      <audio
        src="/sounds/bgm.mp3"
        autoPlay
        loop
        playsInline
        style={{ display: 'none' }}
      />

      {/* Decorative Grid Lines */}
      <div className="absolute inset-0 z-1 pointer-events-none opacity-20" 
           style={{backgroundImage: 'linear-gradient(rgba(50, 50, 50, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(50, 50, 50, 0.3) 1px, transparent 1px)', backgroundSize: '60px 60px'}}>
      </div>

      

      {/* Main UI Container 
          Added transition-opacity to fade out smoothly during Launch
      */}
      <div 
        className={`
          z-10 relative flex flex-col items-center justify-center
          p-12 w-[600px] min-h-[400px]
            transition-all duration-700
          ${styles.border}
          ${isLaunching ? 'opacity-0 scale-150 pointer-events-none' : 'opacity-100 scale-100'}
        `}
      >
        
        {/* Decorative Corners */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-current opacity-70"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-current opacity-70"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-current opacity-70"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-current opacity-70"></div>

        {/* LOGO PLACEHOLDER */}
        <div className={`
            mb-8 w-32 h-32 rounded-full border-2 flex items-center justify-center 
            bg-black/50 transition-colors duration-500
            ${styles.logoBorder}
        `}>
            <img src="/images/logo.png" alt="logo" className=" text-gray-400 opacity-50" />
             {/* Replace this SVG with your <img src="..." /> */}
             {/* <svg className="w-16 h-16 text-gray-400 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"/>
             </svg> */}
             {/* <span className="absolute text-[10px] font-mono mt-1 text-gray-500 bottom-2"></span> */}
        </div>

        {/* Status Text */}
        <h1 
          className={`text-5xl md:text-7xl font-bold tracking-widest font-shock text-center mb-6 transition-colors duration-300 ${styles.text}`}
        >
          {VISUAL_CONFIG.TEXT_MAP[currentState]}
        </h1>
        
        {/* Monitoring Dots */}
        <div className="flex items-center justify-center gap-4 font-mono text-sm tracking-[0.3em] text-gray-400">
             <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${styles.indicator}`}></div>
             <span className="font-mono text-sm " >临河里小学</span>
             <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${styles.indicator}`}></div>
        </div>
      </div>

      {/* Instructions Overlay */}
      <div className="absolute top-4 right-4 z-50 text-gray-600 font-mono text-xs border border-gray-800 p-2 opacity-30 hover:opacity-100 transition-opacity">
        PRESS 'R' TO RESET
      </div>

      {/* Error Message */}
      {error && (
        <div className="absolute top-10 z-50 text-xs text-red-500 font-mono bg-black/80 px-4 py-2 border border-red-900">
            ⚠ 警告: {error}
        </div>
      )}

      {/* HUD / Status Info (Bottom Right) */}
      <div className="absolute bottom-8 right-8 z-20 text-right opacity-80">
        <div className="text-gray-600 text-[10px] font-mono leading-tight">
          <p>PROTOCOL: MQTT_SECURE</p>
          <p>LINK: 127.0.0.1:1888</p>
          <p className="mt-1 text-gray-400">STATE: {currentState}</p>
          <p className="mt-1 text-gray-500">AUDIO: {audioEnabled ? 'ON' : 'OFF'}</p>
        </div>
      </div>
      
    </div>
  );
};

export default App;

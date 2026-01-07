import React, { useState, useEffect, useRef } from 'react';
import Visualizer from './components/Visualizer';
import { triggerStep, resetState } from './services/restClient';
import { LaunchState } from './types';
import { VISUAL_CONFIG, API_CONFIG } from './constants';
import { audioEngine } from './services/audioEngine';

const App: React.FC = () => {
  const [currentState, setCurrentState] = useState<LaunchState>(LaunchState.WAITING);
  const [error, setError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const prevStateRef = useRef<LaunchState>(LaunchState.WAITING);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') {
        setCurrentState(LaunchState.WAITING);
        return;
      }
      if (event.key === '1') {
        triggerStep('step1').then((resp) => {
          if (resp.status === 200) setCurrentState(LaunchState.WAVE_DETECTED);
          else setError("步骤1执行失败");
        }).catch(() => setError("步骤1执行错误"));
        return;
      }
      if (event.key === '2') {
        triggerStep('step2').then((resp) => {
          if (resp.status === 200) setCurrentState(LaunchState.HEART_DETECTED);
          else setError("步骤2执行失败");
        }).catch(() => setError("步骤2执行错误"));
        return;
      }
      if (event.key === '3') {
        triggerStep('step3', { atomic: true }).then((resp) => {
          if (resp.status === 200) setCurrentState(LaunchState.LAUNCHING);
          else setError("步骤3执行失败");
        }).catch(() => setError("步骤3执行错误"));
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    (async () => {
      try {
        await resetState();
        setCurrentState(LaunchState.WAITING);
      } catch { }
      try {
        await audioEngine.init();
        audioEngine.playBGM();
        setAudioEnabled(true);
      } catch (e) { }
    })();
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      audioEngine.stopBGM();
    };
  }, []);

  useEffect(() => {
    let attempts = 0;
    const tryPlay = async () => {
      if (audioEnabled) return;
      try {
        const el = htmlAudioRef.current;
        if (el) {
          el.muted = true;
          el.volume = 0.0;
          await el.play();
          setAudioEnabled(true);
          setTimeout(() => {
            el.muted = false;
            el.volume = 0.5;
          }, 300);
          return;
        }
      } catch { }
      try {
        await audioEngine.init();
        audioEngine.playBGM();
        setAudioEnabled(true);
        return;
      } catch { }
      attempts++;
      if (attempts < 10) setTimeout(tryPlay, 1000);
    };
    tryPlay();
    const onVisible = () => { tryPlay(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); };
  }, [audioEnabled]);

  useEffect(() => {
    let es: EventSource | null = null;
    let interval: any = null;
    try {
      es = new EventSource(`${API_CONFIG.BASE_URL}/api/steps/sse`);
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.state === 'WAVE_DETECTED') setCurrentState(LaunchState.WAVE_DETECTED);
          else if (data.state === 'HEART_DETECTED') setCurrentState(LaunchState.HEART_DETECTED);
          else if (data.state === 'LAUNCHING') setCurrentState(LaunchState.LAUNCHING);
          else if (data.state === 'WAITING') setCurrentState(LaunchState.WAITING);
        } catch { }
      };
      es.onerror = () => { es?.close(); es = null; };
    } catch { }
    if (!es) {
      interval = setInterval(async () => {
        try {
          const r = await fetch(`${API_CONFIG.BASE_URL}/api/steps/state`);
          const j = await r.json();
          const s = j.state;
          if (s === 'WAVE_DETECTED') setCurrentState(LaunchState.WAVE_DETECTED);
          else if (s === 'HEART_DETECTED') setCurrentState(LaunchState.HEART_DETECTED);
          else if (s === 'LAUNCHING') setCurrentState(LaunchState.LAUNCHING);
          else if (s === 'WAITING') setCurrentState(LaunchState.WAITING);
        } catch { }
      }, 1000);
    }
    return () => {
      if (es) es.close();
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!audioEnabled) return;
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
          break;
      }
    }
    prevStateRef.current = currentState;
  }, [currentState, audioEnabled]);

  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (currentState === LaunchState.LAUNCHING) {
      setCountdown(5);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setCountdown(null);
    }
  }, [currentState]);

  const getStatusStyles = () => {
    switch (currentState) {
      case LaunchState.WAITING:
        return { text: 'text-gray-400', border: 'border-gray-800 bg-black/40', indicator: 'bg-gray-500', logoBorder: 'border-gray-700' };
      case LaunchState.WAVE_DETECTED:
        return { text: 'text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.9)]', border: 'border-cyan-500 shadow-[0_0_30px_rgba(34,211,238,0.2)] bg-black/50', indicator: 'bg-cyan-400 animate-ping', logoBorder: 'border-cyan-500 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]' };
      case LaunchState.HEART_DETECTED:
        return { text: 'text-pink-500 drop-shadow-[0_0_20px_rgba(236,72,153,1)]', border: 'border-pink-500 shadow-[0_0_40px_rgba(236,72,153,0.3)] bg-black/50', indicator: 'bg-pink-500 animate-bounce', logoBorder: 'border-pink-500 drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]' };
      case LaunchState.LAUNCHING:
        if (countdown !== null) {
          // During countdown style
          return { text: 'text-yellow-400 drop-shadow-[0_0_25px_rgba(250,204,21,1)] scale-150', border: 'border-yellow-500/50 shadow-[0_0_50px_rgba(250,204,21,0.4)] bg-black/60', indicator: 'bg-yellow-500 animate-pulse', logoBorder: 'border-yellow-500' };
        }
        // Final launch style
        return { text: 'text-white drop-shadow-[0_0_30px_rgba(255,255,255,1)]', border: 'opacity-0', indicator: 'opacity-0', logoBorder: 'opacity-0' };
      default: return { text: '', border: '', indicator: '', logoBorder: '' };
    }
  };

  const styles = getStatusStyles();
  const isLaunching = currentState === LaunchState.LAUNCHING && countdown === null;

  const handleStartAudio = async () => {
    if (!audioEnabled) {
      try {
        await audioEngine.init();
        audioEngine.playBGM();
        setAudioEnabled(true);
      } catch (e) {
        setError("音频初始化失败，请检查浏览器设置");
      }
    }
  };

  const showVisualizer = currentState !== LaunchState.WAITING;

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col items-center select-none font-sans"
      onClick={handleStartAudio}
      style={{
        backgroundImage: 'url(/images/bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Visualizer - Fullscreen and conditionally visible */}
      <div className={`absolute inset-0 z-0 transition-opacity duration-1000 ${showVisualizer ? 'opacity-100' : 'opacity-0'}`}>
        <Visualizer state={currentState} />
      </div>

      {/* Logos */}
      <div className="absolute top-8 left-8 z-20">
        <img src="/images/logo11.png" alt="Left Logo" className="h-32 w-auto object-contain" />
      </div>
      <div className="absolute top-8 right-8 z-20">
        <img src="/images/logo12.png" alt="Right Logo" className="h-32 w-auto object-contain" />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-between py-12 pointer-events-none">

        {/* Title Section */}
        <div className="flex flex-col items-center mt-8">
          <h2 className="text-4xl md:text-6xl font-bold text-white tracking-widest drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] font-[SimHei,sans-serif]"
            style={{ textShadow: '0 0 20px rgba(50,50,255,0.8)' }}>
            2025-2026年
          </h2>
          <h1 className="text-5xl md:text-7xl font-bold text-white mt-4 tracking-wider drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] font-[SimHei,sans-serif]"
            style={{
              background: 'linear-gradient(to bottom, #ffffff 0%, #a0cfff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 20px rgba(0,100,255,0.6))'
            }}>
            秦皇岛市无人机足球联赛
          </h1>
        </div>

        {/* Dynamic Status Text Overlay - Centered */}
        <div className={`flex-1 flex flex-col items-center justify-center w-full transition-opacity duration-300 ${isLaunching ? 'opacity-0' : 'opacity-100'}`}>
          <h3 className={`text-4xl font-bold tracking-widest font-shock text-center ${styles.text}`}>
            {countdown !== null ? countdown : (LaunchState.WAITING === currentState ? '' : VISUAL_CONFIG.TEXT_MAP[currentState])}
          </h3>
        </div>

        {/* Organizers List */}
        <div className="mb-16 text-center z-20 space-y-3">
          <div className="text-white/90 text-xl font-medium tracking-wide flex items-center justify-center gap-2" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
            <span className="opacity-70">主办单位：</span>
            <span>秦皇岛市体育局</span>
          </div>
          <div className="text-white/90 text-xl font-medium tracking-wide flex flex-col items-center justify-center gap-1" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
            <div className="flex items-center gap-2">
              <span className="opacity-70">承办单位：</span>
              <span>秦皇岛市足球协会</span>
            </div>
            <div className="pl-24">秦皇岛工业职业技术学院</div>
            <div className="pl-24">秦皇岛市职业技能公共实训中心</div>
          </div>
          <div className="text-white/90 text-xl font-medium tracking-wide flex items-center justify-center gap-2" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
            <span className="opacity-70">协办单位：</span>
            <span>秦嘉无人机足球俱乐部</span>
          </div>
        </div>

        {/* Footer Pill */}
        <div className="absolute bottom-8 z-20 pointer-events-auto">
          <div className="bg-blue-900/60 backdrop-blur-sm border border-blue-500/30 px-8 py-2 rounded-full text-blue-100 text-lg tracking-widest shadow-[0_0_20px_rgba(0,100,255,0.4)]">
            中国·秦皇岛 2026.01
          </div>
        </div>

        {/* QR Code Placeholder (Bottom Right) */}
        {/* <div className="absolute bottom-8 right-8 z-20 bg-white p-1 rounded shadow-lg pointer-events-auto"> */}
        {/* Using a placeholder or the logo if no QRCode image available yet. The reference shows a QR code. */}
        {/* <div className="w-24 h-24 bg-gray-200 flex items-center justify-center text-black text-xs text-center">
            二维码
          </div> */}
        {/* </div> */}

      </div>

      <audio src="/sounds/bgm.mp3" autoPlay loop playsInline preload="auto" ref={htmlAudioRef} style={{ display: 'none' }} />

      {/* Old Reset/Error/Debug Overlays - Kept discreetly */}
      {/* <div className="absolute top-4 right-4 z-50 text-white/20 font-mono text-xs p-2 hover:opacity-100 transition-opacity cursor-pointer pointer-events-auto">PRESS 'R' TO RESET</div> */}
      {error && (<div className="absolute top-10 z-50 text-xs text-red-500 font-mono bg-black/80 px-4 py-2 border border-red-900 pointer-events-auto">⚠ 警告: {error}</div>)}
    </div>
  );
};
export default App;

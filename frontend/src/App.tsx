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

  return (
    <div
      className="relative w-screen h-screen bg-black overflow-hidden flex flex-col items-center justify-center select-none"
      onClick={handleStartAudio}
    >
      <Visualizer state={currentState} />
      <audio src="/sounds/bgm.mp3" autoPlay loop playsInline preload="auto" ref={htmlAudioRef} style={{ display: 'none' }} />
      <div className="absolute inset-0 z-1 pointer-events-none opacity-20"
        style={{ backgroundImage: 'linear-gradient(rgba(50, 50, 50, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(50, 50, 50, 0.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }}>
      </div>
      <div className={`z-10 relative flex flex-col items-center justify-center p-12 w-[600px] min-h-[400px] transition-all duration-700 ${styles.border} ${isLaunching ? 'opacity-0 scale-150 pointer-events-none' : 'opacity-100 scale-100'}`}>
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-current opacity-70"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-current opacity-70"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-current opacity-70"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-current opacity-70"></div>
        <div className={`mb-8 w-64 h-32 rounded-full border-0 flex items-center justify-center bg-black/50 transition-colors duration-500 ${styles.logoBorder}`}>
          <img src="/images/logo.png" alt="logo" className=" text-gray-400 opacity-80" />
        </div>
        <h1 className={`text-5xl md:text-7xl font-bold tracking-widest font-shock text-center mb-6 transition-all duration-300 ${styles.text}`}>
          {countdown !== null ? countdown : VISUAL_CONFIG.TEXT_MAP[currentState]}
        </h1>
        <div className="flex items-center justify-center gap-4 font-mono text-sm tracking-[0.3em] text-gray-400">
          <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${styles.indicator}`}></div>
          <span className="font-mono text-sm " > 智控绿茵·足梦未来<br />校园无人机足球联赛</span>
          <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${styles.indicator}`}></div>
        </div>
      </div>
      <div className="absolute top-4 right-4 z-50 text-gray-600 font-mono text-xs border border-gray-800 p-2 opacity-30 hover:opacity-100 transition-opacity">PRESS 'R' TO RESET</div>
      {error && (<div className="absolute top-10 z-50 text-xs text-red-500 font-mono bg-black/80 px-4 py-2 border border-red-900">⚠ 警告: {error}</div>)}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 text-center opacity-70 w-full max-w-4xl px-4">
        <div className="text-cyan-500 text-[11px] font-mono leading-relaxed tracking-widest space-y-1">
          <p><span className="text-cyan-600">主办单位：</span>秦皇岛市教育局</p>
          <p><span className="text-cyan-600">承办单位：</span>秦皇岛市足球协会 &nbsp;/&nbsp; 秦皇岛市工业职业技术学院 &nbsp;/&nbsp; 秦皇岛市职业技能实训中心</p>
          <p><span className="text-cyan-600">协办单位：</span>秦嘉无人机足球俱乐部</p>
        </div>
      </div>
      <div className="absolute bottom-8 right-8 z-20 text-right opacity-80">
        <div className="text-gray-600 text-[10px] font-mono leading-tight">
          <p>PROTOCOL: REST_SECURE</p>
          <p>LINK: {API_CONFIG.BASE_URL.replace(/^https?:\/\//, '')}</p>
          <p className="mt-1 text-gray-400">STATE: {currentState}</p>
          <p className="mt-1 text-gray-500">AUDIO: {audioEnabled ? 'ON' : 'OFF'}</p>
        </div>
      </div>
    </div>
  );
};
export default App;

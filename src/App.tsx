import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Terminal, Cpu } from 'lucide-react';

// --- Constants & Types ---
const GRID_SIZE = 20;
const CELL_SIZE = 20;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 0, y: -1 };
const TICK_RATE = 100; // ms per tick

type Point = { x: number; y: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string };

const TRACKS = [
  { id: 1, title: 'SYS.DRIVE_01', artist: 'AI_CORE_ALPHA', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 2, title: 'CYBER_PULSE.WAV', artist: 'NEURAL_NET_V2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 3, title: 'HORIZON_OVERRIDE', artist: 'ALGO_WAVE', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
];

export default function App() {
  // --- React State for UI ---
  const [uiScore, setUiScore] = useState(0);
  const [uiHighScore, setUiHighScore] = useState(0);
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'GAMEOVER' | 'PAUSED'>('IDLE');
  const [isShaking, setIsShaking] = useState(false);

  // --- Music Player State ---
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // --- Game Engine Refs (Mutable, no re-renders) ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);

  const snakeRef = useRef<Point[]>([...INITIAL_SNAKE]);
  const dirRef = useRef<Point>({ ...INITIAL_DIRECTION });
  const nextDirRef = useRef<Point>({ ...INITIAL_DIRECTION });
  const foodRef = useRef<Point>({ x: 5, y: 5 });
  const particlesRef = useRef<Particle[]>([]);
  const scoreRef = useRef(0);
  const stateRef = useRef<'IDLE' | 'PLAYING' | 'GAMEOVER' | 'PAUSED'>('IDLE');

  // Sync stateRef with React state for UI updates
  const updateGameState = (newState: 'IDLE' | 'PLAYING' | 'GAMEOVER' | 'PAUSED') => {
    stateRef.current = newState;
    setGameState(newState);
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 300);
  };

  const spawnParticles = (x: number, y: number, color: string, count: number = 15) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15,
        life: 300 + Math.random() * 400,
        maxLife: 700,
        color
      });
    }
  };

  const generateFood = () => {
    let newFood: Point;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      if (!snakeRef.current.some(s => s.x === newFood.x && s.y === newFood.y)) break;
    }
    foodRef.current = newFood;
  };

  const resetGame = () => {
    snakeRef.current = [...INITIAL_SNAKE];
    dirRef.current = { ...INITIAL_DIRECTION };
    nextDirRef.current = { ...INITIAL_DIRECTION };
    scoreRef.current = 0;
    setUiScore(0);
    particlesRef.current = [];
    generateFood();
    updateGameState('PLAYING');
  };

  // --- Game Loop ---
  const update = useCallback((time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // Update particles
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= deltaTime;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    // Update game logic
    if (stateRef.current === 'PLAYING') {
      accumulatorRef.current += deltaTime;
      while (accumulatorRef.current >= TICK_RATE) {
        dirRef.current = nextDirRef.current;
        const head = snakeRef.current[0];
        const newHead = { x: head.x + dirRef.current.x, y: head.y + dirRef.current.y };

        // Wall Collision
        if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
          updateGameState('GAMEOVER');
          triggerShake();
          spawnParticles(head.x * CELL_SIZE + CELL_SIZE/2, head.y * CELL_SIZE + CELL_SIZE/2, '#00FFFF', 30);
          break;
        }

        // Self Collision
        if (snakeRef.current.some(s => s.x === newHead.x && s.y === newHead.y)) {
          updateGameState('GAMEOVER');
          triggerShake();
          spawnParticles(head.x * CELL_SIZE + CELL_SIZE/2, head.y * CELL_SIZE + CELL_SIZE/2, '#00FFFF', 30);
          break;
        }

        const newSnake = [newHead, ...snakeRef.current];

        // Food Collision
        if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
          scoreRef.current += 10;
          setUiScore(scoreRef.current);
          setUiHighScore(prev => Math.max(prev, scoreRef.current));
          triggerShake();
          spawnParticles(foodRef.current.x * CELL_SIZE + CELL_SIZE/2, foodRef.current.y * CELL_SIZE + CELL_SIZE/2, '#FF00FF');
          generateFood();
        } else {
          newSnake.pop();
        }

        snakeRef.current = newSnake;
        accumulatorRef.current -= TICK_RATE;
      }
    }

    draw();
    requestRef.current = requestAnimationFrame(update);
  }, []);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw Grid (Subtle)
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL_SIZE, 0); ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL_SIZE); ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE); ctx.stroke();
    }

    // Draw Food
    ctx.fillStyle = '#FF00FF';
    // Glitchy food size
    const foodSize = stateRef.current === 'PLAYING' ? CELL_SIZE - 4 + (Math.random() * 4 - 2) : CELL_SIZE - 4;
    ctx.fillRect(foodRef.current.x * CELL_SIZE + (CELL_SIZE - foodSize)/2, foodRef.current.y * CELL_SIZE + (CELL_SIZE - foodSize)/2, foodSize, foodSize);

    // Draw Snake
    snakeRef.current.forEach((segment, i) => {
      ctx.fillStyle = i === 0 ? '#FFFFFF' : '#00FFFF';
      // Add slight glitch offset to body occasionally
      const offsetX = (i > 0 && Math.random() > 0.95 && stateRef.current === 'PLAYING') ? (Math.random() * 4 - 2) : 0;
      ctx.fillRect(segment.x * CELL_SIZE + 1 + offsetX, segment.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    });

    // Draw Particles
    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillRect(p.x, p.y, 4, 4);
    });
    ctx.globalAlpha = 1.0;
  };

  // --- Input Handling ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === ' ') {
        if (stateRef.current === 'IDLE' || stateRef.current === 'GAMEOVER') {
          resetGame();
        } else if (stateRef.current === 'PLAYING') {
          updateGameState('PAUSED');
        } else if (stateRef.current === 'PAUSED') {
          updateGameState('PLAYING');
        }
        return;
      }

      if (stateRef.current !== 'PLAYING') return;

      const currentDir = dirRef.current;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          if (currentDir.y !== 1) nextDirRef.current = { x: 0, y: -1 };
          break;
        case 'ArrowDown': case 's': case 'S':
          if (currentDir.y !== -1) nextDirRef.current = { x: 0, y: 1 };
          break;
        case 'ArrowLeft': case 'a': case 'A':
          if (currentDir.x !== 1) nextDirRef.current = { x: -1, y: 0 };
          break;
        case 'ArrowRight': case 'd': case 'D':
          if (currentDir.x !== -1) nextDirRef.current = { x: 1, y: 0 };
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Start Loop ---
  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  // --- Music Player Logic ---
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const skipTrack = (direction: 'next' | 'prev') => {
    let newIdx = direction === 'next' ? (currentTrackIdx + 1) % TRACKS.length : (currentTrackIdx - 1 + TRACKS.length) % TRACKS.length;
    setCurrentTrackIdx(newIdx);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
      if (isPlaying) audioRef.current.play().catch(e => console.log('Audio play prevented', e));
    }
  }, [currentTrackIdx]);

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const currentTrack = TRACKS[currentTrackIdx];

  return (
    <div className="min-h-screen bg-[#050505] text-cyan-400 font-mono flex flex-col items-center justify-center p-4 selection:bg-fuchsia-500 selection:text-black">
      <div className="scanlines" />
      <div className="static-noise" />

      {/* Header */}
      <header className="mb-8 text-center relative z-10 screen-tear">
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase glitch-text" data-text="SNAKE_OS.EXE">
          SNAKE_OS.EXE
        </h1>
        <p className="text-fuchsia-500 mt-2 text-sm uppercase tracking-widest border-b border-fuchsia-500/50 pb-1 inline-block">
          SYSTEM_STATUS: {gameState === 'PLAYING' ? 'ACTIVE' : gameState === 'GAMEOVER' ? 'CRITICAL_FAILURE' : gameState === 'PAUSED' ? 'SUSPENDED' : 'STANDBY'}
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start relative z-10 max-w-6xl w-full justify-center">
        
        {/* Left Panel: Music Player */}
        <div className="w-full lg:w-80 bg-black border-2 border-cyan-500 p-6 shadow-[4px_4px_0px_#FF00FF] relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500 animate-pulse" />
          
          <div className="flex items-center gap-3 mb-6 border-b border-cyan-500/50 pb-2">
            <Terminal className="w-5 h-5 text-fuchsia-500" />
            <h2 className="text-lg font-bold text-fuchsia-500 tracking-widest">AUDIO_SUBSYSTEM</h2>
          </div>

          <div className="flex-1 flex flex-col justify-center mb-8">
            <div className="relative w-full h-24 bg-[#0a0a0a] border border-cyan-500/30 flex items-center justify-center overflow-hidden mb-4">
              {/* Glitchy Equalizer */}
              <div className="flex items-end gap-1 h-12">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 bg-cyan-400 ${isPlaying ? 'animate-pulse' : 'h-1'}`}
                    style={{
                      height: isPlaying ? `${Math.random() * 100 + 10}%` : '4px',
                      animationDuration: `${0.1 + Math.random() * 0.3}s`
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-fuchsia-500 mb-1">CURRENT_TRACK:</p>
              <h3 className="text-cyan-300 font-bold truncate text-lg uppercase glitch-text" data-text={currentTrack.title}>
                {currentTrack.title}
              </h3>
              <p className="text-cyan-500/60 text-sm mt-1 truncate uppercase">ARTIST: {currentTrack.artist}</p>
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#0a0a0a] p-3 border border-cyan-500/50">
            <button onClick={() => skipTrack('prev')} className="p-2 text-cyan-500 hover:text-fuchsia-500 hover:bg-cyan-500/10 transition-colors">
              <SkipBack className="w-5 h-5" />
            </button>
            <button onClick={togglePlay} className="p-2 text-black bg-cyan-500 hover:bg-fuchsia-500 transition-colors shadow-[2px_2px_0px_#FF00FF]">
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <button onClick={() => skipTrack('next')} className="p-2 text-cyan-500 hover:text-fuchsia-500 hover:bg-cyan-500/10 transition-colors">
              <SkipForward className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-cyan-500/50 mx-2" />
            <button onClick={toggleMute} className="p-2 text-cyan-500 hover:text-fuchsia-500 hover:bg-cyan-500/10 transition-colors">
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>

          <audio ref={audioRef} src={currentTrack.url} onEnded={() => skipTrack('next')} className="hidden" />
        </div>

        {/* Center Panel: Game Board */}
        <div className="flex flex-col items-center">
          {/* Score Board */}
          <div className="flex w-full justify-between items-end mb-2 px-2 border-b-2 border-fuchsia-500 pb-2">
            <div>
              <p className="text-fuchsia-500 text-xs uppercase tracking-widest mb-1">REGISTER::SCORE</p>
              <p className="text-3xl font-black text-cyan-400">
                {uiScore.toString().padStart(4, '0')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-fuchsia-500 text-xs uppercase tracking-widest mb-1">REGISTER::HIGH</p>
              <p className="text-xl font-bold text-cyan-400">
                {uiHighScore.toString().padStart(4, '0')}
              </p>
            </div>
          </div>

          {/* Game Canvas Container */}
          <div className={`relative bg-black border-4 border-cyan-500 p-1 shadow-[8px_8px_0px_#FF00FF] ${isShaking ? 'shake' : ''}`}>
            <div className="relative w-[min(85vw,400px)] aspect-square">
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="w-full h-full bg-[#050505]"
              />

              {/* Overlays */}
              {gameState !== 'PLAYING' && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 border-2 border-dashed border-fuchsia-500 m-2">
                  {gameState === 'IDLE' ? (
                    <div className="text-center">
                      <Cpu className="w-12 h-12 text-cyan-400 mx-auto mb-4 animate-pulse" />
                      <button
                        onClick={resetGame}
                        className="px-6 py-2 bg-cyan-500 text-black font-bold tracking-widest uppercase hover:bg-fuchsia-500 transition-colors shadow-[4px_4px_0px_#FF00FF]"
                      >
                        INITIALIZE_SEQ
                      </button>
                    </div>
                  ) : gameState === 'GAMEOVER' ? (
                    <div className="text-center">
                      <h2 className="text-3xl font-black text-fuchsia-500 mb-2 tracking-widest glitch-text" data-text="TERMINATED">
                        TERMINATED
                      </h2>
                      <p className="text-cyan-300 mb-6 font-bold">SCORE_LOG: {uiScore}</p>
                      <button
                        onClick={resetGame}
                        className="px-6 py-2 bg-transparent border-2 border-cyan-500 text-cyan-400 font-bold tracking-widest uppercase hover:bg-cyan-500 hover:text-black transition-colors shadow-[4px_4px_0px_#FF00FF]"
                      >
                        REBOOT_SYS
                      </button>
                    </div>
                  ) : gameState === 'PAUSED' ? (
                    <div className="text-center">
                      <h2 className="text-3xl font-black text-cyan-400 mb-6 tracking-widest animate-pulse">
                        SUSPENDED
                      </h2>
                      <button
                        onClick={() => updateGameState('PLAYING')}
                        className="px-6 py-2 bg-cyan-500 text-black font-bold tracking-widest uppercase hover:bg-fuchsia-500 transition-colors shadow-[4px_4px_0px_#FF00FF]"
                      >
                        OVERRIDE
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4 text-fuchsia-500 text-xs flex gap-6 uppercase tracking-widest bg-black border border-cyan-500/30 px-4 py-2">
            <span>[SPACE] EXECUTE/HALT</span>
            <span>[WASD] NAVIGATE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

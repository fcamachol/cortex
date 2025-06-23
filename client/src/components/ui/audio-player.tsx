import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  duration?: number;
  className?: string;
  variant?: 'sent' | 'received';
}

export function AudioPlayer({ src, duration, className, variant = 'received' }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const playbackSpeeds = [1, 1.25, 1.5, 1.75, 2];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Reset states when source changes
    setIsLoaded(false);
    setHasError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setTotalDuration(0);

    // Check if the audio source is accessible
    const checkAudioSource = async () => {
      try {
        const response = await fetch(src, { method: 'HEAD' });
        if (!response.ok) {
          setHasError(true);
          setIsLoaded(false);
          console.error('Audio source not accessible:', src, response.status);
          return;
        }
      } catch (error) {
        setHasError(true);
        setIsLoaded(false);
        console.error('Audio source check failed:', src, error);
        return;
      }
    };

    checkAudioSource();

    const handleLoadedData = () => {
      setTotalDuration(audio.duration);
      setIsLoaded(true);
      setHasError(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      // Mark as error for any media loading failure
      if (target?.error || target?.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
        setHasError(true);
        setIsLoaded(false);
        console.error('Audio playback error for:', src);
      }
    };

    const handleCanPlay = () => {
      setHasError(false);
      setIsLoaded(true);
    };

    const handleLoadStart = () => {
      setHasError(false);
    };

    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadstart', handleLoadStart);

    return () => {
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadstart', handleLoadStart);
    };
  }, [src]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !isLoaded) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * totalDuration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const cyclePlaybackSpeed = () => {
    const currentIndex = playbackSpeeds.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % playbackSpeeds.length;
    const newRate = playbackSpeeds[nextIndex];
    
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Generate waveform visualization
  const generateWaveform = () => {
    const bars = 40;
    const heights = [];
    
    for (let i = 0; i < bars; i++) {
      // Create a pseudo-random but consistent height pattern
      const randomSeed = Math.sin(i * 0.5) * Math.cos(i * 0.3);
      const height = Math.abs(randomSeed) * 100;
      heights.push(Math.max(20, Math.min(100, height)));
    }
    
    return heights;
  };

  const waveformHeights = generateWaveform();

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg max-w-xs",
      variant === 'sent' 
        ? "bg-green-100 dark:bg-green-900/30" 
        : "bg-gray-100 dark:bg-gray-800",
      className
    )}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        disabled={!isLoaded}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full transition-all",
          "hover:scale-105 active:scale-95",
          variant === 'sent'
            ? "bg-green-600 text-white hover:bg-green-700"
            : "bg-blue-600 text-white hover:bg-blue-700",
          !isLoaded && "opacity-50 cursor-not-allowed"
        )}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        {/* Playback Speed */}
        {playbackRate !== 1 && (
          <button
            onClick={cyclePlaybackSpeed}
            className={cn(
              "text-xs px-2 py-1 rounded-full mb-1 font-medium transition-colors",
              variant === 'sent'
                ? "bg-green-200 text-green-800 hover:bg-green-300 dark:bg-green-800 dark:text-green-200"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
            )}
          >
            {playbackRate}x
          </button>
        )}

        {/* Waveform */}
        <div 
          className="flex items-end gap-0.5 h-8 cursor-pointer mb-1"
          onClick={handleSeek}
        >
          {waveformHeights.map((height, index) => {
            const barProgress = (index / waveformHeights.length) * 100;
            const isActive = progress > barProgress;
            
            return (
              <div
                key={index}
                className={cn(
                  "w-1 transition-all duration-150 rounded-full",
                  isActive
                    ? variant === 'sent'
                      ? "bg-green-700 dark:bg-green-400"
                      : "bg-blue-600 dark:bg-blue-400"
                    : variant === 'sent'
                      ? "bg-green-300 dark:bg-green-700"
                      : "bg-gray-300 dark:bg-gray-600"
                )}
                style={{ height: `${(height / 100) * 32}px` }}
              />
            );
          })}
        </div>

        {/* Time and Speed Control */}
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-xs font-mono",
            variant === 'sent' 
              ? "text-green-800 dark:text-green-200" 
              : "text-gray-600 dark:text-gray-400"
          )}>
            {formatTime(currentTime)}
          </span>
          
          {hasError ? (
            <span className="text-xs text-red-500 dark:text-red-400">
              Audio unavailable
            </span>
          ) : (
            <>
              <button
                onClick={cyclePlaybackSpeed}
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium transition-colors",
                  variant === 'sent'
                    ? "text-green-700 hover:bg-green-200 dark:text-green-300 dark:hover:bg-green-800"
                    : "text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
                )}
              >
                {playbackRate}x
              </button>
              
              <span className={cn(
                "text-xs font-mono",
                variant === 'sent' 
                  ? "text-green-800 dark:text-green-200" 
                  : "text-gray-600 dark:text-gray-400"
              )}>
                {formatTime(totalDuration)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AudioPlayer;
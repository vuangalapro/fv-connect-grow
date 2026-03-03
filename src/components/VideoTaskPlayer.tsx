import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, ExternalLink, Upload, Check, X, Copy, AlertTriangle, Loader2, Smartphone, Monitor, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { generateUniqueCommentCode, generateDeviceFingerprint, formatTime } from '@/lib/fraudPrevention';
import { performOCR, validateOCRMatch } from '@/lib/ocrService';
import { useVideoTask } from '@/contexts/VideoTaskContext';

export interface VideoSubmissionData {
  screenshotData: string;
  watchedTime: number;
  uniqueCommentCode: string;
  deviceFingerprint: string;
  startTime: Date;
  watchSessionData?: {
    totalPauses: number;
    maxContinuousWatch: number;
  };
  ocrResult?: {
    extractedText: string;
    foundCodes: string[];
    confidence: number;
    isMatch: boolean;
  } | null;
  fraudAlert?: 'confiavel' | 'suspeita' | null;
}

interface VideoTaskPlayerProps {
  taskId: string;
  userId: string;
  videoUrl: string;
  requiredTime?: number;
  onTimeUpdate?: (seconds: number) => void;
  onReadyToSubmit?: () => void;
  onSubmit?: (submissionData: VideoSubmissionData) => Promise<void>;
  onSubmitted?: () => void; // Callback after successful submission to switch panels
}

const YouTubePlayer = ({
  videoId,
  onTimeUpdate,
  requiredTime = 90,
  onVideoComplete,
  onTimeReached
}: {
  videoId: string;
  onTimeUpdate: (seconds: number) => void;
  requiredTime: number;
  onVideoComplete?: () => void;
  onTimeReached?: () => void;
}) => {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasReachedTime, setHasReachedTime] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      playerRef.current = new (window as any).YT.Player('youtube-player', {
        videoId,
        playerVars: {
          autoplay: 0,
          // Disable keyboard controls and progress bar features for anti-fraud
          disablekb: 1,        // Disable keyboard controls
          fs: 0,               // Disable fullscreen button
          rel: 0,              // No related videos
          showinfo: 0,         // Hide video info
          egm: 0,              // No enhanced genie menu
          modestbranding: 1,  // Minimal branding
          // Disable seeking via progress bar
          seek_to_start: undefined,
        },
        events: {
          onReady: () => setIsReady(true),
          onStateChange: (event: any) => {
            setIsPlaying(event.data === (window as any).YT.PlayerState.PLAYING);
          },
        },
      });
    };

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [videoId]);

  // Block seeking attempts
  useEffect(() => {
    const handleSeek = () => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const current = playerRef.current.getCurrentTime();
        // If user tries to seek forward beyond current watched time, block it
        if (current > currentTime + 5) {
          playerRef.current.seekTo(currentTime, true);
        }
      }
    };

    const interval = setInterval(handleSeek, 500);
    return () => clearInterval(interval);
  }, [currentTime]);

  useEffect(() => {
    if (isReady && isPlaying) {
      intervalRef.current = window.setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
          const time = Math.floor(playerRef.current.getCurrentTime());
          setCurrentTime(time);
          onTimeUpdate(time);

          if (time >= requiredTime && !hasReachedTime) {
            setHasReachedTime(true);
            // Stop the video when time limit is reached
            if (playerRef.current && playerRef.current.pauseVideo) {
              playerRef.current.pauseVideo();
            }
            onVideoComplete?.();
            onTimeReached?.();
          }
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isReady, isPlaying, requiredTime, hasReachedTime, onTimeUpdate, onVideoComplete]);

  return (
    <div className="space-y-3">
      <div className="aspect-video rounded-lg overflow-hidden bg-black relative">
        <div id="youtube-player" className="w-full h-full" />

        {/* Mobile warning overlay */}
        {isMobile && (
          <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs flex items-center gap-1 text-white">
            <Smartphone size={12} />
            Mobile
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className={hasReachedTime ? 'text-green-400' : 'text-muted-foreground'}>
            Tempo: {formatTime(currentTime)} / {formatTime(requiredTime)}
          </span>
          {hasReachedTime && (
            <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs flex items-center gap-1">
              <Check size={12} /> Completo
            </span>
          )}
        </div>

        {playerRef.current && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isPlaying) {
                playerRef.current.pauseVideo();
              } else {
                playerRef.current.playVideo();
              }
            }}
          >
            {isPlaying ? <Pause size={16} className="mr-1" /> : <Play size={16} className="mr-1" />}
            {isPlaying ? 'Pausar' : 'Reproduzir'}
          </Button>
        )}
      </div>

      {!hasReachedTime && (
        <p className="text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded flex items-center gap-2">
          <AlertTriangle size={14} />
          Assista pelo menos {formatTime(requiredTime)} para continuar
        </p>
      )}
    </div>
  );
};

const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Local storage key for completed videos
const getCompletedVideosKey = (userId: string) => `completed_videos_${userId}`;

// Local storage key for unique codes per task
const getUniqueCodeKey = (userId: string, taskId: string) => `video_code_${userId}_${taskId}`;

// Local storage key for watch time
const getWatchTimeKey = (userId: string, taskId: string) => `video_time_${userId}_${taskId}`;

export default function VideoTaskPlayer({
  taskId,
  userId,
  videoUrl,
  requiredTime = 90,
  onTimeUpdate,
  onReadyToSubmit,
  onSubmit,
  onSubmitted,
}: VideoTaskPlayerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [watchedTime, setWatchedTime] = useState(0);
  const [canSubmit, setCanSubmit] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Video task context for single popup lock
  const { activeVideoTaskId, openVideoTask, closeVideoTask, isAnyVideoTaskOpen, triggerSwitchToReviews } = useVideoTask();
  const isThisTaskOpen = activeVideoTaskId === taskId;
  const isOtherTaskOpen = isAnyVideoTaskOpen && !isThisTaskOpen;

  const [uniqueCode, setUniqueCode] = useState<string>('');
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [isVideoCompleted, setIsVideoCompleted] = useState(false);

  const videoId = extractVideoId(videoUrl);

  // Check if this video was already completed in this session
  const isVideoCompletedInSession = useCallback(() => {
    if (typeof window === 'undefined') return false;
    try {
      const completed = localStorage.getItem(getCompletedVideosKey(userId));
      if (completed) {
        const parsed = JSON.parse(completed);
        return parsed[taskId] === true;
      }
    } catch (e) {
      console.error('Error reading completed videos:', e);
    }
    return false;
  }, [userId, taskId]);

  // Mark video as completed in localStorage
  const markVideoCompleted = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      // Save completed status
      const completed = localStorage.getItem(getCompletedVideosKey(userId));
      const parsed = completed ? JSON.parse(completed) : {};
      parsed[taskId] = true;
      localStorage.setItem(getCompletedVideosKey(userId), JSON.stringify(parsed));
      
      // Save unique code (only if not already saved)
      if (!localStorage.getItem(getUniqueCodeKey(userId, taskId))) {
        const code = generateUniqueCommentCode(taskId, userId);
        localStorage.setItem(getUniqueCodeKey(userId, taskId), code);
      }
      
      // Save watch time
      localStorage.setItem(getWatchTimeKey(userId, taskId), String(watchedTime));
    } catch (e) {
      console.error('Error saving completed video:', e);
    }
  }, [userId, taskId, watchedTime]);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check if already completed video
  useEffect(() => {
    if (isVideoCompletedInSession()) {
      setCanSubmit(true);
      setIsVideoCompleted(true);
    }
  }, [isVideoCompletedInSession]);

  useEffect(() => {
    if (isOpen && taskId && userId) {
      // Check if there's a saved unique code for this task
      const savedCode = localStorage.getItem(getUniqueCodeKey(userId, taskId));
      const savedTime = localStorage.getItem(getWatchTimeKey(userId, taskId));
      
      // If video was already completed, use saved code and time
      if (savedCode && savedTime) {
        setUniqueCode(savedCode);
        setWatchedTime(parseInt(savedTime, 10));
        setCanSubmit(true);
        setIsVideoCompleted(true);
      } else {
        // Generate new code only if not already completed
        const code = generateUniqueCommentCode(taskId, userId);
        setUniqueCode(code);
        localStorage.setItem(getUniqueCodeKey(userId, taskId), code);
        setWatchedTime(0);
        setCanSubmit(false);
        setIsVideoCompleted(false);
      }

      generateDeviceFingerprint().then(fp => {
        setDeviceFingerprint(fp);
      });

      setStartTime(new Date());
    }
  }, [isOpen, taskId, userId]);

  // Track watch sessions for anti-fraud
  const watchSessionRef = useRef<{ start: number, end: number | null }[]>([]);
  const lastTimeRef = useRef<number>(0);

  // Enhanced time update with session tracking
  const handleTimeUpdateInternal = useCallback((seconds: number) => {
    setWatchedTime(seconds);

    // Track watch sessions (detect pauses)
    if (seconds > lastTimeRef.current + 2) {
      // Gap of 2+ seconds detected - new session
      watchSessionRef.current.push({ start: seconds, end: null });
    } else if (seconds < lastTimeRef.current) {
      // Video restarted
      watchSessionRef.current = [{ start: 0, end: null }];
    } else {
      // Update current session
      if (watchSessionRef.current.length > 0) {
        watchSessionRef.current[watchSessionRef.current.length - 1].end = seconds;
      }
    }
    lastTimeRef.current = seconds;

    if (seconds >= requiredTime && !canSubmit) {
      setCanSubmit(true);
      markVideoCompleted();
      onReadyToSubmit?.();
    }
    onTimeUpdate?.(seconds);
  }, [requiredTime, canSubmit, onReadyToSubmit, onTimeUpdate, markVideoCompleted]);

  const handleVideoComplete = useCallback(() => {
    setIsVideoCompleted(true);
    markVideoCompleted();
    if (!canSubmit) {
      setCanSubmit(true);
      toast.success('Vídeo assistido! Tempo limite atingido. Agora você pode abrir no YouTube e comentar.');
    }
  }, [canSubmit, markVideoCompleted]);

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(uniqueCode);
    toast.success('Código copiado!');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('A imagem deve ter menos de 5MB');
        return;
      }
      setSelectedFile(file);
      setShowUpload(true);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || !canSubmit || !uniqueCode || !deviceFingerprint) return;

    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const screenshotData = e.target?.result as string;

        // Calculate watch session metrics
        const sessionData = watchSessionRef.current;
        const totalPauses = sessionData.length - 1;
        const maxContinuousWatch = sessionData.reduce((max, s) => {
          const duration = (s.end || watchedTime) - s.start;
          return Math.max(max, duration);
        }, 0);

        const submissionData: VideoSubmissionData = {
          screenshotData,
          watchedTime,
          uniqueCommentCode: uniqueCode,
          deviceFingerprint,
          startTime: startTime || new Date(),
          watchSessionData: {
            totalPauses,
            maxContinuousWatch,
          },
         ocrResult: null,
         fraudAlert: null,
        };

        if (onSubmit) {
          await onSubmit(submissionData);
        }

        // Close popup after submission
        setShowUpload(false);
        setSelectedFile(null);
        setIsOpen(false);
        closeVideoTask();
        setCanSubmit(false);
        setWatchedTime(0);
        setUniqueCode('');
        setIsVideoCompleted(false);
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar prova');
    } finally {
      setIsUploading(false);
    }
  };

  if (!videoId) {
    return (
      <div className="text-red-400 p-4">
        URL do vídeo inválida. Use um link do YouTube válido.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={() => {
          if (isOtherTaskOpen) {
            toast.error('Você só pode executar uma tarefa por vez. Feche o vídeo atual para continuar.');
            return;
          }
          if (!openVideoTask(taskId)) {
            toast.error('Você só pode executar uma tarefa por vez. Feche o vídeo atual para continuar.');
            return;
          }
          setIsOpen(true);
        }}
        disabled={isOtherTaskOpen}
        className={`w-full ${isOtherTaskOpen ? 'bg-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
      >
        {isOtherTaskOpen ? (
          <>
            <Lock size={18} className="mr-2" />
            Bloqueado
          </>
        ) : (
          <>
            <Play size={18} className="mr-2" />
            Assistir Vídeo
          </>
        )}
        {isVideoCompleted && !isOtherTaskOpen && (
          <Check size={16} className="ml-2 text-green-400" />
        )}
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="glass rounded-2xl p-4 sm:p-6 w-full max-w-2xl lg:max-w-xl mx-auto my-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {isMobile && <Smartphone size={20} />}
                <h3 className="text-lg font-bold">
                  {isMobile ? 'Tarefa Vídeo' : 'Tarefa de Vídeo YouTube'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  closeVideoTask();
                }}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X size={24} />
              </button>
            </div>

            {/* Video Player - Always shown first */}
            <YouTubePlayer
              videoId={videoId}
              requiredTime={requiredTime}
              onTimeUpdate={handleTimeUpdateInternal}
              onVideoComplete={handleVideoComplete}
              onTimeReached={handleVideoComplete}
            />

            {/* Instructions - Show after video is completed */}
            {isVideoCompleted && uniqueCode && (
              <div className="mt-4 space-y-4">
                {/* Unique Code Display */}
                <div className="p-4 bg-gradient-to-r from-purple-600/30 to-blue-600/30 border border-purple-500/50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-purple-300 font-bold flex items-center gap-2">
                      🔑 Seu código único:
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyCodeToClipboard}
                      className="text-purple-300 hover:text-purple-100 h-8"
                    >
                      <Copy size={14} className="mr-1" />
                      Copiar
                    </Button>
                  </div>
                  <div className="bg-black/60 rounded-lg p-4 font-mono text-lg sm:text-xl text-center text-white tracking-wider border border-purple-500/30">
                    {uniqueCode}
                  </div>
                  <p className="text-xs text-yellow-400 mt-3 flex items-start gap-2 bg-yellow-500/10 p-2 rounded">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                    Comente este código EXATAMENTE como mostrado acima no YouTube
                  </p>
                </div>

                {/* Instructions */}
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <p className="text-sm text-blue-300 font-bold mb-3 flex items-center gap-2">
                    📋 O que fazer no YouTube:
                  </p>
                  <ol className="text-xs sm:text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-500/20 text-blue-400 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs">1</span>
                      <span>Clique em <strong>"Abrir no YouTube"</strong> abaixo</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-500/20 text-blue-400 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs">2</span>
                      <span>Comente o código: <strong className="text-purple-300">{uniqueCode}</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-500/20 text-blue-400 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs">3</span>
                      <span>Tire <strong>screenshot do comentário</strong> com o código</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-500/20 text-blue-400 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs">4</span>
                      <span>Volte aqui e <strong>envie a captura do comentário</strong></span>
                    </li>
                  </ol>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                    onClick={() => window.open(videoUrl, '_blank')}
                  >
                    <ExternalLink size={18} className="mr-2" />
                    Abrir no YouTube
                  </Button>

                  <div className="flex-1">
                    <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg cursor-pointer transition-colors font-medium ${canSubmit
                        ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/30'
                        : 'bg-muted text-muted-foreground cursor-not-allowed border border-muted'
                      }`}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        className="hidden"
                        onChange={handleFileSelect}
                        disabled={!canSubmit}
                      />
                      <Upload size={18} />
                      {selectedFile ? selectedFile.name : '📸 Enviar captura do comentário'}
                    </label>
                  </div>
                </div>

                {/* Status indicator */}
                {canSubmit && !selectedFile && (
                  <p className="text-xs text-center text-green-400 bg-green-500/10 p-2 rounded flex items-center justify-center gap-2">
                    <Check size={14} />
                    Vídeo assistido! Você pode enviar a prova
                  </p>
                )}
              </div>
            )}

            {/* Pre-completion message */}
            {!isVideoCompleted && (
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <p className="text-sm text-yellow-400 flex items-center gap-2">
                  <AlertTriangle size={18} />
                  Assista o vídeo por pelo menos <strong>{Math.floor(requiredTime / 60)}:{String(requiredTime % 60).padStart(2, '0')}</strong> para continuar
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload confirmation modal */}
      {showUpload && selectedFile && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="glass rounded-2xl p-4 sm:p-6 w-full max-w-sm mx-auto my-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Confirmar Envio</h3>
              <button
                onClick={() => {
                  setShowUpload(false);
                  setSelectedFile(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={24} />
              </button>
            </div>

            <img
              src={URL.createObjectURL(selectedFile)}
              alt="Captura"
              className="w-full rounded-lg mb-4 max-h-64 object-contain bg-black"
            />

            {uniqueCode && (
              <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <p className="text-xs text-purple-300">Código esperado na imagem:</p>
                <p className="font-mono text-sm text-white">{uniqueCode}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowUpload(false);
                  setSelectedFile(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleSubmit}
                disabled={isUploading}
              >
                {isUploading ? 'Enviando...' : '✅ Confirmar'} {/* Instant submission - no OCR */}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

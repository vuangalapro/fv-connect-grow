import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, ExternalLink, Upload, Check, X, Copy, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateUniqueCommentCode, generateDeviceFingerprint, formatTime } from '@/lib/fraudPrevention';
import { performOCR, validateOCRMatch } from '@/lib/ocrService';

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
  };
}

interface VideoTaskPlayerProps {
  taskId: string;
  userId: string;
  videoUrl: string;
  requiredTime?: number;
  onTimeUpdate?: (seconds: number) => void;
  onReadyToSubmit?: () => void;
  onSubmit?: (submissionData: VideoSubmissionData) => Promise<void>;
}

const YouTubePlayer = ({
  videoId,
  onTimeUpdate,
  requiredTime = 90,
  onVideoComplete
}: {
  videoId: string;
  onTimeUpdate: (seconds: number) => void;
  requiredTime: number;
  onVideoComplete?: () => void;
}) => {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasReachedTime, setHasReachedTime] = useState(false);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<number | null>(null);

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
          controls: 1,
          rel: 0,
          fs: 1,
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

  useEffect(() => {
    if (isReady && isPlaying) {
      intervalRef.current = window.setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
          const time = Math.floor(playerRef.current.getCurrentTime());
          setCurrentTime(time);
          onTimeUpdate(time);

          if (time >= requiredTime && !hasReachedTime) {
            setHasReachedTime(true);
            onVideoComplete?.();
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
      <div className="aspect-video rounded-lg overflow-hidden bg-black">
        <div id="youtube-player" className="w-full h-full" />
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className={hasReachedTime ? 'text-green-400' : 'text-muted-foreground'}>
            Tempo assistido: {formatTime(currentTime)} / {formatTime(requiredTime)}
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
        <p className="text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded">
          ⚠️ Assista pelo menos {formatTime(requiredTime)} para poder enviar a prova
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

export default function VideoTaskPlayer({
  taskId,
  userId,
  videoUrl,
  requiredTime = 90,
  onTimeUpdate,
  onReadyToSubmit,
  onSubmit,
}: VideoTaskPlayerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [watchedTime, setWatchedTime] = useState(0);
  const [canSubmit, setCanSubmit] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  const [uniqueCode, setUniqueCode] = useState<string>('');
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [isVideoCompleted, setIsVideoCompleted] = useState(false);

  const videoId = extractVideoId(videoUrl);

  useEffect(() => {
    if (isOpen && taskId && userId) {
      const code = generateUniqueCommentCode(taskId, userId);
      setUniqueCode(code);

      generateDeviceFingerprint().then(fp => {
        setDeviceFingerprint(fp);
      });

      setStartTime(new Date());
      setWatchedTime(0);
      setCanSubmit(false);
      setIsVideoCompleted(false);
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
      onReadyToSubmit?.();
    }
    onTimeUpdate?.(seconds);
  }, [requiredTime, canSubmit, onReadyToSubmit, onTimeUpdate]);

  const handleVideoComplete = useCallback(() => {
    setIsVideoCompleted(true);
    if (!canSubmit) {
      setCanSubmit(true);
      toast.success('Vídeo assistido! Agora você pode abrir no YouTube e comentar.');
    }
  }, [canSubmit]);

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(uniqueCode);
    toast.success('Código copiado! Cole no comentário do YouTube.');
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
    setIsProcessingOCR(true);
    setOcrProgress(0);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const screenshotData = e.target?.result as string;

        let ocrResult;
        try {
          const progressInterval = setInterval(() => {
            setOcrProgress(prev => Math.min(prev + 10, 90));
          }, 200);

          const ocr = await performOCR(screenshotData, uniqueCode);

          clearInterval(progressInterval);
          setOcrProgress(100);

          const validation = validateOCRMatch(ocr, uniqueCode);

          ocrResult = {
            extractedText: ocr.extractedText,
            foundCodes: ocr.foundCodes,
            confidence: ocr.confidence,
            isMatch: validation.isMatch,
          };

          if (!validation.isMatch) {
            toast.warning('ATENÇÃO: Código não encontrado no screenshot. O admin irá validar manualmente.');
          }
        } catch (ocrError) {
          console.error('OCR Error:', ocrError);
          toast.warning('OCR falhou. O admin irá validar manualmente.');
          ocrResult = {
            extractedText: '',
            foundCodes: [],
            confidence: 0,
            isMatch: false,
          };
        }

        setIsProcessingOCR(false);

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
          ocrResult,
        };

        if (onSubmit) {
          await onSubmit(submissionData);
        }

        setShowUpload(false);
        setSelectedFile(null);
        setIsOpen(false);
        setCanSubmit(false);
        setWatchedTime(0);
        setUniqueCode('');
        setIsVideoCompleted(false);
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar prova');
      setIsProcessingOCR(false);
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
        onClick={() => setIsOpen(true)}
        className="w-full bg-red-600 hover:bg-red-700"
      >
        <Play size={18} className="mr-2" />
        Assistir Vídeo
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Tarefa de Vídeo YouTube</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={24} />
              </button>
            </div>

            {isVideoCompleted && uniqueCode && (
              <div className="mb-4 p-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-purple-300 font-medium">🔑 Seu código único para comentário:</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyCodeToClipboard}
                    className="text-purple-300 hover:text-purple-100"
                  >
                    <Copy size={14} className="mr-1" />
                    Copiar
                  </Button>
                </div>
                <div className="bg-black/40 rounded-lg p-3 font-mono text-lg text-center text-white tracking-wider">
                  {uniqueCode}
                </div>
                <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  Comente este código EXATAMENTE como mostrado acima no YouTube
                </p>
              </div>
            )}

            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-300 font-medium mb-2">📋 Instruções:</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Assista ao vídeo por pelo menos <strong>{Math.floor(requiredTime / 60)}:{String(requiredTime % 60).padStart(2, '0')}</strong> minutos</li>
                <li>Após completar, seu código único será exibido acima</li>
                <li>Clique em "Abrir no YouTube" para ir ao vídeo</li>
                <li>
                  <strong>⚠️ NO YOUTUBE:</strong>
                  <ul className="list-disc list-inside ml-2 mt-1">
                    <li>Curtir o vídeo (like)</li>
                    <li>Comentar o código <strong>{uniqueCode || 'XXXXXX'}</strong></li>
                    <li>Inscrever-se no canal</li>
                  </ul>
                </li>
                <li>Capture a tela mostrando as 3 ações realizadas</li>
                <li>Volte aqui e envie a captura</li>
              </ol>
            </div>

            <YouTubePlayer
              videoId={videoId}
              requiredTime={requiredTime}
              onTimeUpdate={handleTimeUpdateInternal}
              onVideoComplete={handleVideoComplete}
            />

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <Button
                variant="outline"
                className="flex-1"
                disabled={!canSubmit}
                onClick={() => window.open(videoUrl, '_blank')}
              >
                <ExternalLink size={18} className="mr-2" />
                Abrir no YouTube
              </Button>

              <div className="flex-1">
                <label className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${canSubmit
                  ? 'bg-primary/20 text-primary hover:bg-primary/30'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={!canSubmit}
                  />
                  <Upload size={18} />
                  {selectedFile ? selectedFile.name : 'Anexar captura'}
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUpload && selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass rounded-2xl p-6 w-full max-w-md">
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

            {isProcessingOCR && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 size={16} className="animate-spin text-blue-400" />
                  <span className="text-sm text-blue-300">Validando código...</span>
                </div>
                <div className="w-full bg-blue-900/30 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Aguarde, estamos verificando o código na imagem
                </p>
              </div>
            )}

            <img
              src={URL.createObjectURL(selectedFile)}
              alt="Captura"
              className="w-full rounded-lg mb-4"
            />

            {uniqueCode && (
              <div className="mb-4 p-2 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Código esperado:</p>
                <p className="font-mono text-sm">{uniqueCode}</p>
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
                disabled={isProcessingOCR}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={isUploading || isProcessingOCR}
              >
                {isUploading ? 'Enviando...' : isProcessingOCR ? 'Processando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

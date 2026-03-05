import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export interface ActiveTask {
    id: string;
    title: string;
    videoUrl: string;
    requiredTime: number;
    reward: number;
    startedAt: number;
}

interface VideoTaskContextType {
    activeTask: ActiveTask | null;
    isPopupOpen: boolean;
    openVideoTask: (task: Omit<ActiveTask, 'startedAt'>) => boolean;
    closeVideoTask: () => void;
    isAnyVideoTaskOpen: boolean;
    setSwitchToReviewsCallback?: (callback: () => void) => void;
    triggerSwitchToReviews?: () => void;
    timeRemaining: number;
    isTimerActive: boolean;
    resetTimer: () => void;
}

// LocalStorage keys
const ACTIVE_TASK_KEY = 'activeTask';
const POPUP_STATE_KEY = 'isPopupOpen';

const VideoTaskContext = createContext<VideoTaskContextType | undefined>(undefined);

// Minimum time required before submission (30 seconds)
const MIN_SUBMISSION_TIME = 30;

export function VideoTaskProvider({ children }: { children: ReactNode }) {
    const [activeTask, setActiveTask] = useState<ActiveTask | null>(null);
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [switchToReviewsCallback, setSwitchToReviewsCallback] = useState<(() => void) | null>(null);
    const [timeRemaining, setTimeRemaining] = useState(MIN_SUBMISSION_TIME);
    const [isTimerActive, setIsTimerActive] = useState(false);

    // Initialize timer countdown
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;

        if (isTimerActive && timeRemaining > 0) {
            interval = setInterval(() => {
                setTimeRemaining((prev) => {
                    if (prev <= 1) {
                        setIsTimerActive(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [isTimerActive, timeRemaining]);

    // Reset timer when task changes
    const resetTimer = useCallback(() => {
        setTimeRemaining(MIN_SUBMISSION_TIME);
        setIsTimerActive(true);
    }, []);

    // Recovery function: Load task from localStorage on page load
    const recoverTaskFromStorage = useCallback(() => {
        try {
            const storedTask = localStorage.getItem(ACTIVE_TASK_KEY);
            const storedPopupState = localStorage.getItem(POPUP_STATE_KEY);

            if (storedTask) {
                const task = JSON.parse(storedTask) as ActiveTask;

                // Calculate elapsed time since task started
                const elapsedSeconds = Math.floor((Date.now() - task.startedAt) / 1000);

                // Only recover if less than 30 minutes have passed
                if (elapsedSeconds < 1800) { // 30 minutes
                    setActiveTask(task);

                    // Recover popup state if it was open
                    if (storedPopupState === 'true') {
                        setIsPopupOpen(true);
                    }

                    // Calculate remaining time for timer
                    const remaining = Math.max(0, MIN_SUBMISSION_TIME - elapsedSeconds);
                    if (remaining > 0) {
                        setTimeRemaining(remaining);
                        // Don't start timer automatically - wait for user action
                    } else {
                        setTimeRemaining(0);
                        setIsTimerActive(false);
                    }

                    console.log('Task recovered from localStorage:', task.id);
                } else {
                    // Task expired, clear storage
                    localStorage.removeItem(ACTIVE_TASK_KEY);
                    localStorage.removeItem(POPUP_STATE_KEY);
                }
            }
        } catch (error) {
            console.error('Error recovering task from localStorage:', error);
            // Clear corrupted data
            localStorage.removeItem(ACTIVE_TASK_KEY);
            localStorage.removeItem(POPUP_STATE_KEY);
        }
    }, []);

    // Initialize on mount - recover any active task
    useEffect(() => {
        recoverTaskFromStorage();
    }, [recoverTaskFromStorage]);

    // Listen for visibility changes - recover popup when user returns
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // User returned to the page
                const storedTask = localStorage.getItem(ACTIVE_TASK_KEY);
                const storedPopupState = localStorage.getItem(POPUP_STATE_KEY);

                if (storedTask && storedPopupState === 'true') {
                    const task = JSON.parse(storedTask) as ActiveTask;
                    const elapsedSeconds = Math.floor((Date.now() - task.startedAt) / 1000);

                    // Only recover if task is still valid
                    if (elapsedSeconds < 1800) {
                        setActiveTask(task);
                        setIsPopupOpen(true);

                        // Update timer based on elapsed time
                        const remaining = Math.max(0, MIN_SUBMISSION_TIME - elapsedSeconds);
                        if (remaining > 0) {
                            setTimeRemaining(remaining);
                            setIsTimerActive(true);
                        } else {
                            setTimeRemaining(0);
                            setIsTimerActive(false);
                        }

                        console.log('Task recovered on visibility change:', task.id);
                    }
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Save task to localStorage whenever it changes
    useEffect(() => {
        if (activeTask) {
            localStorage.setItem(ACTIVE_TASK_KEY, JSON.stringify(activeTask));
            localStorage.setItem(POPUP_STATE_KEY, isPopupOpen.toString());
        }
    }, [activeTask, isPopupOpen]);

    const openVideoTask = useCallback((task: Omit<ActiveTask, 'startedAt'>) => {
        if (activeTask && activeTask.id !== task.id) {
            return false;
        }

        const newTask: ActiveTask = {
            ...task,
            startedAt: Date.now(),
        };

        setActiveTask(newTask);
        setIsPopupOpen(true);
        resetTimer();

        return true;
    }, [activeTask, resetTimer]);

    const closeVideoTask = useCallback(() => {
        // Clear localStorage
        localStorage.removeItem(ACTIVE_TASK_KEY);
        localStorage.removeItem(POPUP_STATE_KEY);

        setActiveTask(null);
        setIsPopupOpen(false);
        setTimeRemaining(MIN_SUBMISSION_TIME);
        setIsTimerActive(false);
    }, []);

    const isAnyVideoTaskOpen = activeTask !== null;

    const setSwitchToReviewsCallbackFn = useCallback((callback: () => void) => {
        setSwitchToReviewsCallback(() => callback);
    }, []);

    const triggerSwitchToReviews = useCallback(() => {
        if (switchToReviewsCallback) {
            switchToReviewsCallback();
        }
    }, [switchToReviewsCallback]);

    return (
        <VideoTaskContext.Provider value={{
            activeTask,
            isPopupOpen,
            openVideoTask,
            closeVideoTask,
            isAnyVideoTaskOpen,
            setSwitchToReviewsCallback: setSwitchToReviewsCallbackFn,
            triggerSwitchToReviews,
            timeRemaining,
            isTimerActive,
            resetTimer
        }}>
            {children}
        </VideoTaskContext.Provider>
    );
}

export function useVideoTask() {
    const context = useContext(VideoTaskContext);
    if (!context) {
        throw new Error('useVideoTask must be used within VideoTaskProvider');
    }
    return context;
}

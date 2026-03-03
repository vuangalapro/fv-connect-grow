import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface VideoTaskContextType {
    activeVideoTaskId: string | null;
    openVideoTask: (taskId: string) => boolean;
    closeVideoTask: () => void;
    isAnyVideoTaskOpen: boolean;
    setSwitchToReviewsCallback?: (callback: () => void) => void;
    triggerSwitchToReviews?: () => void;
}

const VideoTaskContext = createContext<VideoTaskContextType | undefined>(undefined);

export function VideoTaskProvider({ children }: { children: ReactNode }) {
    const [activeVideoTaskId, setActiveVideoTaskId] = useState<string | null>(null);
    const [switchToReviewsCallback, setSwitchToReviewsCallback] = useState<(() => void) | null>(null);

    const openVideoTask = useCallback((taskId: string) => {
        if (activeVideoTaskId && activeVideoTaskId !== taskId) {
            return false;
        }
        setActiveVideoTaskId(taskId);
        return true;
    }, [activeVideoTaskId]);

    const closeVideoTask = useCallback(() => {
        setActiveVideoTaskId(null);
    }, []);

    const isAnyVideoTaskOpen = activeVideoTaskId !== null;

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
            activeVideoTaskId,
            openVideoTask,
            closeVideoTask,
            isAnyVideoTaskOpen,
            setSwitchToReviewsCallback: setSwitchToReviewsCallbackFn,
            triggerSwitchToReviews
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

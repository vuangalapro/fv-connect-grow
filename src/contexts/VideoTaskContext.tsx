import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface VideoTaskContextType {
    activeVideoTaskId: string | null;
    openVideoTask: (taskId: string) => boolean; // Returns true if successful, false if blocked
    closeVideoTask: () => void;
    isAnyVideoTaskOpen: boolean;
}

const VideoTaskContext = createContext<VideoTaskContextType | undefined>(undefined);

export function VideoTaskProvider({ children }: { children: ReactNode }) {
    const [activeVideoTaskId, setActiveVideoTaskId] = useState<string | null>(null);

    const openVideoTask = useCallback((taskId: string) => {
        if (activeVideoTaskId && activeVideoTaskId !== taskId) {
            // Another task is already open - block this one
            return false;
        }
        setActiveVideoTaskId(taskId);
        return true;
    }, [activeVideoTaskId]);

    const closeVideoTask = useCallback(() => {
        setActiveVideoTaskId(null);
    }, []);

    const isAnyVideoTaskOpen = activeVideoTaskId !== null;

    return (
        <VideoTaskContext.Provider value={{
            activeVideoTaskId,
            openVideoTask,
            closeVideoTask,
            isAnyVideoTaskOpen
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

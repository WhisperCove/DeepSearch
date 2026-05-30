import { useState, useEffect } from "react";

interface SplashScreenProps {
  isFirstLaunch: boolean;
  onComplete: () => void;
}

export function SplashScreen({ isFirstLaunch, onComplete }: SplashScreenProps) {
  const [activeDot, setActiveDot] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in
    requestAnimationFrame(() => setVisible(true));

    const totalDots = 12;
    const duration = 2000; // 2 seconds
    const interval = duration / totalDots;
    let current = 0;

    const timer = setInterval(() => {
      current++;
      setActiveDot(current);

      if (current >= totalDots) {
        clearInterval(timer);
        // Fade out
        setTimeout(() => {
          setVisible(false);
          setTimeout(onComplete, 300);
        }, 200);
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-gray-950 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      {/* App name only */}
      <h1 className="text-lg font-medium text-gray-900 dark:text-white tracking-tight mb-1">
        LocalSearch Pro
      </h1>
      <p className="text-xs text-gray-400 mb-12">
        本地文件智能检索
      </p>

      {/* Pixel dot progress */}
      <div className="flex gap-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 transition-all duration-100 ${
              i < activeDot 
                ? "bg-gray-900 dark:bg-white scale-100" 
                : "bg-gray-200 dark:bg-gray-800 scale-75"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

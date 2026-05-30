import { useState, useEffect } from "react";

interface SplashScreenProps {
  isFirstLaunch: boolean;
  onComplete: () => void;
}

export function SplashScreen({ isFirstLaunch, onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in
    requestAnimationFrame(() => setVisible(true));

    // Progress animation
    const duration = 1800;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(eased * 100);

      if (p < 1) {
        requestAnimationFrame(animate);
      } else {
        // Fade out
        setVisible(false);
        setTimeout(onComplete, 300);
      }
    };

    requestAnimationFrame(animate);
  }, []); // Stable - no deps

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-gray-950 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      {/* Logo */}
      <div className="mb-10">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="48" rx="12" fill="currentColor" className="text-gray-900 dark:text-white"/>
          <path d="M20 28L24 24M24 24L28 20M24 24L20 20M24 24L28 28" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dark:stroke-gray-950"/>
          <circle cx="24" cy="24" r="8" stroke="white" strokeWidth="2" className="dark:stroke-gray-950"/>
        </svg>
      </div>

      {/* App name */}
      <h1 className="text-lg font-medium text-gray-900 dark:text-white tracking-tight mb-1">
        LocalSearch Pro
      </h1>
      <p className="text-xs text-gray-400 mb-12">
        本地文件智能检索
      </p>

      {/* Progress */}
      <div className="w-32">
        <div className="h-px bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div 
            className="h-full bg-gray-300 dark:bg-gray-700 transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

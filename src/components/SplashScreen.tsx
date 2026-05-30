import { useState, useEffect } from "react";

interface SplashScreenProps {
  isFirstLaunch: boolean;
  onComplete: () => void;
}

export function SplashScreen({ isFirstLaunch: _isFirstLaunch, onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("正在初始化...");
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const stages = [
      { text: "正在加载配置文件...", duration: 600 },
      { text: "正在连接本地数据库...", duration: 800 },
      { text: "正在验证系统环境...", duration: 500 },
      { text: "准备就绪", duration: 300 },
    ];

    let currentStage = 0;
    let elapsed = 0;

    const interval = setInterval(() => {
      if (currentStage < stages.length) {
        setStatusText(stages[currentStage].text);
        elapsed += 50;
        
        if (elapsed >= stages[currentStage].duration) {
          currentStage++;
          elapsed = 0;
        }
        
        setProgress(Math.min(((currentStage * 100) / stages.length) + (elapsed / stages[currentStage].duration) * (100 / stages.length), 100));
      } else {
        clearInterval(interval);
        setFadeOut(true);
        setTimeout(onComplete, 300);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-950 transition-opacity duration-300 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="text-center">
        {/* Logo - minimal style */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-6 bg-gray-900 dark:bg-white rounded-2xl flex items-center justify-center">
            <svg className="w-10 h-10 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">LocalSearch Pro</h1>
          <p className="text-sm text-gray-500">本地文件智能检索工具</p>
        </div>

        {/* Progress bar - subtle */}
        <div className="w-48 mx-auto mb-6">
          <div className="h-0.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gray-900 dark:bg-white transition-all duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Status text */}
        <p className="text-xs text-gray-400">{statusText}</p>

        {/* Copyright */}
        <p className="text-xs text-gray-300 dark:text-gray-700 mt-12">© 2026 LocalSearch Pro</p>
      </div>
    </div>
  );
}

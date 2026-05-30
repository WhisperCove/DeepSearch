import { useState } from "react";

interface FirstRunWizardProps {
  onComplete: () => void;
}

const slides = [
  {
    title: "全离线本地搜索",
    description: "隐私零泄露，所有数据本地处理，无需联网即可使用",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: "毫秒级响应",
    description: "百万级文档下简单查询 <<100ms，即时预览，丝滑体验",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: "中文语义友好",
    description: "基于 jieba 分词，支持专有名词，中文搜索无乱码",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
  },
];

export function FirstRunWizard({ onComplete }: FirstRunWizardProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-40 bg-white dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex-none px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">LocalSearch Pro</span>
        </div>
        <button
          onClick={handleSkip}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          跳过
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-sm text-center">
          {/* Icon - minimal */}
          <div className="w-16 h-16 mx-auto mb-8 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center text-gray-900 dark:text-white border border-gray-100 dark:border-gray-800">
            {slides[currentSlide].icon}
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            {slides[currentSlide].title}
          </h2>

          {/* Description */}
          <p className="text-sm text-gray-500 leading-relaxed">
            {slides[currentSlide].description}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-none px-8 pb-8">
        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`h-1 rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? "w-6 bg-gray-900 dark:bg-white"
                  : "w-1.5 bg-gray-200 dark:bg-gray-800"
              }`}
            />
          ))}
        </div>

        {/* Button */}
        <button
          onClick={handleNext}
          className="w-full py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
        >
          {currentSlide < slides.length - 1 ? "下一步" : "开始使用"}
        </button>
      </div>
    </div>
  );
}

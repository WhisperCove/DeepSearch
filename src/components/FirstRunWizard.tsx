import { useState, useEffect } from "react";

interface FirstRunWizardProps {
  onComplete: () => void;
}

const slides = [
  {
    title: "本地搜索",
    desc: "全离线处理，数据不离开设备",
  },
  {
    title: "即时响应",
    desc: "百万文档，毫秒级检索",
  },
  {
    title: "中文友好",
    desc: "智能分词，精准匹配",
  },
];

export function FirstRunWizard({ onComplete }: FirstRunWizardProps) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleNext = () => {
    if (current < slides.length - 1) {
      setCurrent(current + 1);
    } else {
      setVisible(false);
      setTimeout(onComplete, 200);
    }
  };

  return (
    <div className={`fixed inset-0 z-40 bg-white dark:bg-gray-950 flex flex-col transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}>
      {/* Skip */}
      <div className="flex-none flex justify-end px-6 pt-4">
        <button
          onClick={() => { setVisible(false); setTimeout(onComplete, 200); }}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          跳过
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="text-center max-w-xs">
          {/* Title */}
          <h2 className="text-base font-medium text-gray-900 dark:text-white mb-2">
            {slides[current].title}
          </h2>

          {/* Description */}
          <p className="text-sm text-gray-400">
            {slides[current].desc}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-none px-8 pb-10">
        {/* Dots */}
        <div className="flex justify-center gap-1 mb-6">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-0.5 rounded-full transition-all duration-300 ${
                i === current ? "w-4 bg-gray-900 dark:bg-white" : "w-1 bg-gray-200 dark:bg-gray-800"
              }`}
            />
          ))}
        </div>

        {/* Button */}
        <button
          onClick={handleNext}
          className="w-full py-2.5 text-sm font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 transition-colors"
        >
          {current < slides.length - 1 ? "继续" : "开始使用"}
        </button>
      </div>
    </div>
  );
}

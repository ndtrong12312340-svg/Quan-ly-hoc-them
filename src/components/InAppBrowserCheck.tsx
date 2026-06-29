import React, { useEffect, useState } from 'react';
import { ExternalLink, AlertTriangle } from 'lucide-react';

export default function InAppBrowserCheck() {
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    // Check for Facebook, Messenger, Instagram, Zalo, TikTok
    const isFB = userAgent.indexOf("FBAN") > -1 || userAgent.indexOf("FBAV") > -1;
    const isZalo = userAgent.indexOf("Zalo") > -1;
    const isInstagram = userAgent.indexOf("Instagram") > -1;
    const isTikTok = userAgent.indexOf("TikTok") > -1;

    if (isFB || isZalo || isInstagram || isTikTok) {
      setIsInAppBrowser(true);
    }
  }, []);

  if (!isInAppBrowser) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
        </div>
        
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Trình duyệt không được hỗ trợ</h2>
        
        <p className="text-slate-600 mb-6 text-base leading-relaxed">
          Bạn đang mở ứng dụng trong trình duyệt nội bộ (Zalo, Facebook...). Để đảm bảo các chức năng hoạt động tốt nhất và không bị mất kết nối, vui lòng mở bằng trình duyệt web bên ngoài.
        </p>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 mb-6 w-full text-left">
          <h3 className="font-semibold text-slate-700 mb-2 flex items-center">
            <ExternalLink className="w-4 h-4 mr-2" /> Hướng dẫn:
          </h3>
          <ol className="list-decimal list-inside text-slate-600 space-y-2 text-sm">
            <li>Nhấn vào biểu tượng <strong>3 chấm</strong> ở góc trên bên phải màn hình.</li>
            <li>Chọn <strong>"Mở bằng trình duyệt"</strong> hoặc <strong>"Open in Browser"</strong> (Chrome, Safari, ...).</li>
          </ol>
        </div>
        
        <button 
          onClick={() => setIsInAppBrowser(false)}
          className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors"
        >
          Tôi đã hiểu, tiếp tục dùng tạm
        </button>
      </div>
    </div>
  );
}

import React from 'react';

export const IsfahanSkyline: React.FC<{ className?: string; opacity?: number }> = ({
  className = 'w-full h-24',
  opacity = 0.25,
}) => {
  return (
    <svg
      viewBox="0 0 1200 160"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ opacity }}
      preserveAspectRatio="none"
    >
      <path d="M0,158 L1200,158 L1200,160 L0,160 Z" />
      <g id="bridge-arches">
        <rect x="20" y="110" width="310" height="12" rx="2" />
        <rect x="20" y="98" width="310" height="6" rx="1" />
        {[0, 32, 64, 96, 128, 160, 192, 224, 256, 288].map((offset, i) => (
          <g key={`arch-${i}`} transform={`translate(${28 + offset}, 122)`}>
            <rect x="0" y="0" width="6" height="36" />
            <path d="M6,36 L6,14 C6,4 12,0 16,0 C20,0 26,4 26,14 L26,36 Z" />
          </g>
        ))}
      </g>
      <g id="sheikh-lotfollah-dome" transform="translate(460, 20)">
        <rect x="25" y="90" width="100" height="50" rx="2" />
        <path d="M22,90 C22,35 60,6 75,0 C90,6 128,35 128,90 Z" />
        <circle cx="75" cy="-10" r="3" />
      </g>
      <g id="shah-mosque" transform="translate(780, 0)">
        <path d="M60,110 C60,45 88,14 105,4 C122,14 150,45 150,110 Z" />
        <rect x="62" y="108" width="86" height="52" />
        <circle cx="105" cy="-9" r="3" />
        <rect x="40" y="80" width="130" height="80" />
      </g>
    </svg>
  );
};

export const IsfahanEmblem: React.FC<{ size?: number; className?: string }> = ({
  size = 44,
  className = '',
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-2xl bg-gradient-to-br from-teal-700 via-cyan-800 to-blue-950 p-1.5 shadow-md border border-teal-400/40 ${className}`}
      style={{ width: size, height: size }}
      title="نشان استان اصفهان - آموزش و پرورش ناحیه ۶"
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full text-white"
      >
        <circle cx="50" cy="50" r="46" stroke="#5eead4" strokeWidth="2" strokeDasharray="3 2" />
        <circle cx="50" cy="50" r="41" stroke="#38bdf8" strokeWidth="1.5" />
        <path
          d="M24,84 L24,54 C24,34 50,20 50,20 C50,20 76,34 76,54 L76,84 Z"
          fill="#0f766e"
          fillOpacity="0.4"
          stroke="#99f6e4"
          strokeWidth="2"
        />
        <path
          d="M34,56 C34,36 45,26 50,22 C55,26 66,36 66,56 Z"
          fill="#38bdf8"
          fillOpacity="0.8"
        />
        <circle cx="50" cy="18" r="2.5" fill="#facc15" />
      </svg>
    </div>
  );
};

export const IsfahanTileBorder: React.FC<{ className?: string }> = ({
  className = 'w-full h-2',
}) => {
  return (
    <div
      className={`overflow-hidden relative bg-gradient-to-r from-teal-800 via-sky-600 to-blue-900 ${className}`}
      style={{
        backgroundImage: `repeating-linear-gradient(
          45deg,
          #0d9488 0px,
          #0d9488 10px,
          #0284c7 10px,
          #0284c7 20px,
          #d97706 20px,
          #d97706 23px,
          #1e3a8a 23px,
          #1e3a8a 33px
        )`,
      }}
    >
      <div className="absolute inset-0 bg-white/10 backdrop-blur-[0.5px]" />
    </div>
  );
};

export const IsfahanArchBadge: React.FC<{
  title: string;
  subtitle?: string;
  className?: string;
}> = ({ title, subtitle, className = '' }) => {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-gradient-to-r from-teal-50 via-sky-50 to-blue-50 border border-teal-200 text-teal-950 text-xs shadow-xs ${className}`}
    >
      <span className="text-teal-600 font-bold text-sm">✦</span>
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-teal-900">{title}</span>
        {subtitle && (
          <>
            <span className="text-teal-400">•</span>
            <span className="text-teal-700 text-[11px]">{subtitle}</span>
          </>
        )}
      </div>
      <span className="text-sky-600 font-bold text-sm">✦</span>
    </div>
  );
};

export const IsfahanToranjWatermark: React.FC<{ className?: string; opacity?: number }> = ({
  className = 'w-32 h-32',
  opacity = 0.08,
}) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ opacity }}
    >
      <g transform="translate(50,50)">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, idx) => (
          <g key={idx} transform={`rotate(${angle})`}>
            <path d="M0, -46 C8, -36 12, -22 0, -10 C-12, -22 -8, -36 0, -46 Z" />
            <circle cx="0" cy="-48" r="1.5" />
          </g>
        ))}
        <circle cx="0" cy="0" r="10" />
        <circle cx="0" cy="0" r="6" fill="#f59e0b" />
      </g>
    </svg>
  );
};

export const IsfahanHeritageBar: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`p-3 bg-gradient-to-r from-teal-900 via-sky-950 to-indigo-950 text-white rounded-2xl border border-teal-500/30 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0">
          <span className="text-teal-300 text-base">🕌</span>
        </div>
        <div>
          <div className="font-bold text-teal-200">
            استان اصفهان؛ نصف جهان، پایتخت فرهنگ و تمدن ایران اسلامی
          </div>
          <div className="text-[11px] text-teal-300/80">
            اداره آموزش و پرورش ناحیه ۶ اصفهان | مهد پرورش نخبگان و معلمان فرهیخته
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-sky-200 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
        <span>پرورشی</span>
        <span className="text-teal-400">•</span>
        <span>آموزش ابتدایی</span>
        <span className="text-teal-400">•</span>
        <span>متوسطه اول</span>
        <span className="text-teal-400">•</span>
        <span>متوسطه دوم</span>
        <span className="text-teal-400">•</span>
        <span>تربیت بدنی</span>
      </div>
    </div>
  );
};

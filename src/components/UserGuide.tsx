import React from 'react';
import { HelpCircle, CheckCircle2 } from 'lucide-react';

export const UserGuide: React.FC = () => {
  const guideSections = [
    {
      q: '۱. ۵ بخش و حوزه تخصصی طرح‌ها کدامند و چگونه تعیین می‌شوند؟',
      a: 'طرح‌ها و برنامه‌ها در این سامانه صرفاً برای پرورشی نیستند بلکه در ۵ حوزه تفکیک شده‌اند: ۱. پرورشی ۲. آموزش ابتدایی ۳. آموزش متوسطه اول ۴. آموزش متوسطه دوم ۵. تربیت بدنی. هنگام تعریف یا ویرایش هر طرح، حوزه مربوطه مشخص می‌گردد و در تمام گزارش‌ها و فیلترها قابل پایش تفکیکی است.',
    },
    {
      q: '۲. نمودار دایره‌ای کارتابل همکار برای طرح‌های همگانی و اختصاصی چگونه کار می‌کند؟',
      a: 'در بخش کارتابل همکار، دو نمودار دایره‌ای مجزا و مستقل ارائه شده است: ۱) نمودار دایره‌ای طرح‌های همگانی که مستقیماً در امتیاز و رتبه‌بندی با ضرایب ۱ تا ۳ تاثیر دارد. ۲) نمودار دایره‌ای طرح‌های اختصاصی برای ارزیابی طرح‌های موردی و ویژه. همچنین می‌توانید با دکمه‌های بالای نمودار هر دو نمودار را کنار هم یا به صورت مجزا مشاهده نمایید.',
    },
    {
      q: '۳. نحوه حذف برنامه و طرح‌ها چگونه اصلاح شده است؟',
      a: 'در صفحه «طرح‌ها و برنامه‌ها»، با کلیک بر روی آیکون سطل زباله کنار هر برنامه، یک پنجره تایید داخلی باز می‌شود و با زدن دکمه «بله، این برنامه را حذف کن»، طرح به همراه تکالیف مرتبط بلافاصله و بدون خطا از کل سیستم حذف می‌گردد.',
    },
    {
      q: '۴. نحوه دریافت خروجی HTML از سامانه چگونه است؟',
      a: 'خروجی اصلی نرم‌افزار در قالب فایل مستقل HTML طراحی شده است. از نوار بالای سامانه یا منوی «مرکز خروجی‌ها (HTML/Excel)» دکمه «خروجی HTML» را بزنید. یک فایل مستقل با پسوند .html دانلود می‌شود که بدون نیاز به اینترنت با دابل‌کلیک در هر مرورگری اجرا شده و آماده چاپ استاندارد A4 و ساخت PDF است.',
    },
    {
      q: '۵. ضرایب ۱ تا ۳ طرح‌ها در امتیازدهی چگونه محاسبه می‌شوند؟',
      a: 'هر طرح بر اساس اهمیت ضریب ۱ (عادی)، ۲ (مهم) یا ۳ (ویژه) دارد. انجام به‌موقع هر طرح ۱۰۰ × ضریب (۱۰۰، ۲۰۰ یا ۳۰۰ امتیاز) و انجام با تاخیر ۶۰ × ضریب (۶۰، ۱۲۰ یا ۱۸۰ امتیاز) دارد که مستقیماً در رتبه‌بندی نهایی اعمال می‌شود.',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-emerald-600" />
          <span>راهنمای کاربری سامانه ارزشیابی عملکرد ناحیه ۶ اصفهان</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          راهنمای ۵ حوزه تخصصی، نمودار دایره‌ای همگانی و اختصاصی، حذف طرح‌ها و دریافت خروجی HTML
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3.5">
        {guideSections.map((item, idx) => (
          <div
            key={idx}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-200 transition-colors"
          >
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                {idx + 1}
              </span>
              <span>{item.q}</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed pr-8">{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

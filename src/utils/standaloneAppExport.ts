import { AppDatabase } from '../types';
import { getCurrentJalaliDate } from './jalali';

export async function generateCompleteStandaloneHtml(db: AppDatabase): Promise<string> {
  let html = '';
  try {
    const res = await fetch('/parvareshi_system.html');
    if (res.ok) {
      html = await res.text();
    }
  } catch (e) {}

  if (!html) {
    // Fallback directly to the comprehensive standalone HTML report generator
    const { generateHtmlReportContent } = await import('./htmlExport');
    return generateHtmlReportContent(db);
  }

  const exportTimestamp = Date.now();
  const liveDbWithMetadata = {
    ...db,
    _isExportedLiveDb: true,
    _exportTimestamp: exportTimestamp,
  };

  const fullDbJson = JSON.stringify(liveDbWithMetadata);

  const markerStart = '/* __STANDALONE_DATABASE_START__ */';
  const markerEnd = '/* __STANDALONE_DATABASE_END__ */';

  const startIndex = html.indexOf(markerStart);
  const endIndex = html.indexOf(markerEnd);

  if (startIndex !== -1 && endIndex !== -1) {
    const replacement = `${markerStart}\n    const DEFAULT_DATABASE = ${fullDbJson};\n    ${markerEnd}`;
    html = html.substring(0, startIndex) + replacement + html.substring(endIndex + markerEnd.length);
  }

  const office = db.settings?.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان';
  const newTitle = `سامانه ارزشیابی عملکرد نیروهای آموزش و پرورش ناحیه ۶ اصفهان (نسخه کامل و مستقل) | ${office}`;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${newTitle}</title>`);

  return html;
}

export async function exportCompleteStandaloneApp(
  db: AppDatabase,
  filenamePrefix = 'سامانه_ارزشیابی_عملکرد_ناحیه۶_اصفهان_نسخه_کامل',
): Promise<void> {
  const html = await generateCompleteStandaloneHtml(db);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const dateStr = getCurrentJalaliDate().replace(/\//g, '-');
  const filename = `${filenamePrefix}_${dateStr}.html`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function openCompleteStandaloneAppInNewTab(db: AppDatabase): Promise<void> {
  const html = await generateCompleteStandaloneHtml(db);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

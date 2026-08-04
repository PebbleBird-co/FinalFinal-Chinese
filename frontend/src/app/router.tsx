import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ReportLayout } from '@/components/report/ReportLayout';
import { HomePage } from '@/pages/HomePage';
import { FamilyTreePage } from '@/pages/FamilyTreePage';
import { FileDetailPage } from '@/pages/FileDetailPage';
import { OverviewPage } from '@/pages/OverviewPage';
import { RisksPage } from '@/pages/RisksPage';
import { ScanPage } from '@/pages/ScanPage';
import { TimelinePage } from '@/pages/TimelinePage';

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="scan" element={<ScanPage />} />
          <Route path="report" element={<ReportLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="families" element={<FamilyTreePage />} />
            <Route path="risks" element={<RisksPage />} />
            <Route path="files/:fileId" element={<FileDetailPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

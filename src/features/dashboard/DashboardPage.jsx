import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { CenterPanel } from './CenterPanel';
import { AlertsModal } from '../alerts/AlertsModal';
import { CamerasModal } from '../cameras/CamerasModal';
import { PanicConfirmModal } from '../panic/PanicConfirmModal';
import { ToastStack } from '../alerts/ToastStack';

export function DashboardPage() {
  return (
    <>
      <TopBar />
      <div className="body">
        <Sidebar />
        <CenterPanel />
      </div>

      {/* Modals — rendered always, controlled by ui.store */}
      <AlertsModal />
      <CamerasModal />
      <PanicConfirmModal />

      {/* Floating toast notifications */}
      <ToastStack />
    </>
  );
}

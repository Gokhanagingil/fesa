import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { TenantStatusBanner } from './TenantStatusBanner';

export function AppShell() {
  return (
    <div className="min-h-dvh flex flex-col md:flex-row bg-amateur-canvas">
      <Sidebar />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <Header />
        <TenantStatusBanner />
        <main className="flex-1 px-4 pb-10 pt-6 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

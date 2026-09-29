import { Outlet } from 'react-router'
import { AppHeader } from '@/widgets/app-header'
import { AppSidebar } from '@/widgets/app-sidebar'

export function AppLayout() {
  return (
    <div className="h-screen overflow-x-auto">
      <div className="flex h-full min-w-[1280px]">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

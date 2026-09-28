import { createBrowserRouter, Navigate } from 'react-router'
import { ReplanPage } from '@/pages/replan'
import { AnalyticsPage } from '@/pages/analytics'
import { CrewsPage } from '@/pages/crews'
import { ImportPage } from '@/pages/import'
import { OrdersPage } from '@/pages/orders'
import { PlanningPage } from '@/pages/planning'
import { SettingsPage } from '@/pages/settings'
import { AppLayout } from '../layout/AppLayout'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/planning" replace /> },
      { path: 'planning', element: <PlanningPage /> },
      { path: 'replan', element: <ReplanPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'crews', element: <CrewsPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'import', element: <ImportPage /> },
      { path: '*', element: <Navigate to="/planning" replace /> },
    ],
  },
])

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { PlanProvider } from '@/features/load-plan'
import { router } from './router'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlanProvider>
      <RouterProvider router={router} />
    </PlanProvider>
  </StrictMode>,
)

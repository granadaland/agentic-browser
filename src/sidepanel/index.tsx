import React from 'react'
import ReactDOM from 'react-dom/client'
import { SidePanelPage } from './pages/SidePanelPage'
import './styles/globals.css'
import './styles/shared/index.scss'

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
)

root.render(
  <React.StrictMode>
    <SidePanelPage />
  </React.StrictMode>
) 
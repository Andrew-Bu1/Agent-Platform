import { RouterProvider } from '@tanstack/react-router'
import { ThemeProvider } from './context/ThemeContext'
import { ModelsProvider } from './store/modelsStore'
import { AgentsProvider } from './store/agentsStore'
import { ToolsProvider } from './store/toolsStore'
import { router } from './router'

function App() {
  return (
    <ThemeProvider>
      <ModelsProvider>
        <AgentsProvider>
          <ToolsProvider>
            <RouterProvider router={router} />
          </ToolsProvider>
        </AgentsProvider>
      </ModelsProvider>
    </ThemeProvider>
  )
}

export default App

import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import DatasourcesPage from './pages/DatasourcesPage'
import ModelsPage from './pages/ModelsPage'
import AgentsPage from './pages/AgentsPage'
import ToolsPage from './pages/ToolsPage'

const rootRoute = createRootRoute()

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  component: SignUpPage,
})

const datasourcesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/apps/datasources',
  component: DatasourcesPage,
})

const modelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/apps/models',
  component: ModelsPage,
})

const agentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/apps/agents',
  component: AgentsPage,
})

const toolsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/apps/tools',
  component: ToolsPage,
})

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, signupRoute, datasourcesRoute, modelsRoute, agentsRoute, toolsRoute])

export const router = createRouter({ routeTree })

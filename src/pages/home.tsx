import { Navigate, useLocation } from 'react-router-dom'

/** Legacy route — the Add Recipe screen moved to /add in the Recipe Box
 * redesign. Preserve query params (e.g. ?url=… from the landing hero). */
export default function HomeRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/add${search}`} replace />
}

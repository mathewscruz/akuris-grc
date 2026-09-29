import { Navigate } from 'react-router-dom';

// Preserve bookmarks and campaign links without exposing a public price list.
export default function PlanosAssinatura() {
  return <Navigate to="/?demo=1&interest=plans" replace />;
}

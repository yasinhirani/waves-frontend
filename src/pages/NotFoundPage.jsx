import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Not found');
  return (
    <div className="state">
      <h1>404</h1>
      <p>We couldn’t find that page.</p>
      <Link className="btn btn-primary" to="/">
        Back to home
      </Link>
    </div>
  );
}

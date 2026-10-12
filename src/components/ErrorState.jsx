import { AlertCircle } from 'lucide-react';

export default function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <div className="state" role="alert">
      <AlertCircle size={32} />
      <p>{message}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export const EmptyState = ({ message }) => (
  <div className="state">
    <p>{message}</p>
  </div>
);

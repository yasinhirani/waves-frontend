import { useToastStore } from '../store/toastStore';

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="toaster" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

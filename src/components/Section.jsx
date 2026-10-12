import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Section({ title, children }) {
  const ref = useRef(null);
  const scroll = (dir) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        <div className="section-arrows">
          <button className="icon-btn" aria-label={`Scroll ${title} left`} onClick={() => scroll(-1)}>
            <ChevronLeft size={20} />
          </button>
          <button className="icon-btn" aria-label={`Scroll ${title} right`} onClick={() => scroll(1)}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div className="row" ref={ref}>
        {children}
      </div>
    </section>
  );
}

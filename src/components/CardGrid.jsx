import MediaCard from './MediaCard';

export default function CardGrid({ items }) {
  return (
    <div className="grid">
      {items.map((item, i) => (
        <MediaCard key={`${item.id}-${i}`} item={item} />
      ))}
    </div>
  );
}

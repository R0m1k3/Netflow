import LandscapeCard from './LandscapeCard';
import ContinueCard from './ContinueCard';
import { useSearchParams } from 'react-router-dom';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

type Item = { id: string; title: string; image: string; badge?: string; progress?: number };

export default function Row({ title, items, variant = 'default', onItemClick, browseKey, gutter = 'row' }: {
  title: string;
  items: Item[];
  variant?: 'default' | 'continue';
  onItemClick?: (id: string) => void;
  browseKey?: string;
  gutter?: 'row' | 'inherit' | 'edge'; // 'row' = left-only wrapper + edge scroller; 'inherit' = plain; 'edge' = edge scroller only (no wrapper padding)
}) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  // Deduplicate by stable item id to avoid React key collisions
  const uniqueItems = useMemo(() => {
    const seen = new Set<string>();
    const out: Item[] = [];
    for (const it of items || []) {
      const key = it?.id;
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
    return out;
  }, [items]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 0);
    setShowRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [uniqueItems]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const { clientWidth } = scrollRef.current;
    const scrollAmount = clientWidth * 0.75;
    scrollRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    setTimeout(checkScroll, 300); // Check after scroll animation
  };
  return (
    <section className="py-0 my-6 md:my-8 lg:my-10">
      <div className={gutter === 'row' ? 'row-gutter' : ''}>
        <div className="row-band">
          <div className="pt-4">
            <div className="flex items-baseline gap-3 group">
              <h2 className="text-neutral-200 font-semibold text-xl md:text-2xl cursor-default">{title}</h2>
              {browseKey && (
                <button
                  onClick={() => { params.set('bkey', browseKey); setParams(params, { replace: false }); }}
                  className="flex items-center gap-1 text-sm text-neutral-300 hover:text-white opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all duration-500 ease-out"
                  title="Browse"
                >
                  <span title={t('row.browse')}>{t('row.browse')}</span>
                  <span aria-hidden>›</span>
                </button>
              )}
            </div>
          </div>
          <div className="relative group/row">
            <div
              ref={scrollRef}
              onScroll={checkScroll}
              className={((gutter === 'row' || gutter === 'edge') ? 'row-edge' : 'row-edge-plain') + ' no-scrollbar overflow-x-auto py-3 md:py-4 scroll-smooth'}
            >
              <div className="flex gap-6 md:gap-8 pb-2 md:pb-4 w-max">
                {uniqueItems.map((i) => variant === 'continue' ? (
                  <ContinueCard key={i.id} id={i.id} title={i.title} image={i.image!} progress={i.progress ?? 0} onClick={(id) => onItemClick?.(id)} />
                ) : (
                  <LandscapeCard key={i.id} id={i.id} title={i.title} image={i.image!} badge={i.badge} onClick={() => onItemClick?.(i.id)} />
                ))}
              </div>
            </div>

            {/* Navigation Arrows */}
            {showLeft && (
              <button
                onClick={() => scroll('left')}
                className="absolute left-0 top-0 bottom-0 z-20 w-12 bg-gradient-to-r from-black/80 to-transparent flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                aria-label="Scroll left"
              >
                <svg className="w-8 h-8 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            {showRight && (
              <button
                onClick={() => scroll('right')}
                className="absolute right-0 top-0 bottom-0 z-20 w-12 bg-gradient-to-l from-black/80 to-transparent flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                aria-label="Scroll right"
              >
                <svg className="w-8 h-8 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

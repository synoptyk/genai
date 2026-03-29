import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp } from 'lucide-react';

/**
 * ScrollToTopButton — global floating button that appears after scrolling down 300px.
 * It obtains the scroll container by looking for the nearest ancestor that has overflow-y-auto.
 * Must be rendered inside AppShell's <main> wrapper.
 */
const ScrollToTopButton = ({ scrollContainerRef }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = scrollContainerRef?.current;
    if (!el) return;

    const onScroll = () => {
      setVisible(el.scrollTop > 300);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollContainerRef]);

  const handleClick = () => {
    scrollContainerRef?.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      onClick={handleClick}
      aria-label="Volver arriba"
      className={`fixed bottom-6 right-6 z-[200] w-12 h-12 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-400/40
        flex items-center justify-center hover:bg-indigo-700 hover:scale-110 active:scale-95
        transition-all duration-300 border border-white/20 print:hidden
        ${visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}
    >
      <ChevronUp className="w-5 h-5" strokeWidth={3} />
    </button>
  );
};

export default ScrollToTopButton;

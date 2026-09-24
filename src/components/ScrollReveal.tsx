'use client';

import { useEffect } from 'react';

export default function ScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { 
        threshold: 0.1, 
        rootMargin: '0px 0px -50px 0px' 
      }
    );

    const observeElements = () => {
      document.querySelectorAll('.reveal').forEach((el) => {
        observer.observe(el);
      });
    };

    observeElements();

    // Re-observe when DOM changes (important for client-side navigation)
    const mutationObserver = new MutationObserver(() => {
      observeElements();
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return null;
}

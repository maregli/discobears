import { useState, useEffect } from 'react';

/**
 * Hook to get the actual visible viewport height on mobile devices.
 * This accounts for dynamic browser UI (address bars, toolbars) that change the viewport.
 */
export const useViewportHeight = () => {
  const getViewportHeight = () => {
    // Use visualViewport API if available (most modern browsers)
    if (window.visualViewport) {
      return window.visualViewport.height;
    }
    // Fallback to innerHeight
    return window.innerHeight;
  };

  const [height, setHeight] = useState(getViewportHeight());

  useEffect(() => {
    const handleResize = () => {
      setHeight(getViewportHeight());
    };

    // Listen to visualViewport changes (better for mobile)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }
    
    // Fallback to window resize
    window.addEventListener('resize', handleResize);
    
    // Initial measurement
    handleResize();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return height;
};

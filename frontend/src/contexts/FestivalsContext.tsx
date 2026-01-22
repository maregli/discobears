import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { subscribeToFestivals } from 'firebaseServices/firestore';
import { Festival } from 'types/festival';

interface FestivalsContextType {
  festivals: Festival[];
  isLoading: boolean;
  error: Error | null;
}

const FestivalsContext = createContext<FestivalsContextType | undefined>(undefined);

export const FestivalsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    console.log('FestivalsProvider: Subscribing to festivals...');
    const unsubscribe = subscribeToFestivals(setFestivals, setIsLoading, setError);
    
    return () => {
      console.log('FestivalsProvider: Unsubscribing from festivals');
      unsubscribe();
    };
  }, []);

  return (
    <FestivalsContext.Provider value={{ festivals, isLoading, error }}>
      {children}
    </FestivalsContext.Provider>
  );
};

export const useFestivals = () => {
  const context = useContext(FestivalsContext);
  if (context === undefined) {
    throw new Error('useFestivals must be used within a FestivalsProvider');
  }
  return context;
};

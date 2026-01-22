// src/firebase/firestore.ts

import {
  collection,
  getDocs,
  QuerySnapshot,
  DocumentData,
  onSnapshot,
  doc,
  addDoc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';

import { db } from 'firebaseServices/firebaseConfig';
import { Festival } from 'types/festival';

// Reference to the 'festivals' collection in Firestore
const festivalsCollectionRef = collection(db, 'festivals');

// Function to get all festivals
export const getFestivals = async (): Promise<Festival[]> => {
  try {
    const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(festivalsCollectionRef);
    const festivals: Festival[] = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Festival, 'id'>),
    }));
    return festivals;
  } catch (error) {
    console.error('Error getting festivals:', error);
    return [];
  }
};

// Function to get all festivals with real-time updates
export const subscribeToFestivals = (
  setFestivals: (festivals: Festival[]) => void,
  setIsLoading: (loading: boolean) => void,
  setError: (error: Error | null) => void
): (() => void) => {
  setIsLoading(true);
  setError(null);

  const unsubscribe = onSnapshot(
    festivalsCollectionRef,
    (snapshot) => {
      const festivals: Festival[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Festival, 'id'>),
      }));
      setFestivals(festivals);
      setIsLoading(false);
    },
    (error) => {
      console.error("Error getting festivals:", error);
      setError(error);
      setIsLoading(false);
    }
  );

  return () => unsubscribe();
};

// Festival Details
export const getFestivalById = async (festivalId: string): Promise<Festival | null> => {
  try {
    const docRef = doc(db, 'festivals', festivalId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Festival;
    }
    return null;
  } catch (error) {
    console.error('Error getting festival:', error);
    return null;
  }
};

// Ratings
export interface Rating {
  userId: string;
  userEmail: string;
  overall: number;
  lineup: number;
  location: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface FestivalRatings {
  overall: { average: number; count: number };
  lineup: { average: number; count: number };
  location: { average: number; count: number };
}

export const submitRating = async (
  festivalId: string, 
  userId: string, 
  userEmail: string, 
  ratings: { overall: number; lineup: number; location: number }
): Promise<void> => {
  try {
    const ratingRef = doc(db, 'festivals', festivalId, 'ratings', userId);
    
    // Read user's existing rating (1 read)
    const oldRatingSnap = await getDoc(ratingRef);
    const oldRatingData = oldRatingSnap.exists() ? oldRatingSnap.data() : null;
    
    // Write rating (1 write)
    await setDoc(ratingRef, {
      userId,
      userEmail,
      overall: ratings.overall,
      lineup: ratings.lineup,
      location: ratings.location,
      createdAt: oldRatingData?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Update denormalized rating fields on festival document
    // Get all ratings and recalculate aggregates
    const updatedRatings = await getFestivalRatings(festivalId);
    const festivalRef = doc(db, 'festivals', festivalId);
    
    await updateDoc(festivalRef, {
      rating_overall_average: updatedRatings.overall.average,
      rating_overall_count: updatedRatings.overall.count,
      rating_lineup_average: updatedRatings.lineup.average,
      rating_lineup_count: updatedRatings.lineup.count,
      rating_location_average: updatedRatings.location.average,
      rating_location_count: updatedRatings.location.count
    });
    
  } catch (error) {
    console.error('Error submitting rating:', error);
    throw error;
  }
};

export const getUserRating = async (festivalId: string, userId: string): Promise<Rating | null> => {
  try {
    const ratingRef = doc(db, 'festivals', festivalId, 'ratings', userId);
    const ratingSnap = await getDoc(ratingRef);
    
    if (ratingSnap.exists()) {
      const data = ratingSnap.data();
      return {
        userId: data.userId,
        userEmail: data.userEmail,
        overall: data.overall,
        lineup: data.lineup,
        location: data.location,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting user rating:', error);
    return null;
  }
};

export const getFestivalRatings = async (festivalId: string): Promise<FestivalRatings> => {
  try {
    // Get all ratings for this festival and calculate on-demand
    const ratingsRef = collection(db, 'festivals', festivalId, 'ratings');
    const ratingsSnap = await getDocs(ratingsRef);
    
    if (ratingsSnap.empty) {
      return {
        overall: { average: 0, count: 0 },
        lineup: { average: 0, count: 0 },
        location: { average: 0, count: 0 }
      };
    }
    
    // Calculate averages for each category
    const ratings = ratingsSnap.docs.map(doc => doc.data());
    
    const calculateAverage = (category: 'overall' | 'lineup' | 'location') => {
      // Filter out undefined, null, and 0 values (0 means not rated)
      const values = ratings.map(r => r[category]).filter(v => v !== undefined && v !== null && v > 0);
      if (values.length === 0) return { average: 0, count: 0 };
      const sum = values.reduce((acc, val) => acc + val, 0);
      return {
        average: sum / values.length,
        count: values.length
      };
    };
    
    return {
      overall: calculateAverage('overall'),
      lineup: calculateAverage('lineup'),
      location: calculateAverage('location')
    };
  } catch (error) {
    console.error('Error getting festival ratings:', error);
    return {
      overall: { average: 0, count: 0 },
      lineup: { average: 0, count: 0 },
      location: { average: 0, count: 0 }
    };
  }
};

// Comments
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: Date;
}

export const addComment = async (festivalId: string, userId: string, userName: string, text: string): Promise<void> => {
  try {
    const commentsRef = collection(db, 'festivals', festivalId, 'comments');
    await addDoc(commentsRef, {
      userId,
      userName,
      text,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
};

export const subscribeToComments = (
  festivalId: string,
  setComments: (comments: Comment[]) => void
): (() => void) => {
  const commentsRef = collection(db, 'festivals', festivalId, 'comments');
  const q = query(commentsRef, orderBy('createdAt', 'desc'));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const comments: Comment[] = snapshot.docs.map(doc => ({
      id: doc.id,
      userId: doc.data().userId,
      userName: doc.data().userName,
      text: doc.data().text,
      createdAt: doc.data().createdAt?.toDate() || new Date()
    }));
    setComments(comments);
  });
  
  return unsubscribe;
};

// Attendance
export interface Attendance {
  userId: string;
  userName: string;
  userEmail: string;
  status: 'attending' | 'tempted';
  createdAt: Date;
  updatedAt?: Date;
}

export const setAttendance = async (
  festivalId: string,
  userId: string,
  userName: string,
  userEmail: string,
  status: 'attending' | 'tempted'
): Promise<void> => {
  try {
    const attendanceRef = doc(db, 'festivals', festivalId, 'attendance', userId);
    
    await setDoc(attendanceRef, {
      userId,
      userName,
      userEmail,
      status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error setting attendance:', error);
    throw error;
  }
};

export const removeAttendance = async (
  festivalId: string,
  userId: string
): Promise<void> => {
  try {
    const attendanceRef = doc(db, 'festivals', festivalId, 'attendance', userId);
    await setDoc(attendanceRef, {
      status: null,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error removing attendance:', error);
    throw error;
  }
};

export const getUserAttendance = async (
  festivalId: string,
  userId: string
): Promise<Attendance | null> => {
  try {
    const attendanceRef = doc(db, 'festivals', festivalId, 'attendance', userId);
    const attendanceSnap = await getDoc(attendanceRef);
    
    if (attendanceSnap.exists()) {
      const data = attendanceSnap.data();
      // If status is null, return null (user removed their attendance)
      if (!data.status) return null;
      
      return {
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        status: data.status,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting user attendance:', error);
    return null;
  }
};

export const subscribeToAttendance = (
  festivalId: string,
  setAttendance: (attendance: Attendance[]) => void
): (() => void) => {
  const attendanceRef = collection(db, 'festivals', festivalId, 'attendance');
  
  const unsubscribe = onSnapshot(attendanceRef, (snapshot) => {
    const attendanceList: Attendance[] = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      // Filter out entries where status is null (removed attendance)
      if (data.status) {
        attendanceList.push({
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          status: data.status,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate()
        });
      }
    });
    
    setAttendance(attendanceList);
  });
  
  return unsubscribe;
};

// Get attendance counts for a specific festival
export const getAttendanceCounts = async (
  festivalId: string
): Promise<{ attendingCount: number; temptedCount: number }> => {
  try {
    const attendanceRef = collection(db, 'festivals', festivalId, 'attendance');
    const snapshot = await getDocs(attendanceRef);
    
    let attendingCount = 0;
    let temptedCount = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'attending') attendingCount++;
      else if (data.status === 'tempted') temptedCount++;
    });
    
    return { attendingCount, temptedCount };
  } catch (error) {
    console.error('Error getting attendance counts:', error);
    return { attendingCount: 0, temptedCount: 0 };
  }
};

// Get attendance counts for all festivals
export const getAllAttendanceCounts = async (
  festivalIds: string[]
): Promise<Record<string, { attendingCount: number; temptedCount: number }>> => {
  try {
    const counts: Record<string, { attendingCount: number; temptedCount: number }> = {};
    
    // Fetch attendance for each festival
    await Promise.all(
      festivalIds.map(async (festivalId) => {
        counts[festivalId] = await getAttendanceCounts(festivalId);
      })
    );
    
    return counts;
  } catch (error) {
    console.error('Error getting all attendance counts:', error);
    return {};
  }
};

// Admin functions
export const isUserAdmin = async (userEmail: string): Promise<boolean> => {
  try {
    const adminDoc = await getDoc(doc(db, 'admins', 'admin-users'));
    const adminEmails = adminDoc.data()?.emails || [];
    return adminEmails.includes(userEmail);
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// User festival submission
export const submitUserFestival = async (
  festivalData: any,
  userId: string,
  userName: string
): Promise<void> => {
  const festivalsRef = collection(db, 'festivals');
  
  // Generate unique ID from name + timestamp
  const festivalId = festivalData.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  const docRef = doc(festivalsRef, `user-${festivalId}-${Date.now()}`);
  
  await setDoc(docRef, {
    ...festivalData,
    source: 'user-submitted',
    submittedBy: userId,
    submittedByName: userName,
    status: 'pending',
    submittedAt: serverTimestamp(),
    created_at: serverTimestamp(),
    coordinates: null,
    geocoding_needed: true
  });
};

// Get festivals by status (client-side filtering for small collections)
export const getFestivalsByStatus = async (
  status: 'pending' | 'approved' | 'rejected'
): Promise<Festival[]> => {
  // Get all festivals, then filter client-side (works well for small collections)
  const snapshot = await getDocs(collection(db, 'festivals'));
  
  const festivals = snapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data(),
      submittedAt: doc.data().submittedAt?.toDate(),
      reviewedAt: doc.data().reviewedAt?.toDate()
    } as Festival))
    .filter(festival => 
      festival.source === 'user-submitted' && 
      festival.status === status
    )
    .sort((a, b) => {
      // Sort by submittedAt, newest first
      if (!a.submittedAt) return 1;
      if (!b.submittedAt) return -1;
      return b.submittedAt.getTime() - a.submittedAt.getTime();
    });
  
  return festivals;
};

// Update festival status (admin only)
export const updateFestivalStatus = async (
  festivalId: string,
  status: 'pending' | 'approved' | 'rejected',
  rejectionReason?: string
): Promise<void> => {
  const festivalRef = doc(db, 'festivals', festivalId);
  const updateData: any = {
    status,
    reviewedAt: serverTimestamp()
  };
  
  // Only add rejection reason if provided and status is rejected
  if (rejectionReason && status === 'rejected') {
    updateData.rejectionReason = rejectionReason;
  }
  
  // Clear rejection reason if moving back to pending or approved
  if (status !== 'rejected') {
    updateData.rejectionReason = null;
  }
  
  await updateDoc(festivalRef, updateData);
};


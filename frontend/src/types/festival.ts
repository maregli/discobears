export interface Festival {
  id: string;
  name: string;
  source_url: string; // Festival Alarm URL (where we scraped from)
  url?: string; // Legacy field, kept for backwards compatibility
  dates: string;
  duration: string;
  venue_type: string;
  genres: string[];
  region: string;
  // Address fields (structured)
  street?: string;
  street_number?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  // Legacy venue field (for backwards compatibility during migration)
  venue?: string;
  venue_formatted?: string; // Formatted venue with proper spacing
  coordinates: {
    lat: number;
    lng: number;
  } | null;
  price: string;
  visitors: string;
  parsed_city?: string;
  parsed_country?: string;
  geocoding_needed?: boolean;
  geocoding_failed?: boolean;
  external_link?: string; // Official festival website URL
  created_at?: any;
  updated_at?: any;
  // Rating fields
  rating_overall_average?: number;
  rating_overall_count?: number;
  rating_lineup_average?: number;
  rating_lineup_count?: number;
  rating_location_average?: number;
  rating_location_count?: number;
  // User submission fields
  source?: 'scraped' | 'user-submitted';
  status?: 'pending' | 'approved' | 'rejected';
  submittedBy?: string;
  submittedByName?: string;
  submittedAt?: Date;
  reviewedAt?: Date;
  rejectionReason?: string;
  // Attendance counts (computed on the fly)
  attendingCount?: number;
  temptedCount?: number;
}

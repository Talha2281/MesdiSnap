export interface MedicineInfo {
  medicine_name: string;
  generic_name: string;
  type: string;
  what_it_treats: string[];
  dosage: string;
  when_to_take: string;
  duration: string;
  common_side_effects: string[];
  serious_side_effects: string[];
  drug_interactions: string[];
  who_should_not_take: string[];
  overdose_warning: string;
  storage: string;
  extra_notes: string;
}

export type DoseStatus = 'taken' | 'missed' | 'skipped' | 'snoozed' | 'pending';

export interface DoseLog {
  id: string;
  medicationId: string;
  medicationName: string;
  scheduledTime: string; // ISO String
  actualTime?: string; // ISO String
  status: DoseStatus;
  notes?: string;
  profileId: string;
}

export interface MedicationTrack {
  id: string;
  name: string;
  dosage: string;
  instructions: string;
  startDate: string;
  frequency: 'daily' | 'twice_daily' | 'thrice_daily' | 'custom';
  times: string[]; // ["08:00", "20:00"]
  isCritical: boolean;
  currentStock: number;
  profileId: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  role: string; // 'Self', 'Parent', 'Child', etc.
  avatar?: string;
  healthScore: number;
  conditions: string[];
  allergies: string[];
}

export interface HealthLog {
  id: string;
  profileId: string;
  date: string;
  symptoms: string[];
  mood: string;
  vitals?: {
    systolic?: number;
    diastolic?: number;
    weight?: number;
  };
}

export interface PrescriptionData {
  document_type: 'prescription' | 'report' | 'unknown';
  summary: string;
  prescription_summary: string;
  medicines: MedicineInfo[];
}

export type Language = 'en' | 'ur' | 'hi';

export interface ScanHistory {
  id: string;
  name: string;
  data: PrescriptionData;
  timestamp: number;
}

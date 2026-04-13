/** Client-side shapes mirroring API responses (subset). */

export type AthleteStatus = 'active' | 'inactive' | 'trial' | 'archived';
export type TrainingSessionStatus = 'planned' | 'completed' | 'cancelled';
export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'late';
export type AthleteChargeStatus = 'pending' | 'partially_paid' | 'paid' | 'cancelled';

export type SportBranch = { id: string; code: string; name: string };
export type ClubGroup = { id: string; name: string; sportBranchId: string };
export type Team = { id: string; name: string; sportBranchId: string; groupId: string | null };

export type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  birthDate: string | null;
  gender: string | null;
  sportBranchId: string;
  primaryGroupId: string | null;
  status: AthleteStatus;
  jerseyNumber: string | null;
  notes: string | null;
};

export type Guardian = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
};

export type AthleteGuardianLink = {
  id: string;
  relationshipType: string;
  isPrimaryContact: boolean;
  guardian: Guardian;
};

export type TeamMembership = {
  id: string;
  startedAt: string | null;
  endedAt: string | null;
  team: Team;
};

export type TrainingSession = {
  id: string;
  title: string;
  sportBranchId: string;
  groupId: string;
  teamId: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  location: string | null;
  status: TrainingSessionStatus;
};

export type AttendanceRow = {
  id: string;
  status: AttendanceStatus;
  note: string | null;
  athlete: Athlete;
};

export type ChargeItem = {
  id: string;
  name: string;
  category: string;
  defaultAmount: string;
  currency: string;
  isActive: boolean;
};

export type AthleteCharge = {
  id: string;
  athleteId: string;
  chargeItemId: string;
  amount: string;
  dueDate: string | null;
  status: AthleteChargeStatus;
  chargeItem?: ChargeItem;
};

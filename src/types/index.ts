/* ============================================================
 * Доменные типы. Блок «Таблицы» повторяет схемы бэкенда (backend/app/schemas.py)
 * один в один — не менять без синхронной правки схемы БД.
 * ============================================================ */

// ---------- Таблицы ----------

export type Role = 'resident' | 'admin';

export interface Profile {
  id: string; // uuid = auth.users.id
  first_name: string;
  last_name: string;
  email: string;
  role: Role;
  points: number;
  avatar_url: string | null;
  is_blocked: boolean;
  created_at: string; // ISO
  last_active_at: string;
}

export type EventCategory = 'cleanup' | 'tree_planting' | 'recycling' | 'lecture' | 'other';
export type EventStatus = 'draft' | 'published' | 'cancelled' | 'finished';

export interface EcoEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  status: EventStatus;
  starts_at: string;
  ends_at: string | null;
  lat: number;
  lng: number;
  address: string | null;
  max_participants: number | null;
  cover_url: string | null;
  points_reward: number; // сколько баллов за подтверждённое участие
  created_by: string; // profile.id
  created_at: string;
  participants_count: number; // вычисляемое (во view)
}

export type ParticipationStatus = 'registered' | 'attended' | 'no_show' | 'cancelled';
export interface EventParticipant {
  event_id: string;
  user_id: string;
  status: ParticipationStatus;
  registered_at: string;
}

export type ReportType = 'illegal_dump' | 'toxic_release' | 'overflowing_bin' | 'burning' | 'water_pollution' | 'other';
export type ReportStatus = 'new' | 'in_review' | 'in_progress' | 'resolved' | 'rejected';
export type Severity = 1 | 2 | 3;

export interface Report {
  id: string;
  user_id: string;
  type: ReportType;
  severity: Severity; // небольшое / заметное / серьёзное
  description: string;
  lat: number;
  lng: number;
  status: ReportStatus;
  photo_urls: string[]; // фото от жителя (до 3)
  resolved_photo_url: string | null; // фото «после» от админа
  admin_comment: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface Badge {
  id: string;
  code: string; // 'first_step', 'sharp_eye', ...
  name_ru: string;
  name_kk: string;
  description_ru: string;
  description_kk: string;
  icon: string; // emoji или имя иконки
}
export interface UserBadge {
  user_id: string;
  badge_id: string;
  earned_at: string;
}

export type NotificationKind = 'report_status' | 'event_reminder' | 'badge_earned' | 'new_report' | 'event_update';
export interface AppNotification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string | null; // куда вести по клику
  is_read: boolean;
  created_at: string;
}

export interface VillageSettings {
  name_ru: string;
  name_kk: string;
  population: number; // вводит админ
  center_lat: number;
  center_lng: number;
  default_zoom: number;
  bounds: [[number, number], [number, number]] | null;
}

// ---------- Вспомогательные таблицы (нужно добавить в схему на этапе 2) ----------

/** История смены статусов обращения (таблица report_status_history). */
export interface ReportStatusChange {
  id: string;
  report_id: string;
  status: ReportStatus;
  comment: string | null;
  changed_by: string | null;
  changed_at: string;
}

export type PointReason = 'report_confirmed' | 'event_attended';
/** Журнал начисления баллов (таблица point_transactions) — для рейтинга за месяц. */
export interface PointTransaction {
  id: string;
  user_id: string;
  amount: number;
  reason: PointReason;
  ref_id: string; // report.id или event.id
  created_at: string;
}

// ---------- Входные данные / фильтры / DTO ----------

export interface SignInInput {
  email: string;
  password: string;
}
export interface SignUpInput {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}
export type ProfileUpdate = Partial<Pick<Profile, 'first_name' | 'last_name' | 'avatar_url'>>;

export type EventScope = 'upcoming' | 'past' | 'all';
export interface EventFilters {
  scope?: EventScope;
  category?: EventCategory | 'all';
  statuses?: EventStatus[]; // по умолчанию для жителя — только опубликованные/завершённые
}

export interface EventInput {
  title: string;
  description: string;
  category: EventCategory;
  status: EventStatus;
  starts_at: string;
  ends_at: string | null;
  lat: number;
  lng: number;
  address: string | null;
  max_participants: number | null;
  cover_url: string | null;
  points_reward: number;
}

export interface MyParticipation {
  event: EcoEvent;
  participation: EventParticipant;
}

export interface ParticipantWithProfile {
  participant: EventParticipant;
  profile: Profile;
}

export interface ReportFilters {
  statuses?: ReportStatus[];
  type?: ReportType | 'all';
  severity?: Severity | 'all';
  from?: string | null; // ISO
  to?: string | null;
  sort?: 'date_desc' | 'date_asc' | 'severity_desc';
}

export interface ReportInput {
  type: ReportType;
  severity: Severity;
  description: string;
  lat: number;
  lng: number;
  photo_urls: string[];
}

export interface ReportDetails {
  report: Report;
  author: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'email'> | null;
  history: ReportStatusChange[];
}

export interface BadgeProgress {
  badge: Badge;
  earned_at: string | null;
  current: number;
  target: number;
}

export type LeaderboardPeriod = 'month' | 'all';
export interface LeaderboardEntry {
  rank: number;
  profile: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'avatar_url'>;
  points: number;
}

export interface ProfileFilters {
  search?: string;
}

export interface DashboardStats {
  population: number;
  registered: number;
  active_7d: number;
  active_30d: number;
  reports_new: number;
  reports_in_progress: number;
  reports_resolved_month: number;
  avg_resolution_hours: number | null;
  events_month: number;
  participants_total: number;
  attendance_rate: number | null; // 0..1
  registrations_by_week: { week: string; count: number }[];
  reports_by_type: { type: ReportType; count: number }[];
  reports_by_month: { month: string; created: number; resolved: number }[];
  participation_by_month: { month: string; registered: number; attended: number }[];
  hotspots: { lat: number; lng: number; weight: number; status: ReportStatus }[];
}


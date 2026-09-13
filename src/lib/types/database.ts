/**
 * Database type definitions for the Supabase adapter.
 */

export type TenantRow = {
  id: string;
  slug: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_path: string | null;
  default_locale: string;
  default_currency: string;
  timezone: string;
  is_active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type UserProfileRow = {
  id: string;
  auth_user_id: string;
  tenant_id: string | null;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  locale: string;
  status: "pending" | "active" | "suspended" | "deleted";
  approval_request_id: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
  last_user_agent: string | null;
  password_changed_at: string | null;
  failed_login_count: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountApprovalRequestRow = {
  id: string;
  tenant_id: string | null;
  auth_user_id: string;
  email: string;
  requested_role: "parent" | "student" | "staff";
  requested_at: string;
  activation_code: string | null;
  national_id: string | null;
  phone: string | null;
  full_name: string | null;
  notes_from_user: string | null;
  target_parent_id: string | null;
  target_student_id: string | null;
  status: "pending" | "approved" | "rejected" | "expired";
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

export type RoleRow = {
  id: string;
  code: string;
  label_fr: string;
  label_ar: string | null;
  label_en: string | null;
  description: string | null;
  staff_category: "administration" | "teaching" | "support" | "medical" | null;
  is_staff_role: boolean;
  is_web_role: boolean;
  sort_order: number;
};

export type PermissionRow = {
  id: string;
  code: string;
  label_fr: string;
  label_ar: string | null;
  label_en: string | null;
  domain: string;
  description: string | null;
  sort_order: number;
};

export type AcademicYearRow = {
  id: string;
  tenant_id: string;
  label: string;
  start_date: string;
  end_date: string;
  term_structure: "semester" | "trimester" | "quarter";
  is_current: boolean;
  is_archived: boolean;
};

export type AcademicLevelRow = {
  id: string;
  tenant_id: string;
  cycle: "prescolaire" | "primaire" | "cem" | "lycee";
  year_label: string;
  year_number: number;
  grade_code: string;
  sort_order: number;
  is_active: boolean;
};

export type ClassRow = {
  id: string;
  tenant_id: string;
  academic_year_id: string;
  academic_level_id: string;
  section: string;
  code: string;
  name: string | null;
  capacity: number;
  homeroom_teacher_id: string | null;
  room: string | null;
  is_active: boolean;
};

export type SubjectRow = {
  id: string;
  tenant_id: string;
  code: string;
  name_fr: string;
  name_ar: string | null;
  name_en: string | null;
  domain: "scolarite" | "club" | "therapy" | "auxiliary";
  default_coefficient: number;
  is_active: boolean;
  passing_grade: number;
  is_extracurricular: boolean;
};

export type ParentRow = {
  id: string;
  tenant_id: string;
  parent_code: string;
  first_name: string;
  last_name: string;
  primary_phone: string;
  secondary_phone: string | null;
  email: string | null;
  national_id: string | null;
  occupation: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  relationship: "father" | "mother" | "guardian" | "other" | null;
  notes: string | null;
  display_name: string | null;
  is_active: boolean;
  is_financially_restricted: boolean;
  auth_user_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type StudentRow = {
  id: string;
  tenant_id: string;
  parent_id: string;
  student_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  gender: "male" | "female" | "other" | null;
  grade_level_id: string | null;
  class_id: string | null;
  enrollment_date: string;
  enrollment_status:
    | "inquiry"
    | "quoted"
    | "enrolled"
    | "active"
    | "withdrawn"
    | "graduated";
  medical_notes: string | null;
  is_active: boolean;
  auth_user_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type StudentAcademicHistoryRow = {
  id: string;
  tenant_id: string;
  student_id: string;
  academic_year: string;
  cycle: "prescolaire" | "primaire" | "cem" | "lycee";
  grade_code: string;
  grade_year: number;
  class_name: string | null;
  gpa: number;
  rank: number | null;
  decision: "promoted" | "repeated" | "graduated" | "transferred";
  narrative: string | null;
  recorded_at: string;
};

export type PaymentRow = {
  id: string;
  tenant_id: string;
  payment_number: string;
  receipt_number: string | null;
  parent_id: string;
  student_id: string | null;
  invoice_id: string | null;
  installment_id: string | null;
  amount: number;
  method: "cash" | "check" | "transfer";
  check_number: string | null;
  check_bank_name: string | null;
  check_issue_date: string | null;
  check_clearance_date: string | null;
  transfer_reference: string | null;
  transfer_source_bank: string | null;
  proof_path: string | null;
  status:
    | "paid"
    | "pending"
    | "unpaid"
    | "partial"
    | "overdue"
    | "refunded"
    | "cancelled"
    | "pending_clearance";
  category: string | null;
  expected_amount: number | null;
  excess_amount: number | null;
  excess_remark: string | null;
  collected_at: string;
  collected_by: string | null;
  notes: string | null;
  reversal_of_payment_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentAllocationRow = {
  id: string;
  tenant_id: string;
  payment_id: string;
  charge_id: string | null;
  installment_id: string | null;
  category: string;
  allocated_amount: number;
  label: string | null;
  created_at: string;
};

export type InstallmentRow = {
  id: string;
  tenant_id: string;
  parent_id: string;
  student_id: string;
  service_enrollment_id: string;
  invoice_id: string | null;
  tranche_number: 1 | 2 | 3;
  amount_due: number;
  amount_paid: number;
  amount_pending: number;
  due_date: string;
  paid_date: string | null;
  status:
    | "unpaid"
    | "partial"
    | "paid"
    | "overdue"
    | "pending"
    | "pending_clearance";
  academic_cycle: "primaire" | "cem" | "lycee" | "prescolaire" | null;
  payment_plan: "full_annual" | "tranches";
  is_custom_schedule: boolean;
  custom_schedule_note: string | null;
  label: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
};

export type LedgerEntryRow = {
  id: string | null;
  entry_number: string;
  tenant_id: string;
  account_id: string;
  parent_id: string;
  student_id: string | null;
  category: string;
  amount: number;
  entry_type:
    | "charge"
    | "payment"
    | "adjustment"
    | "refund"
    | "reversal"
    | "transfer";
  source_type: string | null;
  source_id: string | null;
  method: string | null;
  receipt_number: string | null;
  payment_status: string | null;
  reverses_id: string | null;
  description: string | null;
  actor_id: string | null;
  actor_name: string | null;
  at: string;
  metadata: unknown;
  created_at: string;
};

export type ExpenseTicketRow = {
  id: string;
  tenant_id: string;
  ticket_number: string;
  title: string;
  description: string;
  category_id: string;
  requested_amount: number;
  final_spent_amount: number | null;
  justification: string;
  urgency: "low" | "medium" | "high" | "critical";
  status:
    | "draft"
    | "pending_approval"
    | "approved_funds_released"
    | "rejected"
    | "disbursed"
    | "settled_and_closed";
  submitted_by: string;
  submitted_at: string;
  approved_by: string | null;
  approved_at: string | null;
  approval_note: string | null;
  rejected_reason: string | null;
  disbursed_at: string | null;
  settled_by: string | null;
  settled_at: string | null;
  receipt_path: string | null;
  receipt_uploaded_at: string | null;
  receipt_uploaded_by: string | null;
  anomaly_score: number | null;
  anomaly_flags_json: unknown[];
  created_at: string;
  updated_at: string;
};

export type PersonnelRow = {
  id: string;
  tenant_id: string;
  personnel_code: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | null;
  national_id: string | null;
  staff_category: "administration" | "teaching" | "support" | "medical";
  role_id: string | null;
  department_id: string | null;
  supervisor_id: string | null;
  position: string | null;
  hire_date: string;
  end_date: string | null;
  is_active: boolean;
  base_salary: number | null;
  payment_method: "cash" | "bank_transfer" | "check" | null;
  bank_account: string | null;
  bonuses_json: unknown[];
  primary_phone: string | null;
  secondary_phone: string | null;
  email: string | null;
  address: string | null;
  emergency_contact: Record<string, unknown>;
  documents_json: unknown[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AuditLogRow = {
  id: string;
  tenant_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  session_id: string | null;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  note: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  supersedes_id: string | null;
  occurred_at: string;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  tenant_id: string;
  kind: "alert" | "info" | "warning" | "success" | "error" | "system";
  title: string;
  body: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  source: "system" | "manual" | "workflow" | "schedule" | "audit";
  source_label: string | null;
  target_user_id: string | null;
  target_role: string | null;
  is_read: boolean;
  read_at: string | null;
  dismissed_at: string | null;
  triggered_at: string;
  expires_at: string | null;
  link_entity_type: string | null;
  link_entity_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceRow = {
  id: string;
  tenant_id: string;
  parent_id: string;
  student_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  status:
    | "draft"
    | "issued"
    | "partial"
    | "paid"
    | "overdue"
    | "void"
    | "cancelled";
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceEnrollmentRow = {
  id: string;
  tenant_id: string;
  student_id: string;
  academic_year_id: string;
  service_kind:
    | "tuition"
    | "transport"
    | "canteen"
    | "club"
    | "speech_therapy"
    | "psychology"
    | "psychotherapy"
    | "second_apron"
    | "rattrapage"
    | "other";
  service_ref_id: string | null;
  destination_id: string | null;
  grade_level_id: string | null;
  annual_amount: number;
  tranche_1_amount: number;
  tranche_2_amount: number;
  tranche_3_amount: number;
  tranche_1_due_date: string | null;
  tranche_2_due_date: string | null;
  tranche_3_due_date: string | null;
  is_active: boolean;
  enrolled_at: string;
  created_at: string;
  updated_at: string;
};

export type TransportDestinationRow = {
  id: string;
  code: string;
  label_fr: string;
  label_ar: string | null;
  annual_amount: number;
  tranche_1_amount: number;
  tranche_2_amount: number;
  tranche_3_amount: number;
  tranche_1_month: number;
  tranche_2_month: number;
  tranche_3_month: number;
};

export type AccountAdjustmentRow = {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  student_id: string | null;
  amount: number;
  reason_code:
    | "sibling_discount"
    | "staff_family"
    | "early_payment"
    | "passage_palier"
    | "seniority_5y"
    | "highest_average"
    | "full_annual"
    | "scholarship_replacement"
    | "hardship"
    | "correction"
    | "late_fee_waiver"
    | "other";
  admin_note: string;
  performed_by: string;
  performed_at: string;
  before_json: Record<string, unknown>;
  after_json: Record<string, unknown>;
  created_at: string;
};

export type AttendanceRecordRow = {
  id: string;
  tenant_id: string;
  student_id: string;
  class_id: string;
  class_subject_id: string | null;
  date: string;
  status: "present" | "absent_excused" | "absent_unexcused" | "late";
  arrival_time: string | null;
  note: string | null;
  recorded_by: string | null;
  justification_note: string | null;
  justification_path: string | null;
  justification_drive_link: string | null;
  justification_status: "none" | "submitted" | "accepted" | "rejected";
  justification_reviewed_by: string | null;
  justification_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type HomeworkRow = {
  id: string;
  tenant_id: string;
  class_id: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  title: string;
  description: string;
  due_date: string;
  attachments: string[] | null;
  academic_year: string;
  created_at: string;
  pushed_at: string | null;
  acknowledged_count: number;
};

export type HomeworkAssignmentRow = {
  id: string;
  tenant_id: string;
  class_subject_id: string;
  target_class_id: string;
  title: string;
  description: string;
  attachment_path: string | null;
  due_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type AssessmentRow = {
  id: string;
  tenant_id: string;
  class_subject_id: string | null;
  term: number;
  kind: "devoir_1" | "devoir_2" | "examen" | null;
  label: string | null;
  max_score: number;
  weight: number;
  scheduled_at: string | null;
  student_id: string | null;
  class_id: string | null;
  subject_id: string | null;
  academic_year: string | null;
  devoir1: number | null;
  devoir2: number | null;
  examen: number | null;
  subject_average: number | null;
  coefficient: number;
  entered_by: string | null;
  entered_at: string;
  created_at: string;
  updated_at: string;
};

export type GradeRow = {
  id: string;
  tenant_id: string;
  student_id: string;
  assessment_id: string;
  score: number;
  subject_average: number | null;
  recorded_by: string | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
};

export type CalendarEventRow = {
  id: string;
  tenant_id: string;
  kind:
    | "payment_received"
    | "audit_log"
    | "expense_event"
    | "follow_up_call"
    | "reminder"
    | "meeting"
    | "custom";
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  location: string | null;
  attendee_count: number;
  target_entity_type: string | null;
  target_entity_id: string | null;
  target_name: string | null;
  target_phone: string | null;
  created_by: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type ChatChannelRow = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  channel_type: "direct" | "group" | "department" | "announcement";
  member_ids: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  description: string | null;
  department_id: string | null;
  archived_at: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
};

export type ChatMessageReadEntry = {
  user_id: string;
  read_at: string;
};

export type ChatMessageAttachment = {
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
};

export type ChatMessageRow = {
  id: string;
  tenant_id: string;
  channel_id: string;
  author_id: string;
  body: string;
  edited_at: string | null;
  edited_by: string | null;
  deleted_at: string | null;
  parent_message_id: string | null;
  read_by: ChatMessageReadEntry[];
  attachments: ChatMessageAttachment[];
  sent_at: string;
  created_at: string;
};

export type ClassSubjectRow = {
  id: string;
  tenant_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  coefficient: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DeviceTokenRow = {
  id: string;
  tenant_id: string | null;
  user_id: string;
  token: string;
  platform: "web" | "android" | "ios";
  app_version: string | null;
  user_agent: string | null;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type NotificationCategory =
  | "payment"
  | "absence"
  | "message"
  | "announcement"
  | "grade"
  | "homework"
  | "calendar"
  | "account"
  | "system";

export type NotificationPreferenceRow = {
  id: string;
  tenant_id: string | null;
  user_profile_id: string;
  category: NotificationCategory;
  push_enabled: boolean;
  in_app_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type StudentDocumentKind =
  | "birth_certificate"
  | "medical_certificate"
  | "contract"
  | "justification_letter"
  | "id_photo"
  | "report_card"
  | "other";

export type StudentDocumentRow = {
  id: string;
  tenant_id: string;
  student_id: string;
  kind: StudentDocumentKind;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type ActivationCodeRow = {
  id: string;
  tenant_id: string;
  code: string;
  parent_id: string | null;
  student_id: string | null;
  issued_by: string | null;
  issued_at: string;
  bound_to_auth_user_id: string | null;
  bound_at: string | null;
  expires_at: string;
  created_at: string;
};

export type VwAuditLogWithActorRow = AuditLogRow & {
  actor_email: string | null;
  actor_display_name: string | null;
};

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: TenantRow;
        Insert: Partial<TenantRow>;
        Update: Partial<TenantRow>;
        Relationships: [];
      };
      user_profiles: {
        Row: UserProfileRow;
        Insert: Partial<UserProfileRow>;
        Update: Partial<UserProfileRow>;
        Relationships: [];
      };
      account_approval_requests: {
        Row: AccountApprovalRequestRow;
        Insert: Partial<AccountApprovalRequestRow>;
        Update: Partial<AccountApprovalRequestRow>;
        Relationships: [];
      };
      roles: {
        Row: RoleRow;
        Insert: Partial<RoleRow>;
        Update: Partial<RoleRow>;
        Relationships: [];
      };
      permissions: {
        Row: PermissionRow;
        Insert: Partial<PermissionRow>;
        Update: Partial<PermissionRow>;
        Relationships: [];
      };
      academic_years: {
        Row: AcademicYearRow;
        Insert: Partial<AcademicYearRow>;
        Update: Partial<AcademicYearRow>;
        Relationships: [];
      };
      academic_levels: {
        Row: AcademicLevelRow;
        Insert: Partial<AcademicLevelRow>;
        Update: Partial<AcademicLevelRow>;
        Relationships: [];
      };
      classes: {
        Row: ClassRow;
        Insert: Partial<ClassRow>;
        Update: Partial<ClassRow>;
        Relationships: [];
      };
      subjects: {
        Row: SubjectRow;
        Insert: Partial<SubjectRow>;
        Update: Partial<SubjectRow>;
        Relationships: [];
      };
      parents: {
        Row: ParentRow;
        Insert: Partial<ParentRow>;
        Update: Partial<ParentRow>;
        Relationships: [];
      };
      students: {
        Row: StudentRow;
        Insert: Partial<StudentRow>;
        Update: Partial<StudentRow>;
        Relationships: [];
      };
      student_academic_histories: {
        Row: StudentAcademicHistoryRow;
        Insert: Partial<StudentAcademicHistoryRow>;
        Update: Partial<StudentAcademicHistoryRow>;
        Relationships: [];
      };
      payments: {
        Row: PaymentRow;
        Insert: Partial<PaymentRow>;
        Update: Partial<PaymentRow>;
        Relationships: [];
      };
      payment_allocations: {
        Row: PaymentAllocationRow;
        Insert: Partial<PaymentAllocationRow>;
        Update: Partial<PaymentAllocationRow>;
        Relationships: [];
      };
      installments: {
        Row: InstallmentRow;
        Insert: Partial<InstallmentRow>;
        Update: Partial<InstallmentRow>;
        Relationships: [];
      };
      ledger_entries: {
        Row: LedgerEntryRow;
        Insert: Partial<LedgerEntryRow>;
        Update: Partial<LedgerEntryRow>;
        Relationships: [];
      };
      expense_tickets: {
        Row: ExpenseTicketRow;
        Insert: Partial<ExpenseTicketRow>;
        Update: Partial<ExpenseTicketRow>;
        Relationships: [];
      };
      personnel: {
        Row: PersonnelRow;
        Insert: Partial<PersonnelRow>;
        Update: Partial<PersonnelRow>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: Partial<AuditLogRow>;
        Update: Partial<AuditLogRow>;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: Partial<NotificationRow>;
        Update: Partial<NotificationRow>;
        Relationships: [];
      };
      invoices: {
        Row: InvoiceRow;
        Insert: Partial<InvoiceRow>;
        Update: Partial<InvoiceRow>;
        Relationships: [];
      };
      service_enrollments: {
        Row: ServiceEnrollmentRow;
        Insert: Partial<ServiceEnrollmentRow>;
        Update: Partial<ServiceEnrollmentRow>;
        Relationships: [];
      };
      transport_destinations: {
        Row: TransportDestinationRow;
        Insert: Partial<TransportDestinationRow>;
        Update: Partial<TransportDestinationRow>;
        Relationships: [];
      };
      account_adjustments: {
        Row: AccountAdjustmentRow;
        Insert: Partial<AccountAdjustmentRow>;
        Update: Partial<AccountAdjustmentRow>;
        Relationships: [];
      };
      attendance_records: {
        Row: AttendanceRecordRow;
        Insert: Partial<AttendanceRecordRow>;
        Update: Partial<AttendanceRecordRow>;
        Relationships: [];
      };
      homework_assignments: {
        Row: HomeworkAssignmentRow;
        Insert: Partial<HomeworkAssignmentRow>;
        Update: Partial<HomeworkAssignmentRow>;
        Relationships: [];
      };
      homework: {
        Row: HomeworkRow;
        Insert: Partial<HomeworkRow>;
        Update: Partial<HomeworkRow>;
        Relationships: [];
      };
      assessments: {
        Row: AssessmentRow;
        Insert: Partial<AssessmentRow>;
        Update: Partial<AssessmentRow>;
        Relationships: [];
      };
      grades: {
        Row: GradeRow;
        Insert: Partial<GradeRow>;
        Update: Partial<GradeRow>;
        Relationships: [];
      };
      calendar_events: {
        Row: CalendarEventRow;
        Insert: Partial<CalendarEventRow>;
        Update: Partial<CalendarEventRow>;
        Relationships: [];
      };
      chat_channels: {
        Row: ChatChannelRow;
        Insert: Partial<ChatChannelRow>;
        Update: Partial<ChatChannelRow>;
        Relationships: [];
      };
      chat_messages: {
        Row: ChatMessageRow;
        Insert: Partial<ChatMessageRow>;
        Update: Partial<ChatMessageRow>;
        Relationships: [];
      };
      class_subjects: {
        Row: ClassSubjectRow;
        Insert: Partial<ClassSubjectRow>;
        Update: Partial<ClassSubjectRow>;
        Relationships: [];
      };
      device_tokens: {
        Row: DeviceTokenRow;
        Insert: Partial<DeviceTokenRow>;
        Update: Partial<DeviceTokenRow>;
        Relationships: [];
      };
      notification_preferences: {
        Row: NotificationPreferenceRow;
        Insert: Partial<NotificationPreferenceRow>;
        Update: Partial<NotificationPreferenceRow>;
        Relationships: [];
      };
      student_documents: {
        Row: StudentDocumentRow;
        Insert: Partial<StudentDocumentRow>;
        Update: Partial<StudentDocumentRow>;
        Relationships: [];
      };
      activation_codes: {
        Row: ActivationCodeRow;
        Insert: Partial<ActivationCodeRow>;
        Update: Partial<ActivationCodeRow>;
        Relationships: [];
      };
    };
    Views: {
      vw_dashboard_kpis: { Row: Record<string, unknown>; Relationships: [] };
      vw_student_roster: { Row: Record<string, unknown>; Relationships: [] };
      vw_personnel_directory: {
        Row: Record<string, unknown>;
        Relationships: [];
      };
      vw_audit_log_with_actor: {
        Row: VwAuditLogWithActorRow;
        Relationships: [];
      };
    };
    Functions: {
      current_tenant_id: { Args: Record<string, never>; Returns: string };
      current_user_profile_id: { Args: Record<string, never>; Returns: string };
      current_user_roles: { Args: Record<string, never>; Returns: string[] };
      current_user_permissions: {
        Args: Record<string, never>;
        Returns: string[];
      };
      has_permission: { Args: { p_code: string }; Returns: boolean };
      has_role: { Args: { r_code: string }; Returns: boolean };
      write_audit_log: {
        Args: {
          p_tenant_id: string;
          p_action: string;
          p_entity_type: string;
          p_entity_id?: string | null;
          p_actor_id?: string | null;
          p_actor_name?: string | null;
          p_actor_role?: string | null;
          p_session_id?: string | null;
          p_before_json?: unknown;
          p_after_json?: unknown;
          p_note?: string | null;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
          p_request_id?: string | null;
        };
        Returns: string;
      };
      collect_and_allocate_payment: {
        Args: {
          p_tenant_id: string;
          p_parent_id: string;
          p_student_id: string | null;
          p_amount: number;
          p_method: string;
          p_category: string;
          p_installment_id: string | null;
          p_proof_path: string | null;
          p_notes: string | null;
          p_actor_id: string | null;
          p_actor_name: string;
          p_check_number?: string | null;
          p_check_bank_name?: string | null;
          p_check_issue_date?: string | null;
          p_check_clearance_date?: string | null;
          p_transfer_reference?: string | null;
          p_transfer_source_bank?: string | null;
        };
        Returns: {
          payment_id: string;
          receipt_number: string;
          payment_status: string;
          total_allocated: number;
          unallocated_credit: number;
          allocations: unknown;
        }[];
      };
      revert_payment_allocation: {
        Args: {
          p_tenant_id: string;
          p_payment_id: string;
          p_actor_id: string;
          p_actor_name: string;
          p_reason: string;
        };
        Returns: {
          payment_id: string;
          new_status: string;
          reversal_entry_id: string;
          reverts_count: number;
          total_reverted: number;
        }[];
      };
      mark_payment_cleared: {
        Args: {
          p_tenant_id: string;
          p_payment_id: string;
          p_actor_id: string;
          p_actor_name?: string;
        };
        Returns: {
          payment_id: string;
          payment_status: string;
          cleared_installments: number;
          total_cleared: number;
        }[];
      };
      mark_payment_bounced: {
        Args: {
          p_tenant_id: string;
          p_payment_id: string;
          p_reason: string;
          p_actor_id: string;
          p_actor_name?: string;
        };
        Returns: {
          payment_id: string;
          payment_status: string;
          reverted_installments: number;
          total_reverted: number;
        }[];
      };
      compute_parent_summary: {
        Args: { p_parent_id: string; p_as_of?: string };
        Returns: {
          parent_id: string;
          total_outstanding: number;
          total_overdue: number;
          total_charged: number;
          total_paid: number;
          total_adjusted: number;
          total_refunded: number;
          total_cleared: number;
          total_pending: number;
          total_unallocated_credit: number;
          account_count: number;
          accounts: unknown;
        }[];
      };
      compute_account_balance: {
        Args: { p_account_id: string; p_as_of?: string };
        Returns: number[];
      };
      register_fcm_token: {
        Args: { p_user_id: string; p_token: string; p_platform?: string };
        Returns: string;
      };
      deactivate_fcm_tokens: {
        Args: { p_user_id: string; p_platform?: string | null };
        Returns: number;
      };
      unregister_fcm_token: {
        Args: { p_token: string };
        Returns: string | null;
      };
      fn_calculate_student_term_gpa: {
        Args: { p_student_id: string; p_term: string; p_academic_year: string };
        Returns: number;
      };
      generate_activation_code: {
        Args: { p_tenant_id: string };
        Returns: string;
      };
      fn_fnv1a: { Args: { s: string }; Returns: number };
      fn_stable_hash: { Args: { s: string }; Returns: string };
      fn_deterministic_parent_code: {
        Args: {
          p_year: number;
          p_phone?: string | null;
          p_display_name?: string | null;
          p_first_name?: string | null;
          p_last_name?: string | null;
          p_fallback_seed?: string | null;
        };
        Returns: string;
      };
      fn_deterministic_activation_code: {
        Args: { p_parent_code: string; p_tenant_id: string };
        Returns: string;
      };
      bind_activation_code: {
        Args: { p_tenant_id: string; p_code: string; p_auth_user_id: string };
        Returns: unknown;
      };
      approve_account_request: {
        Args: {
          p_request_id: string;
          p_reviewer_profile_id: string;
          p_target_parent_id?: string | null;
          p_target_student_id?: string | null;
          p_decision_note?: string | null;
        };
        Returns: string;
      };
      reject_account_request: {
        Args: {
          p_request_id: string;
          p_reviewer_profile_id: string;
          p_decision_note: string;
        };
        Returns: void;
      };
      batch_register_family: {
        Args: {
          p_tenant_id: string;
          p_parent: unknown;
          p_students: unknown;
          p_actor_profile_id: string;
          p_activation_code?: string | null;
        };
        Returns: unknown;
      };
      expire_pending_approvals: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      refresh_all_materialized_views: {
        Args: Record<string, never>;
        Returns: void;
      };
      open_parent_admin_channel: {
        Args: { p_name?: string | null };
        Returns: ChatChannelRow;
      };
    };
  };
};

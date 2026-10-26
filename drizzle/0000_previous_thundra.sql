CREATE TABLE "audiometry_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"exam_id" integer NOT NULL,
	"ear_side" text NOT NULL,
	"freq_250" double precision,
	"freq_500" double precision,
	"freq_1000" double precision,
	"freq_2000" double precision,
	"freq_3000" double precision,
	"freq_4000" double precision,
	"freq_6000" double precision,
	"freq_8000" double precision,
	"hearing_loss_type" text,
	"hearing_threshold_avg" double precision,
	"noise_induced_hearing_loss" boolean DEFAULT false,
	"diagnosis" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"user_uid" text,
	"personnel_code" text,
	"action" text NOT NULL,
	"module" text DEFAULT 'SYSTEM' NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"result" text DEFAULT 'SUCCESS' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bpmn_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"process_id" integer NOT NULL,
	"instance_number" text,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"current_node_id" text,
	"current_node_name" text,
	"initiator_id" integer,
	"variables" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "bpmn_instances_instance_number_unique" UNIQUE("instance_number")
);
--> statement-breakpoint
CREATE TABLE "bpmn_processes" (
	"id" serial PRIMARY KEY NOT NULL,
	"process_key" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'HSE_GENERAL',
	"version" integer DEFAULT 1 NOT NULL,
	"xml_content" text NOT NULL,
	"status" text DEFAULT 'PUBLISHED' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environmental_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"source_unit_id" integer,
	"log_date" text NOT NULL,
	"parameter_name" text NOT NULL,
	"measured_value" double precision NOT NULL,
	"unit" text NOT NULL,
	"standard_limit" double precision,
	"is_compliant" boolean DEFAULT true NOT NULL,
	"disposal_method" text,
	"destination" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fire_equipment" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"equipment_type" text NOT NULL,
	"location" text NOT NULL,
	"unit_id" integer,
	"capacity" text,
	"manufacturing_year" integer,
	"last_inspection_date" text,
	"next_inspection_due" text,
	"hydrostatic_test_due" text,
	"status" text DEFAULT 'SERVICEABLE' NOT NULL,
	"pressure_status" text DEFAULT 'NORMAL',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fire_equipment_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "five_s_audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"unit_id" integer NOT NULL,
	"audit_date" text NOT NULL,
	"auditor_name" text NOT NULL,
	"seiri_score" double precision DEFAULT 0 NOT NULL,
	"seiton_score" double precision DEFAULT 0 NOT NULL,
	"seiso_score" double precision DEFAULT 0 NOT NULL,
	"seiketsu_score" double precision DEFAULT 0 NOT NULL,
	"shitsuke_score" double precision DEFAULT 0 NOT NULL,
	"total_score" double precision DEFAULT 0 NOT NULL,
	"action_items" jsonb,
	"findings" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hse_trainings" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_title" text NOT NULL,
	"course_category" text DEFAULT 'GENERAL_SAFETY',
	"instructor" text,
	"duration_hours" integer DEFAULT 4 NOT NULL,
	"validity_months" integer DEFAULT 12 NOT NULL,
	"target_positions" jsonb,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_number" text,
	"incident_date" text NOT NULL,
	"incident_time" text,
	"incident_type" text NOT NULL,
	"severity" text DEFAULT 'MINOR',
	"location" text NOT NULL,
	"unit_id" integer,
	"involved_personnel_id" integer,
	"personnel_name" text,
	"description" text NOT NULL,
	"immediate_causes" text,
	"root_causes" text,
	"corrective_actions" text,
	"lost_work_days" integer DEFAULT 0,
	"financial_loss" double precision DEFAULT 0,
	"status" text DEFAULT 'REPORTED' NOT NULL,
	"investigator" text,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "incidents_incident_number_unique" UNIQUE("incident_number")
);
--> statement-breakpoint
CREATE TABLE "lab_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"exam_id" integer NOT NULL,
	"test_code" text NOT NULL,
	"test_name" text NOT NULL,
	"category" text DEFAULT 'BIOCHEMISTRY',
	"numeric_value" double precision,
	"text_value" text,
	"unit" text,
	"ref_min" double precision,
	"ref_max" double precision,
	"is_abnormal" boolean DEFAULT false NOT NULL,
	"clinical_significance" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"exam_id" integer NOT NULL,
	"specialist_type" text NOT NULL,
	"reason" text NOT NULL,
	"urgency" text DEFAULT 'ROUTINE',
	"referral_date" text,
	"follow_up_date" text,
	"outcome" text,
	"status" text DEFAULT 'PENDING',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"notif_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"type" text DEFAULT 'in-app' NOT NULL,
	"target_type" text DEFAULT 'all',
	"target_values" jsonb,
	"sender" text,
	"read_by" jsonb,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_notif_id_unique" UNIQUE("notif_id")
);
--> statement-breakpoint
CREATE TABLE "occupational_disease_diagnoses" (
	"id" serial PRIMARY KEY NOT NULL,
	"exam_id" integer NOT NULL,
	"group_number" integer NOT NULL,
	"group_name" text NOT NULL,
	"disease_name" text NOT NULL,
	"icd10_code" text,
	"severity" text DEFAULT 'MILD',
	"is_work_related" boolean DEFAULT true,
	"is_confirmed" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "optometry_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"exam_id" integer NOT NULL,
	"vision_right_uncorrected" text,
	"vision_left_uncorrected" text,
	"vision_right_corrected" text,
	"vision_left_corrected" text,
	"color_blindness" boolean DEFAULT false,
	"visual_field" text,
	"refractive_error" text,
	"intraocular_pressure_right" double precision,
	"intraocular_pressure_left" double precision,
	"findings" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_companies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "org_departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"code" text,
	"risk_level" text DEFAULT 'LOW',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"location" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_units" (
	"id" serial PRIMARY KEY NOT NULL,
	"department_id" integer,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "periodic_medical_exams" (
	"id" serial PRIMARY KEY NOT NULL,
	"personnel_id" integer NOT NULL,
	"personnel_code" text NOT NULL,
	"national_code" text NOT NULL,
	"exam_year" integer NOT NULL,
	"exam_date" text,
	"exam_type" text DEFAULT 'PERIODIC',
	"height" double precision,
	"weight" double precision,
	"bmi" double precision,
	"systolic_bp" integer,
	"diastolic_bp" integer,
	"pulse_rate" integer,
	"respiratory_rate" integer,
	"doctor_verdict" text DEFAULT 'FIT',
	"restrictions" text,
	"fitness_status" text,
	"clinical_notes" text,
	"next_exam_date" text,
	"exam_center" text,
	"examining_doctor" text,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permit_signatures" (
	"id" serial PRIMARY KEY NOT NULL,
	"permit_id" integer NOT NULL,
	"role_name" text NOT NULL,
	"signer_name" text NOT NULL,
	"signer_personnel_code" text,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"action" text NOT NULL,
	"digital_signature" text,
	"comments" text
);
--> statement-breakpoint
CREATE TABLE "personnel" (
	"id" serial PRIMARY KEY NOT NULL,
	"personnel_code" text NOT NULL,
	"national_code" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"father_name" text,
	"gender" text DEFAULT 'MALE',
	"birth_date" text,
	"hire_date" text,
	"company_id" integer,
	"site_id" integer,
	"department_id" integer,
	"unit_id" integer,
	"position_id" integer,
	"job_title" text,
	"shift_type" text DEFAULT 'DAY',
	"employment_type" text DEFAULT 'OFFICIAL',
	"mobile" text,
	"blood_group" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"extra_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "personnel_personnel_code_unique" UNIQUE("personnel_code"),
	CONSTRAINT "personnel_national_code_unique" UNIQUE("national_code")
);
--> statement-breakpoint
CREATE TABLE "ppe_issuances" (
	"id" serial PRIMARY KEY NOT NULL,
	"personnel_id" integer NOT NULL,
	"item_category" text NOT NULL,
	"item_name" text NOT NULL,
	"standard_code" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"issue_date" text NOT NULL,
	"expiry_date" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_title" text NOT NULL,
	"unit_id" integer,
	"methodology" text DEFAULT 'JSA' NOT NULL,
	"hazard_description" text NOT NULL,
	"consequences" text,
	"existing_controls" text,
	"severity" integer DEFAULT 1 NOT NULL,
	"probability" integer DEFAULT 1 NOT NULL,
	"initial_risk_score" integer NOT NULL,
	"initial_risk_level" text NOT NULL,
	"proposed_controls" text,
	"residual_severity" integer,
	"residual_probability" integer,
	"residual_risk_score" integer,
	"residual_risk_level" text,
	"responsible_person" text,
	"deadline" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safety_warnings" (
	"id" serial PRIMARY KEY NOT NULL,
	"personnel_id" integer,
	"personnel_name" text NOT NULL,
	"national_code" text,
	"personnel_code" text,
	"unit_id" integer,
	"warning_date" text NOT NULL,
	"warning_level" text DEFAULT 'VERBAL' NOT NULL,
	"category" text DEFAULT 'PPE_VIOLATION',
	"reason" text NOT NULL,
	"action_taken" text,
	"issued_by" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"number" text,
	"name" text,
	"site" text,
	"unit" text,
	"type" text,
	"day" integer,
	"month" text,
	"year" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spirometry_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"exam_id" integer NOT NULL,
	"fvc_liters" double precision,
	"fvc_percent" double precision,
	"fev1_liters" double precision,
	"fev1_percent" double precision,
	"fev1_fvc_ratio" double precision,
	"pef" double precision,
	"spirometry_pattern" text,
	"severity" text,
	"interpretation" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"original_name" text NOT NULL,
	"stored_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_path" text NOT NULL,
	"file_url" text,
	"uploaded_by" text,
	"uploader_role" text,
	"version" integer DEFAULT 1 NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_files_file_id_unique" UNIQUE("file_id")
);
--> statement-breakpoint
CREATE TABLE "system_releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"build_id" text NOT NULL,
	"release_id" text NOT NULL,
	"status" text DEFAULT 'SUCCESS' NOT NULL,
	"git_commit" text,
	"environment" text DEFAULT 'production',
	"created_by" text,
	"deployed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_releases_release_id_unique" UNIQUE("release_id")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_attendances" (
	"id" serial PRIMARY KEY NOT NULL,
	"training_id" integer NOT NULL,
	"personnel_id" integer NOT NULL,
	"session_date" text NOT NULL,
	"score" double precision,
	"passed" boolean DEFAULT true NOT NULL,
	"certificate_number" text,
	"expiry_date" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trir_monthly_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"month" text NOT NULL,
	"month_index" integer NOT NULL,
	"incidents" integer DEFAULT 0 NOT NULL,
	"attendance_hours" double precision DEFAULT 0 NOT NULL,
	"mission_hours" double precision DEFAULT 0 NOT NULL,
	"contractor_hours" double precision DEFAULT 0 NOT NULL,
	"total_hours" double precision DEFAULT 0 NOT NULL,
	"monthly_trir" double precision DEFAULT 0 NOT NULL,
	"rolling_trir" double precision DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"username" text,
	"email" text NOT NULL,
	"full_name" text,
	"personnel_number" text,
	"national_id" text,
	"phone_number" text,
	"job_title" text,
	"role" text DEFAULT 'User' NOT NULL,
	"account_status" text DEFAULT 'Active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"permissions" jsonb,
	"profile_data" jsonb,
	"password_hash" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE TABLE "work_permits" (
	"id" serial PRIMARY KEY NOT NULL,
	"permit_number" text NOT NULL,
	"permit_type" text NOT NULL,
	"title" text NOT NULL,
	"company_id" integer,
	"unit_id" integer,
	"location" text NOT NULL,
	"description" text,
	"hazards" jsonb,
	"precautions" jsonb,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"valid_from" text NOT NULL,
	"valid_to" text NOT NULL,
	"issuer_id" integer,
	"acceptor_id" integer,
	"contractor_name" text,
	"worker_count" integer DEFAULT 1,
	"equipment_list" text,
	"form_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "work_permits_permit_number_unique" UNIQUE("permit_number")
);
--> statement-breakpoint
CREATE TABLE "workflow_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"instance_id" integer NOT NULL,
	"step_id" integer,
	"action" text NOT NULL,
	"actor_name" text NOT NULL,
	"actor_role" text,
	"actor_department" text,
	"actor_personnel_code" text,
	"comment" text,
	"signature_hash" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_key" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"entity_number" text,
	"title" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"current_step_order" integer DEFAULT 1 NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"requester_id" integer,
	"requester_name" text,
	"requester_personnel_code" text,
	"is_locked" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deadline" timestamp,
	"metadata" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_signatures" (
	"id" serial PRIMARY KEY NOT NULL,
	"instance_id" integer NOT NULL,
	"step_id" integer,
	"signer_name" text NOT NULL,
	"signer_role" text NOT NULL,
	"signer_personnel_code" text,
	"signer_department" text,
	"signature_type" text DEFAULT 'ELECTRONIC' NOT NULL,
	"signature_data" text,
	"verification_code" text NOT NULL,
	"ip_address" text,
	"signed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"instance_id" integer NOT NULL,
	"step_order" integer NOT NULL,
	"step_name" text NOT NULL,
	"step_type" text DEFAULT 'APPROVE' NOT NULL,
	"assigned_role" text,
	"assigned_department" text,
	"assigned_user_id" integer,
	"assigned_personnel_code" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"deadline" timestamp,
	"completed_at" timestamp,
	"completed_by" text,
	"completed_by_role" text,
	"comment" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"entity_type" text NOT NULL,
	"is_sequential" boolean DEFAULT true NOT NULL,
	"auto_lock_on_complete" boolean DEFAULT true NOT NULL,
	"default_steps" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workflows_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "audiometry_records" ADD CONSTRAINT "audiometry_records_exam_id_periodic_medical_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."periodic_medical_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpmn_instances" ADD CONSTRAINT "bpmn_instances_process_id_bpmn_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."bpmn_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpmn_instances" ADD CONSTRAINT "bpmn_instances_initiator_id_users_id_fk" FOREIGN KEY ("initiator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environmental_logs" ADD CONSTRAINT "environmental_logs_source_unit_id_org_units_id_fk" FOREIGN KEY ("source_unit_id") REFERENCES "public"."org_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fire_equipment" ADD CONSTRAINT "fire_equipment_unit_id_org_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."org_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "five_s_audits" ADD CONSTRAINT "five_s_audits_unit_id_org_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."org_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_unit_id_org_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."org_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_involved_personnel_id_personnel_id_fk" FOREIGN KEY ("involved_personnel_id") REFERENCES "public"."personnel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_exam_id_periodic_medical_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."periodic_medical_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_referrals" ADD CONSTRAINT "medical_referrals_exam_id_periodic_medical_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."periodic_medical_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational_disease_diagnoses" ADD CONSTRAINT "occupational_disease_diagnoses_exam_id_periodic_medical_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."periodic_medical_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optometry_records" ADD CONSTRAINT "optometry_records_exam_id_periodic_medical_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."periodic_medical_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_departments" ADD CONSTRAINT "org_departments_site_id_org_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."org_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_sites" ADD CONSTRAINT "org_sites_company_id_org_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."org_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_department_id_org_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."org_departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodic_medical_exams" ADD CONSTRAINT "periodic_medical_exams_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permit_signatures" ADD CONSTRAINT "permit_signatures_permit_id_work_permits_id_fk" FOREIGN KEY ("permit_id") REFERENCES "public"."work_permits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_company_id_org_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."org_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_site_id_org_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."org_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_department_id_org_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."org_departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_unit_id_org_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."org_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_position_id_org_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."org_positions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppe_issuances" ADD CONSTRAINT "ppe_issuances_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_unit_id_org_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."org_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_warnings" ADD CONSTRAINT "safety_warnings_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_warnings" ADD CONSTRAINT "safety_warnings_unit_id_org_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."org_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spirometry_records" ADD CONSTRAINT "spirometry_records_exam_id_periodic_medical_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."periodic_medical_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_attendances" ADD CONSTRAINT "training_attendances_training_id_hse_trainings_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."hse_trainings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_attendances" ADD CONSTRAINT "training_attendances_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_permits" ADD CONSTRAINT "work_permits_company_id_org_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."org_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_permits" ADD CONSTRAINT "work_permits_unit_id_org_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."org_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_permits" ADD CONSTRAINT "work_permits_issuer_id_personnel_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."personnel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_permits" ADD CONSTRAINT "work_permits_acceptor_id_personnel_id_fk" FOREIGN KEY ("acceptor_id") REFERENCES "public"."personnel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_history" ADD CONSTRAINT "workflow_history_instance_id_workflow_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_history" ADD CONSTRAINT "workflow_history_step_id_workflow_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_signatures" ADD CONSTRAINT "workflow_signatures_instance_id_workflow_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_signatures" ADD CONSTRAINT "workflow_signatures_step_id_workflow_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_instance_id_workflow_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "medical_exam_personnel_year_idx" ON "periodic_medical_exams" USING btree ("personnel_id","exam_year");--> statement-breakpoint
CREATE UNIQUE INDEX "personnel_code_idx" ON "personnel" USING btree ("personnel_code");--> statement-breakpoint
CREATE UNIQUE INDEX "personnel_national_code_idx" ON "personnel" USING btree ("national_code");
export type ProfessionalApplication = {
  applicant_id: string;
  kind: "mentor" | "company";
  company_id: string | null;
  details: Json;
  status: string;
  submitted_at: string;
  feedback: string | null;
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      professional_applications: { Row: ProfessionalApplication; Insert: never; Update: never; Relationships: [] };
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          headline: string | null;
          bio: string | null;
          avatar_url: string | null;
          location: string | null;
          github_username: string | null;
          github_profile_url: string | null;
          linkedin_url: string | null;
          x_url: string | null;
          website_url: string | null;
          account_type: "developer" | "mentor" | "company" | null;
          role: "developer" | "mentor" | "admin";
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          headline?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          location?: string | null;
          github_username?: string | null;
          github_profile_url?: string | null;
          linkedin_url?: string | null;
          x_url?: string | null;
          website_url?: string | null;
          role?: "developer" | "mentor" | "admin";
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          workspace_type: "personal" | "mentor" | "company";
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          workspace_type: "personal" | "mentor" | "company";
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Insert"]>;
        Relationships: [];
      };
      workspace_memberships: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          membership_role: "owner" | "admin" | "mentor" | "member" | "developer";
          membership_status: "pending" | "active" | "suspended" | "revoked";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          membership_role: "owner" | "admin" | "mentor" | "member" | "developer";
          membership_status: "pending" | "active" | "suspended" | "revoked";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_memberships"]["Insert"]>;
        Relationships: [];
      };
      mentor_profiles: {
        Row: {
          id: string;
          user_id: string;
          workspace_id: string;
          expertise: string[];
          biography: string | null;
          availability_status: "available" | "limited" | "unavailable";
          verification_status: "pending" | "approved" | "rejected" | "suspended";
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workspace_id: string;
          expertise?: string[];
          biography?: string | null;
          availability_status?: "available" | "limited" | "unavailable";
          verification_status?: "pending" | "approved" | "rejected" | "suspended";
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["mentor_profiles"]["Insert"]>;
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          website: string | null;
          industry: string | null;
          description: string | null;
          location: string | null;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          verification_status: "pending" | "approved" | "rejected" | "suspended";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          website?: string | null;
          industry?: string | null;
          description?: string | null;
          location?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          verification_status?: "pending" | "approved" | "rejected" | "suspended";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["companies"]["Insert"]>;
        Relationships: [];
      };
      company_memberships: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          membership_role: "owner" | "admin" | "recruiter" | "member";
          membership_status: "pending" | "active" | "suspended" | "revoked";
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          membership_role: "owner" | "admin" | "recruiter" | "member";
          membership_status: "pending" | "active" | "suspended" | "revoked";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["company_memberships"]["Insert"]>;
        Relationships: [];
      };
      skill_scores: {
        Row: {
          id: string;
          user_id: string;
          skill_domain: "frontend" | "backend" | "data" | "devops" | "system_design" | "product";
          composite_score: number;
          evidence_count: number;
          confidence: "unverified" | "low" | "medium" | "high";
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          skill_domain: "frontend" | "backend" | "data" | "devops" | "system_design" | "product";
          repo_evidence_score?: number;
          challenge_score?: number;
          review_score?: number;
          composite_score?: number;
          evidence_count?: number;
          confidence?: "unverified" | "low" | "medium" | "high";
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["skill_scores"]["Insert"]>;
        Relationships: [];
      };
      challenges: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string;
          instructions: Json;
          short_description: string | null;
          problem_statement: string | null;
          scenario: string | null;
          learning_objectives: Json;
          requirements: Json;
          acceptance_criteria: Json;
          submission_requirements: Json;
          technologies: string[];
          tags: string[];
          estimated_minutes: number | null;
          is_platform_seed: boolean;
          difficulty_rank: number;
          search_document: string;
          skill_domain: "frontend" | "backend" | "data" | "devops" | "system_design" | "product";
          difficulty: "beginner" | "intermediate" | "advanced";
          xp_reward: number;
          estimated_hours: number | null;
          rubric: Json;
          is_published: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description: string;
          instructions?: Json;
          short_description?: string | null;
          problem_statement?: string | null;
          scenario?: string | null;
          learning_objectives?: Json;
          requirements?: Json;
          acceptance_criteria?: Json;
          submission_requirements?: Json;
          technologies?: string[];
          tags?: string[];
          estimated_minutes?: number | null;
          is_platform_seed?: boolean;
          skill_domain: "frontend" | "backend" | "data" | "devops" | "system_design" | "product";
          difficulty: "beginner" | "intermediate" | "advanced";
          xp_reward?: number;
          estimated_hours?: number | null;
          rubric: Json;
          is_published?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["challenges"]["Insert"]>;
        Relationships: [];
      };
      challenge_progress: {
        Row: {
          id: string;
          user_id: string;
          challenge_id: string;
          status: "in_progress" | "submitted" | "verifying" | "verified" | "needs_revision" | "rejected";
          verified_score: number | null;
          awarded_xp: number;
          started_at: string;
          verified_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          challenge_id: string;
          status?: "in_progress" | "submitted" | "verifying" | "verified" | "needs_revision" | "rejected";
          verified_score?: number | null;
          awarded_xp?: number;
          started_at?: string;
          verified_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["challenge_progress"]["Insert"]>;
        Relationships: [];
      };
      submissions: {
        Row: {
          id: string;
          user_id: string;
          challenge_id: string;
          repo_owner: string;
          repo_name: string;
          repo_full_name: string;
          repo_url: string;
          skill_domain: "frontend" | "backend" | "data" | "devops" | "system_design" | "product";
          status: "pending" | "verified" | "failed" | "unknown" | "approved";
          repo_evidence_score: number | null;
          verification_snapshot: Json;
          verification_version: string;
          last_synced_at: string | null;
          submitted_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          challenge_id: string;
          repo_owner: string;
          repo_name: string;
          repo_full_name: string;
          repo_url: string;
          skill_domain: "frontend" | "backend" | "data" | "devops" | "system_design" | "product";
          status?: "pending" | "verified" | "failed" | "unknown" | "approved";
          repo_evidence_score?: number | null;
          verification_snapshot?: Json;
          verification_version: string;
          last_synced_at?: string | null;
          submitted_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["submissions"]["Insert"]>;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          submission_id: string;
          reviewer_id: string;
          reviewee_id: string;
          reviewer_type: "peer" | "mentor";
          criteria_scores: Json;
          total_score: number;
          feedback: string;
          decision: "approved" | "revision_requested";
          is_public: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          reviewer_id: string;
          reviewee_id: string;
          reviewer_type: "peer" | "mentor";
          criteria_scores: Json;
          total_score: number;
          feedback: string;
          decision: "approved" | "revision_requested";
          is_public?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      public_profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          headline: string | null;
          bio: string | null;
          avatar_url: string | null;
          location: string | null;
          github_username: string | null;
          github_profile_url: string | null;
          created_at: string;
          linkedin_url: string | null;
          x_url: string | null;
          website_url: string | null;
        };
        Relationships: [];
      };
      public_skill_scores: {
        Row: {
          user_id: string;
          skill_domain: "frontend" | "backend" | "data" | "devops" | "system_design" | "product";
          composite_score: number;
          evidence_count: number;
          confidence: "unverified" | "low" | "medium" | "high";
          updated_at: string;
        };
        Relationships: [];
      };
      public_reviews: {
        Row: {
          id: string;
          reviewee_id: string;
          reviewer_type: "peer" | "mentor";
          criteria_scores: Json;
          total_score: number;
          feedback: string;
          decision: "approved" | "revision_requested";
          created_at: string;
        };
        Relationships: [];
      };
      public_submissions: {
        Row: {
          id: string;
          user_id: string;
          challenge_id: string;
          repo_full_name: string;
          repo_url: string;
          skill_domain: "frontend" | "backend" | "data" | "devops" | "system_design" | "product";
          status: "verified" | "approved";
          repo_evidence_score: number | null;
          last_synced_at: string | null;
          submitted_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_company_workspace_summary: {
        Args: { p_workspace_id: string };
        Returns: { id: string; name: string; slug: string; verification_status: Database["public"]["Tables"]["companies"]["Row"]["verification_status"] }[];
      };
      discover_public_mentors: {
        Args: { p_company_id: string; p_query?: string; p_expertise?: string };
        Returns: { username: string; display_name: string | null; headline: string | null;
          biography: string | null; expertise: string[]; availability_status: string;
          github_url: string | null; linkedin_url: string | null }[];
      };
      list_professional_applications: { Args: Record<string, never>; Returns: ProfessionalApplication[] };
      review_professional_application: {
        Args: { p_applicant: string; p_kind: string; p_decision: string; p_feedback: string | null; p_notes: string | null };
        Returns: undefined;
      };
      complete_registration: {
        Args: {
          p_registration_type: "developer" | "mentor" | "company";
          p_username: string;
          p_display_name?: string | null;
          p_company_name?: string | null;
          p_company_slug?: string | null;
          p_application?: Json;
        };
        Returns: string;
      };
      is_workspace_member: {
        Args: { p_workspace_id: string };
        Returns: boolean;
      };
      is_approved_mentor: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      is_company_member: {
        Args: { p_company_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

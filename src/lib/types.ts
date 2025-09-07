/**
 * Common TypeScript type definitions for the application
 */

// Base entity interface
export interface BaseEntity {
  shortname: string;
  subpath: string;
  resource_type: string;
  space_name?: string;
  uuid?: string;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
  state?: EntityState;
  attributes?: Record<string, any>;
}

// Entity states
export type EntityState = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'active' | 'inactive';

// Attachment interface
export interface Attachment extends BaseEntity {
  attributes: {
    payload?: {
      body?: string;
      content_type?: string;
      size?: number;
    };
  };
}

// Space interface
export interface Space extends BaseEntity {
  displayname?: Record<string, string>;
  description?: Record<string, string>;
  meta?: Record<string, any>;
}

// User profile interface
export interface UserProfile {
  displayname?: string;
  email?: string;
  msisdn?: string;
  password?: string;
  groups?: string[];
  roles?: string[];
  is_active?: boolean;
}

// Form data interfaces
export interface FormData {
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Schema interfaces
export interface SchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  title?: string;
  description?: string;
  default?: any;
  enum?: any[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  multipleOf?: number;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface Schema {
  title?: string;
  description?: string;
  type: string;
  properties: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

// API Response interfaces
export interface ApiResponse<T = any> {
  status: 'success' | 'error' | 'failed';
  data?: T;
  message?: string;
  errors?: string[];
}

export interface QueryResponse<T = any> extends ApiResponse<T> {
  records?: T[];
  attributes?: Record<string, any>;
}

// Request interfaces
export interface RequestRecord {
  resource_type: string;
  shortname: string;
  subpath: string;
  attributes: Record<string, any>;
}

export interface ApiRequest {
  space_name: string;
  request_type: string;
  records: RequestRecord[];
}

// Notification interface
export interface Notification extends BaseEntity {
  title?: string;
  message?: string;
  read?: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
}

// Contact message interface
export interface ContactMessage extends BaseEntity {
  subject?: string;
  message?: string;
  sender_email?: string;
  replied?: boolean;
  reply_message?: string;
}

// File type information
export interface FileTypeInfo {
  contentType: string;
  resourceType: string;
}

// Preview data interface
export interface PreviewData {
  url: string;
  type: 'image' | 'video' | 'pdf' | 'audio' | 'file';
  filename: string;
}

// Editor interfaces
export interface EditorOptions {
  uid?: string;
  content: string;
  isEditMode?: boolean;
  attachments?: Attachment[];
  resource_type?: string;
  space_name?: string;
  subpath?: string;
  parent_shortname?: string;
  changed?: () => void;
}

// Toast message interface
export interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  timeout?: number;
}

// Pagination interface
export interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_records: number;
  page_size: number;
}

// Search/Filter interfaces
export interface SearchFilters {
  query?: string;
  resource_type?: string;
  state?: EntityState;
  date_from?: string;
  date_to?: string;
  [key: string]: any;
}

export interface SearchResult<T = BaseEntity> {
  records: T[];
  pagination: PaginationInfo;
  filters: SearchFilters;
}
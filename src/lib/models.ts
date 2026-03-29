export interface Translation {
  ar: string;
  en: string;
  ku: string;
}

export interface User {
  shortname: string;
  displayname: Translation;
  description: Translation;
  password: string;
}

export interface Entity {
  title: string;
  tags: string[];
  content: string;
  is_active: boolean;
}

export interface EntitySearch {
  limit: number;
  offset: number;
  shortname: string;
  search: string;
}

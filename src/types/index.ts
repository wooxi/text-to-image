export interface KeywordGroup {
  id: number;
  name: string;
  slug: string;
  keywords: Keyword[];
}

export interface Keyword {
  id: number;
  groupId: number;
  name: string;
}

export interface ImageRecord {
  id: number;
  keywordNames: string;
  prompt: string;
  imagePath: string;
  type: string;
  posterPath: string;
  createdAt: string;
}

export interface ConfigItem {
  key: string;
  value: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

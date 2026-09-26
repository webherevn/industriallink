/** Một ảnh trong thư viện CMS (file trên storage, không có bản ghi DB riêng). */
export interface CmsMediaItem {
  filename: string;
  url: string;
  mime: string;
  size: number;
  updatedAt: string;
}

export interface CmsMediaList {
  items: CmsMediaItem[];
}

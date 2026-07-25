export type AdminMode = 'old' | 'new';

export interface AdminUnit {
  id: string;
  name: string;
}

export interface LocationSelectionItem {
  province: string;
  /** Cấp 2 (quận/huyện hoặc phường/xã). Bỏ trống = cả tỉnh. */
  child?: string;
}

export type LocationPickerMode = AdminMode | 'kcn';

export interface LocationPickerValue {
  mode: LocationPickerMode;
  items: LocationSelectionItem[];
}

/** Ngăn cách tỉnh · đơn vị cấp 2 trong chuỗi hiển thị / lưu job.location. */
export const LOCATION_PART_SEP = ' · ';

/** Ngăn cách nhiều địa điểm khi lưu multi trong một field string. */
export const LOCATION_MULTI_SEP = ' | ';

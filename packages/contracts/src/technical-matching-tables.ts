/**
 * Bảng tra cứu matching Kỹ thuật — đồng bộ từ du_lieu_matching_ky_thuat.json
 * phiên_bản 1.0 / 2026-09-21
 * Không sửa tay các ma trận; cập nhật JSON rồi chạy gen-technical-tables.cjs.
 */

export const TECH_MATCH_DATA_VERSION = {"phien_ban":"1.0","ngay":"2026-09-21","nhanh":"ky_thuat"} as const;

export const TECH_MATCH_CONSTANTS = {
  MAX_CHON_HO_SO: 3,
  CUNG_CUM_KHAC_NGANH: 85,
  CUNG_NHOM_KHAC_MUC: 85,
  KHAC_GAP_KHAC: 30,
  MOT_BEN_KHAC: 10,
  NGUONG_BE_DAY_NAM: 6,
  TRAN_THUONG_BE_DAY: 0.25,
  KHOI_CONG_TY: 70,
  KHOI_CHUNG: 30,
  NGUONG_LOC_CUNG_NGANH_MAC_DINH: 85,
} as const;

export const TECH_EQUIPMENT_CODES = ["CK","TL","KN","BVT","DIEN","TDH","DT","ROB","DL","NL","HVAC","ME","PCCC","XD","XLN","SX","BT","KHAC"] as const;

export const TECH_EQUIPMENT_NAMES: Record<(typeof TECH_EQUIPMENT_CODES)[number], string> = {
  "CK": "Cơ khí / Cơ khí chế tạo",
  "TL": "Thủy lực",
  "KN": "Khí nén",
  "BVT": "Bơm / Van / Thiết bị công nghiệp",
  "DIEN": "Điện / Điện công nghiệp",
  "TDH": "Tự động hóa / Điều khiển",
  "DT": "Điện tử / Điện tử công nghiệp",
  "ROB": "Robot / Tự động hóa sản xuất",
  "DL": "Đo lường / Thiết bị đo",
  "NL": "Năng lượng / Điện năng",
  "HVAC": "HVAC / Điều hòa – thông gió",
  "ME": "M&E / MEP",
  "PCCC": "PCCC",
  "XD": "Xây dựng / Công trình kỹ thuật",
  "XLN": "Xử lý nước / Môi trường",
  "SX": "Sản xuất / Công nghệ sản xuất",
  "BT": "Bảo trì / Bảo dưỡng công nghiệp",
  "KHAC": "Khác",
};

export const TECH_EQUIPMENT_GROUP: Record<(typeof TECH_EQUIPMENT_CODES)[number], number> = {
  "CK": 1,
  "TL": 1,
  "KN": 1,
  "BVT": 1,
  "DIEN": 2,
  "TDH": 2,
  "DT": 2,
  "ROB": 2,
  "DL": 2,
  "NL": 2,
  "HVAC": 3,
  "ME": 3,
  "PCCC": 3,
  "XD": 3,
  "XLN": 3,
  "SX": 4,
  "BT": 4,
  "KHAC": 0,
};

export const TECH_EQUIPMENT_SIMILARITY_MATRIX: readonly (readonly number[])[] = [
  [100, 85, 85, 85, 65, 65, 65, 65, 65, 65, 60, 60, 60, 60, 60, 70, 70, 10],
  [85, 100, 85, 85, 65, 65, 65, 65, 65, 65, 60, 60, 60, 60, 60, 70, 70, 10],
  [85, 85, 100, 85, 65, 65, 65, 65, 65, 65, 60, 60, 60, 60, 60, 70, 70, 10],
  [85, 85, 85, 100, 65, 65, 65, 65, 65, 65, 60, 60, 60, 60, 60, 70, 70, 10],
  [65, 65, 65, 65, 100, 85, 85, 85, 85, 85, 70, 70, 70, 70, 70, 65, 65, 10],
  [65, 65, 65, 65, 85, 100, 85, 85, 85, 85, 70, 70, 70, 70, 70, 65, 65, 10],
  [65, 65, 65, 65, 85, 85, 100, 85, 85, 85, 70, 70, 70, 70, 70, 65, 65, 10],
  [65, 65, 65, 65, 85, 85, 85, 100, 85, 85, 70, 70, 70, 70, 70, 65, 65, 10],
  [65, 65, 65, 65, 85, 85, 85, 85, 100, 85, 70, 70, 70, 70, 70, 65, 65, 10],
  [65, 65, 65, 65, 85, 85, 85, 85, 85, 100, 70, 70, 70, 70, 70, 65, 65, 10],
  [60, 60, 60, 60, 70, 70, 70, 70, 70, 70, 100, 85, 85, 85, 85, 50, 50, 10],
  [60, 60, 60, 60, 70, 70, 70, 70, 70, 70, 85, 100, 85, 85, 85, 50, 50, 10],
  [60, 60, 60, 60, 70, 70, 70, 70, 70, 70, 85, 85, 100, 85, 85, 50, 50, 10],
  [60, 60, 60, 60, 70, 70, 70, 70, 70, 70, 85, 85, 85, 100, 85, 50, 50, 10],
  [60, 60, 60, 60, 70, 70, 70, 70, 70, 70, 85, 85, 85, 85, 100, 50, 50, 10],
  [70, 70, 70, 70, 65, 65, 65, 65, 65, 65, 50, 50, 50, 50, 50, 100, 85, 10],
  [70, 70, 70, 70, 65, 65, 65, 65, 65, 65, 50, 50, 50, 50, 50, 85, 100, 10],
  [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 30],
];

export const TECH_WORK_CODES = ["TK","BTKS","LTCD","LD","CTBG","NT","VH","BTBD","SC","XLSC","CTNC","DTHD"] as const;

export const TECH_WORK_NAMES: Record<(typeof TECH_WORK_CODES)[number], string> = {
  "TK": "Thiết kế",
  "BTKS": "Bóc tách / khảo sát",
  "LTCD": "Lập trình / cài đặt",
  "LD": "Lắp đặt",
  "CTBG": "Chạy thử / bàn giao",
  "NT": "Nghiệm thu",
  "VH": "Vận hành",
  "BTBD": "Bảo trì / bảo dưỡng",
  "SC": "Sửa chữa",
  "XLSC": "Xử lý sự cố",
  "CTNC": "Cải tiến / nâng cấp",
  "DTHD": "Đào tạo / hướng dẫn",
};

export const TECH_WORK_GROUP: Record<(typeof TECH_WORK_CODES)[number], number> = {
  "TK": 1,
  "BTKS": 1,
  "LTCD": 1,
  "LD": 2,
  "CTBG": 2,
  "NT": 2,
  "VH": 3,
  "BTBD": 3,
  "SC": 3,
  "XLSC": 3,
  "CTNC": 4,
  "DTHD": 4,
};

export const TECH_WORK_SIMILARITY_MATRIX: readonly (readonly number[])[] = [
  [100, 85, 85, 70, 70, 70, 45, 45, 45, 45, 75, 75],
  [85, 100, 85, 70, 70, 70, 45, 45, 45, 45, 75, 75],
  [85, 85, 100, 70, 70, 70, 45, 45, 45, 45, 75, 75],
  [70, 70, 70, 100, 85, 85, 75, 75, 75, 75, 65, 65],
  [70, 70, 70, 85, 100, 85, 75, 75, 75, 75, 65, 65],
  [70, 70, 70, 85, 85, 100, 75, 75, 75, 75, 65, 65],
  [45, 45, 45, 75, 75, 75, 100, 85, 85, 85, 70, 70],
  [45, 45, 45, 75, 75, 75, 85, 100, 85, 85, 70, 70],
  [45, 45, 45, 75, 75, 75, 85, 85, 100, 85, 70, 70],
  [45, 45, 45, 75, 75, 75, 85, 85, 85, 100, 70, 70],
  [75, 75, 75, 65, 65, 65, 70, 70, 70, 70, 100, 85],
  [75, 75, 75, 65, 65, 65, 70, 70, 70, 70, 85, 100],
];

export const TECH_ENV_CODES = ["NHA_MAY","CONG_TRUONG","TAI_KHACH_HANG","VAN_PHONG","KHAC"] as const;

export const TECH_ENV_NAMES: Record<(typeof TECH_ENV_CODES)[number], string> = {
  "NHA_MAY": "Nhà máy / xưởng",
  "CONG_TRUONG": "Công trường / dự án",
  "TAI_KHACH_HANG": "Tại khách hàng",
  "VAN_PHONG": "Văn phòng",
  "KHAC": "Khác",
};

export const TECH_ENV_SIMILARITY_MATRIX: readonly (readonly number[])[] = [
  [100, 60, 70, 50, 30],
  [60, 100, 80, 40, 30],
  [70, 80, 100, 50, 30],
  [50, 40, 50, 100, 30],
  [30, 30, 30, 30, 30],
];

export const TECH_DOC_CODES = ["BV_CO_KHI","BV_DIEN","PID","DATASHEET","MANUAL","KHAC"] as const;

export const TECH_DOC_NAMES: Record<(typeof TECH_DOC_CODES)[number], string> = {
  "BV_CO_KHI": "Bản vẽ cơ khí",
  "BV_DIEN": "Bản vẽ điện",
  "PID": "P&ID / sơ đồ công nghệ",
  "DATASHEET": "Datasheet / thông số kỹ thuật",
  "MANUAL": "Manual / tài liệu hướng dẫn",
  "KHAC": "Khác",
};

export const TECH_DOC_SIMILARITY_MATRIX: readonly (readonly number[])[] = [
  [100, 50, 60, 40, 40, 10],
  [50, 100, 70, 40, 40, 10],
  [60, 70, 100, 50, 50, 10],
  [40, 40, 50, 100, 80, 10],
  [40, 40, 50, 80, 100, 10],
  [10, 10, 10, 10, 10, 30],
];

export const TECH_TOOL_CATALOG = ["AutoCAD","SolidWorks","Inventor","Revit","PLC / HMI","ERP / SAP","Word / Excel","Khác"] as const;

export const TECH_TITLE_RANKS: Record<string, number> = {
  "Kỹ thuật viên": 1,
  "Kỹ sư dịch vụ / Bảo trì – sửa chữa": 2,
  "Kỹ sư cơ khí": 2,
  "Kỹ sư điện / Điện công nghiệp": 2,
  "Kỹ sư tự động hóa / Điều khiển": 2,
  "Kỹ sư thiết kế": 2,
  "Kỹ sư dự án": 2,
  "Kỹ sư sản xuất / Quy trình": 2,
  "Kỹ sư chất lượng QA/QC": 2,
  "Kỹ sư R&D": 2,
  "Quản lý kỹ thuật": 3,
  "Quản lý dự án": 3,
  "Quản lý / vận hành nhà máy": 3,
  "Khác": 0,
};

export const TECH_TITLE_SCORES = {
  "trung_chuc_danh": 100,
  "cung_cap_khac_chuyen_mon": 70,
  "lech_1_cap": 60,
  "lech_2_cap": 30,
  "khong_chuan_hoa_duoc": 20
} as const;

export const TECH_AUTONOMY_LABELS = ["Cần người hướng dẫn","Có thể làm theo hướng dẫn","Có thể tự thực hiện","Có thể tự xử lý công việc phức tạp","Có thể hướng dẫn người khác"] as const;

export const TECH_AUTONOMY_SCORES = {"bang_hoac_hon":100,"kem_1":70,"kem_2":40,"kem_3_tro_len":10} as const;

export const TECH_SHIFT_LABELS = ["Không thể","Có, nhưng có giới hạn","Có, sẵn sàng"] as const;

export const TECH_SHIFT_SCORES = {"bang_hoac_hon":100,"kem_1":50,"kem_2_tro_len":0} as const;


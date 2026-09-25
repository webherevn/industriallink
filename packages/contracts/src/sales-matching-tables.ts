/**
 * Bảng tra cứu matching Sales — đồng bộ từ du_lieu_matching_sales.json
 * phiên_bản 1.0 / 2026-09-15
 * Không sửa tay các ma trận; cập nhật JSON rồi chạy gen-tables.cjs.
 */

export const SALES_MATCH_DATA_VERSION = {"phien_ban":"1.0","ngay":"2026-09-15"} as const;

export const SALES_MATCH_CONSTANTS = {
  MAX_CHON_HO_SO: 3,
  CUNG_CUM_KHAC_NGANH: 85,
  KHAC_GAP_KHAC: 30,
  MOT_BEN_KHAC: 10,
  TY_TRONG_KHAU_COT_LOI: 0.7,
  NGUONG_BE_DAY_NAM: 6,
  TRAN_THUONG_BE_DAY: 0.25,
  KHOI_CONG_TY: 83,
  KHOI_CHUNG: 17,
  JD04_CUNG_MIEN: 50,
  JD04_KHAC_MIEN: 10,
  JD15_CUNG_KHOI: 60,
  JD15_KHAC_HOAC_KHONG_NHAN: 25,
} as const;

export const PRODUCT_MATCH_CODES = ["MNK","MPD","CNC","LAS","CHA","HAN","EP","DCS","ROB","PLC","BTS","TDI","CHI","AHU","HVA","CTW","BOM","VAN","ONG","NHA","PCC","XLN","LOC","DOL","MEP","KHA"] as const;

export const PRODUCT_MATCH_NAMES: Record<(typeof PRODUCT_MATCH_CODES)[number], string> = {
  "MNK": "Máy nén khí",
  "MPD": "Máy phát điện",
  "CNC": "Máy gia công CNC",
  "LAS": "Máy cắt laser",
  "CHA": "Máy chấn / máy dập",
  "HAN": "Máy hàn",
  "EP": "Máy ép",
  "DCS": "Dây chuyền sản xuất",
  "ROB": "Robot công nghiệp",
  "PLC": "PLC / HMI",
  "BTS": "Biến tần / Servo",
  "TDI": "Tủ điện",
  "CHI": "Chiller",
  "AHU": "AHU / FCU",
  "HVA": "Hệ thống HVAC",
  "CTW": "Cooling Tower",
  "BOM": "Bơm công nghiệp",
  "VAN": "Van công nghiệp",
  "ONG": "Hệ thống đường ống",
  "NHA": "Thiết bị nâng hạ / cầu trục",
  "PCC": "Thiết bị PCCC",
  "XLN": "Hệ thống xử lý nước",
  "LOC": "Lọc bụi / xử lý khí",
  "DOL": "Thiết bị đo lường / cảm biến",
  "MEP": "Hệ thống M&E / MEP",
  "KHA": "Thiết bị công nghiệp khác",
};

export const PRODUCT_MATCH_CLUSTER: Record<(typeof PRODUCT_MATCH_CODES)[number], number | null> = {
  "MNK": 1,
  "MPD": 2,
  "CNC": 1,
  "LAS": 1,
  "CHA": 1,
  "HAN": 1,
  "EP": 1,
  "DCS": 1,
  "ROB": 2,
  "PLC": 2,
  "BTS": 2,
  "TDI": 2,
  "CHI": 3,
  "AHU": 3,
  "HVA": 3,
  "CTW": 3,
  "BOM": 1,
  "VAN": 1,
  "ONG": 1,
  "NHA": 5,
  "PCC": 3,
  "XLN": 3,
  "LOC": 3,
  "DOL": 2,
  "MEP": 3,
  "KHA": null,
};

export const PRODUCT_SIMILARITY_MATRIX: readonly (readonly number[])[] = [
  [100, 90, 50, 50, 50, 50, 50, 50, 40, 40, 40, 40, 30, 30, 30, 70, 90, 80, 80, 30, 30, 30, 30, 70, 70, 10],
  [90, 100, 40, 40, 40, 40, 40, 40, 50, 50, 50, 80, 40, 40, 40, 40, 70, 40, 70, 30, 40, 40, 40, 50, 80, 10],
  [50, 40, 100, 90, 90, 90, 90, 70, 70, 40, 40, 40, 30, 30, 30, 30, 50, 50, 50, 30, 30, 30, 30, 40, 30, 10],
  [50, 40, 90, 100, 90, 90, 80, 70, 70, 40, 40, 40, 30, 30, 30, 30, 50, 50, 50, 30, 30, 30, 30, 40, 30, 10],
  [50, 40, 90, 90, 100, 90, 90, 70, 70, 40, 40, 40, 30, 30, 30, 30, 50, 50, 50, 30, 30, 30, 30, 40, 30, 10],
  [50, 40, 90, 90, 90, 100, 70, 70, 80, 40, 40, 40, 30, 30, 30, 30, 50, 50, 50, 30, 30, 30, 30, 40, 30, 10],
  [50, 40, 90, 80, 90, 70, 100, 80, 70, 40, 40, 40, 30, 30, 30, 30, 50, 50, 50, 30, 30, 30, 30, 40, 30, 10],
  [50, 40, 70, 70, 70, 70, 80, 100, 90, 80, 70, 70, 30, 30, 30, 30, 50, 50, 50, 80, 30, 30, 30, 40, 80, 10],
  [40, 50, 70, 70, 70, 80, 70, 90, 100, 90, 80, 80, 40, 40, 40, 40, 40, 40, 40, 30, 40, 40, 40, 70, 40, 10],
  [40, 50, 40, 40, 40, 40, 40, 80, 90, 100, 90, 90, 40, 40, 40, 40, 40, 40, 40, 30, 40, 40, 40, 90, 70, 10],
  [40, 50, 40, 40, 40, 40, 40, 70, 80, 90, 100, 90, 40, 40, 40, 40, 70, 40, 40, 70, 40, 40, 40, 90, 40, 10],
  [40, 80, 40, 40, 40, 40, 40, 70, 80, 90, 90, 100, 40, 40, 40, 40, 40, 40, 40, 70, 70, 40, 40, 80, 90, 10],
  [30, 40, 30, 30, 30, 30, 30, 30, 40, 40, 40, 40, 100, 90, 90, 90, 70, 70, 70, 40, 50, 50, 50, 40, 80, 10],
  [30, 40, 30, 30, 30, 30, 30, 30, 40, 40, 40, 40, 90, 100, 90, 90, 30, 30, 70, 40, 50, 50, 80, 40, 80, 10],
  [30, 40, 30, 30, 30, 30, 30, 30, 40, 40, 40, 40, 90, 90, 100, 90, 70, 30, 70, 40, 50, 50, 80, 40, 90, 10],
  [70, 40, 30, 30, 30, 30, 30, 30, 40, 40, 40, 40, 90, 90, 90, 100, 80, 30, 70, 40, 50, 80, 50, 40, 70, 10],
  [90, 70, 50, 50, 50, 50, 50, 50, 40, 40, 70, 40, 70, 30, 70, 80, 100, 90, 90, 30, 90, 90, 70, 70, 70, 10],
  [80, 40, 50, 50, 50, 50, 50, 50, 40, 40, 40, 40, 70, 30, 30, 30, 90, 100, 90, 30, 80, 80, 30, 80, 70, 10],
  [80, 70, 50, 50, 50, 50, 50, 50, 40, 40, 40, 40, 70, 70, 70, 70, 90, 90, 100, 30, 80, 90, 70, 40, 90, 10],
  [30, 30, 30, 30, 30, 30, 30, 80, 30, 30, 70, 70, 40, 40, 40, 40, 30, 30, 30, 100, 80, 40, 40, 30, 90, 10],
  [30, 40, 30, 30, 30, 30, 30, 30, 40, 40, 40, 70, 50, 50, 50, 50, 90, 80, 80, 80, 100, 70, 50, 40, 90, 10],
  [30, 40, 30, 30, 30, 30, 30, 30, 40, 40, 40, 40, 50, 50, 50, 80, 90, 80, 90, 40, 70, 100, 90, 70, 70, 10],
  [30, 40, 30, 30, 30, 30, 30, 30, 40, 40, 40, 40, 50, 80, 80, 50, 70, 30, 70, 40, 50, 90, 100, 70, 80, 10],
  [70, 50, 40, 40, 40, 40, 40, 40, 70, 90, 90, 80, 40, 40, 40, 40, 70, 80, 40, 30, 40, 70, 70, 100, 40, 10],
  [70, 80, 30, 30, 30, 30, 30, 80, 40, 70, 40, 90, 80, 80, 90, 70, 70, 70, 90, 90, 90, 70, 80, 40, 100, 10],
  [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 30],
];

export const CUSTOMER_SEGMENT_SIMILARITY_MATRIX: readonly (readonly number[])[] = [
  [100, 70, 70, 90, 80, 30, 30, 10],
  [70, 100, 90, 70, 80, 30, 30, 10],
  [70, 90, 100, 70, 80, 30, 30, 10],
  [90, 70, 70, 100, 80, 30, 30, 10],
  [80, 80, 80, 80, 100, 30, 30, 10],
  [30, 30, 30, 30, 30, 100, 90, 10],
  [30, 30, 30, 30, 30, 90, 100, 10],
  [10, 10, 10, 10, 10, 10, 10, 30],
];

export const DEAL_TYPE_SIMILARITY_MATRIX: readonly (readonly number[])[] = [
  [100, 60, 70, 80, 70, 30],
  [60, 100, 70, 40, 30, 30],
  [70, 70, 100, 70, 60, 30],
  [80, 40, 70, 100, 90, 30],
  [70, 30, 60, 90, 100, 30],
  [30, 30, 30, 30, 30, 30],
];

export const REGION_SIMILARITY_MATRIX: readonly (readonly number[])[] = [
  [100, 60, 40, 60, 50, 30],
  [60, 100, 60, 60, 50, 30],
  [40, 60, 100, 60, 50, 30],
  [100, 100, 100, 100, 70, 30],
  [50, 50, 50, 70, 100, 30],
  [30, 30, 30, 30, 30, 30],
];

export const INDUSTRY_CLUSTER_SIMILARITY_MATRIX: readonly (readonly number[])[] = [
  [100, 65, 45, 50, 55, 55],
  [65, 100, 70, 30, 55, 55],
  [45, 70, 100, 30, 60, 55],
  [50, 30, 30, 100, 30, 55],
  [55, 55, 60, 30, 100, 55],
  [55, 55, 55, 55, 55, 100],
];

export const PROVINCE_TO_MACRO_REGION = {
  "Hà Nội": "Miền Bắc",
  "Hải Phòng": "Miền Bắc",
  "Quảng Ninh": "Miền Bắc",
  "Bắc Ninh": "Miền Bắc",
  "Hưng Yên": "Miền Bắc",
  "Ninh Bình": "Miền Bắc",
  "Phú Thọ": "Miền Bắc",
  "Thái Nguyên": "Miền Bắc",
  "Lào Cai": "Miền Bắc",
  "Tuyên Quang": "Miền Bắc",
  "Cao Bằng": "Miền Bắc",
  "Lạng Sơn": "Miền Bắc",
  "Sơn La": "Miền Bắc",
  "Điện Biên": "Miền Bắc",
  "Lai Châu": "Miền Bắc",
  "Thanh Hóa": "Miền Trung",
  "Nghệ An": "Miền Trung",
  "Hà Tĩnh": "Miền Trung",
  "Quảng Trị": "Miền Trung",
  "Huế": "Miền Trung",
  "Đà Nẵng": "Miền Trung",
  "Quảng Ngãi": "Miền Trung",
  "Gia Lai": "Miền Trung",
  "Đắk Lắk": "Miền Trung",
  "Khánh Hòa": "Miền Trung",
  "Lâm Đồng": "Miền Trung",
  "TP Hồ Chí Minh": "Miền Nam",
  "Đồng Nai": "Miền Nam",
  "Tây Ninh": "Miền Nam",
  "Cần Thơ": "Miền Nam",
  "Vĩnh Long": "Miền Nam",
  "Đồng Tháp": "Miền Nam",
  "An Giang": "Miền Nam",
  "Cà Mau": "Miền Nam"
} as const;

export const MAJOR_KEYWORDS_KY_THUAT = ["kỹ thuật","cơ khí","chế tạo","cơ điện tử","điện","điện tử","tự động hóa","điều khiển","nhiệt","lạnh","năng lượng","hóa","vật liệu","xây dựng","công trình","môi trường","dầu khí","luyện kim","ô tô","động lực","tàu thủy","hàng không","mỏ","địa chất","công nghệ thông tin","tin học","viễn thông","cấp thoát nước"] as const;

export const MAJOR_KEYWORDS_KINH_TE = ["kinh tế","quản trị kinh doanh","quản trị","marketing","thương mại","tài chính","ngân hàng","kế toán","kiểm toán","ngoại thương","logistics","xuất nhập khẩu","bảo hiểm"] as const;


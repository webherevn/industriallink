/**
 * Catalog hãng FDI / B2B lớn hoạt động tại Việt Nam — dùng gợi ý ô Hãng/công nghệ.
 * Ưu tiên: 1 = rất cao (điện tử/semiconductor/automation), 2 = cao, 3 = mở rộng.
 */

export type FdiBrandPriority = 1 | 2 | 3;

export interface FdiB2bBrand {
  name: string;
  country: string;
  /** Nhóm ngành gợi ý (search phụ). */
  sectors: string[];
  priority: FdiBrandPriority;
}

const RAW: FdiB2bBrand[] = [
  // —— Ưu tiên rất cao: electronics / semiconductor / EMS ——
  { name: 'Samsung', country: 'Hàn Quốc', sectors: ['Electronics', 'Semiconductor', 'Manufacturing'], priority: 1 },
  { name: 'Samsung Semiconductor', country: 'Hàn Quốc', sectors: ['Semiconductor'], priority: 1 },
  { name: 'Samsung C&T', country: 'Hàn Quốc', sectors: ['Engineering', 'Construction'], priority: 2 },
  { name: 'LG Electronics', country: 'Hàn Quốc', sectors: ['Electronics', 'Manufacturing'], priority: 1 },
  { name: 'LG Display', country: 'Hàn Quốc', sectors: ['Display', 'Electronics'], priority: 1 },
  { name: 'LG Innotek', country: 'Hàn Quốc', sectors: ['Electronics', 'Components'], priority: 1 },
  { name: 'LG Energy Solution', country: 'Hàn Quốc', sectors: ['Battery', 'Energy'], priority: 1 },
  { name: 'LG Chem', country: 'Hàn Quốc', sectors: ['Chemicals'], priority: 2 },
  { name: 'Intel', country: 'Mỹ', sectors: ['Semiconductor'], priority: 1 },
  { name: 'Amkor Technology', country: 'Mỹ', sectors: ['Semiconductor packaging'], priority: 1 },
  { name: 'Foxconn', country: 'Đài Loan', sectors: ['Electronics manufacturing'], priority: 1 },
  { name: 'Hon Hai', country: 'Đài Loan', sectors: ['Electronics manufacturing'], priority: 1 },
  { name: 'Pegatron', country: 'Đài Loan', sectors: ['Electronics manufacturing'], priority: 1 },
  { name: 'Luxshare-ICT', country: 'Trung Quốc', sectors: ['Electronics manufacturing'], priority: 1 },
  { name: 'Goertek', country: 'Trung Quốc', sectors: ['Electronics', 'Components'], priority: 1 },
  { name: 'BOE', country: 'Trung Quốc', sectors: ['Display', 'Electronics'], priority: 1 },
  { name: 'Hana Micron', country: 'Hàn Quốc', sectors: ['Semiconductor'], priority: 1 },
  { name: 'Qualcomm', country: 'Mỹ', sectors: ['Semiconductor'], priority: 1 },
  { name: 'NVIDIA', country: 'Mỹ', sectors: ['Semiconductor'], priority: 1 },
  { name: 'Synopsys', country: 'Mỹ', sectors: ['Semiconductor', 'EDA'], priority: 2 },
  { name: 'Cadence', country: 'Mỹ', sectors: ['Semiconductor', 'EDA'], priority: 2 },
  { name: 'Marvell Technology', country: 'Mỹ', sectors: ['Semiconductor'], priority: 2 },
  { name: 'Infineon', country: 'Đức', sectors: ['Semiconductor'], priority: 1 },
  { name: 'Renesas', country: 'Nhật Bản', sectors: ['Semiconductor'], priority: 1 },
  { name: 'ASE Technology', country: 'Đài Loan', sectors: ['Semiconductor packaging'], priority: 1 },
  { name: 'Wistron', country: 'Đài Loan', sectors: ['Electronics manufacturing'], priority: 1 },
  { name: 'Compal', country: 'Đài Loan', sectors: ['Electronics manufacturing'], priority: 1 },
  { name: 'Quanta Computer', country: 'Đài Loan', sectors: ['Electronics manufacturing'], priority: 1 },
  { name: 'BYD Electronics', country: 'Trung Quốc', sectors: ['Electronics manufacturing'], priority: 1 },
  { name: 'USI', country: 'Đài Loan', sectors: ['Electronics manufacturing'], priority: 2 },
  { name: 'Universal Scientific Industrial', country: 'Đài Loan', sectors: ['Electronics manufacturing'], priority: 2 },
  { name: 'Lite-On', country: 'Đài Loan', sectors: ['Electronics'], priority: 2 },
  { name: 'TDK', country: 'Nhật Bản', sectors: ['Electronics', 'Components'], priority: 2 },
  { name: 'Murata', country: 'Nhật Bản', sectors: ['Electronics', 'Components'], priority: 2 },
  { name: 'Canon', country: 'Nhật Bản', sectors: ['Electronics', 'Imaging'], priority: 2 },
  { name: 'Panasonic', country: 'Nhật Bản', sectors: ['Electronics', 'Manufacturing'], priority: 1 },
  { name: 'Panasonic Energy', country: 'Nhật Bản', sectors: ['Battery', 'Energy'], priority: 2 },

  // —— Automation / industrial technology (ưu tiên rất cao) ——
  { name: 'Bosch', country: 'Đức', sectors: ['Automotive', 'Engineering', 'Technology'], priority: 1 },
  { name: 'Bosch Rexroth', country: 'Đức', sectors: ['Industrial automation'], priority: 1 },
  { name: 'Siemens', country: 'Đức', sectors: ['Automation', 'Industrial technology'], priority: 1 },
  { name: 'Siemens Energy', country: 'Đức', sectors: ['Energy'], priority: 2 },
  { name: 'Schneider Electric', country: 'Pháp', sectors: ['Energy management', 'Automation'], priority: 1 },
  { name: 'ABB', country: 'Thụy Sĩ', sectors: ['Automation', 'Electrification'], priority: 1 },
  { name: 'Mitsubishi Electric', country: 'Nhật Bản', sectors: ['Automation', 'Electrical'], priority: 1 },
  { name: 'Rockwell Automation', country: 'Mỹ', sectors: ['Industrial automation'], priority: 1 },
  { name: 'Allen-Bradley', country: 'Mỹ', sectors: ['Industrial automation'], priority: 1 },
  { name: 'Yokogawa', country: 'Nhật Bản', sectors: ['Process automation'], priority: 2 },
  { name: 'Omron', country: 'Nhật Bản', sectors: ['Automation', 'Robotics'], priority: 2 },
  { name: 'FANUC', country: 'Nhật Bản', sectors: ['Robotics', 'Automation'], priority: 2 },
  { name: 'Keyence', country: 'Nhật Bản', sectors: ['Sensors', 'Automation'], priority: 2 },
  { name: 'Yaskawa', country: 'Nhật Bản', sectors: ['Robotics'], priority: 2 },
  { name: 'KUKA', country: 'Đức', sectors: ['Robotics'], priority: 2 },
  { name: 'SMC', country: 'Nhật Bản', sectors: ['Pneumatics'], priority: 2 },
  { name: 'Festo', country: 'Đức', sectors: ['Automation'], priority: 2 },
  { name: 'Beckhoff', country: 'Đức', sectors: ['Automation'], priority: 2 },
  { name: 'Phoenix Contact', country: 'Đức', sectors: ['Industrial automation'], priority: 2 },
  { name: 'Pepperl+Fuchs', country: 'Đức', sectors: ['Sensors'], priority: 2 },
  { name: 'Emerson', country: 'Mỹ', sectors: ['Automation'], priority: 2 },
  { name: 'Honeywell', country: 'Mỹ', sectors: ['Automation'], priority: 2 },
  { name: 'Fuji Electric', country: 'Nhật Bản', sectors: ['Electrical', 'Automation'], priority: 2 },
  { name: 'Delta Electronics', country: 'Đài Loan', sectors: ['Automation', 'Power'], priority: 2 },
  { name: 'Advantech', country: 'Đài Loan', sectors: ['Industrial computing'], priority: 2 },
  { name: 'Cognex', country: 'Mỹ', sectors: ['Machine vision'], priority: 2 },
  { name: 'Dassault Systèmes', country: 'Pháp', sectors: ['Industrial software'], priority: 2 },
  { name: 'PTC', country: 'Mỹ', sectors: ['Industrial IoT'], priority: 2 },
  { name: 'Hexagon', country: 'Thụy Điển', sectors: ['Engineering', 'Industrial software'], priority: 2 },
  { name: 'Pilz', country: 'Đức', sectors: ['Safety', 'Automation'], priority: 2 },
  { name: 'Sick', country: 'Đức', sectors: ['Sensors'], priority: 2 },
  { name: 'Endress+Hauser', country: 'Thụy Sĩ', sectors: ['Process instrumentation'], priority: 2 },
  { name: 'SEW-Eurodrive', country: 'Đức', sectors: ['Drives'], priority: 2 },
  { name: 'Danfoss', country: 'Đan Mạch', sectors: ['Drives', 'Climate'], priority: 2 },
  { name: 'Atlas Copco', country: 'Thụy Điển', sectors: ['Compressed air', 'Industrial'], priority: 2 },
  { name: 'Ingersoll Rand', country: 'Mỹ', sectors: ['Compressed air', 'Industrial'], priority: 2 },
  { name: 'Kaeser', country: 'Đức', sectors: ['Compressed air'], priority: 2 },
  { name: 'ELGi', country: 'Ấn Độ', sectors: ['Compressed air'], priority: 3 },
  { name: 'Grundfos', country: 'Đan Mạch', sectors: ['Pumps'], priority: 2 },
  { name: 'Wilo', country: 'Đức', sectors: ['Pumps'], priority: 3 },
  { name: 'Carrier', country: 'Mỹ', sectors: ['HVAC'], priority: 2 },
  { name: 'Daikin', country: 'Nhật Bản', sectors: ['HVAC'], priority: 2 },
  { name: 'Trane', country: 'Mỹ', sectors: ['HVAC'], priority: 2 },

  // —— Automotive ——
  { name: 'Toyota', country: 'Nhật Bản', sectors: ['Automotive'], priority: 2 },
  { name: 'Honda', country: 'Nhật Bản', sectors: ['Automotive'], priority: 2 },
  { name: 'Nissan', country: 'Nhật Bản', sectors: ['Automotive'], priority: 2 },
  { name: 'Mitsubishi Motors', country: 'Nhật Bản', sectors: ['Automotive'], priority: 2 },
  { name: 'Mazda', country: 'Nhật Bản', sectors: ['Automotive'], priority: 2 },
  { name: 'Suzuki', country: 'Nhật Bản', sectors: ['Automotive'], priority: 2 },
  { name: 'Isuzu', country: 'Nhật Bản', sectors: ['Automotive'], priority: 2 },
  { name: 'Ford', country: 'Mỹ', sectors: ['Automotive'], priority: 2 },
  { name: 'Mercedes-Benz', country: 'Đức', sectors: ['Automotive'], priority: 2 },
  { name: 'BMW', country: 'Đức', sectors: ['Automotive'], priority: 2 },
  { name: 'Continental', country: 'Đức', sectors: ['Automotive'], priority: 2 },
  { name: 'ZF', country: 'Đức', sectors: ['Automotive'], priority: 2 },
  { name: 'Schaeffler', country: 'Đức', sectors: ['Automotive'], priority: 2 },
  { name: 'Denso', country: 'Nhật Bản', sectors: ['Automotive'], priority: 2 },
  { name: 'Aisin', country: 'Nhật Bản', sectors: ['Automotive'], priority: 2 },
  { name: 'Yazaki', country: 'Nhật Bản', sectors: ['Automotive'], priority: 2 },
  { name: 'Sumitomo Wiring Systems', country: 'Nhật Bản', sectors: ['Automotive'], priority: 2 },
  { name: 'Niterra', country: 'Nhật Bản', sectors: ['Automotive'], priority: 3 },
  { name: 'Bridgestone', country: 'Nhật Bản', sectors: ['Automotive', 'Tires'], priority: 2 },
  { name: 'Michelin', country: 'Pháp', sectors: ['Automotive', 'Tires'], priority: 2 },
  { name: 'Hyundai', country: 'Hàn Quốc', sectors: ['Automotive'], priority: 2 },
  { name: 'Kia', country: 'Hàn Quốc', sectors: ['Automotive'], priority: 2 },
  { name: 'Hyundai Mobis', country: 'Hàn Quốc', sectors: ['Automotive'], priority: 2 },
  { name: 'VinFast', country: 'Việt Nam', sectors: ['Automotive', 'EV'], priority: 1 },
  { name: 'BYD', country: 'Trung Quốc', sectors: ['Automotive', 'EV'], priority: 2 },

  // —— Energy ——
  { name: 'GE Vernova', country: 'Mỹ', sectors: ['Energy'], priority: 2 },
  { name: 'Hitachi Energy', country: 'Nhật Bản', sectors: ['Energy'], priority: 2 },
  { name: 'Mitsubishi Heavy Industries', country: 'Nhật Bản', sectors: ['Energy', 'Engineering'], priority: 2 },
  { name: 'Eaton', country: 'Ireland', sectors: ['Power management'], priority: 2 },
  { name: 'Vestas', country: 'Đan Mạch', sectors: ['Wind energy'], priority: 2 },
  { name: 'Ørsted', country: 'Đan Mạch', sectors: ['Energy'], priority: 3 },
  { name: 'TotalEnergies', country: 'Pháp', sectors: ['Energy', 'Oil & Gas'], priority: 2 },
  { name: 'Shell', country: 'Anh', sectors: ['Energy', 'Oil & Gas'], priority: 2 },
  { name: 'BP', country: 'Anh', sectors: ['Energy', 'Oil & Gas'], priority: 2 },
  { name: 'Equinor', country: 'Na Uy', sectors: ['Energy'], priority: 3 },
  { name: 'AES', country: 'Mỹ', sectors: ['Energy'], priority: 3 },
  { name: 'Trina Solar', country: 'Trung Quốc', sectors: ['Solar'], priority: 2 },
  { name: 'LONGi', country: 'Trung Quốc', sectors: ['Solar'], priority: 2 },
  { name: 'JinkoSolar', country: 'Trung Quốc', sectors: ['Solar'], priority: 2 },
  { name: 'Canadian Solar', country: 'Canada', sectors: ['Solar'], priority: 2 },
  { name: 'First Solar', country: 'Mỹ', sectors: ['Solar'], priority: 2 },
  { name: 'Hitachi', country: 'Nhật Bản', sectors: ['Industrial', 'Technology'], priority: 2 },

  // —— Chemicals / materials ——
  { name: 'BASF', country: 'Đức', sectors: ['Chemicals'], priority: 2 },
  { name: 'Dow', country: 'Mỹ', sectors: ['Chemicals'], priority: 2 },
  { name: 'DuPont', country: 'Mỹ', sectors: ['Chemicals', 'Materials'], priority: 2 },
  { name: '3M', country: 'Mỹ', sectors: ['Materials', 'Industrial'], priority: 2 },
  { name: 'Henkel', country: 'Đức', sectors: ['Chemicals', 'Adhesives'], priority: 2 },
  { name: 'Evonik', country: 'Đức', sectors: ['Chemicals'], priority: 2 },
  { name: 'Covestro', country: 'Đức', sectors: ['Chemicals'], priority: 2 },
  { name: 'Mitsubishi Chemical', country: 'Nhật Bản', sectors: ['Chemicals'], priority: 2 },
  { name: 'Toray', country: 'Nhật Bản', sectors: ['Materials'], priority: 2 },
  { name: 'Sumitomo Chemical', country: 'Nhật Bản', sectors: ['Chemicals'], priority: 2 },
  { name: 'Asahi Kasei', country: 'Nhật Bản', sectors: ['Chemicals'], priority: 2 },
  { name: 'LyondellBasell', country: 'Hà Lan', sectors: ['Chemicals'], priority: 2 },
  { name: 'SABIC', country: 'Saudi Arabia', sectors: ['Chemicals'], priority: 2 },
  { name: 'SK Innovation', country: 'Hàn Quốc', sectors: ['Energy', 'Chemicals'], priority: 2 },
  { name: 'SKC', country: 'Hàn Quốc', sectors: ['Materials'], priority: 3 },
  { name: 'Wacker Chemie', country: 'Đức', sectors: ['Chemicals'], priority: 2 },
  { name: 'AkzoNobel', country: 'Hà Lan', sectors: ['Coatings'], priority: 2 },
  { name: 'PPG', country: 'Mỹ', sectors: ['Coatings'], priority: 2 },
  { name: 'Sherwin-Williams', country: 'Mỹ', sectors: ['Coatings'], priority: 3 },
  { name: 'Formosa Plastics', country: 'Đài Loan', sectors: ['Chemicals', 'Plastics'], priority: 2 },

  // —— Engineering / construction ——
  { name: 'Hyundai Engineering', country: 'Hàn Quốc', sectors: ['Engineering', 'Construction'], priority: 2 },
  { name: 'Hyundai E&C', country: 'Hàn Quốc', sectors: ['Engineering', 'Construction'], priority: 2 },
  { name: 'GS Engineering & Construction', country: 'Hàn Quốc', sectors: ['Construction'], priority: 2 },
  { name: 'POSCO E&C', country: 'Hàn Quốc', sectors: ['Engineering', 'Construction'], priority: 2 },
  { name: 'Lotte Engineering & Construction', country: 'Hàn Quốc', sectors: ['Construction'], priority: 2 },
  { name: 'Daewoo E&C', country: 'Hàn Quốc', sectors: ['Construction'], priority: 2 },
  { name: 'Obayashi', country: 'Nhật Bản', sectors: ['Construction'], priority: 2 },
  { name: 'Shimizu', country: 'Nhật Bản', sectors: ['Construction'], priority: 2 },
  { name: 'Kajima', country: 'Nhật Bản', sectors: ['Construction'], priority: 2 },
  { name: 'Taisei', country: 'Nhật Bản', sectors: ['Construction'], priority: 2 },
  { name: 'Takenaka', country: 'Nhật Bản', sectors: ['Construction'], priority: 2 },
  { name: 'VINCI', country: 'Pháp', sectors: ['Construction', 'Infrastructure'], priority: 2 },
  { name: 'Bouygues', country: 'Pháp', sectors: ['Construction'], priority: 2 },
  { name: 'Bechtel', country: 'Mỹ', sectors: ['Engineering', 'Construction'], priority: 2 },
  { name: 'Fluor', country: 'Mỹ', sectors: ['Engineering', 'Construction'], priority: 2 },
  { name: 'Hoa Phat', country: 'Việt Nam', sectors: ['Steel', 'Industrial'], priority: 2 },

  // —— Logistics / supply chain ——
  { name: 'DHL', country: 'Đức', sectors: ['Logistics'], priority: 2 },
  { name: 'DB Schenker', country: 'Đức', sectors: ['Logistics'], priority: 2 },
  { name: 'Kuehne+Nagel', country: 'Thụy Sĩ', sectors: ['Logistics'], priority: 2 },
  { name: 'Maersk', country: 'Đan Mạch', sectors: ['Logistics', 'Shipping'], priority: 2 },
  { name: 'DSV', country: 'Đan Mạch', sectors: ['Logistics'], priority: 2 },
  { name: 'Nippon Express', country: 'Nhật Bản', sectors: ['Logistics'], priority: 2 },
  { name: 'Expeditors', country: 'Mỹ', sectors: ['Logistics'], priority: 2 },
  { name: 'UPS', country: 'Mỹ', sectors: ['Logistics'], priority: 2 },
  { name: 'FedEx', country: 'Mỹ', sectors: ['Logistics'], priority: 2 },
  { name: 'CEVA Logistics', country: 'Pháp', sectors: ['Logistics'], priority: 2 },
  { name: 'Bolloré Logistics', country: 'Pháp', sectors: ['Logistics'], priority: 2 },
  { name: 'Kerry Logistics', country: 'Hồng Kông', sectors: ['Logistics'], priority: 2 },
  { name: 'Yusen Logistics', country: 'Nhật Bản', sectors: ['Logistics'], priority: 2 },
  { name: 'Sagawa Express', country: 'Nhật Bản', sectors: ['Logistics'], priority: 3 },
  { name: 'CJ Logistics', country: 'Hàn Quốc', sectors: ['Logistics'], priority: 2 },
  { name: 'Lotte Global Logistics', country: 'Hàn Quốc', sectors: ['Logistics'], priority: 2 },
  { name: 'SF Express', country: 'Trung Quốc', sectors: ['Logistics'], priority: 2 },
  { name: 'COSCO', country: 'Trung Quốc', sectors: ['Shipping', 'Logistics'], priority: 2 },
  { name: 'Hapag-Lloyd', country: 'Đức', sectors: ['Shipping'], priority: 2 },

  // —— Food / FMCG manufacturing ——
  { name: 'Nestlé', country: 'Thụy Sĩ', sectors: ['FMCG', 'Food'], priority: 2 },
  { name: 'PepsiCo', country: 'Mỹ', sectors: ['FMCG', 'Food'], priority: 2 },
  { name: 'Coca-Cola', country: 'Mỹ', sectors: ['FMCG', 'Beverage'], priority: 2 },
  { name: 'Unilever', country: 'Anh', sectors: ['FMCG'], priority: 2 },
  { name: 'P&G', country: 'Mỹ', sectors: ['FMCG'], priority: 2 },
  { name: 'Mondelez', country: 'Mỹ', sectors: ['FMCG', 'Food'], priority: 2 },
  { name: 'Heineken', country: 'Hà Lan', sectors: ['Beverage'], priority: 2 },
  { name: 'Carlsberg', country: 'Đan Mạch', sectors: ['Beverage'], priority: 2 },
  { name: 'AB InBev', country: 'Bỉ', sectors: ['Beverage'], priority: 2 },
  { name: 'Suntory', country: 'Nhật Bản', sectors: ['Beverage'], priority: 2 },
  { name: 'Ajinomoto', country: 'Nhật Bản', sectors: ['Food'], priority: 2 },
  { name: 'Kirin', country: 'Nhật Bản', sectors: ['Beverage'], priority: 3 },
  { name: 'FrieslandCampina', country: 'Hà Lan', sectors: ['Food', 'Dairy'], priority: 2 },
  { name: 'Cargill', country: 'Mỹ', sectors: ['Food', 'Agriculture'], priority: 2 },
  { name: 'ADM', country: 'Mỹ', sectors: ['Food', 'Agriculture'], priority: 2 },
  { name: 'Wilmar', country: 'Singapore', sectors: ['Food', 'Agriculture'], priority: 2 },
  { name: 'Olam', country: 'Singapore', sectors: ['Food', 'Agriculture'], priority: 2 },
  { name: 'CJ', country: 'Hàn Quốc', sectors: ['Food', 'FMCG'], priority: 2 },
  { name: 'LOTTE', country: 'Hàn Quốc', sectors: ['Food', 'FMCG'], priority: 2 },
  { name: 'Vinamilk', country: 'Việt Nam', sectors: ['Food', 'Dairy'], priority: 2 },

  // —— Consulting / technology B2B ——
  { name: 'Accenture', country: 'Ireland', sectors: ['Consulting', 'Technology'], priority: 2 },
  { name: 'Deloitte', country: 'Anh', sectors: ['Consulting'], priority: 2 },
  { name: 'PwC', country: 'Anh', sectors: ['Consulting'], priority: 2 },
  { name: 'EY', country: 'Anh', sectors: ['Consulting'], priority: 2 },
  { name: 'KPMG', country: 'Hà Lan', sectors: ['Consulting'], priority: 2 },
  { name: 'IBM', country: 'Mỹ', sectors: ['Technology'], priority: 2 },
  { name: 'Microsoft', country: 'Mỹ', sectors: ['Technology'], priority: 2 },
  { name: 'Oracle', country: 'Mỹ', sectors: ['Technology'], priority: 2 },
  { name: 'SAP', country: 'Đức', sectors: ['Technology', 'ERP'], priority: 2 },
  { name: 'Salesforce', country: 'Mỹ', sectors: ['Technology'], priority: 2 },
  { name: 'AWS', country: 'Mỹ', sectors: ['Cloud'], priority: 2 },
  { name: 'Google Cloud', country: 'Mỹ', sectors: ['Cloud'], priority: 2 },
  { name: 'Cisco', country: 'Mỹ', sectors: ['Networking'], priority: 2 },
  { name: 'Huawei', country: 'Trung Quốc', sectors: ['Technology', 'Telecom'], priority: 2 },
  { name: 'NTT DATA', country: 'Nhật Bản', sectors: ['Technology'], priority: 2 },
  { name: 'Fujitsu', country: 'Nhật Bản', sectors: ['Technology'], priority: 2 },
  { name: 'NEC', country: 'Nhật Bản', sectors: ['Technology'], priority: 2 },
  { name: 'Tata Consultancy Services', country: 'Ấn Độ', sectors: ['IT services'], priority: 2 },
  { name: 'Infosys', country: 'Ấn Độ', sectors: ['IT services'], priority: 2 },
  { name: 'Wipro', country: 'Ấn Độ', sectors: ['IT services'], priority: 2 },
  { name: 'HCLTech', country: 'Ấn Độ', sectors: ['IT services'], priority: 2 },

  // —— VN energy / industrial ——
  { name: 'PetroVietnam', country: 'Việt Nam', sectors: ['Oil & Gas'], priority: 2 },
  { name: 'PV Gas', country: 'Việt Nam', sectors: ['Energy'], priority: 2 },
];

function dedupeByName(list: FdiB2bBrand[]): FdiB2bBrand[] {
  const map = new Map<string, FdiB2bBrand>();
  for (const row of list) {
    const key = row.name.toLowerCase();
    const prev = map.get(key);
    if (!prev || row.priority < prev.priority) {
      map.set(key, row);
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name, 'en');
  });
}

/** Danh mục đầy đủ, đã sort ưu tiên (1 → 3). */
export const FDI_B2B_BRANDS: readonly FdiB2bBrand[] = dedupeByName(RAW);

/** Tên hãng theo thứ tự ưu tiên — tương thích field brandsTechnologies cũ. */
export const BRANDS_TECHNOLOGIES = FDI_B2B_BRANDS.map((b) => b.name);

export type BrandTechnology = (typeof BRANDS_TECHNOLOGIES)[number];

export interface CompanySuggestItem {
  name: string;
  country?: string | null;
  sectors?: string[];
  priority?: FdiBrandPriority;
  domain?: string | null;
  icon?: string | null;
  source: 'catalog';
}

export interface CompanySuggestResponse {
  items: CompanySuggestItem[];
}

/** Tìm trong catalog FDI/B2B VN — không gọi API ngoài. */
export function suggestFdiB2bBrands(query: string, limit = 12): CompanySuggestItem[] {
  const q = query.trim().toLowerCase();
  const pool = !q
    ? FDI_B2B_BRANDS
    : FDI_B2B_BRANDS.filter((b) => {
        if (b.name.toLowerCase().includes(q)) return true;
        if (b.country.toLowerCase().includes(q)) return true;
        return b.sectors.some((s) => s.toLowerCase().includes(q));
      });

  return pool.slice(0, limit).map((b) => ({
    name: b.name,
    country: b.country,
    sectors: b.sectors,
    priority: b.priority,
    source: 'catalog' as const,
  }));
}

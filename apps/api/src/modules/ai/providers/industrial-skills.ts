/** Từ điển kỹ năng công nghiệp dùng cho mock parse CV và suy luận AI Search. */
export const INDUSTRIAL_SKILL_KEYWORDS: {
  keyword: RegExp;
  name: string;
  industry: string;
}[] = [
  { keyword: /plc|s7|tia\s*portal|simatic/i, name: 'PLC Siemens', industry: 'Automation' },
  { keyword: /mitsubishi|gx\s*works/i, name: 'PLC Mitsubishi', industry: 'Automation' },
  { keyword: /scada|wincc/i, name: 'SCADA', industry: 'Automation' },
  { keyword: /hmi/i, name: 'HMI', industry: 'Automation' },
  { keyword: /robot|abb|fanuc|yaskawa/i, name: 'Robot công nghiệp', industry: 'Automation' },
  { keyword: /hvac|chiller|ahu|vrv|fcu/i, name: 'Hệ thống điều hòa / HVAC', industry: 'HVAC' },
  { keyword: /autocad/i, name: 'AutoCAD', industry: 'Engineering' },
  { keyword: /solidworks/i, name: 'SolidWorks', industry: 'Engineering' },
  { keyword: /eplan/i, name: 'EPLAN', industry: 'Automation' },
  { keyword: /sap|erp/i, name: 'SAP', industry: 'Manufacturing' },
  { keyword: /lean|kaizen|5s|six\s*sigma/i, name: 'Sản xuất tinh gọn', industry: 'Manufacturing' },
  { keyword: /sales|kinh\s*doanh|sales\s*engineer/i, name: 'Kinh doanh kỹ thuật', industry: 'Sales' },
];

/** Suy ra danh sách kỹ năng từ câu tìm kiếm / nội dung CV (không phân biệt hoa thường). */
export function inferSkillsFromText(text: string): string[] {
  if (!text.trim()) return [];
  return INDUSTRIAL_SKILL_KEYWORDS.filter((s) => s.keyword.test(text)).map((s) => s.name);
}

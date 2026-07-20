import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Taxonomy kỹ năng công nghiệp khởi tạo. Nền tảng cho AI Matching. */
const SKILLS: {
  code: string;
  name: string;
  slug: string;
  category: string;
  industry: string;
  aliases: string[];
}[] = [
  { code: 'SK-PLC-SIEMENS', name: 'PLC Siemens', slug: 'plc-siemens', category: 'Automation', industry: 'Automation', aliases: ['S7-1200', 'S7-1500', 'Simatic', 'Siemens PLC'] },
  { code: 'SK-PLC-MITSU', name: 'PLC Mitsubishi', slug: 'plc-mitsubishi', category: 'Automation', industry: 'Automation', aliases: ['GX Works', 'Mitsubishi PLC'] },
  { code: 'SK-PLC-OMRON', name: 'PLC Omron', slug: 'plc-omron', category: 'Automation', industry: 'Automation', aliases: ['Omron PLC'] },
  { code: 'SK-TIA', name: 'TIA Portal', slug: 'tia-portal', category: 'Software', industry: 'Automation', aliases: ['Totally Integrated Automation'] },
  { code: 'SK-SCADA', name: 'SCADA', slug: 'scada', category: 'Automation', industry: 'Automation', aliases: ['WinCC'] },
  { code: 'SK-HMI', name: 'HMI', slug: 'hmi', category: 'Automation', industry: 'Automation', aliases: ['Human Machine Interface'] },
  { code: 'SK-ROBOT-ABB', name: 'Robot ABB', slug: 'robot-abb', category: 'Robotics', industry: 'Automation', aliases: ['ABB Robot', 'RobotStudio'] },
  { code: 'SK-ROBOT-FANUC', name: 'Robot Fanuc', slug: 'robot-fanuc', category: 'Robotics', industry: 'Automation', aliases: ['Fanuc'] },
  { code: 'SK-HVAC', name: 'HVAC System', slug: 'hvac-system', category: 'HVAC', industry: 'HVAC', aliases: ['Chiller', 'AHU', 'FCU', 'VRV'] },
  { code: 'SK-AUTOCAD', name: 'AutoCAD', slug: 'autocad', category: 'Software', industry: 'Engineering', aliases: ['CAD'] },
  { code: 'SK-SOLIDWORKS', name: 'SolidWorks', slug: 'solidworks', category: 'Software', industry: 'Engineering', aliases: [] },
  { code: 'SK-EPLAN', name: 'EPLAN', slug: 'eplan', category: 'Software', industry: 'Automation', aliases: [] },
  { code: 'SK-SAP', name: 'SAP', slug: 'sap', category: 'ERP', industry: 'Manufacturing', aliases: ['ERP'] },
  { code: 'SK-LEAN', name: 'Lean Manufacturing', slug: 'lean-manufacturing', category: 'Process', industry: 'Manufacturing', aliases: ['Kaizen', '5S', 'Six Sigma', 'TPM'] },
  { code: 'SK-SALES', name: 'Kinh doanh kỹ thuật', slug: 'technical-sales', category: 'Kinh doanh', industry: 'Kinh doanh', aliases: ['Sales Engineer', 'Kỹ sư kinh doanh', 'Technical Sales'] },
  { code: 'SK-QA', name: 'Quality Assurance', slug: 'quality-assurance', category: 'Quality', industry: 'Manufacturing', aliases: ['QA', 'QC'] },
];

/** Tin demo — dùng đúng taxonomy INDUSTRY_GROUPS / LOCATIONS / ExperienceBand / JobLevelCode. */
const DEMO_JOBS: {
  code: string;
  title: string;
  industry: string;
  department: string;
  jobLevel: string;
  location: string;
  experienceBand: string;
  salaryMin: number;
  salaryMax: number;
  skills: string[];
  hoursAgo: number;
}[] = [
  {
    code: 'JOB-DEMO-001',
    title: 'Kỹ sư kinh doanh – Máy nén khí & thiết bị công nghiệp',
    industry: 'Máy móc & Thiết bị công nghiệp',
    department: 'Kinh doanh',
    jobLevel: 'sales.staff',
    location: 'Hà Nội',
    experienceBand: '1_3',
    salaryMin: 12_000_000,
    salaryMax: 20_000_000,
    skills: ['Kinh doanh kỹ thuật', 'Kinh doanh B2B', 'Tìm kiếm khách hàng'],
    hoursAgo: 2,
  },
  {
    code: 'JOB-DEMO-002',
    title: 'Kỹ sư PLC / Tự động hóa',
    industry: 'Tự động hóa & Điều khiển',
    department: 'Kỹ thuật',
    jobLevel: 'technical.staff',
    location: 'KCN Bắc Ninh',
    experienceBand: '1_3',
    salaryMin: 15_000_000,
    salaryMax: 25_000_000,
    skills: ['PLC Siemens', 'TIA Portal', 'SCADA'],
    hoursAgo: 5,
  },
  {
    code: 'JOB-DEMO-003',
    title: 'Trưởng nhóm Kinh doanh kỹ thuật – Vật tư MRO',
    industry: 'Thiết bị & Vật tư MRO',
    department: 'Kinh doanh',
    jobLevel: 'sales.team_lead',
    location: 'TP. Hồ Chí Minh',
    experienceBand: '3_5',
    salaryMin: 20_000_000,
    salaryMax: 32_000_000,
    skills: ['Kinh doanh kỹ thuật', 'Quản lý đội nhóm', 'Đàm phán'],
    hoursAgo: 12,
  },
  {
    code: 'JOB-DEMO-004',
    title: 'Kỹ sư cơ khí thiết kế / CNC',
    industry: 'Cơ khí & Chế tạo máy',
    department: 'Kỹ thuật',
    jobLevel: 'technical.staff',
    location: 'KCN Đồng Nai',
    experienceBand: '1_3',
    salaryMin: 14_000_000,
    salaryMax: 22_000_000,
    skills: ['SolidWorks', 'AutoCAD', 'Thiết kế cơ khí'],
    hoursAgo: 20,
  },
  {
    code: 'JOB-DEMO-005',
    title: 'Nhân viên QA/QC nhà máy',
    industry: 'Nhà máy & Sản xuất công nghiệp',
    department: 'QA / QC',
    jobLevel: 'technical.staff',
    location: 'KCN Bình Dương',
    experienceBand: 'under_1',
    salaryMin: 10_000_000,
    salaryMax: 16_000_000,
    skills: ['Quality Assurance', 'ISO', 'Kiểm tra chất lượng'],
    hoursAgo: 30,
  },
  {
    code: 'JOB-DEMO-006',
    title: 'HVAC Engineer – Chiller & phòng sạch',
    industry: 'HVAC & Cơ điện M&E',
    department: 'Kỹ thuật',
    jobLevel: 'technical.dept_head',
    location: 'KCN Hải Phòng',
    experienceBand: '5_plus',
    salaryMin: 30_000_000,
    salaryMax: 48_000_000,
    skills: ['HVAC System', 'EPLAN', 'Quản lý dự án'],
    hoursAgo: 48,
  },
  {
    code: 'JOB-DEMO-007',
    title: 'Kỹ sư bảo trì / Utility nhà máy',
    industry: 'Nhà máy & Sản xuất công nghiệp',
    department: 'Bảo trì',
    jobLevel: 'technical.team_lead',
    location: 'KCN Long An',
    experienceBand: '3_5',
    salaryMin: 18_000_000,
    salaryMax: 28_000_000,
    skills: ['Lean Manufacturing', 'SAP', 'Cải tiến liên tục'],
    hoursAgo: 72,
  },
  {
    code: 'JOB-DEMO-008',
    title: 'Kỹ sư kinh doanh – Điện & năng lượng công nghiệp',
    industry: 'Điện & Năng lượng công nghiệp',
    department: 'Kinh doanh',
    jobLevel: 'sales.staff',
    location: 'Đà Nẵng',
    experienceBand: '1_3',
    salaryMin: 12_000_000,
    salaryMax: 18_000_000,
    skills: ['Kinh doanh kỹ thuật', 'HMI', 'Điện tử'],
    hoursAgo: 8,
  },
  {
    code: 'JOB-DEMO-009',
    title: 'Kỹ sư kinh doanh – Xe nâng & thiết bị kho',
    industry: 'Logistics & Thiết bị kho vận',
    department: 'Kinh doanh',
    jobLevel: 'sales.staff',
    location: 'TP. Hồ Chí Minh',
    experienceBand: 'none',
    salaryMin: 8_000_000,
    salaryMax: 12_000_000,
    skills: ['Kho vận', 'Xuất nhập khẩu', 'SAP'],
    hoursAgo: 16,
  },
  {
    code: 'JOB-DEMO-010',
    title: 'Project Engineer – Nhà thầu Automation / EPC',
    industry: 'Nhà thầu công nghiệp & EPC',
    department: 'Kỹ thuật',
    jobLevel: 'technical.team_lead',
    location: 'KCN Bắc Ninh',
    experienceBand: '3_5',
    salaryMin: 22_000_000,
    salaryMax: 35_000_000,
    skills: ['Robot ABB', 'Robot Fanuc', 'PLC Siemens'],
    hoursAgo: 4,
  },
  {
    code: 'JOB-DEMO-011',
    title: 'Application Engineer – Thủy lực & khí nén',
    industry: 'Thủy lực & Khí nén',
    department: 'Kỹ thuật',
    jobLevel: 'technical.staff',
    location: 'Hà Nội',
    experienceBand: '1_3',
    salaryMin: 14_000_000,
    salaryMax: 22_000_000,
    skills: ['Kinh doanh kỹ thuật', 'PLC Siemens', 'AutoCAD'],
    hoursAgo: 10,
  },
  {
    code: 'JOB-DEMO-012',
    title: 'Kinh doanh kỹ thuật – Dầu nhớt công nghiệp',
    industry: 'Dầu mỡ nhờn & Hóa chất công nghiệp',
    department: 'Kinh doanh',
    jobLevel: 'sales.staff',
    location: 'TP. Hồ Chí Minh',
    experienceBand: '1_3',
    salaryMin: 12_000_000,
    salaryMax: 20_000_000,
    skills: ['Kinh doanh kỹ thuật', 'Kinh doanh B2B'],
    hoursAgo: 18,
  },
  {
    code: 'JOB-DEMO-013',
    title: 'Kỹ sư kinh doanh – Thiết bị đo lường',
    industry: 'Đo lường & Thiết bị công nghiệp',
    department: 'Kinh doanh',
    jobLevel: 'sales.staff',
    location: 'Hà Nội',
    experienceBand: '1_3',
    salaryMin: 13_000_000,
    salaryMax: 21_000_000,
    skills: ['Kinh doanh kỹ thuật', 'HMI', 'SCADA'],
    hoursAgo: 6,
  },
];

/** Chuẩn hoá ngành cũ → taxonomy mới trên Job / Company / CandidateProfile. */
const INDUSTRY_LEGACY_UPDATES: Array<{ from: string; to: string }> = [
  { from: 'Cơ điện / M&E', to: 'HVAC & Cơ điện M&E' },
  { from: 'Tự động hoá / Automation', to: 'Tự động hóa & Điều khiển' },
  { from: 'Tự động hóa / Automation', to: 'Tự động hóa & Điều khiển' },
  { from: 'Sản xuất / Manufacturing', to: 'Nhà máy & Sản xuất công nghiệp' },
  { from: 'Điện tử / Electronics', to: 'Nhà máy & Sản xuất công nghiệp' },
  { from: 'Cơ khí / Mechanical', to: 'Cơ khí & Chế tạo máy' },
  { from: 'Logistics / Kho vận', to: 'Logistics & Thiết bị kho vận' },
  { from: 'QA / QC', to: 'Nhà máy & Sản xuất công nghiệp' },
  { from: 'Kinh doanh B2B', to: 'Máy móc & Thiết bị công nghiệp' },
  { from: 'Automation', to: 'Tự động hóa & Điều khiển' },
];

async function migrateLegacyIndustries(): Promise<void> {
  let updated = 0;
  for (const { from, to } of INDUSTRY_LEGACY_UPDATES) {
    const jobs = await prisma.job.updateMany({ where: { industry: from }, data: { industry: to } });
    const companies = await prisma.company.updateMany({
      where: { industry: from },
      data: { industry: to },
    });
    const profiles = await prisma.candidateProfile.updateMany({
      where: { industry: from },
      data: { industry: to },
    });
    updated += jobs.count + companies.count + profiles.count;
  }
  if (updated > 0) {
    console.log(`Đã chuẩn hoá ${updated} bản ghi ngành nghề legacy → taxonomy mới.`);
  }
}

async function seedSkills(): Promise<void> {
  for (const skill of SKILLS) {
    await prisma.skill.upsert({
      where: { code: skill.code },
      create: {
        code: skill.code,
        name: skill.name,
        slug: skill.slug,
        category: skill.category,
        industry: skill.industry,
        aliases: skill.aliases,
      },
      update: {
        name: skill.name,
        category: skill.category,
        industry: skill.industry,
        aliases: skill.aliases,
      },
    });
  }
  console.log(`Đã seed ${SKILLS.length} kỹ năng vào Taxonomy.`);
}

async function seedDemoJobs(): Promise<void> {
  const brandProfile = {
    logoUrl: null,
    bannerUrl:
      'https://images.unsplash.com/photo-1565043666747-69f6646db940?auto=format&fit=crop&w=1600&q=80',
    bannerCaption: 'Giải pháp tự động hóa cho tương lai công nghiệp',
    internationalName: 'ABC Automation',
    email: 'hr@abc-automation.vn',
    phone: '024 1234 5678',
    foundedYear: 2012,
    verified: true,
    trustedEmployer: true,
    facebookUrl: 'https://facebook.com',
    linkedinUrl: 'https://linkedin.com',
    youtubeUrl: 'https://youtube.com',
    coreActivities: [
      'Tự động hóa công nghiệp',
      'Robot & tích hợp hệ thống',
      'SCADA / MES',
      'Cơ điện M&E',
      'Bảo trì thiết bị',
    ],
    whyChooseUs: [
      'Môi trường chuyên nghiệp, đúng ngành công nghiệp',
      'Lộ trình thăng tiến rõ ràng theo kỹ thuật / kinh doanh',
      'Đào tạo chuyên sâu PLC, Robot, HVAC',
      'Phúc lợi cạnh tranh, hỗ trợ đi lại KCN',
    ],
    benefits: [
      'Bảo hiểm sức khỏe',
      'Thưởng hiệu suất quý / năm',
      'Đào tạo nội bộ & chứng chỉ',
      'Team building định kỳ',
      'Hỗ trợ nhà ở / đi lại KCN',
    ],
    stats: {
      yearsActive: 12,
      employees: 320,
      customers: 180,
      projects: 450,
      locations: 8,
    },
    cultureGallery: [
      {
        url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80',
        title: 'Team building 2025',
        caption: 'Gắn kết đội ngũ kỹ thuật & kinh doanh',
      },
      {
        url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
        title: 'Year-end party',
        caption: 'Tổng kết năm – vinh danh xuất sắc',
      },
      {
        url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80',
        title: 'Đào tạo kỹ thuật',
        caption: 'Workshop PLC & Robot trên hiện trường',
      },
      {
        url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800&q=80',
        title: 'Văn phòng mở',
        caption: 'Không gian làm việc sáng tạo',
      },
    ],
    awards: [
      { name: 'ISO 9001' },
      { name: 'Top 10 NTD công nghiệp' },
      { name: 'Great Place to Work' },
    ],
    reviews: [
      {
        name: 'Nguyễn Minh Anh',
        role: 'Kỹ sư tự động hóa',
        rating: 5,
        comment:
          'Môi trường học hỏi nhanh, dự án thực tế với nhà máy FDI. Mentor hỗ trợ tốt khi mới vào.',
        postedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      },
      {
        name: 'Trần Quốc Bảo',
        role: 'Kỹ sư kinh doanh',
        rating: 4,
        comment:
          'Làm việc với khách B2B công nghiệp rõ ràng. KPI minh bạch, thưởng đúng cam kết.',
        postedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
      },
      {
        name: 'Lê Thu Hà',
        role: 'Kỹ sư ứng dụng',
        rating: 5,
        comment: 'Văn hóa cởi mở, nhiều cơ hội đi hiện trường và đào tạo chứng chỉ.',
        postedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      },
    ],
    ratingAvg: 4.6,
    ratingCount: 24,
  };

  const company = await prisma.company.upsert({
    where: { code: 'COM-DEMO-001' },
    create: {
      code: 'COM-DEMO-001',
      tenantId: 'default',
      name: 'Công ty TNHH ABC',
      taxCode: '0101234567',
      industry: 'Tự động hóa & Điều khiển',
      size: 'large',
      address: 'KCN Bắc Ninh, Việt Nam',
      website: 'https://abc-automation.vn',
      description:
        'ABC Automation cung cấp giải pháp tự động hóa, robot và tích hợp hệ thống cho nhà máy công nghiệp tại Việt Nam. Chúng tôi đồng hành cùng khách hàng FDI và doanh nghiệp trong nước từ khảo sát, thiết kế đến vận hành.',
      status: 'active',
      profile: brandProfile,
    },
    update: {
      name: 'Công ty TNHH ABC',
      taxCode: '0101234567',
      industry: 'Tự động hóa & Điều khiển',
      size: 'large',
      address: 'KCN Bắc Ninh, Việt Nam',
      website: 'https://abc-automation.vn',
      description:
        'ABC Automation cung cấp giải pháp tự động hóa, robot và tích hợp hệ thống cho nhà máy công nghiệp tại Việt Nam. Chúng tôi đồng hành cùng khách hàng FDI và doanh nghiệp trong nước từ khảo sát, thiết kế đến vận hành.',
      profile: brandProfile,
    },
  });

  for (const demo of DEMO_JOBS) {
    const publishedAt = new Date(Date.now() - demo.hoursAgo * 60 * 60 * 1000);
    const description = [
      `Tuyển ${demo.title} tại ${demo.location}.`,
      'Công việc gắn với môi trường nhà máy / B2B công nghiệp.',
      'Ưu tiên ứng viên có kinh nghiệm thực tế và kỹ năng chuyên môn đúng ngành.',
    ].join(' ');

    const job = await prisma.job.upsert({
      where: { code: demo.code },
      create: {
        code: demo.code,
        tenantId: 'default',
        companyId: company.id,
        title: demo.title,
        description,
        requirements: `Kinh nghiệm: theo mô tả. Kỹ năng: ${demo.skills.join(', ')}.`,
        benefits: 'Lương cạnh tranh, thưởng hiệu suất, hỗ trợ đi lại KCN.',
        industry: demo.industry,
        department: demo.department,
        jobLevel: demo.jobLevel,
        employmentType: 'full_time',
        location: demo.location,
        headcount: 1,
        experienceBand: demo.experienceBand,
        salaryMin: demo.salaryMin,
        salaryMax: demo.salaryMax,
        status: 'published',
        publishedAt,
      },
      update: {
        title: demo.title,
        description,
        industry: demo.industry,
        department: demo.department,
        jobLevel: demo.jobLevel,
        location: demo.location,
        experienceBand: demo.experienceBand,
        salaryMin: demo.salaryMin,
        salaryMax: demo.salaryMax,
        status: 'published',
        publishedAt,
        isDeleted: false,
      },
    });

    await prisma.jobSkill.deleteMany({ where: { jobId: job.id } });
    for (const name of demo.skills) {
      const skill = await prisma.skill.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });
      await prisma.jobSkill.create({
        data: {
          jobId: job.id,
          skillId: skill?.id ?? null,
          name,
          required: true,
          weight: 1,
        },
      });
    }
  }

  console.log(`Đã seed ${DEMO_JOBS.length} tin tuyển dụng demo cho ${company.name}.`);
}

/** Bổ sung tiêu chí Sales B2B vào hồ sơ ứng viên hiện có (để lọc / matching demo). */
async function seedCandidateSalesProfiles(): Promise<void> {
  const demos = [
    {
      productsSold: ['Máy nén khí', 'Máy phát điện', 'Vòng bi / Vật tư bảo trì (MRO)'],
      customerSegments: ['Nhà máy FDI', 'Nhà máy Việt Nam'],
      b2bExperienceBand: '3_5',
      marketsCovered: ['Hà Nội', 'Bắc Ninh / Bắc Giang', 'Miền Bắc'],
      industriesExperienced: ['Máy móc & Thiết bị công nghiệp', 'Thiết bị & Vật tư MRO'],
      industry: 'Máy móc & Thiết bị công nghiệp',
      customerDevStyle: 'hybrid',
      dealType: 'solution',
      sellingStages: ['Tìm khách tiềm năng', 'Tư vấn kỹ thuật', 'Báo giá', 'Đàm phán', 'Chốt đơn'],
      jobReadiness: 'open',
      languages: ['Tiếng Anh giao tiếp'],
      hasB2License: true,
      willingToTravel: true,
      kpiAchievementPct: 110,
      latestRevenue: 8_000_000_000,
      newCustomerRatioPct: 40,
    },
    {
      productsSold: ['PLC / Tự động hóa', 'SCADA / HMI', 'Robot công nghiệp'],
      customerSegments: ['Nhà máy FDI', 'Nhà thầu cơ điện / EPC'],
      b2bExperienceBand: '5_10',
      marketsCovered: ['KCN toàn quốc', 'Khách hàng FDI'],
      industriesExperienced: ['Tự động hóa & Điều khiển'],
      industry: 'Tự động hóa & Điều khiển',
      customerDevStyle: 'hunter',
      dealType: 'project',
      sellingStages: [
        'Tìm khách tiềm năng',
        'Khảo sát hiện trường',
        'Tư vấn kỹ thuật',
        'Xây dựng giải pháp',
        'Báo giá',
        'Đàm phán',
        'Chốt đơn',
      ],
      jobReadiness: 'active',
      languages: ['Tiếng Anh thương mại'],
      hasB2License: true,
      willingToTravel: true,
      kpiAchievementPct: 95,
      latestRevenue: 12_000_000_000,
      newCustomerRatioPct: 65,
    },
    {
      productsSold: ['Chiller / Điều hòa công nghiệp', 'Tháp giải nhiệt'],
      customerSegments: ['Nhà thầu cơ điện / EPC', 'Nhà sản xuất OEM'],
      b2bExperienceBand: '1_3',
      marketsCovered: ['TP. Hồ Chí Minh', 'Đồng Nai / Bình Dương', 'Miền Nam'],
      industriesExperienced: ['HVAC & Cơ điện M&E'],
      industry: 'HVAC & Cơ điện M&E',
      customerDevStyle: 'farmer',
      dealType: 'standard',
      sellingStages: ['Tư vấn kỹ thuật', 'Báo giá', 'Chốt đơn', 'Thu hồi công nợ'],
      jobReadiness: 'open',
      languages: ['Tiếng Anh giao tiếp'],
      hasB2License: false,
      willingToTravel: true,
      kpiAchievementPct: 88,
      latestRevenue: 3_500_000_000,
      newCustomerRatioPct: 20,
    },
  ];

  const candidates = await prisma.candidate.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: 'desc' },
    take: demos.length,
    include: { profile: true },
  });

  let updated = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    const demo = demos[i % demos.length];
    await prisma.candidateProfile.upsert({
      where: { candidateId: c.id },
      create: {
        candidateId: c.id,
        currentPosition: c.profile?.currentPosition ?? 'Kỹ sư kinh doanh',
        industry: demo.industry,
        industriesExperienced: demo.industriesExperienced,
        productsSold: demo.productsSold,
        customerSegments: demo.customerSegments,
        b2bExperienceBand: demo.b2bExperienceBand,
        marketsCovered: demo.marketsCovered,
        customerDevStyle: demo.customerDevStyle,
        dealType: demo.dealType,
        sellingStages: demo.sellingStages,
        jobReadiness: demo.jobReadiness,
        languages: demo.languages,
        hasB2License: demo.hasB2License,
        willingToTravel: demo.willingToTravel,
        kpiAchievementPct: demo.kpiAchievementPct,
        latestRevenue: demo.latestRevenue,
        newCustomerRatioPct: demo.newCustomerRatioPct,
        salesHighlights: 'Đạt/ vượt KPI, phát triển khách nhà máy FDI.',
        totalExperienceYears:
          demo.b2bExperienceBand === '5_10' ? 7 : demo.b2bExperienceBand === '3_5' ? 4 : 2,
      },
      update: {
        industry: demo.industry,
        industriesExperienced: demo.industriesExperienced,
        productsSold: demo.productsSold,
        customerSegments: demo.customerSegments,
        b2bExperienceBand: demo.b2bExperienceBand,
        marketsCovered: demo.marketsCovered,
        customerDevStyle: demo.customerDevStyle,
        dealType: demo.dealType,
        sellingStages: demo.sellingStages,
        jobReadiness: demo.jobReadiness,
        languages: demo.languages,
        hasB2License: demo.hasB2License,
        willingToTravel: demo.willingToTravel,
        kpiAchievementPct: demo.kpiAchievementPct,
        latestRevenue: demo.latestRevenue,
        newCustomerRatioPct: demo.newCustomerRatioPct,
        salesHighlights: 'Đạt/ vượt KPI, phát triển khách nhà máy FDI.',
      },
    });
    updated += 1;
  }
  console.log(`Đã seed hồ sơ Sales B2B cho ${updated} ứng viên.`);
}

/**
 * Seed tiến trình ứng tuyển demo cho ứng viên đầu tiên trong DB
 * (interview / offer / onboarding) — dữ liệu thật trong PostgreSQL, không hardcode UI.
 */
async function seedDemoProgress(): Promise<void> {
  const candidates = await prisma.candidate.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  if (candidates.length === 0) {
    console.log('Bỏ qua seed tiến trình: chưa có ứng viên nào trong DB.');
    return;
  }

  const jobs = await prisma.job.findMany({
    where: {
      code: { in: DEMO_JOBS.slice(0, 6).map((j) => j.code) },
      isDeleted: false,
    },
    include: { company: { select: { name: true } } },
  });
  if (jobs.length < 4) {
    console.log('Bỏ qua seed tiến trình: chưa đủ tin demo.');
    return;
  }

  const jobByCode = new Map(jobs.map((j) => [j.code, j]));

  for (const candidate of candidates) {
    await seedProgressForCandidate(candidate, jobByCode);
  }
}

async function seedProgressForCandidate(
  candidate: { id: string; code: string; tenantId: string; displayName: string },
  jobByCode: Map<
    string,
    {
      id: string;
      code: string;
      location: string | null;
      salaryMin: number | null;
    }
  >,
): Promise<void> {
  const suffix = candidate.code.replace(/[^a-zA-Z0-9]/g, '').slice(-6) || 'X';
  const scenarios: {
    key: string;
    jobCode: string;
    status: string;
    daysAgo: number;
    interview?: boolean;
    offer?: boolean;
    rejected?: boolean;
  }[] = [
    { key: '01', jobCode: 'JOB-DEMO-002', status: 'interview', daysAgo: 12, interview: true },
    { key: '02', jobCode: 'JOB-DEMO-001', status: 'screening', daysAgo: 8 },
    { key: '03', jobCode: 'JOB-DEMO-003', status: 'offer', daysAgo: 20, interview: true, offer: true },
    { key: '04', jobCode: 'JOB-DEMO-004', status: 'applied', daysAgo: 3 },
    { key: '05', jobCode: 'JOB-DEMO-005', status: 'rejected', daysAgo: 25, rejected: true },
    { key: '06', jobCode: 'JOB-DEMO-006', status: 'interview', daysAgo: 15, interview: true },
  ];

  let created = 0;
  let offerAppId: string | null = null;

  for (const sc of scenarios) {
    const job = jobByCode.get(sc.jobCode);
    if (!job) continue;

    const appCode = `APP-D-${suffix}-${sc.key}`;
    const createdAt = new Date(Date.now() - sc.daysAgo * 24 * 60 * 60 * 1000);
    const byCode = await prisma.application.findUnique({ where: { code: appCode } });
    const byPair = await prisma.application.findUnique({
      where: { jobId_candidateId: { jobId: job.id, candidateId: candidate.id } },
    });
    let application = byCode;
    if (!application && byPair && byPair.code !== appCode) {
      continue;
    }
    if (application) {
      application = await prisma.application.update({
        where: { id: application.id },
        data: {
          status: sc.status,
          isDeleted: false,
          jobId: job.id,
          candidateId: candidate.id,
          matchScore: 72 + (created % 20),
        },
      });
    } else if (byPair) {
      application = byPair;
    } else {
      application = await prisma.application.create({
        data: {
          code: appCode,
          tenantId: candidate.tenantId,
          jobId: job.id,
          candidateId: candidate.id,
          status: sc.status,
          matchScore: 72 + (created % 20),
          createdAt,
        },
      });
    }
    created += 1;
    if (sc.offer) offerAppId = application.id;

    await prisma.applicationTimeline.deleteMany({ where: { applicationId: application.id } });
    const timeline: { type: string; title: string; hoursAfter: number }[] = [
      { type: 'status_change', title: 'Đã ứng tuyển', hoursAfter: 0 },
    ];
    if (sc.status !== 'applied') {
      timeline.push({ type: 'status_change', title: 'Sàng lọc hồ sơ', hoursAfter: 24 });
    }
    if (['interview', 'offer', 'hired'].includes(sc.status) || sc.interview) {
      timeline.push({ type: 'status_change', title: 'Phỏng vấn', hoursAfter: 72 });
    }
    if (sc.status === 'offer' || sc.offer) {
      timeline.push({ type: 'status_change', title: 'Đề nghị làm việc', hoursAfter: 120 });
    }
    if (sc.rejected) {
      timeline.push({ type: 'status_change', title: 'Đã từ chối', hoursAfter: 96 });
    }
    for (const t of timeline) {
      await prisma.applicationTimeline.create({
        data: {
          applicationId: application.id,
          tenantId: candidate.tenantId,
          type: t.type,
          title: t.title,
          occurredAt: new Date(createdAt.getTime() + t.hoursAfter * 60 * 60 * 1000),
        },
      });
    }

    if (sc.interview) {
      const intCode = `INT-${appCode}`;
      const scheduledAt = new Date(Date.now() + (created === 1 ? 2 : 5) * 24 * 60 * 60 * 1000);
      scheduledAt.setHours(9 + created, 30, 0, 0);
      await prisma.interview.upsert({
        where: { code: intCode },
        create: {
          code: intCode,
          tenantId: candidate.tenantId,
          applicationId: application.id,
          jobId: job.id,
          candidateId: candidate.id,
          type: created % 2 === 0 ? 'technical' : 'hr',
          status: 'scheduled',
          scheduledAt,
          durationMinutes: 60,
          meetingLink: created % 2 === 0 ? 'https://meet.google.com/demo-ilv' : null,
          location: created % 2 === 0 ? null : job.location,
          interviewerName:
            created % 2 === 0 ? 'Trưởng phòng Kỹ thuật' : 'Chuyên viên Nhân sự',
        },
        update: {
          status: 'scheduled',
          scheduledAt,
          isDeleted: false,
          applicationId: application.id,
        },
      });
    }

    if (sc.offer) {
      const ofrCode = `OFR-${appCode}`;
      await prisma.offer.upsert({
        where: { code: ofrCode },
        create: {
          code: ofrCode,
          tenantId: candidate.tenantId,
          applicationId: application.id,
          jobId: job.id,
          candidateId: candidate.id,
          status: 'pending',
          salary: job.salaryMin ?? 18_000_000,
          currency: 'VND',
          startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          benefits: 'Thưởng hiệu suất, BHXH đầy đủ, hỗ trợ đi lại KCN.',
        },
        update: {
          status: 'pending',
          salary: job.salaryMin ?? 18_000_000,
          isDeleted: false,
          applicationId: application.id,
        },
      });
    }
  }

  if (offerAppId) {
    const job = jobByCode.get('JOB-DEMO-003');
    if (job) {
      const onbCode = `ONB-${suffix}-03`;
      await prisma.onboarding.upsert({
        where: { code: onbCode },
        create: {
          code: onbCode,
          tenantId: candidate.tenantId,
          applicationId: offerAppId,
          jobId: job.id,
          candidateId: candidate.id,
          status: 'pending',
          startDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
          reportLocation: job.location,
          contactName: 'Phòng Nhân sự',
          checklist: [
            'Ký hợp đồng lao động',
            'Nộp hồ sơ nhân sự',
            'Khám sức khỏe',
            'Nhận việc',
          ].join('\n'),
        },
        update: {
          status: 'pending',
          isDeleted: false,
          applicationId: offerAppId,
        },
      });
    }
  }

  console.log(
    `Đã seed tiến trình demo (${created} đơn) cho ứng viên ${candidate.displayName} (${candidate.code}).`,
  );
}

async function main(): Promise<void> {
  await migrateLegacyIndustries();
  await seedSkills();
  await seedDemoJobs();
  await seedCandidateSalesProfiles();
  await seedDemoProgress();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });

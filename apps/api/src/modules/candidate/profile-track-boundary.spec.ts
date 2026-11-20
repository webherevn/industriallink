import { sanitizeProfileForTrack } from './profile-track-boundary';
import { sanitizeDesiredPositions } from './profile-track-sanitize';

/**
 * Vòng lặp kiểm tra ranh giới phân tách dữ liệu giữa 2 nhánh lĩnh vực.
 *
 * SALES (3 vị trí KD + mục 13–32) → TECHNICAL (3 vị trí KT + mục 13–28) →
 * SALES: xác nhận mục 13–32 của SALES đã sạch trong "DB" và không bị kẹt
 * giới hạn 3/3 khi đổi ngược lại.
 */

/** Mô phỏng hồ sơ trong DB (chỉ giữ field của 1 nhánh sau khi sanitize). */
type StoredProfile = Record<string, unknown>;

function saveAs(
  db: StoredProfile,
  input: {
    jobTrack: 'sales' | 'technical';
    desiredPositions: string[];
    salesFields?: Record<string, unknown>;
    technicalFields?: Record<string, unknown>;
    sharedFields?: Record<string, unknown>;
  },
): StoredProfile {
  const merged = {
    // Mục 1–12 — dùng chung, KHÔNG bao giờ reset.
    currentPosition: 'Kỹ sư điện công nghiệp',
    phone: '0901234567',
    currentCity: 'Hà Nội',
    educationSchool: 'ĐH Bách Khoa',
    ...(input.sharedFields ?? {}),
    jobTrack: input.jobTrack,
    desiredPositions: input.desiredPositions,
    ...(input.salesFields ?? {}),
    ...(input.technicalFields ?? {}),
  };

  const sanitized = sanitizeProfileForTrack(merged, input.jobTrack);
  // Ghi đè đè lên bản ghi đang lưu (mô phỏng `update: profile` của Prisma).
  for (const key of Object.keys(db)) delete db[key];
  Object.assign(db, sanitized);
  return db;
}

describe('sanitizeProfileForTrack — ranh giới lĩnh vực', () => {
  it('lưu SALES: giữ mục 1–12 + mục 13–32, xóa sạch field kỹ thuật', () => {
    const db: StoredProfile = {};

    saveAs(db, {
      jobTrack: 'sales',
      desiredPositions: [
        'Nhân viên kinh doanh',
        'Chăm sóc khách hàng',
        'Trưởng nhóm kinh doanh',
      ],
      salesFields: {
        b2bExperienceBand: '3_5',
        marketsCovered: ['Miền Bắc'],
        sellingStages: ['prospecting'],
        latestRevenue: 500000000,
        kpiAchievementPct: 110,
        dealType: 'new',
        hasB2License: true,
      },
      technicalFields: {
        brandsTechnologies: ['Siemens'],
        technicalWorkTypes: ['Bảo trì'],
        technicalTools: ['AutoCAD'],
        documentLiteracy: ['Bản vẽ cơ khí'],
        systemScaleNote: 'Dây chuyền 2000 tấn/h',
        shiftFlexibility: 'flexible',
        desiredWorkEnvironments: ['Nhà máy / xưởng'],
      },
    });

    // Mục 1–12 giữ nguyên (currentPosition cập nhật theo vị trí đầu tiên của nhánh).
    expect(db.currentPosition).toBe('Nhân viên kinh doanh');
    expect(db.phone).toBe('0901234567');
    expect(db.currentCity).toBe('Hà Nội');
    expect(db.educationSchool).toBe('ĐH Bách Khoa');

    // Mục 13–32 của SALES được giữ.
    expect(db.b2bExperienceBand).toBe('3_5');
    expect(db.marketsCovered).toEqual(['Miền Bắc']);
    expect(db.sellingStages).toEqual(['prospecting']);
    expect(db.latestRevenue).toBe(500000000);
    expect(db.hasB2License).toBe(true);

    // Mục 13–28 của TECHNICAL phải SẠCH.
    expect(db.brandsTechnologies).toEqual([]);
    expect(db.technicalWorkTypes).toEqual([]);
    expect(db.technicalTools).toEqual([]);
    expect(db.documentLiteracy).toEqual([]);
    expect(db.systemScaleNote).toBeNull();
    expect(db.shiftFlexibility).toBeNull();
    expect(db.desiredWorkEnvironments).toEqual([]);
    expect(db.technicalAutonomyLevel).toBeNull();
  });

  it('lưu TECHNICAL: giữ mục 1–12 + mục 13–28, xóa sạch field kinh doanh', () => {
    const db: StoredProfile = {};

    saveAs(db, {
      jobTrack: 'technical',
      desiredPositions: ['Kỹ sư điện / Điện công nghiệp', 'Kỹ sư tự động hóa / Điều khiển'],
      salesFields: {
        b2bExperienceBand: '3_5',
        marketsCovered: ['Miền Bắc'],
        sellingStages: ['prospecting'],
        latestRevenue: 500000000,
        kpiAchievementPct: 110,
        dealType: 'new',
        hasB2License: true,
      },
      technicalFields: {
        brandsTechnologies: ['Siemens'],
        technicalWorkTypes: ['Bảo trì'],
        technicalTools: ['AutoCAD'],
        documentLiteracy: ['Bản vẽ cơ khí'],
        systemScaleNote: 'Dây chuyền 2000 tấn/h',
        shiftFlexibility: 'flexible',
        desiredWorkEnvironments: ['Nhà máy / xưởng'],
        technicalAutonomyLevel: 4,
        troubleshootingLevel: 3,
      },
    });

    // Mục 1–12 giữ nguyên (không reset khi đổi lĩnh vực).
    expect(db.currentPosition).toBe('Kỹ sư điện / Điện công nghiệp');
    expect(db.phone).toBe('0901234567');
    expect(db.currentCity).toBe('Hà Nội');

    // Mục 13–28 của TECHNICAL được giữ.
    expect(db.brandsTechnologies).toEqual(['Siemens']);
    expect(db.technicalWorkTypes).toEqual(['Bảo trì']);
    expect(db.technicalTools).toEqual(['AutoCAD']);
    expect(db.systemScaleNote).toBe('Dây chuyền 2000 tấn/h');
    expect(db.technicalAutonomyLevel).toBe(4);

    // Mục 13–32 của SALES phải SẠCH.
    expect(db.b2bExperienceBand).toBeNull();
    expect(db.marketsCovered).toEqual([]);
    expect(db.sellingStages).toEqual([]);
    expect(db.latestRevenue).toBeNull();
    expect(db.kpiAchievementPct).toBeNull();
    expect(db.dealType).toBeNull();
    expect(db.hasB2License).toBeNull();
  });

  it('vòng lặp SALES → TECHNICAL → SALES: mục 13–32 sạch và không kẹt giới hạn 3/3', () => {
    const db: StoredProfile = {};

    // --- Lần 1: lưu SALES với 3 vị trí kinh doanh + dữ liệu KD.
    saveAs(db, {
      jobTrack: 'sales',
      desiredPositions: [
        'Nhân viên kinh doanh',
        'Chăm sóc khách hàng',
        'Trưởng nhóm kinh doanh',
      ],
      salesFields: {
        b2bExperienceBand: '3_5',
        sellingStages: ['prospecting'],
        latestRevenue: 500000000,
      },
    });
    expect(db.desiredPositions).toHaveLength(3);
    expect(db.b2bExperienceBand).toBe('3_5');

    // --- Lần 2: đổi sang TECHNICAL, lưu 3 vị trí kỹ thuật + dữ liệu KT.
    saveAs(db, {
      jobTrack: 'technical',
      desiredPositions: [
        'Kỹ sư cơ khí',
        'Kỹ sư điện / Điện công nghiệp',
        'Kỹ sư tự động hóa / Điều khiển',
      ],
      technicalFields: {
        brandsTechnologies: ['Siemens'],
        technicalWorkTypes: ['Bảo trì'],
        technicalTools: ['AutoCAD'],
      },
    });
    expect(db.desiredPositions).toHaveLength(3);
    expect(db.desiredPositions).toEqual([
      'Kỹ sư cơ khí',
      'Kỹ sư điện / Điện công nghiệp',
      'Kỹ sư tự động hóa / Điều khiển',
    ]);
    // Mục 13–32 của SALES đã sạch trong DB.
    expect(db.b2bExperienceBand).toBeNull();
    expect(db.sellingStages).toEqual([]);
    expect(db.latestRevenue).toBeNull();

    // --- Lần 3: đổi ngược lại SALES — không bị kẹt giới hạn 3/3.
    saveAs(db, {
      jobTrack: 'sales',
      desiredPositions: ['Thực tập sinh kinh doanh'],
      salesFields: { b2bExperienceBand: '1_3' },
    });
    expect(db.desiredPositions).toEqual(['Thực tập sinh kinh doanh']);
    expect(db.desiredPositions).toHaveLength(1);
    // Mục 13–28 của TECHNICAL đã sạch trong DB.
    expect(db.brandsTechnologies).toEqual([]);
    expect(db.technicalWorkTypes).toEqual([]);
    expect(db.technicalTools).toEqual([]);
  });

  it('lọc giá trị của nhánh còn lại ở mục 13 trước khi kiểm tra giới hạn 3', () => {
    // 3 vị trí KD + 1 vị trí KT = 4 giá trị; khi lưu TECHNICAL phải còn đúng 3.
    const result = sanitizeDesiredPositions(
      [
        'Nhân viên kinh doanh',
        'Kỹ sư cơ khí',
        'Chăm sóc khách hàng',
        'Kỹ sư tự động hóa / Điều khiển',
      ],
      'technical',
    );
    expect(result).toEqual([
      'Kỹ sư cơ khí',
      'Kỹ sư tự động hóa / Điều khiển',
    ]);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('giới hạn tối đa 3 vị trí cho CẢ 2 nhánh', () => {
    expect(
      sanitizeDesiredPositions(
        [
          'Thực tập sinh kinh doanh',
          'Chăm sóc khách hàng',
          'Nhân viên kinh doanh',
          'Trưởng nhóm kinh doanh',
        ],
        'sales',
      ),
    ).toHaveLength(3);

    expect(
      sanitizeDesiredPositions(
        [
          'Thực tập sinh kỹ thuật',
          'Kỹ thuật viên',
          'Kỹ sư cơ khí',
          'Kỹ sư điện / Điện công nghiệp',
        ],
        'technical',
      ),
    ).toHaveLength(3);
  });

  it('loại bỏ giá trị trùng lặp', () => {
    expect(
      sanitizeDesiredPositions(
        ['Nhân viên kinh doanh', 'Nhân viên kinh doanh', 'Chăm sóc khách hàng'],
        'sales',
      ),
    ).toEqual(['Nhân viên kinh doanh', 'Chăm sóc khách hàng']);
  });

  it('currentPosition theo vị trí đầu tiên của nhánh đang lưu', () => {
    const db: StoredProfile = {};
    saveAs(db, {
      jobTrack: 'technical',
      desiredPositions: ['Kỹ sư thiết kế', 'Kỹ sư dự án'],
    });
    expect(db.currentPosition).toBe('Kỹ sư thiết kế');
  });

  // ==========================================================================
  // ⭐ ĐỒNG BỘ CHỨC DANH KHI ĐỔI LĨNH VỰC
  // Lỗi gốc: ứng viên đổi sang Kỹ thuật nhưng chưa khai báo vị trí thuộc nhánh
  // mới → `desiredPositions` rỗng → `currentPosition` cũ của nhánh Kinh doanh
  // vẫn còn ("Thực tập sinh kinh doanh") → NTD hiểu sai chuyên môn.
  // ==========================================================================
  it('⭐ đổi SALES → TECHNICAL mà chưa khai báo vị trí KT → xoá chức danh cũ của nhánh KD', () => {
    const db: StoredProfile = {};

    // Bước 1: ứng viên đang là Kinh doanh.
    saveAs(db, {
      jobTrack: 'sales',
      desiredPositions: ['Thực tập sinh kinh doanh'],
      sharedFields: { currentPosition: 'Thực tập sinh kinh doanh' },
    });
    expect(db.currentPosition).toBe('Thực tập sinh kinh doanh');

    // Bước 2: đổi sang Kỹ thuật nhưng chưa chọn vị trí KT nào.
    saveAs(db, {
      jobTrack: 'technical',
      desiredPositions: [],
      sharedFields: { currentPosition: 'Thực tập sinh kinh doanh' },
    });

    // Chức danh KD phải bị xoá (không hiển thị sai lĩnh vực).
    expect(db.currentPosition).toBeNull();
    expect(db.desiredPositions).toEqual([]);
  });

  it('⭐ đổi TECHNICAL → SALES mà chưa khai báo vị trí KD → xoá chức danh cũ của nhánh KT', () => {
    const db: StoredProfile = {};

    saveAs(db, {
      jobTrack: 'technical',
      desiredPositions: ['Kỹ sư cơ khí'],
      sharedFields: { currentPosition: 'Kỹ sư cơ khí' },
    });
    expect(db.currentPosition).toBe('Kỹ sư cơ khí');

    saveAs(db, {
      jobTrack: 'sales',
      desiredPositions: [],
      sharedFields: { currentPosition: 'Kỹ sư cơ khí' },
    });

    expect(db.currentPosition).toBeNull();
  });

  it('⭐ đổi lĩnh vực nhưng đã khai vị trí thuộc nhánh mới → chức danh lấy theo vị trí đầu tiên', () => {
    const db: StoredProfile = {};

    saveAs(db, {
      jobTrack: 'sales',
      desiredPositions: ['Thực tập sinh kinh doanh'],
      sharedFields: { currentPosition: 'Thực tập sinh kinh doanh' },
    });

    saveAs(db, {
      jobTrack: 'technical',
      desiredPositions: ['Kỹ sư điện / Điện công nghiệp', 'Kỹ thuật viên'],
      sharedFields: { currentPosition: 'Thực tập sinh kinh doanh' },
    });

    expect(db.currentPosition).toBe('Kỹ sư điện / Điện công nghiệp');
  });
});

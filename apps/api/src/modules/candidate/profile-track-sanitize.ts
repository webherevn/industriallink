import {
  MAX_DESIRED_POSITIONS,
  filterDesiredPositionsForTrack,
  normalizeProfileTrack,
  type ProfileTrack,
} from '@industriallink/contracts';

/** Field thuoc nhanh Kinh doanh (muc 13-32) — xoa sach khi luu sang nhanh Ky thuat. */
export const SALES_ONLY_FIELDS = [
  'b2bExperienceBand',
  'marketsCovered',
  'customerDevStyle',
  'dealType',
  'typicalDealValue',
  'maxDealValue',
  'sellingStages',
  'latestRevenue',
  'kpiAchievementPct',
  'newCustomerRatioPct',
  'expectedOte',
  'hasB2License',
  'driverLicenseType',
] as const;

/** Field thuoc nhanh Ky thuat (muc 13-28) — xoa sach khi luu sang nhanh Kinh doanh. */
export const TECHNICAL_ONLY_FIELDS = [
  'brandsTechnologies',
  'technicalWorkTypes',
  'technicalAutonomyLevel',
  'troubleshootingLevel',
  'technicalTools',
  'documentLiteracy',
  'systemScaleNote',
  'shiftFlexibility',
  'desiredWorkEnvironments',
] as const;

/**
 * Loai cua tung field dac thu — quyet dinh gia tri rong khi xoa sach:
 * array -> [], scalar -> null. Khop voi schema candidate.candidate_profile.
 */
export const FIELD_EMPTY_VALUE: Record<string, 'array' | 'scalar'> = {
  b2bExperienceBand: 'scalar',
  marketsCovered: 'array',
  customerDevStyle: 'scalar',
  dealType: 'scalar',
  typicalDealValue: 'scalar',
  maxDealValue: 'scalar',
  sellingStages: 'array',
  latestRevenue: 'scalar',
  kpiAchievementPct: 'scalar',
  newCustomerRatioPct: 'scalar',
  expectedOte: 'scalar',
  hasB2License: 'scalar',
  driverLicenseType: 'scalar',
  brandsTechnologies: 'array',
  technicalWorkTypes: 'array',
  technicalAutonomyLevel: 'scalar',
  troubleshootingLevel: 'scalar',
  technicalTools: 'array',
  documentLiteracy: 'array',
  systemScaleNote: 'scalar',
  shiftFlexibility: 'scalar',
  desiredWorkEnvironments: 'array',
};

/**
 * Loc `desiredPositions` theo nhanh active — bo gia tri lai tap giua 2 nhanh,
 * cat toi da 3. Luon chay TRUOC khi kiem tra gioi han length <= 3.
 */
export function sanitizeDesiredPositions(
  values: readonly string[] | null | undefined,
  track: ProfileTrack,
): string[] {
  return filterDesiredPositionsForTrack(values, track).slice(0, MAX_DESIRED_POSITIONS);
}

/** Chuan hoa `jobTrack` ve 'sales' | 'technical'. */
export function normalizeTrack(
  track: string | null | undefined,
): ProfileTrack {
  return normalizeProfileTrack(track);
}

/**
 * Tra ve danh sach field can xoa sach cho nhanh dang active.
 * Luu voi nhanh SALES -> xoa field ky thuat. Luu voi nhanh TECHNICAL -> xoa field KD.
 */
export function fieldsToClearForTrack(track: ProfileTrack): readonly string[] {
  return track === 'technical' ? SALES_ONLY_FIELDS : TECHNICAL_ONLY_FIELDS;
}

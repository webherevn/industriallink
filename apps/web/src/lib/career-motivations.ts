import {
  CAREER_MOTIVATIONS,
  TECHNICAL_CAREER_MOTIVATIONS,
} from '@industriallink/contracts';

export function catalogCareerMotivations(
  track: string | null | undefined,
): readonly string[] {
  return track === 'technical' ? TECHNICAL_CAREER_MOTIVATIONS : CAREER_MOTIVATIONS;
}

/** Chỉ giữ lựa chọn thuộc catalog hiện tại — bỏ dữ liệu cũ/track khác đang chiếm slot 3/3. */
export function filterCareerMotivations(
  values: string[] | undefined,
  track: string | null | undefined,
): string[] {
  const catalog = catalogCareerMotivations(track);
  return [...new Set(values ?? [])]
    .filter((v) => (catalog as readonly string[]).includes(v))
    .slice(0, 3);
}

import {
  CAREER_LADDERS,
  JobLevelCode,
  JobTrack,
  defaultDepartmentForTrack,
  departmentsForTrack,
  trackImpliedByDepartment,
} from '@industriallink/contracts';

function levelOnTrack(level: string, track: JobTrack): JobLevelCode {
  const ladder = CAREER_LADDERS[track];
  return ladder.includes(level as JobLevelCode) ? (level as JobLevelCode) : ladder[0];
}

/** Đổi phòng ban → đồng bộ lộ trình + cấp bậc. */
export function applyJobDepartmentChange(
  department: string,
  currentTrack: JobTrack,
  currentLevel: string,
): { department: string; jobTrack: JobTrack; jobLevel: JobLevelCode } {
  const implied = trackImpliedByDepartment(department);
  const jobTrack = implied ?? currentTrack;
  return {
    department,
    jobTrack,
    jobLevel: levelOnTrack(currentLevel, jobTrack),
  };
}

/** Đổi lộ trình → lọc phòng ban + cấp bậc cho khớp. */
export function applyJobTrackChange(
  jobTrack: JobTrack,
  currentDepartment: string,
  currentLevel: string,
): { department: string; jobTrack: JobTrack; jobLevel: JobLevelCode } {
  const allowed = departmentsForTrack(jobTrack);
  const department = allowed.includes(currentDepartment)
    ? currentDepartment
    : defaultDepartmentForTrack(jobTrack);
  return {
    department,
    jobTrack,
    jobLevel: levelOnTrack(currentLevel, jobTrack),
  };
}

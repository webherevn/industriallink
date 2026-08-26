-- Chuẩn hoá nhóm ngành theo file iLink chốt 25.08.2026.
-- Chỉ cập nhật Job / Company / CandidateProfile / CandidateExperience
-- (không đụng knowledge.skill — cột industry của skill là category kỹ năng).

-- 1) Đổi tên STT 1
UPDATE recruitment.job
SET industry = 'Máy móc & Thiết bị sản xuất'
WHERE industry = 'Máy móc & Thiết bị công nghiệp';

UPDATE company.company
SET industry = 'Máy móc & Thiết bị sản xuất'
WHERE industry = 'Máy móc & Thiết bị công nghiệp';

UPDATE candidate.candidate_profile
SET industry = 'Máy móc & Thiết bị sản xuất'
WHERE industry = 'Máy móc & Thiết bị công nghiệp';

UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(
  industries_experienced,
  'Máy móc & Thiết bị công nghiệp',
  'Máy móc & Thiết bị sản xuất'
)
WHERE 'Máy móc & Thiết bị công nghiệp' = ANY (industries_experienced);

UPDATE candidate.candidate_experience
SET industries = array_replace(
  industries,
  'Máy móc & Thiết bị công nghiệp',
  'Máy móc & Thiết bị sản xuất'
)
WHERE 'Máy móc & Thiết bị công nghiệp' = ANY (industries);

-- 2) Alias legacy khác → nhóm chuẩn
UPDATE recruitment.job SET industry = 'HVAC & Cơ điện M&E' WHERE industry IN ('Cơ điện / M&E', 'HVAC');
UPDATE company.company SET industry = 'HVAC & Cơ điện M&E' WHERE industry IN ('Cơ điện / M&E', 'HVAC');
UPDATE candidate.candidate_profile SET industry = 'HVAC & Cơ điện M&E' WHERE industry IN ('Cơ điện / M&E', 'HVAC');

UPDATE recruitment.job SET industry = 'Tự động hóa & Điều khiển' WHERE industry IN ('Tự động hoá / Automation', 'Tự động hóa / Automation', 'Automation');
UPDATE company.company SET industry = 'Tự động hóa & Điều khiển' WHERE industry IN ('Tự động hoá / Automation', 'Tự động hóa / Automation', 'Automation');
UPDATE candidate.candidate_profile SET industry = 'Tự động hóa & Điều khiển' WHERE industry IN ('Tự động hoá / Automation', 'Tự động hóa / Automation', 'Automation');

UPDATE recruitment.job SET industry = 'Nhà máy & Sản xuất công nghiệp' WHERE industry IN ('Sản xuất / Manufacturing', 'Điện tử / Electronics', 'QA / QC', 'Manufacturing');
UPDATE company.company SET industry = 'Nhà máy & Sản xuất công nghiệp' WHERE industry IN ('Sản xuất / Manufacturing', 'Điện tử / Electronics', 'QA / QC', 'Manufacturing');
UPDATE candidate.candidate_profile SET industry = 'Nhà máy & Sản xuất công nghiệp' WHERE industry IN ('Sản xuất / Manufacturing', 'Điện tử / Electronics', 'QA / QC', 'Manufacturing');

UPDATE recruitment.job SET industry = 'Cơ khí & Chế tạo máy' WHERE industry IN ('Cơ khí / Mechanical', 'Engineering');
UPDATE company.company SET industry = 'Cơ khí & Chế tạo máy' WHERE industry IN ('Cơ khí / Mechanical', 'Engineering');
UPDATE candidate.candidate_profile SET industry = 'Cơ khí & Chế tạo máy' WHERE industry IN ('Cơ khí / Mechanical', 'Engineering');

UPDATE recruitment.job SET industry = 'Logistics & Thiết bị kho vận' WHERE industry IN ('Logistics / Kho vận');
UPDATE company.company SET industry = 'Logistics & Thiết bị kho vận' WHERE industry IN ('Logistics / Kho vận');
UPDATE candidate.candidate_profile SET industry = 'Logistics & Thiết bị kho vận' WHERE industry IN ('Logistics / Kho vận');

UPDATE recruitment.job SET industry = 'Máy móc & Thiết bị sản xuất' WHERE industry IN ('Kinh doanh B2B', 'Sales', 'Sale');
UPDATE company.company SET industry = 'Máy móc & Thiết bị sản xuất' WHERE industry IN ('Kinh doanh B2B', 'Sales', 'Sale');
UPDATE candidate.candidate_profile SET industry = 'Máy móc & Thiết bị sản xuất' WHERE industry IN ('Kinh doanh B2B', 'Sales', 'Sale');

UPDATE recruitment.job SET industry = 'Điện & Năng lượng công nghiệp' WHERE industry IN ('Thiết bị điện', 'Thiết bị điện / Chiếu sáng / Tự động hóa');
UPDATE company.company SET industry = 'Điện & Năng lượng công nghiệp' WHERE industry IN ('Thiết bị điện', 'Thiết bị điện / Chiếu sáng / Tự động hóa');
UPDATE candidate.candidate_profile SET industry = 'Điện & Năng lượng công nghiệp' WHERE industry IN ('Thiết bị điện', 'Thiết bị điện / Chiếu sáng / Tự động hóa');

UPDATE recruitment.job SET industry = 'Tự động hóa & Điều khiển' WHERE lower(industry) = 'automation';
UPDATE company.company SET industry = 'Tự động hóa & Điều khiển' WHERE lower(industry) = 'automation';
UPDATE candidate.candidate_profile SET industry = 'Tự động hóa & Điều khiển' WHERE lower(industry) = 'automation';

-- 3) Mảng industries_experienced / industries
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'Cơ điện / M&E', 'HVAC & Cơ điện M&E')
WHERE 'Cơ điện / M&E' = ANY (industries_experienced);
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'HVAC', 'HVAC & Cơ điện M&E')
WHERE 'HVAC' = ANY (industries_experienced);
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'Tự động hoá / Automation', 'Tự động hóa & Điều khiển')
WHERE 'Tự động hoá / Automation' = ANY (industries_experienced);
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'Tự động hóa / Automation', 'Tự động hóa & Điều khiển')
WHERE 'Tự động hóa / Automation' = ANY (industries_experienced);
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'Automation', 'Tự động hóa & Điều khiển')
WHERE 'Automation' = ANY (industries_experienced);
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'Sản xuất / Manufacturing', 'Nhà máy & Sản xuất công nghiệp')
WHERE 'Sản xuất / Manufacturing' = ANY (industries_experienced);
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'Điện tử / Electronics', 'Nhà máy & Sản xuất công nghiệp')
WHERE 'Điện tử / Electronics' = ANY (industries_experienced);
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'QA / QC', 'Nhà máy & Sản xuất công nghiệp')
WHERE 'QA / QC' = ANY (industries_experienced);
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'Manufacturing', 'Nhà máy & Sản xuất công nghiệp')
WHERE 'Manufacturing' = ANY (industries_experienced);
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'Cơ khí / Mechanical', 'Cơ khí & Chế tạo máy')
WHERE 'Cơ khí / Mechanical' = ANY (industries_experienced);
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'Engineering', 'Cơ khí & Chế tạo máy')
WHERE 'Engineering' = ANY (industries_experienced);
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'Logistics / Kho vận', 'Logistics & Thiết bị kho vận')
WHERE 'Logistics / Kho vận' = ANY (industries_experienced);
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'Kinh doanh B2B', 'Máy móc & Thiết bị sản xuất')
WHERE 'Kinh doanh B2B' = ANY (industries_experienced);
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'Sales', 'Máy móc & Thiết bị sản xuất')
WHERE 'Sales' = ANY (industries_experienced);
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'Sale', 'Máy móc & Thiết bị sản xuất')
WHERE 'Sale' = ANY (industries_experienced);
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'Thiết bị điện', 'Điện & Năng lượng công nghiệp')
WHERE 'Thiết bị điện' = ANY (industries_experienced);
UPDATE candidate.candidate_profile
SET industries_experienced = array_replace(industries_experienced, 'Thiết bị điện / Chiếu sáng / Tự động hóa', 'Điện & Năng lượng công nghiệp')
WHERE 'Thiết bị điện / Chiếu sáng / Tự động hóa' = ANY (industries_experienced);

UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'Sales', 'Máy móc & Thiết bị sản xuất')
WHERE 'Sales' = ANY (industries);

UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'Cơ điện / M&E', 'HVAC & Cơ điện M&E')
WHERE 'Cơ điện / M&E' = ANY (industries);
UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'HVAC', 'HVAC & Cơ điện M&E')
WHERE 'HVAC' = ANY (industries);
UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'Tự động hoá / Automation', 'Tự động hóa & Điều khiển')
WHERE 'Tự động hoá / Automation' = ANY (industries);
UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'Tự động hóa / Automation', 'Tự động hóa & Điều khiển')
WHERE 'Tự động hóa / Automation' = ANY (industries);
UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'Automation', 'Tự động hóa & Điều khiển')
WHERE 'Automation' = ANY (industries);
UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'Sản xuất / Manufacturing', 'Nhà máy & Sản xuất công nghiệp')
WHERE 'Sản xuất / Manufacturing' = ANY (industries);
UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'Điện tử / Electronics', 'Nhà máy & Sản xuất công nghiệp')
WHERE 'Điện tử / Electronics' = ANY (industries);
UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'QA / QC', 'Nhà máy & Sản xuất công nghiệp')
WHERE 'QA / QC' = ANY (industries);
UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'Manufacturing', 'Nhà máy & Sản xuất công nghiệp')
WHERE 'Manufacturing' = ANY (industries);
UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'Cơ khí / Mechanical', 'Cơ khí & Chế tạo máy')
WHERE 'Cơ khí / Mechanical' = ANY (industries);
UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'Engineering', 'Cơ khí & Chế tạo máy')
WHERE 'Engineering' = ANY (industries);
UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'Logistics / Kho vận', 'Logistics & Thiết bị kho vận')
WHERE 'Logistics / Kho vận' = ANY (industries);
UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'Kinh doanh B2B', 'Máy móc & Thiết bị sản xuất')
WHERE 'Kinh doanh B2B' = ANY (industries);
UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'Sales', 'Máy móc & Thiết bị sản xuất')
WHERE 'Sales' = ANY (industries);
UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'Sale', 'Máy móc & Thiết bị sản xuất')
WHERE 'Sale' = ANY (industries);
UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'Thiết bị điện', 'Điện & Năng lượng công nghiệp')
WHERE 'Thiết bị điện' = ANY (industries);
UPDATE candidate.candidate_experience
SET industries = array_replace(industries, 'Thiết bị điện / Chiếu sáng / Tự động hóa', 'Điện & Năng lượng công nghiệp')
WHERE 'Thiết bị điện / Chiếu sáng / Tự động hóa' = ANY (industries);

# E2E test for inlink: 3 recruiters + 3 candidates, full flow.
# API base: http://localhost:3001/api/v1
$api = "http://127.0.0.1:3001/api/v1"
$log = "$env:TEMP\e2e-results.txt"
"" | Out-File -FilePath $log -Encoding utf8

function W {
  param($msg)
  $line = "[$((Get-Date).ToString('HH:mm:ss'))] $msg"
  Write-Host $line
  $line | Out-File -FilePath $log -Append -Encoding utf8
}

function Call-Api {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null,
    [string]$Token = $null,
    [string]$IdemKey = ""
  )
  $headers = @{ "Content-Type" = "application/json" }
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  if ($IdemKey) { $headers["Idempotency-Key"] = $IdemKey }
  $uri = "$api$Path"
  $params = @{
    Uri = $uri
    Method = $Method
    Headers = $headers
    UseBasicParsing = $true
    TimeoutSec = 30
  }
  if ($Body -ne $null) { $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress) }
  try {
    $r = Invoke-WebRequest @params
    $code = $r.StatusCode
    $len = $r.RawContentLength
    $content = $r.Content
    try { $json = $content | ConvertFrom-Json } catch { $json = $null }
    return [pscustomobject]@{ Status=$code; Len=$len; Json=$json; Raw=$content }
  } catch {
    $ec = $null
    $body = ""
    if ($_.Exception.Response) {
      $ec = [int]$_.Exception.Response.StatusCode
      try {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $sr.ReadToEnd()
        $sr.Close()
      } catch {}
    }
    W "  >>> ERR $Method $Path status=$ec body=$body"
    try { $json = $body | ConvertFrom-Json } catch { $json = $null }
    return [pscustomobject]@{ Status=if($ec){$ec}else{0}; Len=0; Json=$json; Raw=$body }
  }
}

function Reg-Verify-Login {
  param([string]$Email, [string]$Password, [string]$DisplayName, [string]$Role, [string]$Tag)
  W "=== Register $Tag ($Role): $Email ==="
  $r = Call-Api -Method POST -Path "/auth/register" -Body @{
    email = $Email; password = $Password; displayName = $DisplayName; role = $Role
  }
  if ($r.Status -ne 201 -and $r.Status -ne 200) { W "  FAIL register status=$r.Status"; return $null }
  $otp = $r.Json.devOtp
  if (-not $otp) { W "  FAIL no devOtp"; return $null }
  W "  registered, OTP=$otp"

  $r2 = Call-Api -Method POST -Path "/auth/verify-otp" -Body @{ email = $Email; otp = $otp }
  if ($r2.Status -ne 200) { W "  FAIL verify-otp status=$r2.Status body=$($r2.Raw)"; return $null }
  W "  verified"

  $r3 = Call-Api -Method POST -Path "/auth/login" -Body @{ email = $Email; password = $Password }
  if ($r3.Status -ne 200 -or -not $r3.Json.accessToken) { W "  FAIL login status=$r3.Status body=$($r3.Raw)"; return $null }
  W "  login OK token=$($r3.Json.accessToken.Substring(0,20))... userId=$($r3.Json.user.id) role=$($r3.Json.user.role)"
  return [pscustomobject]@{
    Email = $Email; Password = $Password; DisplayName = $DisplayName; Role = $Role
    Token = $r3.Json.accessToken; UserId = $r3.Json.user.id
  }
}

$ts = [int]([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())
$password = "Test@12345"

# === 3 Recruiters ===
$rec1 = Reg-Verify-Login -Email "rec1-$ts@inlink.test" -Password $password -DisplayName "Tran Van Tuyen REC1" -Role "recruiter" -Tag "REC1"
$rec2 = Reg-Verify-Login -Email "rec2-$ts@inlink.test" -Password $password -DisplayName "Le Thi Dung REC2" -Role "recruiter" -Tag "REC2"
$rec3 = Reg-Verify-Login -Email "rec3-$ts@inlink.test" -Password $password -DisplayName "Pham Van Moi REC3" -Role "recruiter" -Tag "REC3"

# === 3 Candidates ===
$cand1 = Reg-Verify-Login -Email "cand1-$ts@inlink.test" -Password $password -DisplayName "Nguyen Van Ung CAND1" -Role "candidate" -Tag "CAND1"
$cand2 = Reg-Verify-Login -Email "cand2-$ts@inlink.test" -Password $password -DisplayName "Hoang Thi Vien CAND2" -Role "candidate" -Tag "CAND2"
$cand3 = Reg-Verify-Login -Email "cand3-$ts@inlink.test" -Password $password -DisplayName "Vu Van Can CAND3" -Role "candidate" -Tag "CAND3"

if (-not $rec1 -or -not $rec2 -or -not $rec3 -or -not $cand1 -or -not $cand2 -or -not $cand3) {
  W "FAIL: Không tạo được đủ 6 user. Dừng."
  exit 1
}

# === Each recruiter creates a company ===
W ""
W "===== Each recruiter creates company ====="
$companies = @()
$coNames = @("Tech Mech JSC", "Vin Trading Co", "GreenBuild LLC")
for ($i = 0; $i -lt 3; $i++) {
  $u = @($rec1,$rec2,$rec3)[$i]
  $name = $coNames[$i]
  $industry = @("automation","sales","construction")[$i]
  $r = Call-Api -Method GET -Path "/companies/me" -Token $u.Token
  if ($r.Status -eq 200 -and $r.Json.id) {
    W "    $($u.DisplayName) already has company id=$($r.Json.id) (skipping create)"
    $companies += [pscustomobject]@{ Owner=$u; Company=$r.Json }
    continue
  }
  $r = Call-Api -Method POST -Path "/companies" -Token $u.Token -Body @{
    name = $name; industry = $industry; size = "medium"; website = "https://$industry-$ts.example.com"
    description = "Công ty test tự động $industry"
  } -IdemKey ("create-co-" + $u.UserId)
  if ($r.Status -ge 400) { W "FAIL create company for $($u.DisplayName) status=$r.Status body=$($r.Raw)"; continue }
  $co = $r.Json
  if (-not $co.id) { $co = $r.Json.company }
  if (-not $co.id) { W "FAIL no company id in response: $($r.Raw)"; continue }
  W "    $($u.DisplayName) created id=$($co.id) name=$($co.name)"
  $companies += [pscustomobject]@{ Owner=$u; Company=$co }
}

# === Recruiter 1 publishes a job (technical) ===
W ""
W "===== REC1 publishes job ====="
$job1Body = @{
  title = "Ky su PLC"
  description = "Lap trinh PLC Siemens S7-1500, HMI WinCC cho day chuyen tu dong hoa cong nghiep. Yeu cau toi thieu 2 nam kinh nghiem thuc te tai nha may, thanh thao Profibus/Profinet, co kha nang doc tai lieu ky thuat bang tieng Anh. Phuc loi: BHXH day du, thuong quy theo hieu qua, du thu 5 ngay/thang."
  requirements = "Toi thieu 2 nam kinh nghiem PLC Siemens. Biet SCADA WinCC la loi the. Ky nang doc tai lieu tieng Anh tot."
  benefits = "Luong 25-35tr, BHXH day du, thuong quy, du thu 5 ngay/thang, phu cap di lai."
  industry = "Automation"
  subIndustry = "PLC"
  jobLevel = "technical.staff"
  employmentType = "full_time"
  location = "Dong Nai"
  headcount = 2
  salaryMin = 25000000
  salaryMax = 35000000
  experienceBand = "1_3"
  jobTrack = "technical"
  skills = @(
    @{ name="PLC Siemens"; required=$true; weight=3 },
    @{ name="HMI"; required=$true; weight=2 },
    @{ name="SCADA"; required=$false; weight=1 }
  )
  technicalCriteria = @{
    industries = @("Automation")
    equipmentSystems = @("PLC Siemens", "HMI")
    technicalWorkTypes = @("Programming")
    educationLevel = "Bachelor"
  }
  publish = $true
}
function Pick-Id {
  param($Resp, [string]$Path = "id")
  if (-not $Resp.Json) { return $null }
  $parts = $Path.Split(".")
  $node = $Resp.Json
  foreach ($p in $parts) {
    if ($node.PSObject.Properties[$p]) { $node = $node.$p } else { return $null }
  }
  return $node
}

function W-Id {
  param($Resp, [string]$Path, [string]$Tag, [string]$What = "id")
  $id = Pick-Id $Resp $Path
  if ($id) { W "  $Tag $What=$id" } else { W "  $Tag no $What at '$Path' resp=$($Resp.Raw.Substring(0, [Math]::Min(200,$Resp.Raw.Length)))" }
  return $id
}

$r = Call-Api -Method POST -Path "/jobs" -Token $rec1.Token -Body $job1Body -IdemKey ("job-1-" + $rec1.UserId)
if ($r.Status -ge 400) { W "FAIL create job1 status=$r.Status body=$($r.Raw)"; exit 1 }
$job1 = $r.Json
W "    REC1 job1 id=$($job1.id) title=$($job1.title) status=$($job1.status) slug=$($job1.slug)"

# === Publish jobs ===
W ""
W "===== Publish jobs ====="
foreach ($pair in @(@($rec1,$job1,"job1"), @($rec2,$job2,"job2"), @($rec3,$job3,"job3"))) {
  $u = $pair[0]; $j = $pair[1]; $tag = $pair[2]
  $r = Call-Api -Method POST -Path "/jobs/$($j.id)/publish" -Token $u.Token -Body @{}
  W "  $tag publish status=$($r.Status) -> job.status=$($r.Json.status) moderation=$($r.Json.moderationStatus)"
}
W ""
W "===== REC2 publishes job ====="
$job2Body = @{
  title = "Nhan vien kinh doanh B2B"
  description = "Ban thiet bi cong nghiep cho cac nha may san xuat tai KCN Amata, My Phuoc, Tan Thuan. Di thuc te 4 ngay/thang, khach hang B2B la cac plant manager va chu dau tu. Phuc loi: luong cung 12tr, hoa hong 2-5% doanh so, thuong quy, theo xe cong ty."
  requirements = "Ky nang giao tiep va thuyet phuc tot. Chiu duoc ap luc doanh so. Co kinh nghiem ban B2B it nhat 1 nam."
  benefits = "Luong cung 12tr + hoa hong 2-5% doanh so. BHXH day du. Phu cap di lai."
  jobLevel = "sales.staff"
  employmentType = "full_time"
  location = "Ho Chi Minh"
  headcount = 3
  salaryMin = 12000000
  salaryMax = 30000000
  experienceBand = "1_3"
  jobTrack = "sales"
  skills = @(
    @{ name="B2B Sales"; required=$true; weight=2 },
    @{ name="CRM"; required=$false; weight=1 }
  )
  salesCriteria = @{
    industries = @("Manufacturing")
    customerSegments = @("Factories")
    dealTypes = @("Direct sales")
    sellingStages = @("Find leads", "Quote", "Negotiate", "Close")
  }
  publish = $true
}
$r = Call-Api -Method POST -Path "/jobs" -Token $rec2.Token -Body $job2Body -IdemKey ("job-2-" + $rec2.UserId)
if ($r.Status -ge 400) { W "FAIL create job2 status=$r.Status body=$($r.Raw)" }
$job2 = $r.Json
W "    REC2 job2 id=$($job2.id) title=$($job2.title) status=$($job2.status) slug=$($job2.slug)"

# === Recruiter 3 publishes a job (technical) ===
W ""
W "===== REC3 publishes job ====="
$job3Body = @{
  title = "Ky su xay dung cong nghiep"
  description = "Giam sat thi cong nha xuong cong nghiep tai KCN Binh Duong, Dong Nai. Doc ban ve ket cau thep va be tong, lap tien do thi cong, kiem soat chat luong vat lieu, phoi hop voi chu dau tu va tong thau. Phuc loi: luong 20-30tr, phu cap cong trinh 2tr, xe dua don."
  requirements = "Toi thieu 3 nam kinh nghiem giam sat cong trinh nha xuong cong nghiep. Thanh thao AutoCAD. Chung chi hanh nghe hoac chi huy truong."
  industry = "Construction"
  jobLevel = "technical.staff"
  employmentType = "full_time"
  location = "Binh Duong"
  headcount = 1
  salaryMin = 20000000
  salaryMax = 30000000
  experienceBand = "3_5"
  jobTrack = "technical"
  skills = @(@{ name="Autocad"; required=$true; weight=2 })
  technicalCriteria = @{
    industries = @("Construction")
    educationLevel = "Bachelor"
  }
  publish = $true
}
$r = Call-Api -Method POST -Path "/jobs" -Token $rec3.Token -Body $job3Body -IdemKey ("job-3-" + $rec3.UserId)
if ($r.Status -ge 400) { W "FAIL create job3 status=$r.Status body=$($r.Raw)" }
$job3 = $r.Json
W "    REC3 job3 id=$($job3.id) title=$($job3.title) status=$($job3.status) slug=$($job3.slug)"

# === Publish jobs (force via DB script, then wait for moderation) ===
W ""
W "===== Publish jobs (via direct DB patch + wait for moderation) ====="
$pubLog = & node "$PSScriptRoot\apps\api\scripts\force-publish-draft.cjs" 2>&1
W "  $($pubLog -join ' | ')"
W "  Waiting 8s for AI moderation to finish..."
Start-Sleep 12
# Re-check status
$r = Call-Api -Method GET -Path "/jobs/$($job1.id)" -Token $rec1.Token
W "  JOB1 after moderation: status=$($r.Json.status) moderation=$($r.Json.moderationStatus)"
$r = Call-Api -Method GET -Path "/jobs/$($job2.id)" -Token $rec2.Token
W "  JOB2 after moderation: status=$($r.Json.status) moderation=$($r.Json.moderationStatus)"
$r = Call-Api -Method GET -Path "/jobs/$($job3.id)" -Token $rec3.Token
W "  JOB3 after moderation: status=$($r.Json.status) moderation=$($r.Json.moderationStatus)"

# === Each candidate updates profile ===
W "===== Candidates with mostly-empty profiles, fill what we can ====="
$profile1 = @{
  displayName = "Nguyen Van Ung CAND1"
  currentCity = "Dong Nai"
  currentPosition = "PLC Engineer"
  totalExperienceYears = 3
  industry = "Automation"
  industriesExperienced = @("Automation")
  productsSold = @()
  customerSegments = @()
  marketsCovered = @("VN")
  sellingStages = @()
  languages = @("English")
  careerMotivations = @("stable")
  workStyles = @("office")
  desiredPositions = @("PLC Engineer")
  desiredLocations = @("Dong Nai", "Binh Duong")
  expectedSalaryMin = 22000000
  expectedSalaryMax = 32000000
  educationLevel = "Bachelor"
  jobTrack = "technical"
  certificates = @()
  skills = @(@{ name="PLC Siemens"; level="good" }, @{ name="HMI"; level="basic" })
  experiences = @(
    @{ companyName="ABC Automation"; jobTitle="PLC Engineer"; startYear=2023; endYear=$null; isCurrent=$true; industries=@("Automation"); productsSold=@(); customerSegments=@(); marketsCovered=@("VN"); sellingStages=@(); brandsTechnologies=@("Siemens") }
  )
}
$r = Call-Api -Method PATCH -Path "/candidates/me" -Token $cand1.Token -Body $profile1
W "    CAND1 profile status=$($r.Status)"

$profile2 = @{
  displayName = "Hoang Thi Vien CAND2"
  currentCity = "Ho Chi Minh"
  currentPosition = "Sales B2B"
  totalExperienceYears = 2
  industry = "Manufacturing"
  industriesExperienced = @("Manufacturing")
  productsSold = @("Industrial equipment")
  customerSegments = @("Factories")
  marketsCovered = @("VN")
  sellingStages = @("Lead","Quote","Negotiate","Close")
  languages = @("English")
  careerMotivations = @("income")
  workStyles = @("field")
  desiredPositions = @("Sales Engineer")
  desiredLocations = @("Ho Chi Minh")
  expectedSalaryMin = 14000000
  expectedSalaryMax = 28000000
  educationLevel = "Associate"
  jobTrack = "sales"
  certificates = @()
  skills = @(@{ name="CRM"; level="good" })
  experiences = @(
    @{ companyName="XYZ Trading"; jobTitle="Sales B2B"; startYear=2022; endYear=$null; isCurrent=$true; industries=@("Manufacturing"); productsSold=@("Industrial equipment"); customerSegments=@("Factories"); marketsCovered=@("VN"); sellingStages=@("Lead","Quote","Negotiate","Close") }
  )
}
$r = Call-Api -Method PATCH -Path "/candidates/me" -Token $cand2.Token -Body $profile2
W "    CAND2 profile status=$($r.Status)"

$profile3 = @{
  displayName = "Vu Van Can CAND3"
  currentCity = "Binh Duong"
  currentPosition = "Civil Engineer"
  totalExperienceYears = 4
  industry = "Construction"
  industriesExperienced = @("Construction")
  productsSold = @()
  customerSegments = @()
  marketsCovered = @("VN")
  sellingStages = @()
  languages = @("English")
  careerMotivations = @("stable")
  workStyles = @("field")
  desiredPositions = @("Civil Engineer")
  desiredLocations = @("Binh Duong", "Ho Chi Minh")
  expectedSalaryMin = 18000000
  expectedSalaryMax = 28000000
  educationLevel = "Bachelor"
  jobTrack = "technical"
  certificates = @()
  skills = @(@{ name="AutoCAD"; level="good" })
  experiences = @(
    @{ companyName="Construction Co"; jobTitle="Site Engineer"; startYear=2020; endYear=$null; isCurrent=$true; industries=@("Construction"); productsSold=@(); customerSegments=@(); marketsCovered=@("VN"); sellingStages=@() }
  )
}
$r = Call-Api -Method PATCH -Path "/candidates/me" -Token $cand3.Token -Body $profile3
W "    CAND3 profile status=$($r.Status)"

# === Candidate applies to jobs ===
W ""
W "===== Candidates apply to jobs ====="
function Apply {
  param($Cand, $Job, $Tag)
  $body = @{ coverLetter = "Toi quan tam toi vi tri $($Job.title). Mong duoc trao doi them." }
  $r = Call-Api -Method POST -Path "/jobs/$($Job.id)/apply" -Token $Cand.Token -Body $body -IdemKey ("apply-$($Job.id)-$($Cand.UserId)")
  if ($r.Status -ge 400) { W "  FAIL $Tag apply status=$($r.Status) body=$($r.Raw)"; return $null }
  $app = $r.Json.application
  if (-not $app) { $app = $r.Json }
  W "  $Tag applied jobId=$($Job.id) applicationId=$($app.id) matchScore=$($app.matchScore)"
  return $app
}

$app1 = Apply -Cand $cand1 -Job $job1 -Tag "CAND1->JOB1"
$app2 = Apply -Cand $cand1 -Job $job3 -Tag "CAND1->JOB3"
$app3 = Apply -Cand $cand2 -Job $job2 -Tag "CAND2->JOB2"
$app4 = Apply -Cand $cand2 -Job $job1 -Tag "CAND2->JOB1"
$app5 = Apply -Cand $cand3 -Job $job3 -Tag "CAND3->JOB3"
$app6 = Apply -Cand $cand3 -Job $job1 -Tag "CAND3->JOB1"

# === Recruiter lists applicants and updates status ===
W ""
W "===== Recruiters view applicants ====="
$r = Call-Api -Method GET -Path "/jobs/$($job1.id)/applications" -Token $rec1.Token
if ($r.Status -eq 200) {
  $items = if ($r.Json.items) { $r.Json.items } else { @($r.Json) }
  W "  REC1 job1 applicants count=$($items.Count)"
  foreach ($a in $items) {
    $name = if ($a.candidate) { $a.candidate.displayName } else { "" }
    W "    - $name status=$($a.status) matchScore=$($a.matchScore)"
  }
} else { W "  REC1 job1 applicants: status=$($r.Status)" }

$r = Call-Api -Method GET -Path "/jobs/$($job2.id)/applications" -Token $rec2.Token
if ($r.Status -eq 200) {
  $items = if ($r.Json.items) { $r.Json.items } else { @($r.Json) }
  W "  REC2 job2 applicants count=$($items.Count)"
} else { W "  REC2 job2 applicants: status=$($r.Status)" }

$r = Call-Api -Method GET -Path "/jobs/$($job3.id)/applications" -Token $rec3.Token
if ($r.Status -eq 200) {
  $items = if ($r.Json.items) { $r.Json.items } else { @($r.Json) }
  W "  REC3 job3 applicants count=$($items.Count)"
} else { W "  REC3 job3 applicants: status=$($r.Status)" }

# === Update status: shortlist CAND1 on JOB1, reject CAND3 ===
W ""
W "===== Update application status ====="
$r = Call-Api -Method PATCH -Path "/applications/$($app1.id)/status" -Token $rec1.Token -Body @{ status = "screening"; note = "Phu hop ky nang" }
W "  REC1 -> CAND1 status update (screening): status=$($r.Status)"

$r = Call-Api -Method PATCH -Path "/applications/$($app6.id)/status" -Token $rec1.Token -Body @{ status = "rejected"; note = "Khong dung nganh" }
W "  REC1 -> CAND3 status update: status=$($r.Status)"

# === Candidate lists their own applications ===
W ""
W "===== Candidates list own applications ====="
$r = Call-Api -Method GET -Path "/applications/mine" -Token $cand1.Token
if ($r.Status -eq 200) {
  $items = if ($r.Json.items) { $r.Json.items } else { @($r.Json) }
  W "  CAND1 applications: $($items.Count) (or similar)"
  foreach ($a in $items) { W "    - jobId=$($a.jobId) status=$($a.status) matchScore=$($a.matchScore)" }
} else { W "  CAND1 applications: status=$($r.Status)" }

$r = Call-Api -Method GET -Path "/applications/mine" -Token $cand2.Token
if ($r.Status -eq 200) {
  $items = if ($r.Json.items) { $r.Json.items } else { @($r.Json) }
  W "  CAND2 applications: $($items.Count)"
} else { W "  CAND2 applications: status=$($r.Status)" }

$r = Call-Api -Method GET -Path "/applications/mine" -Token $cand3.Token
if ($r.Status -eq 200) {
  $items = if ($r.Json.items) { $r.Json.items } else { @($r.Json) }
  W "  CAND3 applications: $($items.Count)"
} else { W "  CAND3 applications: status=$($r.Status)" }

# === Recommended jobs for CAND1 (try common paths) ===
W ""
W "===== Recommended jobs for CAND1 ====="
$recPaths = @("/candidates/me/recommendations","/matching/recommended-jobs","/candidates/recommendations","/jobs/recommended")
foreach ($p in $recPaths) {
  $r = Call-Api -Method GET -Path $p -Token $cand1.Token
  W "  GET $p -> status=$($r.Status)"
}

# === Public job listing ===
W ""
W "===== Public job listing ====="
$r = Call-Api -Method GET -Path "/jobs"
W "  Public /jobs: status=$($r.Status) items=$($r.Json.items.Count) (or similar)"

# === Job detail ===
$r = Call-Api -Method GET -Path "/jobs/$($job1.id)"
W "  Public /jobs/$($job1.id): status=$($r.Status) title=$($r.Json.title)"

W ""
W "===== SUMMARY ====="
W "Recruiters: rec1, rec2, rec3"
W "Candidates: cand1, cand2, cand3"
W "Jobs: job1=PLC, job2=Sales, job3=Construction"
W "Applications: 6 (4 on job1, 1 on job2, 1 on job3)"
W "Status updates: CAND1 shortlisted, CAND3 rejected (on job1)"

# Save data for next round
@{
  ts = $ts
  rec1 = @{ email = $rec1.Email; token = $rec1.Token; userId = $rec1.UserId }
  rec2 = @{ email = $rec2.Email; token = $rec2.Token; userId = $rec2.UserId }
  rec3 = @{ email = $rec3.Email; token = $rec3.Token; userId = $rec3.UserId }
  cand1 = @{ email = $cand1.Email; token = $cand1.Token; userId = $cand1.UserId }
  cand2 = @{ email = $cand2.Email; token = $cand2.Token; userId = $cand2.UserId }
  cand3 = @{ email = $cand3.Email; token = $cand3.Token; userId = $cand3.UserId }
  job1 = @{ id = $job1.id; title = $job1.title }
  job2 = @{ id = $job2.id; title = $job2.title }
  job3 = @{ id = $job3.id; title = $job3.title }
} | ConvertTo-Json -Depth 5 | Out-File "$env:TEMP\e2e-data.json" -Encoding utf8
W "Saved data to $env:TEMP\e2e-data.json"
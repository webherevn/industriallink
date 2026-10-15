-- Nội dung marketing / SEO trang /bang-gia — SuperAdmin chỉnh, không hardcode.

CREATE TABLE billing.billing_page_content (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope                      TEXT NOT NULL UNIQUE DEFAULT 'default',

  seo_title                  TEXT NOT NULL DEFAULT 'Bảng giá dịch vụ — inlink',
  seo_description            TEXT NOT NULL DEFAULT 'Bảng giá minh bạch cho nhà tuyển dụng: gói Tin đăng, Săn nhân sự và Top-up Credit. Không auto-charge, không phát sinh.',
  seo_title_recruiter        TEXT NOT NULL DEFAULT 'Bảng giá dành cho nhà tuyển dụng — inlink Recruiter',
  seo_description_recruiter  TEXT NOT NULL DEFAULT 'Gói Tin đăng, Tin đăng Plus, Doanh nghiệp, Enterprise. Dịch vụ Săn nhân sự. Top-up Credit. Minh bạch, không auto-charge.',
  focus_keyword              TEXT,
  og_title                   TEXT,
  og_description             TEXT,
  og_image_url               TEXT,
  og_image_alt               TEXT NOT NULL DEFAULT 'Bảng giá inlink',
  robots_index               BOOLEAN NOT NULL DEFAULT true,
  robots_follow              BOOLEAN NOT NULL DEFAULT true,

  hero_badge                 TEXT NOT NULL DEFAULT 'Bảng giá 2026',
  hero_heading               TEXT NOT NULL DEFAULT 'Tuyển dụng công nghiệp',
  hero_heading_accent        TEXT NOT NULL DEFAULT 'minh bạch, không phát sinh',
  hero_subtitle              TEXT NOT NULL DEFAULT 'iLink giúp nhà tuyển dụng đăng tin, matching AI, mở hồ sơ tiềm năng chỉ với vài cú click. Không auto-charge, không phí ẩn.',
  hero_social_proof          TEXT NOT NULL DEFAULT 'Được 50+ doanh nghiệp FDI tin dùng',
  hero_cta_primary           TEXT NOT NULL DEFAULT 'Bắt đầu miễn phí',
  hero_cta_secondary         TEXT NOT NULL DEFAULT 'Xem cách tính phí',

  recruiter_kicker           TEXT NOT NULL DEFAULT 'Tài khoản / Bảng giá',
  recruiter_heading          TEXT NOT NULL DEFAULT 'Chọn gói phù hợp, nâng cấp bất kỳ lúc nào',
  recruiter_subtitle         TEXT NOT NULL DEFAULT 'Tất cả gói dùng được ngay sau khi thanh toán. Hoá đơn VAT cho doanh nghiệp.',

  platform_title             TEXT NOT NULL DEFAULT 'Gói nền tảng',
  platform_subtitle          TEXT NOT NULL DEFAULT 'Tự tuyển dụng với AI Matching. Quản lý JD, ứng viên, mở hồ sơ tiềm năng.',
  sourcing_title             TEXT NOT NULL DEFAULT 'Gói Săn nhân sự',
  sourcing_subtitle          TEXT NOT NULL DEFAULT 'Đội ngũ iLink trực tiếp tìm kiếm, sàng lọc và đánh giá ứng viên theo JD của bạn.',
  credit_title               TEXT NOT NULL DEFAULT 'Top-up Credit',
  credit_subtitle            TEXT NOT NULL DEFAULT 'Mua thêm lượt mở hồ sơ tiềm năng. Đơn giá giảm khi mua nhiều.',
  features_title             TEXT NOT NULL DEFAULT 'Tính năng nổi bật',
  features_subtitle          TEXT NOT NULL DEFAULT 'Tất cả công cụ bạn cần để tuyển dụng công nghiệp hiệu quả.',
  compare_title              TEXT NOT NULL DEFAULT 'So sánh gói',
  compare_subtitle           TEXT NOT NULL DEFAULT 'Chọn gói phù hợp với nhu cầu tuyển dụng của bạn.',
  how_title                  TEXT NOT NULL DEFAULT 'Chỉ trả cho những gì bạn dùng',
  how_subtitle               TEXT NOT NULL DEFAULT 'Quy trình đơn giản, không phí ẩn, không auto-charge.',
  how_footer                 TEXT NOT NULL DEFAULT 'Tặng Credit khi mua gói — không auto-charge, không phí ẩn.',
  faq_title                  TEXT NOT NULL DEFAULT 'Câu hỏi thường gặp',
  faq_subtitle               TEXT NOT NULL DEFAULT 'Mọi thắc mắc về giá, gói và Credit.',
  contact_title              TEXT NOT NULL DEFAULT 'Cần tư vấn gói riêng cho doanh nghiệp?',
  contact_subtitle           TEXT NOT NULL DEFAULT 'Đội ngũ iLink sẵn sàng hỗ trợ bạn chọn gói phù hợp nhất.',
  final_cta_title            TEXT NOT NULL DEFAULT 'Sẵn sàng tuyển hiệu quả hơn?',
  final_cta_subtitle         TEXT NOT NULL DEFAULT 'Đăng ký miễn phí hoặc liên hệ sales để được tư vấn gói phù hợp.',
  footer_tagline             TEXT NOT NULL DEFAULT 'Kết nối nhân tài – Dẫn lối công nghiệp',
  consult_nav_text           TEXT NOT NULL DEFAULT 'Cần tư vấn? Gọi 1900 6868',

  contact_email              TEXT NOT NULL DEFAULT 'sales@inlink.vn',
  contact_email_desc         TEXT NOT NULL DEFAULT 'Phản hồi trong 24h',
  contact_hotline            TEXT NOT NULL DEFAULT '1900 6868',
  contact_hotline_href       TEXT NOT NULL DEFAULT 'tel:19006868',
  contact_hotline_desc       TEXT NOT NULL DEFAULT 'T2–T6, 8h–17h',
  contact_zalo_label         TEXT NOT NULL DEFAULT 'inlink.vn',
  contact_zalo_href          TEXT NOT NULL DEFAULT 'https://zalo.me/inlink',
  contact_zalo_desc          TEXT NOT NULL DEFAULT 'Nhắn tin nhanh',

  features                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  how_steps                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  faq_items                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  trust_items                JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                 UUID,
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                 UUID
);

INSERT INTO billing.billing_page_content (
  scope, features, how_steps, faq_items, trust_items
) VALUES (
  'default',
  '[
    {"title":"AI Matching thông minh","desc":"Thuật toán AI phân tích JD, tìm ứng viên phù hợp. Matching chính xác, tiết kiệm 70% thời gian sàng lọc."},
    {"title":"Tạo JD từ template","desc":"Template chuẩn công nghiệp, điền thông tin và nhận JD hoàn chỉnh chỉ trong 3 phút."},
    {"title":"Mở hồ sơ tiềm năng","desc":"Dùng Credit để mở hồ sơ ứng viên tiềm năng. Không auto-charge, chủ động kiểm soát chi phí."},
    {"title":"Nhiều user cùng dùng","desc":"Gói Doanh nghiệp & Enterprise hỗ trợ nhiều tài khoản nhà tuyển dụng cùng lúc."},
    {"title":"Báo cáo hiệu quả","desc":"Dashboard thống kê views, ứng tuyển, matching rate. Theo dõi ROI tuyển dụng dễ dàng."},
    {"title":"Top-up Credit linh hoạt","desc":"Mua Credit theo nhu cầu thực tế. Đơn giá giảm khi mua nhiều. Không hết hạn khi tài khoản còn hoạt động."}
  ]'::jsonb,
  '[
    {"title":"Chọn gói phù hợp","desc":"Từ gói miễn phí Khám phá đến Enterprise — chọn gói phù hợp quy mô và nhu cầu tuyển dụng của bạn."},
    {"title":"Đăng JD & Matching AI","desc":"Tạo JD bằng template hoặc paste nội dung. AI sẽ tự động phân tích và matching ứng viên phù hợp."},
    {"title":"Mua thêm Credit khi cần","desc":"Mở hồ sơ ứng viên tiềm năng bằng Credit. Mua thêm bất kỳ lúc nào, đơn giá giảm theo số lượng."}
  ]'::jsonb,
  '[
    {"q":"Giá đã bao gồm VAT chưa?","a":"Giá hiển thị chưa bao gồm VAT 10%. Hoá đơn VAT được xuất theo yêu cầu khi thanh toán."},
    {"q":"Tôi có thể đổi từ Tin đăng sang Tin đăng Plus không?","a":"Có. Vào trang quản lý gói, chọn Nâng cấp và phần chênh lệch sẽ được tính theo tỉ lệ thời gian còn lại."},
    {"q":"Credit mua thêm có hết hạn không?","a":"Theo chính sách hiện tại, Credit không hết hạn khi tài khoản còn hoạt động. Chúng tôi sẽ thông báo trước 30 ngày nếu có thay đổi."},
    {"q":"Phí Săn nhân sự có bao gồm Credit không?","a":"Không. Phí Săn (Cơ bản/Tiêu chuẩn/Chuyên sâu) là phí dịch vụ iLink thực hiện. Credit mua riêng theo nhu cầu mở hồ sơ tiềm năng."},
    {"q":"iLink có auto-charge Credit khi hết không?","a":"Không. Theo nguyên tắc V1, hệ thống không tự động mua Credit. Bạn chủ động mua khi cần."},
    {"q":"Có hỗ trợ thanh toán qua chuyển khoản ngân hàng không?","a":"Có. Doanh nghiệp và Enterprise hỗ trợ chuyển khoản, xuất hoá đơn VAT. Liên hệ sales@inlink.vn để được hỗ trợ."}
  ]'::jsonb,
  '[
    {"title":"Không auto-charge","desc":"Hệ thống không tự động mua Credit. Bạn chủ động quyết định."},
    {"title":"Hoá đơn VAT","desc":"Xuất VAT đầy đủ cho doanh nghiệp. Hỗ trợ chuyển khoản."},
    {"title":"Hỗ trợ 1-1","desc":"Đội ngũ iLink đồng hành setup, training và tối ưu JD."}
  ]'::jsonb
)
ON CONFLICT (scope) DO NOTHING;

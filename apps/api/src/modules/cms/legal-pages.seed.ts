/**
 * Bộ 8 trang chính sách & điều khoản chuẩn pháp lý Việt Nam (Bộ Công Thương NĐ 52/2013,
 * NĐ 85/2021 và Bảo vệ dữ liệu cá nhân NĐ 13/2023/NĐ-CP) dành cho nền tảng inLink.
 *
 * Tự động khởi tạo vào bảng `cms.cms_post` (type='page', status='published') khi API khởi động
 * nếu slug chưa tồn tại — SuperAdmin có thể chỉnh sửa trực tiếp tại /admin/cms/pages mà không bị ghi đè.
 */

export interface LegalPageSeed {
  slug: string;
  title: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  bodyHtml: string;
}

export const DEFAULT_LEGAL_PAGES: LegalPageSeed[] = [
  {
    slug: 'gioi-thieu',
    title: 'Giới thiệu inLink — Nền tảng kết nối nhân tài ngành công nghiệp ứng dụng AI',
    excerpt:
      'inLink là nền tảng tuyển dụng công nghệ chuyên sâu cho ngành công nghiệp B2B tại Việt Nam — ứng dụng AI Matching hai chiều giúp Doanh nghiệp tuyển đúng người nhanh hơn và Ứng viên kỹ thuật, kinh doanh công nghiệp tìm đúng bến đỗ sự nghiệp.',
    seoTitle: 'Giới thiệu inLink | Kết nối nhân tài — Dẫn lối công nghiệp',
    seoDescription:
      'Tìm hiểu về CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK và nền tảng tuyển dụng công nghiệp B2B inLink: AI Matching hai chiều, AI JD Copilot, Dịch vụ Săn nhân sự công nghiệp và cam kết minh bạch.',
    bodyHtml: `
<p><strong>inLink — Kết nối nhân tài, dẫn lối công nghiệp.</strong> Trong bối cảnh chuỗi cung ứng sản xuất, tự động hóa, cơ điện và thương mại thiết bị B2B tại Việt Nam tăng tốc mạnh mẽ, bài toán khó nhất của mọi doanh nghiệp công nghiệp không phải là thiếu ứng viên — mà là <strong>tìm đúng người am hiểu kỹ thuật, nắm vững thị trường công nghiệp và sẵn sàng tạo ra kết quả thực chiến</strong>.</p>

<p>Các sàn tuyển dụng đại trà thường gộp chung mọi ngành nghề vào một bộ lọc đơn giản, khiến Nhà tuyển dụng mất hàng tuần sàng lọc hàng trăm CV không đúng chuyên môn, còn Kỹ sư và Chuyên viên Kinh doanh B2B chất lượng cao lại bị chìm giữa biển tin tuyển dụng thiếu rõ ràng. <strong>inLink</strong> ra đời để giải quyết tận gốc khoảng trống đó.</p>

<h2>1. inLink là ai?</h2>
<p><strong>inLink</strong> (thuộc <strong>CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK</strong>) là nền tảng công nghệ tuyển dụng và kết nối nhân tài chuyên biệt 100% cho <strong>ngành công nghiệp B2B tại Việt Nam</strong>.</p>
<p>Chúng tôi tập trung sâu vào các nhóm vị trí cốt lõi tạo nên năng lực cạnh tranh của doanh nghiệp sản xuất và thương mại kỹ thuật:</p>
<ul>
  <li><strong>Khối Kinh doanh Công nghiệp B2B:</strong> Kỹ sư bán hàng (Sales Engineer), Chuyên viên Kinh doanh dự án, Quản lý khách hàng trọng điểm (Key Account Manager), Giám đốc Kinh doanh thiết bị, vật tư, giải pháp nhà máy &amp; EPC.</li>
  <li><strong>Khối Kỹ thuật &amp; Vận hành Công nghiệp:</strong> Kỹ sư Tự động hóa (PLC/SCADA/Robotics), Cơ khí chế tạo, Điện công nghiệp – M&amp;E, Bảo trì &amp; Dịch vụ kỹ thuật hiện trường, Quản lý sản xuất, QA/QC, HSE và Chuỗi cung ứng công nghiệp.</li>
</ul>

<h2>2. Tầm nhìn, Sứ mệnh &amp; Giá trị cốt lõi</h2>
<h3>2.1. Tầm nhìn</h3>
<p>Trở thành <strong>nền tảng kết nối nhân lực công nghiệp ứng dụng AI hàng đầu Việt Nam</strong> — nơi mỗi doanh nghiệp sản xuất, thương mại kỹ thuật và nhà thầu công nghiệp có thể tìm thấy đúng nhân sự nòng cốt với chi phí minh bạch và tốc độ vượt trội.</p>

<h3>2.2. Sứ mệnh</h3>
<p>Chuẩn hóa ngôn ngữ tuyển dụng ngành công nghiệp bằng trí tuệ nhân tạo, rút ngắn khoảng cách giữa năng lực thực chiến của ứng viên và yêu cầu chuyên sâu của doanh nghiệp — góp phần nâng cao năng suất và sức cạnh tranh của ngành công nghiệp Việt Nam.</p>

<h3>2.3. 4 Giá trị cốt lõi</h3>
<ul>
  <li><strong>Chuyên sâu ngành công nghiệp:</strong> Không chạy theo số lượng tin đại trà. Mọi trường dữ liệu, bộ lọc và thuật toán đều được thiết kế riêng cho đặc thù tuyển dụng B2B và kỹ thuật công nghiệp.</li>
  <li><strong>Công nghệ AI thực chiến:</strong> AI không chỉ để trưng bày — AI của inLink trực tiếp bóc tách JD, chuẩn hóa CV, chấm điểm phù hợp theo từng tiêu chí và giải thích rõ lý do phù hợp cũng như điểm cần lưu ý.</li>
  <li><strong>Minh bạch tuyệt đối:</strong> Minh bạch mức độ phù hợp, minh bạch cơ chế tính Credit (xem điểm AI miễn phí, 0 Credit với ứng viên tự ứng tuyển), minh bạch báo giá và xuất hóa đơn GTGT đầy đủ.</li>
  <li><strong>Đồng hành trọn vòng đời tuyển dụng:</strong> Từ khâu viết JD, sàng lọc hồ sơ, nhắn tin trực tiếp, quản lý quy trình phỏng vấn đến gửi đề nghị nhận việc (Offer) và hội nhập (Onboarding).</li>
</ul>

<h2>3. Khác biệt công nghệ: AI Matching hai chiều chuyên biệt công nghiệp</h2>
<p>Thay vì chỉ khớp từ khóa rời rạc, <strong>inLink AI Matching</strong> phân tách rõ hai khung năng lực chuyên sâu — <strong>Nhóm Kinh doanh Công nghiệp</strong> và <strong>Nhóm Kỹ thuật Công nghiệp</strong> — để đánh giá độ phù hợp đa chiều:</p>
<ul>
  <li><strong>Chuẩn hóa tiêu chí tuyển dụng thực tế:</strong> Đối chiếu sâu theo lĩnh vực công nghiệp, dải sản phẩm/thiết bị, tệp khách hàng/nhà máy, kinh nghiệm triển khai thực tế, kỹ năng chuyên môn, ngoại ngữ, khu vực làm việc và khung thu nhập.</li>
  <li><strong>Giải thích điểm phù hợp trực quan:</strong> Cả Nhà tuyển dụng và Ứng viên đều nhìn thấy rõ <em>điểm mạnh đáp ứng tốt</em> và <em>khoảng trống cần bổ sung</em> trước khi kết nối, giảm tối đa thời gian phỏng vấn sai đối tượng.</li>
  <li><strong>AI JD Copilot &amp; AI CV Builder:</strong> Hỗ trợ Nhà tuyển dụng chuyển hóa mô tả công việc thô thành tin tuyển dụng chuẩn hóa trong vài phút; đồng thời giúp Ứng viên trình bày kinh nghiệm kỹ thuật &amp; doanh số B2B mạch lạc, ấn tượng chỉ với 3 bước.</li>
</ul>

<h2>4. Hệ sinh thái giải pháp toàn diện của inLink</h2>
<h3>4.1. Dành cho Doanh nghiệp tuyển dụng (tuyendung.inlink.vn)</h3>
<ul>
  <li><strong>Đăng tin &amp; Quản trị tuyển dụng (ATS tích hợp):</strong> Đăng tin chuẩn AI, theo dõi ứng viên theo bảng quy trình (Kanban), đặt lịch phỏng vấn, gửi email hàng loạt, báo cáo hiệu quả tuyển dụng và tham chiếu lương thị trường.</li>
  <li><strong>Chủ động tìm kiếm ứng viên AI:</strong> Lọc nhanh ứng viên tiềm năng theo đúng chuyên môn ngành, xem điểm phù hợp AI hoàn toàn miễn phí và chỉ dùng Credit khi chủ động mở liên hệ hồ sơ bạn thực sự ưng ý.</li>
  <li><strong>Dịch vụ Săn nhân sự công nghiệp (AI VIP):</strong> Kết hợp hệ thống AI quét nguồn ứng viên tự động liên tục cùng đội ngũ chuyên viên săn nhân sự am hiểu ngành, trực tiếp tiếp cận, thẩm định và bàn giao danh sách ứng viên sẵn sàng phỏng vấn cho doanh nghiệp.</li>
</ul>

<h3>4.2. Dành cho Ứng viên ngành công nghiệp (inlink.vn)</h3>
<ul>
  <li><strong>Hồ sơ năng lực &amp; CV chuẩn ngành công nghiệp:</strong> Xây dựng CV chuyên nghiệp miễn phí với AI, làm nổi bật dự án kỹ thuật, thiết bị từng vận hành hoặc thành tích doanh số B2B.</li>
  <li><strong>Gợi ý việc làm trúng đích:</strong> Nhận đề xuất cơ hội nghề nghiệp phù hợp năng lực từ các doanh nghiệp sản xuất, nhà thầu và công ty thương mại thiết bị đã được xác thực.</li>
  <li><strong>Chủ động &amp; An toàn dữ liệu:</strong> Theo dõi minh bạch từng bước đơn ứng tuyển, trò chuyện trực tiếp với Nhà tuyển dụng và được bảo vệ dữ liệu cá nhân nghiêm ngặt theo Nghị định 13/2023/NĐ-CP.</li>
</ul>

<h3>4.3. Mạng lưới Cộng tác viên &amp; Đối tác (ctv.inlink.vn)</h3>
<p>inLink phát triển chương trình <strong>Cộng tác viên giới thiệu doanh nghiệp</strong> với cơ chế ghi nhận tự động, theo dõi trạng thái minh bạch và chính sách hoa hồng rõ ràng — mở rộng mạng lưới kết nối giữa các doanh nghiệp công nghiệp trên toàn quốc.</p>

<h2>5. Cam kết chuẩn mực vận hành</h2>
<ol>
  <li><strong>Không biến nền tảng thành sàn tin rác:</strong> Mọi doanh nghiệp và tin tuyển dụng đều được kiểm duyệt minh bạch nhằm bảo vệ trải nghiệm ứng viên và uy tín thương hiệu tuyển dụng.</li>
  <li><strong>Chi phí rõ ràng — Không bẫy gia hạn ẩn:</strong> Doanh nghiệp chủ động lựa chọn gói dịch vụ theo đúng nhu cầu thực tế, không tự động trừ tiền gia hạn khi hết chu kỳ.</li>
  <li><strong>Tuân thủ pháp luật Việt Nam:</strong> Vận hành đầy đủ theo Nghị định 52/2013/NĐ-CP, Nghị định 85/2021/NĐ-CP về thương mại điện tử và Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.</li>
</ol>

<h2>6. Thông tin doanh nghiệp &amp; Kết nối cùng inLink</h2>
<ul>
  <li><strong>Đơn vị chủ quản:</strong> CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK</li>
  <li><strong>Cổng Ứng viên:</strong> <a href="https://inlink.vn">https://inlink.vn</a></li>
  <li><strong>Cổng Nhà tuyển dụng B2B:</strong> <a href="https://tuyendung.inlink.vn">https://tuyendung.inlink.vn</a></li>
  <li><strong>Cổng Cộng tác viên:</strong> <a href="https://ctv.inlink.vn">https://ctv.inlink.vn</a></li>
  <li><strong>Email hỗ trợ &amp; tư vấn hợp tác B2B:</strong> hotro@inlink.vn</li>
</ul>
<p>Dù bạn là <strong>Doanh nghiệp công nghiệp</strong> đang tìm kiếm kỹ sư, quản lý sản xuất hay đội ngũ kinh doanh B2B xuất sắc, hay là <strong>Ứng viên</strong> muốn bứt phá sự nghiệp trong ngành công nghiệp — <strong>inLink</strong> luôn sẵn sàng đồng hành để kết nối đúng người, đúng công việc, đúng thời điểm.</p>
`.trim(),
  },
  {
    slug: 'quy-che-hoat-dong',
    title: 'Quy chế hoạt động nền tảng tuyển dụng inLink',
    excerpt:
      'Quy chế quản lý hoạt động của sàn giao dịch kết nối tuyển dụng công nghiệp B2B inLink (inlink.vn & tuyendung.inlink.vn) theo Nghị định 52/2013/NĐ-CP và Nghị định 85/2021/NĐ-CP.',
    seoTitle: 'Quy chế hoạt động | inLink',
    seoDescription:
      'Quy chế hoạt động chính thức của nền tảng kết nối tuyển dụng công nghiệp inLink — nguyên tắc vận hành, quy trình giao dịch, kiểm duyệt tin và bảo vệ quyền lợi các bên.',
    bodyHtml: `
<p><strong>Đơn vị chủ quản:</strong> CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK (sau đây gọi tắt là <strong>inLink</strong>)<br/>
<strong>Website:</strong> https://inlink.vn · https://tuyendung.inlink.vn · https://ctv.inlink.vn<br/>
<strong>Email hỗ trợ:</strong> hotro@inlink.vn</p>

<h2>1. Nguyên tắc chung</h2>
<p>Nền tảng tuyển dụng <strong>inLink</strong> là hệ thống kết nối nhân lực ngành công nghiệp B2B (kỹ sư kinh doanh, kỹ thuật, sản xuất, vận hành, tự động hóa, M&amp;E…) ứng dụng trí tuệ nhân tạo (AI Matching hai chiều) giữa Ứng viên và Doanh nghiệp tuyển dụng.</p>
<ul>
  <li>Tổ chức, cá nhân tham gia giao dịch trên inLink tự do thỏa thuận trên cơ sở tôn trọng quyền và lợi ích hợp pháp của các bên, tuân thủ pháp luật Việt Nam.</li>
  <li>Mọi tin tuyển dụng, hồ sơ doanh nghiệp và hồ sơ ứng viên đăng tải trên inLink phải trung thực, rõ ràng, không vi phạm quy định pháp luật lao động và thuần phong mỹ tục.</li>
  <li>inLink đóng vai trò là nền tảng công nghệ trung gian kết nối, không phải bên sử dụng lao động trực tiếp đối với các vị trí do Doanh nghiệp đối tác đăng tuyển.</li>
</ul>

<h2>2. Quy định chung &amp; Đối tượng tham gia</h2>
<ul>
  <li><strong>Ứng viên:</strong> Cá nhân từ đủ 18 tuổi, có đầy đủ năng lực hành vi dân sự, tạo hồ sơ năng lực/CV để tìm kiếm cơ hội việc làm và kết nối với Doanh nghiệp.</li>
  <li><strong>Nhà tuyển dụng (Doanh nghiệp):</strong> Pháp nhân, doanh nghiệp có Mã số thuế (MST) hợp pháp tại Việt Nam, có nhu cầu tuyển dụng nhân sự thực tế. Doanh nghiệp phải hoàn tất xác minh MST/Giấy phép kinh doanh theo quy định của inLink để sử dụng đầy đủ quyền lợi.</li>
  <li><strong>Cộng tác viên (CTV):</strong> Cá nhân tham gia chương trình giới thiệu doanh nghiệp B2B sử dụng dịch vụ của inLink theo chính sách hoa hồng công bố công khai.</li>
</ul>

<h2>3. Quy trình giao dịch trên nền tảng</h2>
<h3>3.1. Quy trình dành cho Ứng viên</h3>
<ol>
  <li>Đăng ký tài khoản bằng Email (xác thực OTP) hoặc Đăng nhập bằng Google tại <strong>inlink.vn</strong>.</li>
  <li>Hoàn thiện hồ sơ năng lực hoặc tạo/tải lên CV (hỗ trợ hai nhánh chuyên môn: Kỹ thuật &amp; Kinh doanh B2B).</li>
  <li>Xem điểm mức độ phù hợp (% AI Matching), tìm kiếm việc làm, nộp hồ sơ ứng tuyển hoặc đồng ý kết nối và trò chuyện trực tiếp miễn phí với Nhà tuyển dụng.</li>
</ol>

<h3>3.2. Quy trình dành cho Nhà tuyển dụng</h3>
<ol>
  <li>Đăng ký tài khoản doanh nghiệp tại <strong>tuyendung.inlink.vn</strong> và xác minh thông tin doanh nghiệp (Mã số thuế duy nhất, Giấy phép đăng ký kinh doanh).</li>
  <li>Lựa chọn gói dịch vụ phù hợp (Gói Tin đăng, Gói Săn nhân sự, hoặc nạp Ví Credit) tại mục <strong>Bảng giá</strong>.</li>
  <li>Thanh toán qua chuyển khoản doanh nghiệp (VietQR) hoặc phương thức được hỗ trợ. Gói dịch vụ được kích hoạt tự động sau khi đối soát thành công.</li>
  <li>Đăng tin tuyển dụng, sử dụng AI chấm điểm &amp; tìm kiếm ứng viên phù hợp, quản lý quy trình phỏng vấn và tuyển dụng.</li>
</ol>

<h2>4. Quy trình kiểm duyệt tin tuyển dụng &amp; Bảo đảm an toàn</h2>
<ul>
  <li>inLink áp dụng cơ chế kiểm duyệt tự động và hậu kiểm đối với tin tuyển dụng. Nghiêm cấm các tin đăng lừa đảo, thu phí ứng viên trái phép, đa cấp biến tướng, hoặc sai lệch thông tin doanh nghiệp.</li>
  <li>Mỗi Mã số thuế doanh nghiệp chỉ được gắn duy nhất với một tài khoản doanh nghiệp để ngăn chặn hành vi giả mạo và lạm dụng gói miễn phí.</li>
  <li>inLink có quyền tạm ẩn, từ chối hoặc gỡ bỏ ngay lập tức các tin tuyển dụng/tài khoản vi phạm mà không cần báo trước.</li>
</ul>

<h2>5. Quyền và nghĩa vụ của Ban quản lý inLink</h2>
<ul>
  <li>Xây dựng, vận hành ổn định hạ tầng kỹ thuật và bảo mật thông tin người dùng theo tiêu chuẩn hiện hành.</li>
  <li>Cung cấp đầy đủ hóa đơn GTGT điện tử và đối soát minh bạch cho các giao dịch dịch vụ B2B hợp lệ.</li>
  <li>Tiếp nhận, phối hợp giải quyết khiếu nại, tranh chấp phát sinh giữa các bên trên nền tảng.</li>
</ul>

<h2>6. Quyền và nghĩa vụ của Thành viên</h2>
<ul>
  <li>Chịu hoàn toàn trách nhiệm về tính chính xác, hợp pháp của thông tin đăng tải (hồ sơ cá nhân, tin tuyển dụng, MST, GPKD).</li>
  <li>Bảo mật thông tin đăng nhập, mật khẩu và mã xác thực (OTP/MFA).</li>
  <li>Không sử dụng công cụ tự động (bot/crawl) để thu thập trái phép dữ liệu ứng viên hoặc phá hoại hệ thống.</li>
</ul>

<h2>7. Điều khoản áp dụng &amp; Cam kết</h2>
<p>Quy chế này có hiệu lực kể từ ngày công bố trên website <strong>inlink.vn</strong>. Khi có thay đổi, inLink sẽ thông báo công khai trên nền tảng trước khi áp dụng. Mọi thắc mắc vui lòng liên hệ <strong>hotro@inlink.vn</strong>.</p>
`.trim(),
  },
  {
    slug: 'dieu-khoan-dich-vu',
    title: 'Điều khoản dịch vụ inLink',
    excerpt:
      'Thỏa thuận sử dụng dịch vụ giữa CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK và người dùng (Ứng viên, Nhà tuyển dụng, Cộng tác viên) khi truy cập và sử dụng hệ sinh thái inLink.',
    seoTitle: 'Điều khoản dịch vụ | inLink',
    seoDescription:
      'Điều khoản sử dụng dịch vụ của nền tảng tuyển dụng công nghiệp inLink — quy định tài khoản, hành vi bị cấm, sở hữu trí tuệ và giới hạn trách nhiệm.',
    bodyHtml: `
<p>Chào mừng bạn đến với <strong>inLink</strong> — nền tảng kết nối nhân tài và doanh nghiệp công nghiệp do <strong>CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK</strong> vận hành. Việc bạn đăng ký tài khoản hoặc tiếp tục sử dụng dịch vụ đồng nghĩa với việc bạn đã đọc, hiểu và đồng ý tuân thủ toàn bộ Điều khoản dịch vụ này.</p>

<h2>1. Tài khoản &amp; Bảo mật truy cập</h2>
<ul>
  <li>Bạn cam kết cung cấp thông tin chính xác khi đăng ký tài khoản bằng Email/OTP hoặc Google Sign-In.</li>
  <li>Bạn tự chịu trách nhiệm bảo mật tài khoản, mật khẩu và mọi hoạt động phát sinh dưới tài khoản của mình.</li>
  <li>Đối với Nhà tuyển dụng: mỗi doanh nghiệp (định danh theo Mã số thuế hợp pháp) chỉ được đăng ký và xác minh 01 tài khoản doanh nghiệp chính thức. Hành vi tạo nhiều tài khoản để lạm dụng gói miễn phí hoặc Credit tặng sẽ bị khóa tài khoản vĩnh viễn.</li>
</ul>

<h2>2. Phạm vi dịch vụ &amp; Công nghệ AI Matching</h2>
<ul>
  <li>inLink cung cấp các công cụ: tạo/tải CV, chấm điểm mức độ phù hợp bằng AI, đăng tin tuyển dụng, tìm kiếm &amp; mở khóa hồ sơ ứng viên, dịch vụ Săn nhân sự và hệ thống quản lý tuyển dụng (ATS).</li>
  <li>Điểm % phù hợp do AI tính toán mang tính chất hỗ trợ ra quyết định dựa trên dữ liệu ứng viên và mô tả công việc (JD). Quyết định phỏng vấn, tuyển dụng và ký kết hợp đồng lao động hoàn toàn thuộc về Doanh nghiệp và Ứng viên.</li>
</ul>

<h2>3. Các hành vi bị nghiêm cấm</h2>
<ul>
  <li>Đăng tải tin tuyển dụng giả mạo, lừa đảo, yêu cầu ứng viên đóng phí đặt cọc/phí hồ sơ trái pháp luật.</li>
  <li>Sao chép, thu thập (scrape/crawl), mua bán hoặc phát tán dữ liệu hồ sơ ứng viên ra ngoài phạm vi tuyển dụng hợp pháp.</li>
  <li>Giả mạo doanh nghiệp khác, sử dụng Giấy phép kinh doanh hoặc Mã số thuế không thuộc quyền đại diện hợp pháp của mình.</li>
  <li>Gian lận trong chương trình Cộng tác viên (tự giới thiệu chính công ty mình đang làm việc/sở hữu, tạo đơn ảo để trục lợi hoa hồng).</li>
  <li>Phát tán mã độc, tấn công từ chối dịch vụ hoặc can thiệp trái phép vào hạ tầng kỹ thuật của inLink.</li>
</ul>

<h2>4. Quyền sở hữu trí tuệ</h2>
<p>Toàn bộ giao diện, mã nguồn, thuật toán AI Matching, thương hiệu <strong>inLink</strong>, logo, hình ảnh và nội dung do inLink biên soạn thuộc quyền sở hữu độc quyền của CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK. Người dùng giữ quyền sở hữu đối với nội dung CV/JD do mình tạo ra và cấp cho inLink quyền hiển thị, phân tích AI phục vụ mục đích kết nối tuyển dụng trên nền tảng.</p>

<h2>5. Tạm khóa &amp; Chấm dứt tài khoản</h2>
<p>inLink có quyền tạm ngưng hoặc chấm dứt quyền truy cập của tài khoản nếu phát hiện vi phạm nghiêm trọng Điều khoản dịch vụ, có yêu cầu từ cơ quan nhà nước có thẩm quyền, hoặc phát sinh hành vi gian lận gây thiệt hại cho cộng đồng người dùng.</p>

<h2>6. Giới hạn trách nhiệm &amp; Luật áp dụng</h2>
<p>inLink nỗ lực duy trì hệ thống hoạt động ổn định 24/7 nhưng không chịu trách nhiệm đối với các gián đoạn bất khả kháng (thiên tai, sự cố đường truyền diện rộng, tấn công mạng ngoài khả năng kiểm soát hợp lý). Điều khoản này được điều chỉnh và giải thích theo pháp luật nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.</p>

<h2>7. Liên hệ</h2>
<p>Mọi câu hỏi liên quan đến Điều khoản dịch vụ vui lòng gửi về email <strong>hotro@inlink.vn</strong>.</p>
`.trim(),
  },
  {
    slug: 'chinh-sach-quyen-rieng-tu',
    title: 'Chính sách quyền riêng tư',
    excerpt:
      'Cam kết bảo mật thông tin và giải thích cách inLink thu thập, sử dụng, chia sẻ và bảo vệ dữ liệu của Ứng viên, Nhà tuyển dụng và Cộng tác viên.',
    seoTitle: 'Chính sách quyền riêng tư | inLink',
    seoDescription:
      'Chính sách quyền riêng tư của inLink — minh bạch cách thu thập, sử dụng, chia sẻ và bảo vệ thông tin tài khoản, CV và dữ liệu doanh nghiệp.',
    bodyHtml: `
<p><strong>CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK</strong> tôn trọng và cam kết bảo vệ quyền riêng tư của mọi người dùng khi truy cập và sử dụng nền tảng <strong>inlink.vn</strong>.</p>

<h2>1. Thông tin chúng tôi thu thập</h2>
<ul>
  <li><strong>Thông tin tài khoản:</strong> Họ tên, địa chỉ email, mật khẩu (được băm mã hóa một chiều), thông tin xác thực Google (nếu đăng nhập bằng Google).</li>
  <li><strong>Thông tin Ứng viên:</strong> Số điện thoại, tỉnh/thành phố, kinh nghiệm làm việc, kỹ năng, học vấn, chứng chỉ, mục tiêu nghề nghiệp, ảnh đại diện và file CV bạn chủ động tải lên.</li>
  <li><strong>Thông tin Doanh nghiệp:</strong> Tên công ty, Mã số thuế, địa chỉ, thông tin liên hệ, Giấy phép đăng ký kinh doanh (lưu trữ riêng tư phục vụ xác minh), thông tin xuất hóa đơn GTGT.</li>
  <li><strong>Thông tin Cộng tác viên:</strong> Mã giới thiệu, lịch sử hoa hồng và hồ sơ xác thực KYC (CCCD, tài khoản ngân hàng nhận chi trả).</li>
  <li><strong>Dữ liệu kỹ thuật:</strong> Địa chỉ IP, loại trình duyệt, nhật ký truy cập phục vụ bảo mật, chống gian lận và cải thiện chất lượng dịch vụ.</li>
</ul>

<h2>2. Mục đích sử dụng thông tin</h2>
<ul>
  <li>Tạo lập, xác thực và quản lý tài khoản người dùng trên hệ sinh thái inLink.</li>
  <li>Phân tích hồ sơ bằng AI để gợi ý việc làm phù hợp cho Ứng viên và gợi ý ứng viên phù hợp cho Nhà tuyển dụng.</li>
  <li>Xác minh pháp nhân doanh nghiệp, chống giả mạo và bảo vệ cộng đồng ứng viên khỏi tin tuyển dụng lừa đảo.</li>
  <li>Xử lý thanh toán dịch vụ, xuất hóa đơn GTGT và đối soát chi trả hoa hồng CTV.</li>
  <li>Gửi thông báo về trạng thái ứng tuyển, lịch phỏng vấn, tin nhắn kết nối và hỗ trợ khách hàng.</li>
</ul>

<h2>3. Phạm vi chia sẻ thông tin</h2>
<p>inLink <strong>tuyệt đối không bán</strong> thông tin cá nhân của người dùng cho bên thứ ba. Dữ liệu chỉ được chia sẻ trong các trường hợp sau:</p>
<ul>
  <li>Khi Ứng viên chủ động nộp hồ sơ ứng tuyển hoặc đồng ý kết nối với một Nhà tuyển dụng cụ thể.</li>
  <li>Khi Nhà tuyển dụng đã xác minh sử dụng Credit/quyền lợi hợp lệ để mở khóa thông tin liên hệ của Ứng viên đang bật chế độ tìm việc.</li>
  <li>Với các đối tác hạ tầng kỹ thuật (máy chủ, gửi email giao dịch, xử lý AI, đối soát ngân hàng) theo thỏa thuận bảo mật chặt chẽ.</li>
  <li>Theo yêu cầu hợp pháp của cơ quan nhà nước có thẩm quyền.</li>
</ul>

<h2>4. Bảo mật &amp; Lưu trữ dữ liệu</h2>
<ul>
  <li>Mọi kết nối giữa trình duyệt và máy chủ inLink đều được mã hóa bằng giao thức HTTPS/TLS.</li>
  <li>Tài liệu nhạy cảm (Giấy phép kinh doanh, ảnh CCCD KYC, khóa API thanh toán) được lưu trữ tách biệt, mã hóa và kiểm soát phân quyền truy cập nghiêm ngặt.</li>
  <li>Hỗ trợ xác thực hai lớp (MFA qua Email OTP hoặc ứng dụng TOTP) để tăng cường an toàn tài khoản.</li>
</ul>

<h2>5. Quyền kiểm soát của bạn</h2>
<p>Bạn có toàn quyền cập nhật, chỉnh sửa hồ sơ, bật/tắt trạng thái tìm việc, tải xuống CV hoặc gửi yêu cầu xóa tài khoản và dữ liệu cá nhân bất kỳ lúc nào qua email <strong>hotro@inlink.vn</strong>.</p>
`.trim(),
  },
  {
    slug: 'bao-ve-du-lieu-ca-nhan',
    title: 'Chính sách bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP)',
    excerpt:
      'Thông báo xử lý và bảo vệ dữ liệu cá nhân tuân thủ Nghị định 13/2023/NĐ-CP của Chính phủ, quy định rõ quyền của chủ thể dữ liệu và trách nhiệm của inLink.',
    seoTitle: 'Bảo vệ dữ liệu cá nhân (NĐ 13/2023) | inLink',
    seoDescription:
      'Chính sách bảo vệ dữ liệu cá nhân của inLink theo Nghị định 13/2023/NĐ-CP — phân loại dữ liệu, mục đích xử lý AI, quyền của chủ thể dữ liệu và đầu mối liên hệ.',
    bodyHtml: `
<p>Chính sách này được ban hành bởi <strong>CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK</strong> nhằm tuân thủ đầy đủ các quy định tại <strong>Nghị định số 13/2023/NĐ-CP</strong> ngày 17/04/2023 của Chính phủ về bảo vệ dữ liệu cá nhân.</p>

<h2>1. Phân loại dữ liệu cá nhân được xử lý</h2>
<h3>1.1. Dữ liệu cá nhân cơ bản</h3>
<ul>
  <li>Họ và tên, ngày/năm sinh, địa chỉ liên hệ, email, số điện thoại, ảnh đại diện.</li>
  <li>Trình độ học vấn, chứng chỉ, lịch sử công việc, kỹ năng chuyên môn, mức lương kỳ vọng và định hướng nghề nghiệp trong hồ sơ/CV.</li>
</ul>
<h3>1.2. Dữ liệu cá nhân nhạy cảm (chỉ thu thập khi cần thiết theo từng vai trò)</h3>
<ul>
  <li>Thông tin định danh CCCD và số tài khoản ngân hàng của Cộng tác viên phục vụ xác thực KYC và kê khai thuế thu nhập cá nhân khi chi trả hoa hồng.</li>
  <li>Dữ liệu vị trí khu vực làm việc mong muốn để AI gợi ý cơ hội việc làm gần nơi sinh sống.</li>
</ul>

<h2>2. Cách thức &amp; Mục đích xử lý dữ liệu</h2>
<ul>
  <li>Dữ liệu được thu thập trực tiếp khi người dùng tự khai báo, tải CV lên hệ thống hoặc thông qua cơ chế đăng nhập Google khi có sự đồng ý rõ ràng.</li>
  <li>Hệ thống AI của inLink trích xuất kỹ năng, kinh nghiệm từ CV và so khớp với yêu cầu công việc (JD) để tạo điểm % phù hợp và gợi ý kết nối hai chiều.</li>
  <li>Dữ liệu được lưu trữ an toàn trên hạ tầng máy chủ bảo mật trong suốt thời gian tài khoản hoạt động hoặc theo thời hạn lưu trữ chứng từ kế toán, thuế do pháp luật quy định.</li>
</ul>

<h2>3. Quyền của Chủ thể dữ liệu (theo Điều 9 Nghị định 13/2023/NĐ-CP)</h2>
<p>Khi sử dụng inLink, bạn có đầy đủ các quyền sau đối với dữ liệu cá nhân của mình:</p>
<ul>
  <li><strong>Quyền được biết</strong> về hoạt động xử lý dữ liệu cá nhân của mình.</li>
  <li><strong>Quyền đồng ý hoặc không đồng ý</strong> cho phép xử lý dữ liệu cá nhân.</li>
  <li><strong>Quyền truy cập, xem, chỉnh sửa</strong> hoặc yêu cầu chỉnh sửa dữ liệu cá nhân.</li>
  <li><strong>Quyền rút lại sự đồng ý</strong> đã cấp trước đó.</li>
  <li><strong>Quyền yêu cầu xóa dữ liệu</strong> hoặc <strong>hạn chế xử lý dữ liệu</strong>.</li>
  <li><strong>Quyền yêu cầu cung cấp dữ liệu</strong> cá nhân của chính mình (bao gồm tải xuống bản CV PDF).</li>
  <li><strong>Quyền phản đối xử lý dữ liệu</strong> nhằm ngăn chặn hoặc hạn chế tiết lộ dữ liệu cho mục đích tiếp thị.</li>
  <li><strong>Quyền khiếu nại, tố cáo, khởi kiện</strong> và yêu cầu bồi thường thiệt hại theo quy định pháp luật.</li>
</ul>

<h2>4. Hậu quả, thiệt hại không mong muốn có thể xảy ra &amp; Biện pháp phòng ngừa</h2>
<p>Mặc dù inLink áp dụng các biện pháp bảo mật kỹ thuật (mã hóa TLS, mã hóa khóa AES-256-GCM, phân quyền tối thiểu, xác thực MFA, nhật ký kiểm toán), môi trường mạng luôn tiềm ẩn rủi ro tấn công mạng bất khả kháng. Trong trường hợp xảy ra sự cố an ninh dữ liệu, inLink cam kết thông báo kịp thời tới cơ quan chức năng và chủ thể dữ liệu trong vòng 72 giờ theo đúng quy định của Nghị định 13/2023/NĐ-CP.</p>

<h2>5. Đầu mối tiếp nhận yêu cầu về Dữ liệu cá nhân</h2>
<p>Mọi yêu cầu thực thi quyền chủ thể dữ liệu (xem, chỉnh sửa, rút lại sự đồng ý, xóa dữ liệu) vui lòng gửi về:<br/>
<strong>Bộ phận Bảo vệ Dữ liệu Cá nhân — CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK</strong><br/>
Email: <strong>hotro@inlink.vn</strong> (Thời gian phản hồi trong vòng 72 giờ làm việc).</p>
`.trim(),
  },
  {
    slug: 'dieu-kien-giao-dich-chung',
    title: 'Điều kiện giao dịch chung',
    excerpt:
      'Quy định chung về việc đặt mua, báo giá, thuế GTGT (VAT), kích hoạt và sử dụng các gói dịch vụ tuyển dụng B2B trên nền tảng inLink.',
    seoTitle: 'Điều kiện giao dịch chung | inLink',
    seoDescription:
      'Điều kiện giao dịch chung cho các gói Tin đăng, Gói Săn nhân sự và Ví Credit trên nền tảng tuyển dụng inLink.',
    bodyHtml: `
<p>Điều kiện giao dịch chung này áp dụng cho tất cả các giao dịch mua gói dịch vụ tuyển dụng giữa Khách hàng (Doanh nghiệp / Nhà tuyển dụng) và <strong>CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK</strong> trên hệ thống <strong>inlink.vn</strong> và <strong>tuyendung.inlink.vn</strong>.</p>

<h2>1. Danh mục dịch vụ cung cấp</h2>
<ul>
  <li><strong>Gói Tin đăng tuyển dụng (Tầng 1):</strong> Bao gồm Gói Khám phá (miễn phí dành cho doanh nghiệp đã xác minh MST hợp lệ), Gói Tin đăng, Gói Tin đăng Plus, Gói Doanh nghiệp và Gói Enterprise.</li>
  <li><strong>Gói Săn nhân sự chủ động (Tầng 2):</strong> Dịch vụ tìm kiếm, sàng lọc và bàn giao hồ sơ ứng viên công nghiệp theo chiến dịch.</li>
  <li><strong>Nạp Ví Credit (Top-up):</strong> Mua thêm Credit dùng cho các thao tác mở khóa thông tin liên hệ ứng viên, sử dụng tính năng AI nâng cao. Credit mua thêm có thời hạn bảo lưu dài hạn theo chính sách công bố trên bảng giá.</li>
</ul>

<h2>2. Giá dịch vụ &amp; Thuế giá trị gia tăng (VAT)</h2>
<ul>
  <li>Giá niêm yết trên trang <strong>Bảng giá (/bang-gia)</strong> là đơn giá tính bằng Đồng Việt Nam (VNĐ) và <strong>chưa bao gồm thuế GTGT (VAT)</strong> trừ khi có ghi chú khác.</li>
  <li>Tại bước tạo đơn thanh toán, hệ thống tự động tính và hiển thị minh bạch: <em>Giá dịch vụ + Thuế VAT (theo thuế suất hiện hành) = Tổng tiền thanh toán</em>.</li>
  <li>inLink cam kết không tự động gia hạn (no auto-charge) và không thu phụ phí ẩn.</li>
</ul>

<h2>3. Xác lập giao dịch &amp; Hiệu lực dịch vụ</h2>
<ul>
  <li>Giao dịch được xác lập khi Khách hàng chọn gói dịch vụ, tạo đơn hàng trên hệ thống và hoàn tất thanh toán đúng tổng số tiền (bao gồm VAT).</li>
  <li>Thời hạn sử dụng của từng gói (ví dụ: 30 ngày hiển thị tin hoặc theo chu kỳ gói) được ghi rõ trên trang Bảng giá và trong mục <strong>Gói dịch vụ &amp; Ví Credit</strong> của doanh nghiệp.</li>
  <li>Đối với các gói Tin đăng lẻ (Tin đăng / Tin đăng Plus), doanh nghiệp có quyền chủ động kích hoạt trong vòng 30 ngày kể từ ngày mua; thời hạn hiển thị và Credit kèm gói bắt đầu tính tại thời điểm kích hoạt.</li>
</ul>

<h2>4. Xuất hóa đơn điện tử GTGT</h2>
<p>inLink xuất hóa đơn GTGT điện tử hợp lệ theo thông tin pháp nhân (Tên công ty, Mã số thuế, Địa chỉ) đã khai báo trong mục <strong>Hồ sơ công ty</strong>. Doanh nghiệp có trách nhiệm kiểm tra và cập nhật chính xác thông tin xuất hóa đơn trước khi thanh toán.</p>
`.trim(),
  },
  {
    slug: 'chinh-sach-thanh-toan-hoan-huy',
    title: 'Chính sách thanh toán, giao nhận dịch vụ & hoàn hủy',
    excerpt:
      'Hướng dẫn phương thức thanh toán chuyển khoản doanh nghiệp (VietQR), thời gian kích hoạt dịch vụ điện tử và chính sách xử lý hoàn/hủy giao dịch trên inLink.',
    seoTitle: 'Thanh toán, giao nhận dịch vụ & hoàn hủy | inLink',
    seoDescription:
      'Chi tiết phương thức thanh toán VietQR doanh nghiệp, kích hoạt dịch vụ tức thời và chính sách hoàn hủy minh bạch trên inLink.',
    bodyHtml: `
<h2>1. Phương thức thanh toán</h2>
<p>Nhằm đáp ứng chuẩn kế toán và xuất hóa đơn GTGT cho doanh nghiệp B2B tại Việt Nam, inLink áp dụng phương thức thanh toán chính là <strong>Chuyển khoản ngân hàng doanh nghiệp (VietQR / NAPAS 247)</strong>:</p>
<ul>
  <li>Khi tạo đơn hàng, hệ thống tự động sinh <strong>mã VietQR động</strong> đã điền sẵn Số tài khoản công ty inLink, Số tiền chính xác (đã gồm VAT) và <strong>Mã nội dung chuyển khoản riêng</strong> (ví dụ: <code>INLINK123456</code>).</li>
  <li>Doanh nghiệp có thể quét mã QR hoặc chuyển khoản từ tài khoản ngân hàng công ty theo đúng số tiền và nội dung hiển thị.</li>
  <li>Ngoài ra, đối với khách hàng quốc tế hoặc theo thỏa thuận riêng, inLink có thể hỗ trợ thanh toán thẻ qua cổng thanh toán quốc tế (khi được kích hoạt).</li>
</ul>

<h2>2. Chính sách giao nhận &amp; kích hoạt dịch vụ số</h2>
<p>Do toàn bộ sản phẩm trên inLink là <strong>dịch vụ tuyển dụng trực tuyến (dịch vụ số)</strong> nên không phát sinh vận chuyển vật lý:</p>
<ul>
  <li><strong>Kích hoạt tự động:</strong> Ngay khi hệ thống nhận được báo có ngân hàng khớp mã nội dung và đủ số tiền, gói dịch vụ / Credit sẽ được cộng tự động vào tài khoản doanh nghiệp trong vòng <strong>1 – 5 phút</strong> (24/7).</li>
  <li><strong>Đối soát thủ công:</strong> Trường hợp kế toán chuyển khoản thiếu hoặc ghi sai mã nội dung, vui lòng gửi Ủy nhiệm chi về email <strong>hotro@inlink.vn</strong> để bộ phận kế toán xác nhận và kích hoạt trong vòng 02 giờ làm việc.</li>
  <li><strong>Hóa đơn điện tử GTGT:</strong> Được phát hành và gửi qua email doanh nghiệp trong vòng 24 giờ làm việc kể từ khi thanh toán được xác nhận.</li>
</ul>

<h2>3. Chính sách hoàn tiền &amp; hủy giao dịch</h2>
<ul>
  <li><strong>Hủy đơn chưa thanh toán:</strong> Khách hàng có thể bỏ qua hoặc yêu cầu hủy bất kỳ đơn hàng nào đang ở trạng thái <em>Chờ thanh toán</em> mà không mất phí.</li>
  <li><strong>Trường hợp được hoàn tiền 100%:</strong>
    <ul>
      <li>Khách hàng chuyển khoản thừa tiền hoặc thanh toán trùng lặp cho cùng một đơn hàng do lỗi kỹ thuật.</li>
      <li>Hệ thống inLink gặp sự cố kỹ thuật nghiêm trọng kéo dài khiến dịch vụ đã thanh toán hoàn toàn không thể kích hoạt hoặc sử dụng, và lỗi thuộc về inLink.</li>
    </ul>
  </li>
  <li><strong>Trường hợp không áp dụng hoàn tiền:</strong> Gói dịch vụ/Credit đã được kích hoạt thành công và đã phát sinh sử dụng một phần hoặc toàn bộ quyền lợi (đã đăng tin, đã mở khóa hồ sơ ứng viên, đã triển khai chiến dịch Săn nhân sự), hoặc tài khoản bị khóa do vi phạm Điều khoản dịch vụ.</li>
  <li><strong>Thời gian hoàn tiền:</strong> Trong vòng <strong>05 – 07 ngày làm việc</strong> kể từ khi hai bên xác nhận biên bản hoàn tiền, tiền sẽ được chuyển trả về đúng tài khoản ngân hàng doanh nghiệp đã thanh toán ban đầu.</li>
</ul>
`.trim(),
  },
  {
    slug: 'giai-quyet-khieu-nai',
    title: 'Cơ chế giải quyết khiếu nại & tranh chấp',
    excerpt:
      'Quy trình tiếp nhận, xác minh và giải quyết mọi khiếu nại, phản ánh hoặc tranh chấp phát sinh giữa Ứng viên, Nhà tuyển dụng, Cộng tác viên và inLink.',
    seoTitle: 'Giải quyết khiếu nại & tranh chấp | inLink',
    seoDescription:
      'Quy trình 4 bước giải quyết khiếu nại, phản ánh tin tuyển dụng vi phạm và tranh chấp giao dịch minh bạch trên nền tảng inLink.',
    bodyHtml: `
<p><strong>CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK</strong> luôn đề cao tính minh bạch và cam kết bảo vệ quyền lợi chính đáng của Ứng viên, Nhà tuyển dụng và Cộng tác viên thông qua cơ chế tiếp nhận, giải quyết khiếu nại rõ ràng.</p>

<h2>1. Các trường hợp tiếp nhận khiếu nại</h2>
<ul>
  <li>Phản ánh tin tuyển dụng có dấu hiệu lừa đảo, sai sự thật, thu phí ứng viên trái phép hoặc doanh nghiệp giả mạo.</li>
  <li>Khiếu nại về lỗi kỹ thuật hệ thống, sai lệch số dư Ví Credit, chậm kích hoạt gói dịch vụ sau khi đã chuyển khoản.</li>
  <li>Khiếu nại về đối soát ghi nhận khách hàng, khóa Mã số thuế hoặc tính toán hoa hồng Cộng tác viên.</li>
  <li>Yêu cầu xử lý vi phạm bản quyền, xâm phạm quyền riêng tư hoặc dữ liệu cá nhân.</li>
</ul>

<h2>2. Kênh tiếp nhận khiếu nại chính thức</h2>
<ul>
  <li><strong>Email tiếp nhận:</strong> hotro@inlink.vn (Tiêu đề ghi rõ: <em>[Khiếu nại] + Nội dung tóm tắt</em>).</li>
  <li><strong>Thông tin cần cung cấp:</strong> Họ tên/Tên doanh nghiệp, email tài khoản, mã đơn hàng hoặc đường dẫn tin tuyển dụng liên quan, mô tả sự việc kèm ảnh chụp/chứng từ (nếu có).</li>
</ul>

<h2>3. Quy trình 4 bước giải quyết</h2>
<ol>
  <li><strong>Bước 1 — Tiếp nhận &amp; Xác nhận (trong vòng 24 giờ làm việc):</strong> Bộ phận Chăm sóc khách hàng ghi nhận hồ sơ khiếu nại và gửi email xác nhận mã tiếp nhận.</li>
  <li><strong>Bước 2 — Xác minh &amp; Bảo vệ tạm thời (1 – 3 ngày làm việc):</strong> inLink kiểm tra nhật ký hệ thống, chứng từ giao dịch và liên hệ các bên liên quan. Đối với tin tuyển dụng bị tố cáo lừa đảo có căn cứ, inLink sẽ tạm ẩn tin ngay lập tức để bảo vệ ứng viên.</li>
  <li><strong>Bước 3 — Đưa ra phương án xử lý (trong vòng 03 – 07 ngày làm việc):</strong> Thông báo kết quả xác minh và biện pháp khắc phục (hoàn Credit, kích hoạt lại gói, điều chỉnh đối soát, hoặc khóa tài khoản vi phạm).</li>
  <li><strong>Bước 4 — Đóng hồ sơ hoặc giải quyết theo pháp luật:</strong> Trường hợp các bên không đạt được thỏa thuận qua thương lượng, hòa giải, một trong các bên có quyền đưa vụ việc ra Tòa án nhân dân có thẩm quyền tại Việt Nam để giải quyết theo quy định pháp luật.</li>
</ol>
`.trim(),
  },
  {
    slug: 'cai-dat-cookie',
    title: 'Chính sách & Cài đặt Cookie',
    excerpt:
      'Giải thích các loại Cookie được sử dụng trên nền tảng inLink (phiên đăng nhập, ghi nhận giới thiệu CTV 14 ngày, tối ưu hiệu năng) và cách quản lý Cookie trên trình duyệt.',
    seoTitle: 'Chính sách & Cài đặt Cookie | inLink',
    seoDescription:
      'Tìm hiểu cách inLink sử dụng Cookie để bảo mật phiên đăng nhập, ghi nhận giới thiệu CTV và tối ưu trải nghiệm người dùng.',
    bodyHtml: `
<p>Trang này giải thích cách <strong>inLink</strong> sử dụng Cookie và các công nghệ lưu trữ cục bộ tương tự khi bạn truy cập <strong>inlink.vn</strong>, <strong>tuyendung.inlink.vn</strong> và <strong>ctv.inlink.vn</strong>.</p>

<h2>1. Cookie là gì?</h2>
<p>Cookie là các tệp văn bản nhỏ được trình duyệt lưu trên thiết bị của bạn khi truy cập website. Cookie giúp hệ thống ghi nhớ trạng thái đăng nhập an toàn, tùy chọn giao diện và cải thiện tốc độ tải trang.</p>

<h2>2. Các loại Cookie inLink sử dụng</h2>
<h3>2.1. Cookie thiết yếu (Bắt buộc)</h3>
<ul>
  <li><strong>Cookie phiên đăng nhập (<code>il_refresh</code>):</strong> Cookie bảo mật dạng <code>HttpOnly</code> dùng để duy trì phiên đăng nhập an toàn giữa các tên miền phụ (<code>inlink.vn</code>, <code>tuyendung.inlink.vn</code>, <code>ctv.inlink.vn</code>) mà không làm lộ mã xác thực ra mã nguồn trình duyệt.</li>
  <li><strong>Lưu trữ cài đặt cục bộ:</strong> Ghi nhớ trạng thái bộ lọc tìm kiếm việc làm và trải nghiệm sử dụng cơ bản.</li>
</ul>

<h3>2.2. Cookie chức năng &amp; Ghi nhận giới thiệu (Affiliate)</h3>
<ul>
  <li><strong>Cookie giới thiệu CTV (<code>il_ref</code>):</strong> Khi bạn nhấn vào liên kết giới thiệu của Cộng tác viên inLink, cookie này được lưu tối đa <strong>14 ngày</strong> nhằm ghi nhận quyền lợi hoa hồng minh bạch cho người giới thiệu khi doanh nghiệp đăng ký và sử dụng dịch vụ.</li>
</ul>

<h3>2.3. Cookie phân tích &amp; đo lường hiệu năng</h3>
<ul>
  <li>Giúp inLink thống kê lưu lượng truy cập ẩn danh, phát hiện lỗi kỹ thuật và tối ưu tốc độ hiển thị trang web.</li>
</ul>

<h2>3. Cách quản lý hoặc tắt Cookie</h2>
<p>Bạn có thể chủ động xem, xóa hoặc chặn Cookie bất kỳ lúc nào trong phần <strong>Cài đặt (Settings) → Quyền riêng tư &amp; Bảo mật → Cookie</strong> trên trình duyệt (Chrome, Safari, Edge, Firefox). Lưu ý rằng việc tắt Cookie thiết yếu có thể khiến bạn không thể duy trì trạng thái đăng nhập hoặc sử dụng đầy đủ các tính năng của inLink.</p>

<h2>4. Liên hệ</h2>
<p>Nếu có câu hỏi về Chính sách Cookie, vui lòng liên hệ <strong>hotro@inlink.vn</strong>.</p>
`.trim(),
  },
  {
    slug: 'hoi-dap',
    title: 'Hỏi đáp ứng viên (FAQ)',
    excerpt:
      'Giải đáp các câu hỏi thường gặp dành cho ứng viên khi tạo hồ sơ, tạo CV bằng AI và ứng tuyển việc làm công nghiệp trên inLink.',
    seoTitle: 'Hỏi đáp ứng viên | inLink',
    seoDescription:
      'Câu hỏi thường gặp về cách tạo hồ sơ ứng viên, tạo CV bằng AI, cách AI Matching chấm điểm phù hợp và bảo mật thông tin trên inLink.',
    bodyHtml: `
<h2>1. Làm thế nào để tạo hồ sơ và CV bằng AI trên inLink?</h2>
<p>Sau khi đăng nhập tài khoản Ứng viên tại <strong>inlink.vn</strong>, bạn có thể tải lên CV có sẵn (PDF/DOCX) tại mục <strong>Tạo CV &amp; Hồ sơ AI</strong> để hệ thống tự động trích xuất kinh nghiệm, kỹ năng và đề xuất mẫu CV chuẩn ngành công nghiệp B2B.</p>

<h2>2. Điểm phù hợp AI Matching được tính như thế nào?</h2>
<p>AI Matching của inLink đối chiếu đa chiều giữa hồ sơ ứng viên (ngành hàng công nghiệp, nhóm vị trí Kinh doanh/Kỹ thuật, năm kinh nghiệm, kỹ năng chuyên môn, khu vực làm việc, mức lương kỳ vọng) với yêu cầu thực tế của Doanh nghiệp để hiển thị mức độ phù hợp minh bạch.</p>

<h2>3. Thông tin cá nhân của tôi có được bảo mật không?</h2>
<p>inLink tuân thủ nghiêm ngặt <strong>Nghị định 13/2023/NĐ-CP</strong> về bảo vệ dữ liệu cá nhân. Số điện thoại và email của bạn chỉ được hiển thị cho Nhà tuyển dụng đã xác thực khi bạn chủ động ứng tuyển hoặc đồng ý mở kết nối.</p>

<h2>4. Cần hỗ trợ thêm?</h2>
<p>Nếu gặp khó khăn khi sử dụng tài khoản hoặc ứng tuyển, vui lòng gửi email về <strong>hotro@inlink.vn</strong> để được đội ngũ hỗ trợ phản hồi trong giờ hành chính.</p>
`.trim(),
  },
  {
    slug: 'goc-bao-chi',
    title: 'Góc báo chí & Truyền thông',
    excerpt:
      'Thông tin chính thức, bộ nhận diện thương hiệu và đầu mối liên hệ truyền thông của CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK.',
    seoTitle: 'Góc báo chí & Truyền thông | inLink',
    seoDescription:
      'Thông tin chính thức và đầu mối liên hệ báo chí, truyền thông của nền tảng tuyển dụng công nghiệp B2B inLink.',
    bodyHtml: `
<h2>1. Giới thiệu nhanh về inLink</h2>
<p><strong>inLink</strong> là nền tảng công nghệ kết nối nhân tài chuyên sâu cho ngành công nghiệp B2B tại Việt Nam (kỹ sư kinh doanh, tự động hóa, cơ điện M&amp;E, sản xuất, vận hành, thiết bị công nghiệp…), ứng dụng trí tuệ nhân tạo AI Matching hai chiều giúp doanh nghiệp rút ngắn thời gian tuyển đúng người.</p>

<h2>2. Thông tin pháp nhân</h2>
<ul>
  <li><strong>Đơn vị chủ quản:</strong> CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK</li>
  <li><strong>Hệ sinh thái nền tảng:</strong> inlink.vn (Ứng viên) · tuyendung.inlink.vn (Doanh nghiệp) · ctv.inlink.vn (Cộng tác viên)</li>
</ul>

<h2>3. Liên hệ báo chí &amp; Truyền thông</h2>
<p>Các cơ quan báo chí, đối tác sự kiện hoặc tổ chức cần thông cáo báo chí, dữ liệu thị trường lao động công nghiệp hoặc bộ nhận diện thương hiệu inLink, vui lòng liên hệ qua email: <strong>hotro@inlink.vn</strong>.</p>
`.trim(),
  },
  {
    slug: 'tuyen-dung',
    title: 'Tuyển dụng tại inLink',
    excerpt:
      'Gia nhập đội ngũ inLink để cùng xây dựng nền tảng tuyển dụng công nghiệp ứng dụng AI hàng đầu Việt Nam.',
    seoTitle: 'Tuyển dụng tại inLink | inLink',
    seoDescription:
      'Cơ hội nghề nghiệp tại CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK — môi trường công nghệ, tuyển dụng B2B và dữ liệu AI.',
    bodyHtml: `
<h2>1. Về đội ngũ inLink</h2>
<p>Tại <strong>inLink</strong>, chúng tôi kết hợp công nghệ AI với sự am hiểu sâu sắc ngành công nghiệp sản xuất và thương mại B2B để giải quyết bài toán tuyển dụng nhân sự kỹ thuật &amp; kinh doanh chất lượng cao tại Việt Nam.</p>

<h2>2. Các nhóm vị trí thường xuyên tuyển dụng</h2>
<ul>
  <li><strong>Kinh doanh giải pháp tuyển dụng B2B (Account Executive / B2B Sales)</strong></li>
  <li><strong>Chuyên viên Tư vấn &amp; Săn nhân sự công nghiệp (Industrial Headhunter / Talent Partner)</strong></li>
  <li><strong>Kỹ sư phần mềm Fullstack / AI &amp; Data Engineer</strong></li>
  <li><strong>Chuyên viên Marketing B2B &amp; Phát triển cộng đồng</strong></li>
</ul>

<h2>3. Cách thức ứng tuyển</h2>
<p>Gửi CV của bạn về địa chỉ email <strong>hotro@inlink.vn</strong> với tiêu đề <em>[Ứng tuyển inLink] Họ tên - Vị trí</em>. Bộ phận Nhân sự sẽ liên hệ phản hồi trong vòng 03 ngày làm việc đối với các hồ sơ phù hợp.</p>
`.trim(),
  },
  {
    slug: 'lien-he',
    title: 'Liên hệ hợp tác & Tư vấn B2B',
    excerpt:
      'Thông tin liên hệ chính thức dành cho Doanh nghiệp tuyển dụng, Ứng viên và Đối tác hợp tác với nền tảng inLink.',
    seoTitle: 'Liên hệ hợp tác & Tư vấn B2B | inLink',
    seoDescription:
      'Liên hệ CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK để được tư vấn gói tuyển dụng B2B, dịch vụ Săn nhân sự công nghiệp và hỗ trợ tài khoản.',
    bodyHtml: `
<h2>1. Thông tin liên hệ chính thức</h2>
<ul>
  <li><strong>Đơn vị chủ quản:</strong> CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK</li>
  <li><strong>Email hỗ trợ &amp; tư vấn B2B:</strong> hotro@inlink.vn</li>
  <li><strong>Cổng Nhà tuyển dụng:</strong> https://tuyendung.inlink.vn</li>
  <li><strong>Cổng Ứng viên:</strong> https://inlink.vn</li>
  <li><strong>Cổng Cộng tác viên:</strong> https://ctv.inlink.vn</li>
</ul>

<h2>2. Thời gian làm việc</h2>
<p>Thứ 2 – Thứ 6: 08:30 – 17:30 · Thứ 7: 08:30 – 12:00 (trừ ngày Lễ, Tết theo quy định).</p>

<h2>3. Dành cho Doanh nghiệp cần tư vấn gói dịch vụ</h2>
<p>Nếu doanh nghiệp của bạn đang cần tuyển gấp kỹ sư kinh doanh, kỹ sư tự động hóa, quản lý sản xuất hoặc gói <strong>Săn nhân sự công nghiệp</strong>, hãy gửi yêu cầu về <strong>hotro@inlink.vn</strong> kèm tên công ty, vị trí cần tuyển và số điện thoại liên hệ — đội ngũ chuyên viên B2B của inLink sẽ phản hồi trong vòng 2 giờ làm việc.</p>
`.trim(),
  },
];

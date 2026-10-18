import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarClock,
  CirclePercent,
  Contact,
  FileText,
  UserRound,
  Inbox,
  Kanban,
  Landmark,
  LayoutDashboard,
  NotebookPen,
  Percent,
  PieChart,
  Radio,
  Receipt,
  Scale,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type { DocGroup } from '@/lib/admin-docs-content';

/**
 * Nội dung trang /crm/docs. Mô tả hành vi THỰC TẾ của CRM — khi đổi logic
 * ở API/web, cập nhật lại mục tương ứng ở đây.
 */
export const CRM_DOC_GROUPS: DocGroup[] = [
  {
    id: 'nen-tang',
    title: 'Nền tảng',
    description: 'CRM là chỗ bán hàng, chăm khách, hóa đơn và cộng tác viên. Gói vẫn bật ở cổng thanh toán hoặc do SuperAdmin tick.',
    flow: ['Lead', 'Báo giá', 'Phễu', 'Khách trả trên web', 'Sổ khách', 'Hóa đơn và hoa hồng'],
    sections: [
      {
        id: 'vai-tro',
        title: 'Ai được vào CRM',
        icon: ShieldCheck,
        summary: 'SuperAdmin, trưởng phòng và nhân viên kinh doanh. Biên tập viên không vào CRM.',
        keywords: ['sale', 'superadmin', 'quyền', 'phân quyền'],
        blocks: [
          {
            type: 'statuses',
            title: 'Trong CRM',
            items: [
              { label: 'SuperAdmin', tone: 'navy', code: 'super_admin', text: 'Thấy mọi lead, deal, báo giá, khách, đơn đã trả và hoa hồng. Đặt mức hoa hồng, ngày chi, thuế suất và mẫu tờ. Tạo tài khoản ở mục người dùng.' },
              { label: 'Trưởng phòng kinh doanh', tone: 'blue', code: 'sales_manager', text: 'Thấy CRM của cả đội và chuyển người phụ trách. Thấy bảng nhân sự và chỉ thêm được nhân viên kinh doanh. Không sửa, không xóa tài khoản. Không vào SuperAdmin, không đặt hoa hồng, thuế suất, ngân sách hay mẫu tờ.' },
              { label: 'Nhân viên kinh doanh', tone: 'slate', code: 'sales', text: 'Thấy lead, deal, nhật ký, báo giá và khách của mình. Không thấy bảng nhân sự và không sửa tài khoản. Không vào SuperAdmin.' },
              { label: 'Biên tập viên', tone: 'slate', code: 'editor', text: 'Làm nội dung ở SuperAdmin. Không có quyền CRM.' },
            ],
          },
          {
            type: 'p',
            text: 'Nền tảng có ba loại tài khoản: nhà tuyển dụng, ứng viên và cộng tác viên. CRM không có loại tài khoản nhà máy. Chữ nhà máy trên một số màn hình là cách gọi công ty nhà tuyển dụng đang trả tiền.',
          },
        ],
      },
      {
        id: 'ranh-gioi',
        title: 'CRM không bật gói',
        icon: Wallet,
        summary: 'Gói tin và gói Săn chỉ bật khi khách trả online, hoặc SuperAdmin tick trên danh sách công ty.',
        keywords: ['thanh toán', 'đơn', 'credit', 'sepay', 'stripe', 'công nợ'],
        blocks: [
          {
            type: 'steps',
            title: 'Gói được bật ở đâu',
            items: [
              { actor: 'Nhà tuyển dụng', title: 'Trả trên inlink', text: 'Khách chọn gói trên web và thanh toán. Cổng xác nhận đã trả thì hệ thống ghi một đơn vào sổ billing và bật gói. Stripe đang chạy. Bản test dùng thanh toán giả.' },
              { actor: 'SuperAdmin', title: 'Tick trên danh sách công ty', text: 'SuperAdmin gán gói bằng tay ở khu quản trị. Việc này không đi qua CRM.' },
              { actor: 'CRM', title: 'Theo dõi và gửi giấy tờ', text: 'Lead, báo giá, phễu, hóa đơn và hoa hồng nằm ở đây. Bước Đã chốt và Chờ thanh toán là trạng thái bán hàng. Chúng không tạo đơn và không cộng Credit.' },
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            title: 'Thanh toán online',
            text: 'inlink nhận tiền online và tự duyệt gói tin, gói Săn khi cổng báo đã trả. CRM không tạo đơn thu hộ. Công nợ chỉ có ở hợp đồng Enterprise: chốt tờ thì các đợt theo phần trăm thành khoản phải thu, ghi đã thu không bật gói. SePay chưa nối, vì đang test trên cổng giả.',
          },
        ],
      },
      {
        id: 'thanh-tren',
        title: 'Thanh trên',
        icon: Search,
        summary: 'Ô tìm và lối tắt nằm trên mọi trang CRM, cạnh chuông thông báo.',
        keywords: ['tìm kiếm', 'việc hẹn', 'thông báo'],
        blocks: [
          {
            type: 'list',
            items: [
              'Ô tìm ghi Tìm tiềm năng, liên hệ, khách hàng. Gõ từ 2 ký tự thì hiện tiềm năng và khách hàng. Bấm một dòng mở hồ sơ công ty. Nhấn Enter thì bàn làm việc lọc theo từ đó.',
              'Việc hẹn mở Nhật ký, nơi có ngày gọi lại. Có lịch hẹn thì hiện số đỏ.',
              'Tạo tiềm năng mở trang Tiềm năng. Tài liệu mở trang này. Chuông mở thông báo.',
              'Vòng tròn bên phải là chữ cái của người đang đăng nhập.',
            ],
          },
        ],
      },
      {
        id: 'ban-lam-viec',
        title: 'Bàn làm việc',
        icon: LayoutDashboard,
        href: '/crm',
        summary: 'Tháng đang chọn: đơn đã trả, doanh số gói, công nợ Enterprise và việc của người phụ trách.',
        keywords: ['bàn làm việc', 'nhân viên xuất sắc', 'còn phải thu'],
        blocks: [
          {
            type: 'list',
            items: [
              'Chọn tháng, không quá tháng hiện tại theo giờ Việt Nam.',
              'Doanh số đã thu là đơn gói tin và gói Săn, giá lớn hơn 0, chưa VAT. Đã thu Enterprise là các đợt ghi thu trong tháng. Còn phải thu là mọi đợt Enterprise đang mở.',
              'Biểu đồ năm và doanh số theo nguồn cộng đơn đã trả với đợt Enterprise đã ghi thu. Nguồn lấy theo lead sớm nhất của công ty.',
              'Nhân viên xuất sắc chỉ xếp người có tiền đã thu trong tháng. Chưa có thì hiện câu chưa có tiền đã thu.',
              'Việc trong tháng gồm lead mới, cơ hội, báo giá, đơn đã trả và doanh số của người phụ trách. Giá niêm yết trên cơ hội không cộng vào doanh số.',
              'Khi ô tìm có chữ, bảng tháng ẩn và hiện danh sách khớp.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'kinh-doanh',
    title: 'Kinh doanh',
    description: 'Sidebar Kinh doanh đi từ tiềm năng, khách hàng, cơ hội, báo giá, đơn hàng, rồi báo cáo. Doanh số mở trong Báo cáo. Khách tự mua sẽ nằm trong sổ khách.',
    flow: ['Tiềm năng', 'Khách hàng', 'Cơ hội', 'Báo giá', 'Đơn hàng', 'Báo cáo'],
    sections: [
      {
        id: 'lead',
        title: 'Tiềm năng',
        icon: Building2,
        href: '/crm/leads',
        summary: 'Khách chưa mua hoặc đang được chăm. Bắt buộc mã số thuế, tên công ty, người liên hệ và nguồn.',
        keywords: ['mst', 'vietqr', 'địa chỉ', 'việc cần làm', 'lý do mất', 'chuyển sale'],
        blocks: [
          {
            type: 'steps',
            title: 'Nhập lead',
            items: [
              { actor: 'Sale', title: 'Gõ mã số thuế', text: 'Ô mã số thuế đứng trước. Từ 2 số, hệ thống gợi ý công ty đã có trên inlink. Đủ 10 hoặc 13 số mà chưa có trên inlink thì hỏi sổ thuế VietQR.' },
              { actor: 'Sale', title: 'Chọn gợi ý', text: 'Chọn một dòng thì điền tên công ty và địa chỉ. Người liên hệ và số điện thoại vẫn nhập tay. Chưa bấm lưu thì chưa tạo lead.' },
              { actor: 'Sale', title: 'Hẹn việc cần làm', text: 'Ngày hẹn lưu thành 09:00 giờ Việt Nam. Xóa ngày trên form sửa thì bỏ hẹn. Trang Nhật ký có danh sách đến hạn.' },
            ],
          },
          {
            type: 'list',
            title: 'Quy tắc lead',
            items: [
              'Bắt buộc mã số thuế, tên công ty, người liên hệ và nguồn. Điện thoại, email, Zalo, chức danh, tổ chức và địa chỉ không bắt buộc.',
              'Địa chỉ dùng 34 tỉnh, thành từ 01/7/2025. Không có cấp quận, huyện. Phường, xã ghi bằng chữ.',
              'Đánh mất thì phải ghi lý do, ít nhất 2 ký tự. Lý do vào nhật ký.',
              'Trùng mã số thuế, số điện thoại từ 9 số, hoặc cùng một công ty với lead còn hiệu lực thì báo lead đã có.',
              'Sale sửa và xóa lead của mình. SuperAdmin sửa và xóa lead của mọi sale. Xóa tiềm năng thì xóa cơ hội và nhật ký gắn với lead đó. Công ty trên inlink và đơn đã trả vẫn giữ. Nút hiện khi rê chuột vào dòng hoặc khi tick ô chọn.',
              'Nguồn khách là kênh marketing đang bật. Kênh tắt không hiện trong ô chọn. Nguồn Cộng tác viên thì chọn thêm người giới thiệu.',
            ],
          },
        ],
      },
      {
        id: 'bao-gia',
        title: 'Báo giá',
        icon: FileText,
        href: '/crm/quotes',
        summary: 'Tờ chào giá gói đang bán, hoặc hợp đồng Enterprise theo đợt phần trăm. Giá ghi chưa VAT, tổng thanh toán cộng thuế suất lúc lập tờ.',
        keywords: ['báo giá', 'phương án', 'pdf', 'vat', 'enterprise'],
        blocks: [
          {
            type: 'steps',
            title: 'Lập tờ',
            items: [
              { actor: 'Sale', title: 'Chọn loại tờ', text: 'Gói đang bán: phương án 1 là bắt buộc, phương án 2 có thể bỏ trống, hai phương án không trùng một gói và không cộng lại. Enterprise: ghi tên gói, giá trị hợp đồng và từ 2 đến 6 đợt. Mỗi đợt có tên, tỉ lệ nguyên và hạn. Các đợt cộng đủ 100%.' },
              { actor: 'Hệ thống', title: 'Chụp giá', text: 'Giá gói tin là giá niêm yết, giá gói Săn là phí Săn, đúng số SuperAdmin đang đặt. Thuế suất lúc lập tờ được giữ trên tờ. Đã đặt thì mỗi phương án có tiền VAT và tổng thanh toán. Chưa đặt thì thanh toán bằng giá chưa VAT.' },
              { actor: 'SuperAdmin', title: 'Mẫu tờ', text: 'Nút Mẫu tờ trên trang Báo giá. SuperAdmin tải logo và ghi tên pháp lý, mã số thuế, địa chỉ, điện thoại, email, website, tài khoản và điều khoản. Sale không sửa mẫu. Chưa điền thì tờ vẫn xuất được.' },
              { actor: 'Sale', title: 'Xuất tờ', text: 'Nút Xuất PDF mở hộp in của trình duyệt. Tờ ghi đầu công ty, số, ngày báo giá, hạn hiệu lực, khách, điện thoại và email liên hệ, hai phương án hoặc các đợt Enterprise, điều khoản, tài khoản và chữ ký. Mỗi phương án có giá chưa VAT, tiền VAT và tổng thanh toán. Hai phương án không cộng. Đợt Enterprise ghi số chưa VAT và số phải chuyển.' },
            ],
          },
          {
            type: 'callout',
            tone: 'tip',
            title: 'Tờ này chỉ để gửi',
            text: 'Lập báo giá không tạo đơn, không bật gói và không kéo deal sang bước Đã gửi báo giá. Gói tin và gói Săn khách vẫn tự thanh toán trên inlink. Tờ Enterprise khi bấm Chốt hợp đồng thì các đợt thành công nợ. Ghi đã thu một đợt không bật gói. SuperAdmin kích hoạt Enterprise sau. Mã số thuế khớp một công ty đã có thì tờ được gắn với công ty đó. Sale xóa tờ của mình, SuperAdmin xóa tờ của mọi sale. Tờ đã ghi thu thì không xóa. Xóa tờ đã chốt mà chưa ghi thu thì công nợ của tờ đó mất.',
          },
        ],
      },
      {
        id: 'pheu',
        title: 'Cơ hội',
        icon: Kanban,
        href: '/crm/pipeline',
        summary: 'Cơ hội cho gói tin và gói Săn. Xem danh sách hoặc kanban. Đổi bước không gán gói.',
        keywords: ['deal', 'đã chốt', 'chờ thanh toán', 'enterprise'],
        blocks: [
          {
            type: 'statuses',
            title: 'Các bước',
            items: [
              { label: 'Lead mới', tone: 'slate', code: 'new', text: 'Deal vừa mở.' },
              { label: 'Đã tư vấn', tone: 'blue', code: 'consulting', text: 'Đã nói chuyện với khách.' },
              { label: 'Đã gửi báo giá', tone: 'blue', code: 'quoted', text: 'Sale tự chuyển khi đã gửi tờ. Lập tờ ở mục Báo giá không tự nhảy bước này.' },
              { label: 'Chờ thanh toán', tone: 'amber', code: 'awaiting_payment', text: 'Khách được nhắc tự trả trên inlink. CRM không tạo đơn.' },
              { label: 'Đã chốt', tone: 'green', code: 'won', text: 'Trạng thái bán hàng. Không bật gói và không ghi hoa hồng.' },
              { label: 'Không chốt', tone: 'red', code: 'lost', text: 'Bắt buộc lý do, ít nhất 2 ký tự.' },
            ],
          },
          {
            type: 'list',
            items: [
              'Form tạo có tiềm năng, tên cơ hội, gói, giai đoạn và ngày kỳ vọng. Liên hệ, nguồn và chiến dịch lấy từ tiềm năng đã chọn. Giá niêm yết và tỉ lệ thành công hiện theo gói và giai đoạn, không gõ tay. Bước Không chốt cần lý do. Chọn giai đoạn không tạo đơn và không bật gói.',
              'Chọn Danh sách hoặc Kanban. Danh sách có tên cơ hội, gói đã chọn, số tiền niêm yết, giai đoạn, ngày kỳ vọng hoặc ngày kết thúc, người thực hiện và ngày tạo.',
              'Đơn đã trả hiện trên deal khi deal đã có trước lúc khách trả, và cùng công ty cùng gói. Bước phễu không tự chạy theo đơn.',
              'Nhà tuyển dụng bấm tư vấn Enterprise trên bảng giá thì tạo lead và deal cho SuperAdmin đang hoạt động sớm nhất. Deal đó không có giá niêm yết. SuperAdmin không gửi yêu cầu này từ bảng giá.',
              'Sale xóa cơ hội của mình. SuperAdmin xóa cơ hội của mọi sale. Xóa cơ hội không xóa tiềm năng và không hủy đơn đã trả.',
            ],
          },
        ],
      },
      {
        id: 'khach-hang',
        title: 'Khách hàng',
        icon: Contact,
        href: '/crm/customers',
        summary: 'Sổ công ty: đang dùng, hết hạn hoặc chưa mua. Bấm hồ sơ để xem gói, credit và đơn.',
        keywords: ['sổ khách', 'đang dùng', 'hết hạn', 'hồ sơ', 'khám phá'],
        blocks: [
          {
            type: 'statuses',
            title: 'Trạng thái',
            items: [
              { label: 'Đang dùng', tone: 'green', text: 'Gói tin hoặc gói Săn còn hiệu lực. Khám phá 0đ vẫn là đang dùng khi hạn chưa hết.' },
              { label: 'Hết hạn', tone: 'amber', text: 'Từng có gói hoặc từng trả một đơn giá lớn hơn 0, nhưng hiện không còn gói sống.' },
              { label: 'Chưa mua', tone: 'slate', text: 'Có lead gắn công ty, chưa có gói và chưa có đơn gói đã trả.' },
            ],
          },
          {
            type: 'list',
            items: [
              'Tìm theo tên công ty, mã số thuế, người liên hệ hoặc số điện thoại. Sale chỉ thấy công ty mình phụ trách qua lead hoặc deal.',
              'Sổ hiện người liên hệ, bộ phận, điện thoại, email, lĩnh vực và địa chỉ từ lead gắn công ty. Bộ phận nhập ở Tiềm năng.',
              'Lead chưa gắn công ty vẫn nằm ở trang Tiềm năng.',
              'Hồ sơ một công ty gồm gói đang chạy, hạn, credit, tin đang đăng, đơn đã trả, số hóa đơn và cộng tác viên nếu có. Sổ này không gán gói và không xóa tài khoản công ty. Đơn hàng đã trả cũng không xóa từ CRM.',
            ],
          },
        ],
      },
      {
        id: 'khach-tu-mua',
        title: 'Khách tự mua',
        icon: Inbox,
        href: '/crm/inbox',
        summary: 'Công ty đã trả gói nhưng chưa có lead. Ai nhận thì người đó phụ trách. Sẽ nằm trong sổ khách hàng, không còn mục riêng trên sidebar.',
        keywords: ['nhận khách', 'tự mua', 'chưa có lead'],
        blocks: [
          {
            type: 'p',
            text: 'Hàng đợi gồm công ty có đơn gói tin hoặc gói Săn đã trả, giá lớn hơn 0, và chưa có lead còn hiệu lực gắn công ty đó. Bấm Nhận khách tạo lead cho người bấm, nguồn Web. Nếu đã có lead cùng mã số thuế của chính người bấm, hoặc SuperAdmin nhận, thì gắn lead đó. Lead của người khác không bị lấy. Không tạo deal và không bật gói.',
          },
        ],
      },
      {
        id: 'bao-cao',
        title: 'Báo cáo',
        icon: BarChart3,
        href: '/crm/bao-cao',
        summary: 'Sáu báo cáo kinh doanh. Doanh số mở ở đây, không nằm trên sidebar.',
        keywords: ['báo cáo', 'phễu', 'nguồn', 'gia hạn', 'cộng tác viên'],
        blocks: [
          {
            type: 'list',
            items: [
              'Doanh số: đơn gói đã trả trong tháng, theo người phụ trách, nguồn và cộng tác viên. Tách gói tin với gói Săn. Bước Đã chốt không cộng vào tiền.',
              'Phễu cơ hội: số cơ hội và giá niêm yết theo giai đoạn. Ngày kỳ vọng trong tháng là dự kiến, không phải doanh số.',
              'Nguồn tiềm năng: lead tạo trong tháng theo nguồn và người phụ trách, kèm công ty đã trả gói sau lead đó.',
              'Báo giá: tờ gói đang bán tách bản thảo và đã gửi, phương án 1 và phương án 2 để riêng. Enterprise đếm riêng: giá trị đã chốt chỉ tờ đã chốt có ngày báo giá trong tháng, còn của tờ trong tháng là đợt đang mở của các tờ đó, đã ghi thu trong tháng là mọi đợt ghi trong tháng.',
              'Gia hạn: gói hết hạn trong tháng. Có đơn trả tiếp thì là đã gia hạn. Báo cáo này không bật gói. Khám phá 0đ không vào bảng.',
              'Cộng tác viên: tiền khách đã trả gắn mã giới thiệu. Không hiện số hoa hồng.',
            ],
          },
        ],
      },
      {
        id: 'doanh-so',
        title: 'Doanh số',
        icon: PieChart,
        href: '/crm/reports',
        summary: 'Mở từ Báo cáo. Một tháng theo người phụ trách, nguồn và cộng tác viên. Tiền là đơn đã trả, tách gói tin và gói Săn.',
        keywords: ['báo cáo', 'tháng', 'doanh số', 'nguồn'],
        blocks: [
          {
            type: 'table',
            title: 'Mỗi cột đếm gì',
            head: ['Cột', 'Cách đếm'],
            rows: [
              ['Lead', 'Lead tạo trong tháng đang chọn, giờ Việt Nam. Lead loại bỏ không đếm.'],
              ['Đơn đã trả', 'Đơn gói tin hoặc gói Săn, trạng thái đã trả, giá lớn hơn 0, trả trong tháng đó.'],
              ['Gói tin / Gói Săn', 'Cùng các đơn đó, tách theo loại gói. Tổng là cộng hai cột.'],
              ['Theo cộng tác viên', 'Số khách đã trả trên khoản hoa hồng của tháng. Không phải số tiền hoa hồng.'],
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            text: 'Đơn gắn với lead sớm nhất của công ty, kể cả lead tạo từ tháng trước. Công ty trả tiền mà chưa có lead thì SuperAdmin thấy ở nhóm Chưa có người phụ trách. Bước Đã chốt không được cộng vào tiền.',
          },
        ],
      },
    ],
  },
  {
    id: 'cham-soc',
    title: 'Chăm sóc',
    description: 'Việc cần làm và khách sắp hết gói.',
    sections: [
      {
        id: 'nhat-ky',
        title: 'Nhật ký',
        icon: NotebookPen,
        href: '/crm/activities',
        summary: 'Ghi cuộc gọi, ghi chú và ngày hẹn. Dòng thanh toán do hệ thống ghi khi khách đã trả.',
        keywords: ['nhật ký', 'follow-up', 'thanh toán'],
        blocks: [
          {
            type: 'p',
            text: 'Form nhật ký không tạo loại thanh toán. Khi khách trả một gói, hệ thống thêm một dòng, mỗi đơn một dòng, người ghi hiện là inlink. Ngày hẹn trên form được tính là 09:00 giờ Việt Nam.',
          },
        ],
      },
      {
        id: 'gia-han',
        title: 'Gia hạn',
        icon: CalendarClock,
        href: '/crm/renewals',
        summary: 'Khách sắp hết gói. Thẻ hiện credit còn và số tin đang đăng.',
        keywords: ['gia hạn', 'credit', 'tin đang đăng'],
        blocks: [
          {
            type: 'list',
            items: [
              'Mỗi thẻ có credit còn và số tin đang ở trạng thái đăng.',
              'Chưa có tin đăng thì thẻ có dòng Chưa đăng tin.',
              'Tạo deal gia hạn là việc bán hàng. Deal đó không bật gói mới. Khách trả trên web thì gói mới chạy theo đơn.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'tai-chinh',
    title: 'Tài chính',
    description: 'Hóa đơn là giấy tờ. Hoa hồng ghi sau khi khách đã trả. Đã chi trừ ví inlink, chưa chuyển khoản.',
    flow: ['Khách trả', 'Ghi hoa hồng', 'Chốt kỳ', 'Cho phép chi', 'Đã chi'],
    sections: [
      {
        id: 'hoa-don',
        title: 'Hóa đơn',
        icon: Receipt,
        href: '/crm/finance',
        summary: 'Ghi số hóa đơn cho đơn gói đã trả. Mỗi đơn một số. VAT trên đơn là mức lúc khách trả.',
        keywords: ['hóa đơn', 'vat', 'sổ', 'csv'],
        blocks: [
          {
            type: 'list',
            items: [
              'Chỉ đơn gói tin hoặc gói Săn, đã trả, giá lớn hơn 0. Nạp Credit không vào sổ này.',
              'Mức VAT giữ theo lúc khách trả. Chưa đặt lúc đó thì để trống. Sửa số hóa đơn sau đó không đổi mức đã giữ và không lấy mức đang đặt để điền lại.',
              'Sổ có giá chưa VAT, tiền VAT và số khách đã trả. Doanh số dùng giá chưa VAT. Tải sổ ra file CSV của cả sổ, không theo ô tìm trên màn hình. File này không gồm công nợ.',
              'Công nợ chỉ hiện khi hợp đồng Enterprise đã chốt. Các đợt đang mở nằm phía trên sổ hóa đơn. Ghi đã thu cả một đợt, không bật gói.',
              'Một số hóa đơn không ghi cho hai đơn.',
            ],
          },
        ],
      },
      {
        id: 'doi-soat',
        title: 'Đối soát',
        icon: Scale,
        href: '/crm/finance/reconciliation',
        summary: 'Mỗi đơn đã trả có thể có một dòng hoa hồng, trạng thái chờ đối soát.',
        keywords: ['hoa hồng', 'đối soát', 'chờ đối soát'],
        blocks: [
          {
            type: 'p',
            text: 'Dòng hoa hồng chỉ tạo khi khách trả gói tin hoặc gói Săn, giá lớn hơn 0, và mức hoa hồng đang đặt từ 1% đến 30%. Tiền hoa hồng làm tròn nửa lên. Nạp Credit và đơn 0đ không có dòng. Bước Đã chốt trên phễu không tạo dòng. Sale thấy dòng của cộng tác viên mình tạo, hoặc của công ty mình phụ trách. SuperAdmin thấy tất cả.',
          },
        ],
      },
      {
        id: 'ky-chot',
        title: 'Kỳ chốt',
        icon: CalendarCheck,
        href: '/crm/finance/periods',
        summary: 'Mỗi cộng tác viên một tháng. Chốt tháng đã xong, không chốt tháng đang chạy.',
        keywords: ['kỳ', 'chốt', 'tháng'],
        blocks: [
          {
            type: 'p',
            text: 'Tháng tính theo lịch Việt Nam. Vào phút thứ 10 mỗi giờ, hệ thống chốt tháng trước nếu tháng đó đã kết thúc, nên ngày 31 hoặc ngày cuối tháng 2 vẫn nằm trong kỳ. SuperAdmin chốt tay được. Chốt kỳ không trừ ví. Kỳ hệ thống chốt thì không ghi người chốt.',
          },
        ],
      },
      {
        id: 'ke-toan',
        title: 'Kế toán',
        icon: Landmark,
        href: '/crm/finance/accounting',
        summary: 'SuperAdmin cho phép chi. Đã chi ghi ngày và trừ đúng khoản của kỳ khỏi ví inlink.',
        keywords: ['đã chi', 'ví', 'bảng kê', 'ngày chi'],
        blocks: [
          {
            type: 'steps',
            title: 'Đường chi hoa hồng',
            items: [
              { actor: 'SuperAdmin', title: 'Cho phép chi', text: 'Kỳ đã chốt được duyệt thì sang kế toán. Kỳ chưa duyệt ở lại ví.' },
              { actor: 'Kế toán', title: 'Đã chi', text: 'Ghi ngày chi và trừ đúng số hoa hồng của kỳ đó khỏi ví inlink. Không gửi chuyển khoản ngân hàng.' },
              { actor: 'Hệ thống', title: 'Giữ sổ cho đúng', text: 'Ví không đủ thì kỳ quay lại trạng thái được chi. Bấm Đã chi hai lần không trừ hai lần. Tải bảng kê CSV gồm kỳ được chi và kỳ đã chi.' },
            ],
          },
          {
            type: 'callout',
            tone: 'warn',
            title: 'Ví này không phải Credit của khách',
            text: 'Ví hoa hồng là số dư cộng tác viên trên inlink. Credit nhà tuyển dụng dùng để đăng tin là một sổ khác. Ngày chi trong cài đặt không tự đánh dấu Đã chi.',
          },
        ],
      },
    ],
  },
  {
    id: 'tang-truong',
    title: 'Tăng trưởng',
    description: 'Cộng tác viên, link giới thiệu và nhà tuyển dụng đăng ký nhưng chưa mua.',
    flow: ['Click link', 'Cookie 14 ngày', 'Đăng ký nhà tuyển dụng', 'Trả gói', 'Ghi hoa hồng'],
    sections: [
      {
        id: 'ctv',
        title: 'Cộng tác viên',
        icon: Users,
        href: '/crm/partners',
        summary: 'Hai cách có mã. Mỗi tài khoản một mã. Một mức hoa hồng cho tất cả.',
        keywords: ['ctv', 'mã', 'giới thiệu', 'cookie'],
        blocks: [
          {
            type: 'list',
            title: 'Tạo mã',
            items: [
              'Sale hoặc SuperAdmin tạo trong CRM bằng tên và số điện thoại.',
              'Nhà tuyển dụng mở menu Cộng tác viên trên site của mình và đăng ký. Hệ thống cấp mã và link. Đăng ký lại thì trả mã cũ.',
              'Số điện thoại đã có cộng tác viên thì không nhận. Không lấy mã của người khác bằng cách gõ lại số.',
              'Mã có dạng CTV kèm 4 ký tự. Link public là trang bảng giá với ?ref=mã.',
            ],
          },
          {
            type: 'steps',
            title: 'Khi nào có hoa hồng',
            items: [
              { actor: 'Khách', title: 'Bấm link', text: 'Cookie giữ mã và thời điểm bấm trong 14 ngày. Lần bấm sau cùng được tính. Mã không tồn tại thì xóa cookie.' },
              { actor: 'Khách', title: 'Đăng ký nhà tuyển dụng', text: 'Tài khoản phải được tạo sau lần bấm, trong cửa sổ 14 ngày. SuperAdmin và tài khoản đã có trước lần bấm không được gắn hoa hồng.' },
              { actor: 'Khách', title: 'Trả một gói', text: 'Gói tin hoặc gói Săn, giá lớn hơn 0. Nạp Credit và gói 0đ không tính. Mức % lấy tại lúc trả. Đổi % sau đó không viết lại dòng cũ.' },
            ],
          },
          {
            type: 'p',
            text: 'Danh sách hiện doanh số tháng này: tiền khách đã trả gói tin hoặc gói Săn qua mã, giá lớn hơn 0, chưa VAT. Hoa hồng không cộng vào doanh số. Bấm hồ sơ để xem đơn trong tháng, đăng ký chưa trả, ví và khóa mã số thuế.',
          },
          {
            type: 'p',
            text: 'Khóa mã số thuế giữ một MST cho một cộng tác viên, tối đa 30 mã. Việc này không tạo tài khoản. Sale chỉ khóa cộng tác viên mình tạo. Nếu lead còn hiệu lực đã giữ MST đó cho người khác thì không khóa được. Ô nhập ghi tên công ty.',
          },
        ],
      },
      {
        id: 'dang-ky-chua-tra',
        title: 'Đăng ký chưa trả',
        icon: UserPlus,
        href: '/crm/signups',
        summary: 'Nhà tuyển dụng đến từ link cộng tác viên nhưng chưa mua gói có giá.',
        keywords: ['đăng ký', 'chưa trả', 'signup'],
        blocks: [
          {
            type: 'p',
            text: 'Trang này liệt kê đăng ký gắn với cộng tác viên mà chưa có đơn gói đã trả. Khi khách trả một gói có giá, hoa hồng nằm ở Đối soát, không còn là đăng ký chưa trả.',
          },
        ],
      },
    ],
  },
  {
    id: 'marketing',
    title: 'Marketing',
    description: 'Kênh, chiến dịch và chi phí. Báo cáo ROI và nối API kênh để sau.',
    flow: ['Kênh', 'Chiến dịch', 'Chi phí'],
    sections: [
      {
        id: 'kenh',
        title: 'Kênh',
        icon: Radio,
        href: '/crm/marketing/channels',
        summary: 'Mười kênh chuẩn hiện thành thẻ. SuperAdmin bật, tắt hoặc thêm kênh.',
        keywords: ['kênh', 'facebook', 'zalo', 'youtube', 'tiktok'],
        blocks: [
          {
            type: 'list',
            items: [
              'Kênh sở hữu: Web, Zalo, Sự kiện, Cộng tác viên. Kênh social: Facebook, Instagram, TikTok, LinkedIn, X, YouTube.',
              'Mở trang Kênh thì hệ thống thêm kênh chuẩn còn thiếu. Kênh đã tắt giữ nguyên trạng thái tắt.',
              'SuperAdmin bật hoặc tắt từng kênh, và thêm kênh mới bằng tên. Sale xem được danh sách, không tắt kênh và không thêm kênh.',
              'Kênh tắt không dùng cho chiến dịch mới. Thêm kênh là một dòng dữ liệu, không sửa logic chiến dịch.',
            ],
          },
        ],
      },
      {
        id: 'chien-dich',
        title: 'Chiến dịch và chi phí',
        icon: BookOpen,
        href: '/crm/marketing/campaigns',
        summary: 'Sale thấy chiến dịch của mình và gắn cơ hội của mình. SuperAdmin đặt ngân sách và ghi chi phí.',
        keywords: ['chiến dịch', 'chi phí', 'ngân sách'],
        blocks: [
          {
            type: 'p',
            text: 'Chi phí ghi ngày, số tiền VND, chiến dịch và kênh. Hoa hồng cộng tác viên không nhập vào chi phí marketing. Báo cáo ROI, link theo dõi và nối API từng mạng chưa có.',
          },
        ],
      },
    ],
  },
  {
    id: 'cai-dat',
    title: 'Cài đặt',
    description: 'Hồ sơ từng nhân sự, và ba mức SuperAdmin đặt một lần cho cả hệ thống.',
    sections: [
      {
        id: 'nhan-su',
        title: 'Bảng nhân sự',
        icon: Users,
        href: '/crm/settings/staff',
        summary: 'Cùng tài khoản với Người dùng ở Admin. Xóa ở đây thì bên Admin cũng mất.',
        keywords: ['nhân sự', 'tài khoản', 'trưởng phòng'],
        blocks: [
          {
            type: 'list',
            items: [
              'SuperAdmin thêm, sửa và xóa nhân viên hoặc trưởng phòng.',
              'Trưởng phòng thấy bảng và chỉ thêm nhân viên kinh doanh.',
              'Nhân viên không thấy mục này và không sửa được bảng.',
            ],
          },
        ],
      },
      {
        id: 'ho-so',
        title: 'Hồ sơ nhân sự',
        icon: UserRound,
        href: '/crm/settings/profile',
        summary: 'Ảnh, tên, ngày sinh, giới tính, điện thoại và địa chỉ. Email đăng nhập chỉ xem.',
        keywords: ['hồ sơ', 'ảnh đại diện', 'ngày sinh'],
        blocks: [
          {
            type: 'list',
            items: [
              'Nhân viên và trưởng phòng chỉ sửa hồ sơ của chính mình.',
              'SuperAdmin chọn nhân sự rồi sửa. Trưởng phòng không sửa hộ người khác.',
              'Địa chỉ chọn tỉnh, thành theo địa giới từ 01/07/2025, không còn cấp huyện.',
            ],
          },
        ],
      },
      {
        id: 'hoa-hong',
        title: 'Hoa hồng',
        icon: Percent,
        href: '/crm/settings/commission',
        summary: 'Một mức từ 0% đến 30% cho mọi cộng tác viên.',
        keywords: ['phần trăm', 'hoa hồng'],
        blocks: [
          {
            type: 'p',
            text: 'SuperAdmin sửa. Sale xem được mức đang đặt. Mức 0 không tạo dòng hoa hồng. Dòng đã ghi giữ % tại lúc khách trả.',
          },
        ],
      },
      {
        id: 'ngay-chi',
        title: 'Ngày chi',
        icon: CalendarClock,
        href: '/crm/settings/payout-day',
        summary: 'Ngày trong tháng để kế toán nhớ chi. Mặc định ngày 10, chọn từ 1 đến 28.',
        keywords: ['ngày chi', 'payout'],
        blocks: [
          {
            type: 'p',
            text: 'Đến ngày này hệ thống nhắc. Nó không tự đánh dấu Đã chi và không trừ ví. Việc trừ ví vẫn là nút Đã chi trên kế toán.',
          },
        ],
      },
      {
        id: 'thue-suat',
        title: 'Thuế suất',
        icon: CirclePercent,
        href: '/crm/settings/vat',
        summary: 'Một mức cho cả site. Báo giá mới và đơn thanh toán mới cộng thêm mức này.',
        keywords: ['vat', 'thuế', 'bảng giá'],
        blocks: [
          {
            type: 'list',
            items: [
              'Chưa đặt thì bảng giá, tờ báo giá và thanh toán không ghi một mức cụ thể. Khách trả đúng giá niêm yết.',
              'Đã đặt thì bảng giá nêu mức đó. Tờ mới và đơn mới cộng tiền VAT làm tròn đồng vào số khách trả. Giá niêm yết không đổi.',
              'Tờ và đơn giữ mức tại lúc tạo. Đổi mức sau không sửa tờ cũ, không sửa đơn đã tạo và không đổi giá gói.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'chua-lam',
    title: 'Để sau',
    description: 'Những phần đã thống nhất chưa làm trong lúc đang test.',
    sections: [
      {
        id: 'viec-de-sau',
        title: 'Chưa có trong CRM',
        icon: Inbox,
        summary: 'Báo cáo ROI, SePay và chi hoa hồng qua ngân hàng.',
        keywords: ['marketing', 'facebook', 'tiktok', 'instagram', 'linkedin', 'youtube', 'sepay', 'ngân hàng'],
        blocks: [
          {
            type: 'list',
            items: [
              'Báo cáo ROI, link theo dõi và nối API kênh chưa có. Kênh, chiến dịch và chi phí đã có ở mục Marketing. Nguồn trên lead, link cộng tác viên và đăng ký chưa trả vẫn đang chạy.',
              'SePay: khi có tài khoản cổng thì nối vào cùng sổ đơn hiện tại. Trong lúc test vẫn dùng thanh toán giả.',
              'Chi hoa hồng ra ngân hàng: hiện dừng ở bảng kê và nút Đã chi trên ví inlink.',
            ],
          },
        ],
      },
    ],
  },
];

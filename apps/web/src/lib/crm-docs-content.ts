import {
  Building2,
  CalendarCheck,
  CalendarClock,
  CirclePercent,
  Contact,
  FileText,
  Inbox,
  Kanban,
  Landmark,
  NotebookPen,
  Percent,
  PieChart,
  Receipt,
  Scale,
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
        summary: 'Chỉ SuperAdmin và Sale. Sale thấy hồ sơ mình phụ trách. Biên tập viên không vào CRM.',
        keywords: ['sale', 'superadmin', 'quyền', 'phân quyền'],
        blocks: [
          {
            type: 'statuses',
            title: 'Trong CRM',
            items: [
              { label: 'SuperAdmin', tone: 'navy', code: 'super_admin', text: 'Thấy mọi lead, deal, báo giá, khách, đơn đã trả và hoa hồng. Chuyển được người phụ trách. Đặt mức hoa hồng, ngày chi và thuế suất.' },
              { label: 'Sale', tone: 'blue', code: 'sales', text: 'Thấy lead, deal, nhật ký, báo giá và khách của mình. Đơn đã trả và hóa đơn chỉ của công ty mình phụ trách. SuperAdmin tạo tài khoản Sale ở mục người dùng.' },
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
            text: 'inlink nhận tiền online và tự duyệt gói khi cổng báo đã trả. CRM không ghi công nợ và không tạo đơn thu hộ. SePay chưa nối, vì đang test trên cổng giả.',
          },
        ],
      },
    ],
  },
  {
    id: 'kinh-doanh',
    title: 'Kinh doanh',
    description: 'Sidebar Kinh doanh đi từ tiềm năng, khách hàng, cơ hội, báo giá, đơn hàng, doanh số, rồi báo cáo. Khách tự mua sẽ nằm trong sổ khách.',
    flow: ['Tiềm năng', 'Khách hàng', 'Cơ hội', 'Báo giá', 'Đơn hàng', 'Doanh số', 'Báo cáo'],
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
              'Sale sửa lead của mình. SuperAdmin đổi người phụ trách thì deal của lead đó chuyển theo.',
              'Nguồn gồm Web, Zalo, Sự kiện và Cộng tác viên.',
            ],
          },
        ],
      },
      {
        id: 'bao-gia',
        title: 'Báo giá',
        icon: FileText,
        href: '/crm/quotes',
        summary: 'Tờ chào giá: khách, hạn hiệu lực, tình trạng và một hoặc hai gói. Giá lấy lúc lập, chưa cộng VAT.',
        keywords: ['báo giá', 'phương án', 'pdf', 'vat', 'enterprise'],
        blocks: [
          {
            type: 'steps',
            title: 'Lập tờ',
            items: [
              { actor: 'Sale', title: 'Chọn gói', text: 'Phương án 1 là bắt buộc. Phương án 2 có thể bỏ trống. Hai phương án không được trùng một gói. Danh sách lấy gói đang bán, trừ Enterprise vì gói đó không có giá niêm yết.' },
              { actor: 'Hệ thống', title: 'Chụp giá', text: 'Giá gói tin là giá niêm yết, giá gói Săn là phí Săn, đúng số SuperAdmin đang đặt. Nếu thuế suất đã đặt thì ghi mức đó lên tờ, không cộng vào số tiền.' },
              { actor: 'Sale', title: 'Xuất tờ', text: 'Nút Xuất PDF mở hộp in của trình duyệt. Tờ ghi số, ngày báo giá, hạn hiệu lực, khách, địa chỉ, liên hệ, cơ hội nếu có, hai phương án và câu giá chưa gồm VAT.' },
            ],
          },
          {
            type: 'callout',
            tone: 'tip',
            title: 'Tờ này chỉ để gửi',
            text: 'Lập báo giá không tạo đơn, không bật gói và không kéo deal sang bước Đã gửi báo giá. Khách vẫn tự thanh toán trên inlink. Mã số thuế khớp một công ty đã có thì tờ được gắn với công ty đó. Tên in trên tờ là tên đã gõ.',
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
              'Chọn Danh sách hoặc Kanban. Danh sách có tên cơ hội, gói đã chọn, số tiền niêm yết, giai đoạn, ngày kỳ vọng hoặc ngày kết thúc, người thực hiện và ngày tạo.',
              'Đơn đã trả hiện trên deal khi deal đã có trước lúc khách trả, và cùng công ty cùng gói. Bước phễu không tự chạy theo đơn.',
              'Nhà tuyển dụng bấm tư vấn Enterprise trên bảng giá thì tạo lead và deal cho SuperAdmin đang hoạt động sớm nhất. Deal đó không có giá niêm yết. SuperAdmin không gửi yêu cầu này từ bảng giá.',
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
              'Hồ sơ một công ty gồm gói đang chạy, hạn, credit, tin đang đăng, đơn đã trả, số hóa đơn và cộng tác viên nếu có. Sổ này không gán gói.',
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
        id: 'doanh-so',
        title: 'Doanh số',
        icon: PieChart,
        href: '/crm/reports',
        summary: 'Một tháng theo người phụ trách, nguồn và cộng tác viên. Tiền là đơn đã trả, tách gói tin và gói Săn.',
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
        summary: 'Ghi số hóa đơn cho đơn gói đã trả. Mỗi đơn một số. Mức VAT được giữ tại lúc ghi.',
        keywords: ['hóa đơn', 'vat', 'sổ', 'csv'],
        blocks: [
          {
            type: 'list',
            items: [
              'Chỉ đơn gói tin hoặc gói Săn, đã trả, giá lớn hơn 0. Nạp Credit không vào sổ này.',
              'Lần ghi đầu giữ mức thuế suất đang đặt. Chưa đặt thì để trống. Sửa số hóa đơn sau đó không đổi mức đã giữ.',
              'Đơn ghi trước khi có cột VAT hiện câu VAT lúc ghi: chưa đặt. Không lấy mức thuế hiện tại để điền lại.',
              'Số trên sổ là số khách đã trả, chưa cộng thuế. Tải sổ ra file CSV của cả sổ, không theo ô tìm trên màn hình.',
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
            text: 'Khóa mã số thuế giữ một MST cho một cộng tác viên, tối đa 30 mã. Việc này không tạo tài khoản. Sale chỉ khóa cộng tác viên mình tạo. Nếu lead còn hiệu lực đã giữ MST đó cho người khác thì không khóa được.',
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
    id: 'cai-dat',
    title: 'Cài đặt',
    description: 'Ba mức SuperAdmin đặt một lần cho cả hệ thống.',
    sections: [
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
        summary: 'Một mức cho cả site. Giá niêm yết và số đã trả không cộng thêm thuế.',
        keywords: ['vat', 'thuế', 'bảng giá'],
        blocks: [
          {
            type: 'list',
            items: [
              'Chưa đặt thì bảng giá và tờ báo giá không ghi một mức cụ thể.',
              'Đã đặt thì câu VAT trên bảng giá dùng đúng mức đó. Giá hiện và giá thu vẫn là giá chưa thuế.',
              'Đơn hóa đơn và tờ báo giá giữ mức tại lúc ghi. Đổi mức sau không sửa các tờ cũ và không đổi giá gói.',
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
        summary: 'Marketing, SePay và chi hoa hồng qua ngân hàng.',
        keywords: ['marketing', 'facebook', 'tiktok', 'instagram', 'linkedin', 'youtube', 'sepay', 'ngân hàng'],
        blocks: [
          {
            type: 'list',
            items: [
              'Quản lý marketing đã có: kênh, chiến dịch, chi phí và gắn cơ hội. Kênh chuẩn gồm Web, Zalo, Sự kiện, Cộng tác viên, Facebook, Instagram, TikTok, LinkedIn, X và YouTube. Báo cáo ROI, link theo dõi và nối API kênh chưa có. Nguồn trên lead, link cộng tác viên và đăng ký chưa trả vẫn đang chạy.',
              'SePay: khi có tài khoản cổng thì nối vào cùng sổ đơn hiện tại. Trong lúc test vẫn dùng thanh toán giả.',
              'Chi hoa hồng ra ngân hàng: hiện dừng ở bảng kê và nút Đã chi trên ví inlink.',
            ],
          },
        ],
      },
    ],
  },
];

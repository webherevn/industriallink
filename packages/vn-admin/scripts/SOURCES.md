# Nguồn dữ liệu hành chính Việt Nam

## Cũ (tỉnh + quận/huyện, snapshot trước 1/7/2025)

- Repo: [daohoangson/dvhcvn](https://github.com/daohoangson/dvhcvn) tag `v20250301`
- File: `data/sorted.json`
- License: dữ liệu hành chính công khai (xem LICENSE của repo nguồn)

Tải lại:

```bash
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/daohoangson/dvhcvn/v20250301/data/sorted.json" -OutFile scripts/dvhcvn-old.json
```

## Mới (tỉnh + phường/xã sau sáp nhập 2025)

- Repo: [open-admin-data/vietnam-administrative-divisions](https://github.com/open-admin-data/vietnam-administrative-divisions)
- File: `data/hierarchy.json` (34 tỉnh/thành, ~3321 phường/xã)

Tải lại:

```bash
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/open-admin-data/vietnam-administrative-divisions/main/data/hierarchy.json" -OutFile scripts/hierarchy-new.json
```

## Biến đổi

```bash
pnpm --filter @industriallink/vn-admin transform
```

Output: `src/data/provinces-old.json`, `districts-old.json`, `provinces-new.json`, `wards-new.json`.

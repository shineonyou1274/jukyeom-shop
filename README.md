# 천왕봉 죽염 쇼핑몰

React + Supabase(회원·DB) + 토스페이먼츠(카드결제) + Vercel(배포)로 만든 온라인 쇼핑몰입니다.

## 기능

- **손님**: 상품 목록/상세, 장바구니, 회원가입·로그인·비밀번호 찾기, 주소 검색, 카드결제(토스 결제위젯), 주문 내역·송장번호 확인, 영수증
- **관리자(어머님)**: 주문 확인 → 상품 준비 → 송장번호 입력(발송) → 배송 완료, 주문 취소·전액 환불, 상품 등록/수정/숨김, 사진 업로드, 재고 관리
- **안전장치**: 결제 금액은 서버가 DB 가격으로 다시 계산하고 검증함(브라우저에서 금액 조작 불가), 결제되면 재고 자동 차감/취소하면 복구, 회원이 스스로 관리자가 될 수 없도록 DB 권한을 막아 둠

## 처음 설정하기

### 1. Supabase (회원·DB)
1. https://supabase.com 에서 새 프로젝트 생성 (Region: Seoul)
2. **SQL Editor** → `supabase/schema.sql` 전체 붙여넣고 실행 → `supabase/seed.sql`(예시 상품) 실행
3. **Project Settings → API**에서 `URL`, `anon key`, `service_role key` 복사
4. **Authentication → URL Configuration**의 Site URL을 실제 사이트 주소로 설정

### 2. 어머님 계정을 관리자로 만들기
사이트에서 회원가입한 뒤 SQL Editor에서 실행:
```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = '어머님이메일@example.com');
```
→ 다시 로그인하면 상단에 **관리자** 메뉴가 생깁니다.

### 3. 환경변수
`.env.example`을 `.env`로 복사하고 값을 채웁니다. Vercel에 배포할 때는 **Settings → Environment Variables**에 같은 값을 등록합니다.

| 이름 | 설명 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (공개돼도 됨) |
| `VITE_TOSS_CLIENT_KEY` | 토스 결제위젯 클라이언트 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | **비밀** — 서버에서만 사용 |
| `TOSS_SECRET_KEY` | **비밀** — 서버에서만 사용 |

### 4. 실행/배포
```bash
npm install
npm run dev      # http://localhost:5173 (서버 API 포함)
```
Vercel에서 이 폴더를 Root Directory로 지정해 import하면 배포됩니다 (Framework: Vite).

## 실제 카드결제 받기 (테스트 → 실결제 전환)

지금은 토스 **테스트 키**라서 결제해도 돈이 빠져나가지 않습니다. 실결제를 받으려면:

1. 토스페이먼츠 가입 → 전자결제 계약 신청 (사업자등록증, 통신판매업 신고증, 대표자 통장 사본 등 필요)
2. 계약 심사 시 **사이트 주소가 열려 있고** 상품·가격·환불규정·사업자정보가 보여야 합니다 (이 사이트는 하단에 표시되도록 되어 있음)
3. 승인되면 상점관리자 → 개발 연동 → **결제위젯 연동 키**의 라이브 키(`live_gck_…`, `live_gsk_…`)로 환경변수를 교체

## 운영 전 꼭 바꿀 것

- [ ] `src/config/store.js` — 상호, 대표자, 사업자번호, 통신판매업 신고번호, 주소, 연락처 (**법적 필수 표시사항**)
- [ ] 이용약관·개인정보처리방침(`src/pages/Policy.jsx`) 검토
- [ ] 예시 상품을 실제 상품·가격·사진으로 교체 (관리자 화면에서 가능)
- [ ] 관리자 이메일은 `admin_emails` 테이블에 넣어 두면 가입 즉시 관리자가 됩니다
- [ ] 식품 판매: 제품에 맞는 영업신고(식품제조·가공업 또는 즉석판매제조가공업 등) 확인
- [ ] 상품 설명에 질병 치료·예방 효능 표현 금지 (식품표시광고법)

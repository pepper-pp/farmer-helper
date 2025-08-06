# farmer-helper
👩‍🌾파머 승인대기 자동취합 서포터 / 솔루션 : 확장 프로그램

✱manifest.json<br>
확장 프로그램의 이름·설명·버전과 함께 저장소·Google 계정·알림 권한을 정의하고, 특정 파머 승인대기 URL에 대한 호스트 권한과 백그라운드 서비스 워커·콘텐츠 스크립트·팝업·옵션 페이지를 등록한다<br>

✱background.js<br>
팝업에서 전송 요청을 받으면 활성 탭이 파머 승인대기 목록인지 확인한 뒤 행 데이터를 수집·날짜순 정렬하고, Chrome Identity로 인증해 Google Sheets API에 업로드하며 단계별 알림을 표시한다<br>

✱content_script.js<br>
페이지에서 ‘승인대기’ 상태의 행을 탐색해 노란색 하이라이트를 적용하고, 수집 요청을 받으면 각 행의 이름과 신청 날짜를 추출해 백그라운드로 전달한다<br>

✱popup.js<br>
팝업 버튼 클릭 시 백그라운드 스크립트에 전송 메시지를 보내고, 옵션 페이지로 이동하는 링크를 제공한다<br>

✱options.js<br>
사용자로부터 구글 스프레드시트 ID와 시트 이름을 입력받아 저장하며, Google 인증 버튼을 통해 로그인·토큰 취득을 시도하고 상태 메시지를 표시한다<br>

✱styles.css<br>
‘승인대기’ 행에 연한 노란색 배경을 적용하고 마우스 오버 시 더 진한 색으로 변경해 시각적 강조를 제공한다<br>

farmer-helper<br>
├── 📁 fonts&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ 폰트 파일 저장용 폴더<br>
├── 📄 background.js        → 백그라운드 스크립트 (백그라운드에서 항상 실행)<br>
├── 📄 content_script.js    → 웹페이지에 주입되는 스크립트<br>
├── 🖼 icon48.png           → 확장 프로그램 아이콘<br>
├── 📄 manifest.json        → 확장 프로그램의 설정 파일 (필수)<br>
├── 📄 options.html         → 옵션 페이지 (HTML)<br>
├── 📄 options.js           → 옵션 페이지 동작 제어 JS<br>
├── 📄 popup.html           → 팝업 페이지 (HTML)<br>
├── 📄 popup.js             → 팝업 동작 제어 JS<br>
└── 📄 styles.css           → 전체 스타일 시트<br>

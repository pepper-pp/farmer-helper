# farmer-helper
👩‍🌾파머 승인대기 자동취합 서포터입니당

🔹manifest.json은 확장 프로그램 이름·버전·설명을 정의하고, 저장소·Google 계정 인증·알림 권한과 특정 파머 승인대기 URL에 대한 호스트 권한을 부여하며, 백그라운드 서비스 워커와 콘텐츠 스크립트를 등록한다
🔹background.js는 팝업에서 수집 명령을 받으면 현재 탭의 데이터를 요청해 날짜순 정렬 후 Google Sheets API로 전송하고, 각 단계에서 알림을 통해 상태를 표시한다
🔹content_script.js는 페이지의 ‘승인대기’ 행에 강조 스타일을 적용하고, 요청 시 행의 이름과 날짜를 추출해 백그라운드로 전달한다
🔹popup.js는 ‘승인대기 전송’ 버튼 클릭 시 백그라운드에 메시지를 보내고, 옵션 페이지 이동 링크를 제공한다
🔹options.js는 사용자에게 Google Sheets ID와 시트 이름을 입력받아 저장하고, Chrome Identity API로 Google 로그인 기능을 제공한다
🔹styles.css는 ‘승인대기’ 행을 노란색으로 하이라이트하는 CSS 클래스를 정의한다

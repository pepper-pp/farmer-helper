'use strict';

// 확장 프로그램 설치 시 아무 작업도 할 필요가 없음.
chrome.runtime.onInstalled.addListener(() => {
    console.log('파머 승인대기 서포터가 설치되었습니다.');
});

// 메시지 수신부: [시트로 전송] 요청만 처리합니다.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'sendToSheets') {
        collectAndSendData();
    }
    return true; // 비동기 응답
});

/**
 * content_script로부터 데이터를 수집하여 전송 프로세스를 시작하는 메인 함수
 */
async function collectAndSendData() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.startsWith("https://shopping-manager.kakaosecure.net/display/store-manager/etc/farmer/list")) {
        chrome.notifications.create({ type: 'basic', iconUrl: 'icon48.png', title: '실행 불가', message: '파머 승인대기 목록 페이지에서만 사용 가능합니다.' });
        return;
    }

    console.log(`[Background] 활성 탭(${tab.id})에 데이터 수집 요청...`);
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'collectData' });

    if (!response || !response.data) {
        chrome.notifications.create({ type: 'basic', iconUrl: 'icon48.png', title: '수집 실패', message: '페이지에서 데이터를 가져오지 못했습니다.' });
        return;
    }

    const collectedFarmers = response.data;
    if (collectedFarmers.length === 0) {
        chrome.notifications.create({ type: 'basic', iconUrl: 'icon48.png', title: '데이터 없음', message: "페이지에서 처리할 '승인대기' 항목을 찾지 못했습니다." });
        return;
    }

    // 날짜 오름차순 정렬
    collectedFarmers.sort((a, b) => new Date(`2024/${a[2]}`) - new Date(`2024/${b[2]}`));

    // 수집된 데이터를 최종 전송 함수로 넘깁니다.
    sendDataToSheets(collectedFarmers);
}


/**
 * 전달받은 데이터를 기존 시트 데이터와 비교하여 중복을 제외하고,
 * 특정 열(C열) 기준으로 빈 행을 찾아 데이터를 전송하는 최종 함수.
 * @param {Array} newFarmers - 새로 수집된 파머 데이터 배열
 */
async function sendDataToSheets(newFarmers) {
    const { spreadsheetId, sheetName } = await chrome.storage.sync.get(['spreadsheetId', 'sheetName']);

    if (!spreadsheetId || !sheetName) {
        chrome.runtime.openOptionsPage();
        return;
    }

    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
        if (chrome.runtime.lastError || !token) {
            chrome.notifications.create({ type: 'basic', iconUrl: 'icon48.png', title: '인증 실패', message: '구글 계정 인증에 실패했습니다.' });
            return;
        }

        const SPREADSHEET_ID = spreadsheetId;
        const SHEET_NAME = sheetName;
        const BASE_API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values`;

        try {
            // --- ★★★ 로직 보완: 중복 검사 및 빈 행 찾기 통합 ★★★ ---

            // 단계 1: 중복 검사와 빈 행 찾기에 필요한 모든 열(C, D, F)의 데이터를 한 번에 가져온다.
            const readRange = `${SHEET_NAME}!C:F`;
            console.log(`데이터 조회 및 중복 검사 시도: ${readRange}`);
            const getResponse = await fetch(`${BASE_API_URL}/${encodeURIComponent(readRange)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const existingData = await getResponse.json();
            if (!getResponse.ok) throw new Error(`시트 조회 실패: ${existingData.error?.message || JSON.stringify(existingData)}`);

            const existingValues = existingData.values || [];

            // 단계 2: D열이 비어있는 중복 데이터를 식별하기 위한 Set을 생성한다.
            const duplicateCheckSet = new Set();
            existingValues.forEach(row => {
                const date = row[0];     // C열 데이터
                const dValue = row[1];   // D열 데이터
                const storeName = row[3]; // F열 데이터 (C열이 0번 인덱스이므로 F열은 3번)

                // 조건: D열에 값이 *없는* 경우에만 중복 검사 대상으로 추가
                if (!dValue && date && storeName) {
                    const uniqueKey = `${date}::${storeName}`; // "날짜::스토어명" 형태의 고유 키
                    duplicateCheckSet.add(uniqueKey);
                }
            });
            console.log(`중복 검사 Set 생성 완료. ${duplicateCheckSet.size}개의 항목을 검사합니다.`);

            // 단계 3: 새로 추가할 데이터(newFarmers)를 필터링한다.
            const farmersToAdd = newFarmers.filter(farmer => {
                const date = farmer[2];      // 새로 추가할 데이터의 C열
                const storeName = farmer[5]; // 새로 추가할 데이터의 F열
                const uniqueKey = `${date}::${storeName}`;
                // Set에 동일한 키가 존재하지 않는 경우에만 true를 반환 (즉, 중복이 아닐 때만 추가)
                return !duplicateCheckSet.has(uniqueKey);
            });
            console.log(`필터링 완료. 총 ${newFarmers.length}개 중 ${farmersToAdd.length}개의 새로운 항목을 추가합니다.`);

            // 단계 4: 필터링된 데이터가 없으면 알림 후 종료.
            if (farmersToAdd.length === 0) {
                chrome.notifications.create({
                    type: 'basic', iconUrl: 'icon48.png',
                    title: '추가할 항목 없음', message: '모든 "승인대기" 항목이 이미 시트에 존재하거나 조건에 맞지 않습니다.'
                });
                return;
            }

            // 단계 5: C열을 기준으로 비어있는 첫 행을 찾아 데이터를 추가한다.
            // C열 데이터만 필터링하여 실제 값이 있는 마지막 행을 찾는다.
            const cColumnData = existingValues.map(row => row[0]);
            let lastRow = cColumnData.length;
            // 뒤에서부터 빈 셀이 아닐 때까지 탐색
            while(lastRow > 0 && (cColumnData[lastRow-1] === undefined || cColumnData[lastRow-1] === '')) {
                lastRow--;
            }
            const nextRow = lastRow + 1;
            console.log(`E열 수식 무시. C열 기준 다음 입력 행: ${nextRow}`);

            const updateRange = `${SHEET_NAME}!A${nextRow}`;
            const updateResponse = await fetch(`${BASE_API_URL}/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: farmersToAdd })
            });
            const updateResult = await updateResponse.json();
            if (!updateResponse.ok) throw new Error(`시트 업데이트 실패: ${updateResult.error?.message}`);

            chrome.notifications.create({
                type: 'basic', iconUrl: 'icon48.png',
                title: '전송 성공!',
                message: `${farmersToAdd.length}개의 새로운 스토어를 시트 ${nextRow}행부터 추가했습니다.`
            });

        } catch (error) {
            console.error('API 호출 또는 처리 중 오류 발생:', error);
            chrome.notifications.create({
                type: 'basic', iconUrl: 'icon48.png',
                title: '전송 실패', message: `오류가 발생했습니다: ${error.message}`
            });
        }
    });
}

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
            const readRange = `${SHEET_NAME}!C:F`;
            const getResponse = await fetch(`${BASE_API_URL}/${encodeURIComponent(readRange)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const existingData = await getResponse.json();
            if (!getResponse.ok) throw new Error(`시트 조회 실패: ${existingData.error?.message || JSON.stringify(existingData)}`);

            const existingValues = existingData.values || [];

            const duplicateCheckSet = new Set();
            existingValues.forEach(row => {
                const dateCellValue = row[0]; // C열의 셀 값 (예: "07/30 (수)")
                const dValue = row[1];
                const storeName = row[3];

                if (!dValue && dateCellValue && storeName) {
                    // ★★★ 핵심 수정: 요일 부분 (소괄호와 내용) 및 모든 공백 제거 ★★★
                    const cleanDate = String(dateCellValue).replace(/\s*\(.*\)\s*/g, '').replace(/\s/g, '');
                    const cleanStoreName = String(storeName).replace(/\s/g, '');
                    const uniqueKey = `${cleanDate}::${cleanStoreName}`;
                    duplicateCheckSet.add(uniqueKey);
                }
            });
            console.log("생성된 중복 검사 키 예시 (첫 5개):", Array.from(duplicateCheckSet).slice(0, 5));

            const farmersToAdd = newFarmers.filter(farmer => {
                const date = farmer[2]; // "MM/DD" 형식
                const storeName = farmer[5];
                // ★★★ 핵심 수정: 이쪽도 모든 공백을 제거하여 비교 ★★★
                const cleanDate = String(date).replace(/\s/g, '');
                const cleanStoreName = String(storeName).replace(/\s/g, '');
                const uniqueKey = `${cleanDate}::${cleanStoreName}`;

                const isDuplicate = duplicateCheckSet.has(uniqueKey);
                if (isDuplicate) {
                    console.log(`중복 발견 (제외): ${uniqueKey}`);
                }
                return !isDuplicate;
            });
            console.log(`필터링 완료. 총 ${newFarmers.length}개 중 ${farmersToAdd.length}개의 새로운 항목을 추가합니다.`);

            if (farmersToAdd.length === 0) {
                chrome.notifications.create({ type: 'basic', iconUrl: 'icon48.png', title: '추가할 항목 없음', message: '모든 "승인대기" 항목이 이미 시트에 존재합니다.' });
                return;
            }

            const cColumnData = existingValues.map(row => row[0]);
            let lastRow = cColumnData.length;
            while(lastRow > 0 && (cColumnData[lastRow-1] === undefined || cColumnData[lastRow-1] === '')) {
                lastRow--;
            }
            const nextRow = lastRow + 1;

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

'use strict';

// 확장 프로그램 설치 시 아무 작업도 할 필요가 없음당
chrome.runtime.onInstalled.addListener(() => {
    console.log('파머 승인대기 서포터가 설치되었습니다.');
});

// 메시지 수신부
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'sendToSheets') {
        // [시트로 전송] 요청을 받으면 프로세스를 시작합니다.
        collectAndSendData();
    }
    // 이 스크립트에서는 더 이상 clearData, addFarmer 메시지를 처리하지 않습니다.
    return true; // 비동기 응답
});

/**
 * content_script로부터 데이터를 수집하여 구글 시트로 전송하는 메인 함수
 */
async function collectAndSendData() {
    // 1. 현재 활성화된 탭에 데이터 수집 요청
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 파머 페이지가 아니면 실행 중지
    if (!tab.url.startsWith("https://shopping-manager.kakaosecure.net/display/store-manager/etc/farmer/list")) {
        chrome.notifications.create({
            type: 'basic', iconUrl: 'icon48.png',
            title: '실행 불가', message: '이 기능은 파머 승인대기 목록 페이지에서만 사용할 수 있습니다.'
        });
        return;
    }

    console.log(`[Background] 활성 탭(${tab.id})에 데이터 수집을 요청합니다.`);
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'collectData' });

    if (!response || !response.data) {
        chrome.notifications.create({ type: 'basic', iconUrl: 'icon48.png', title: '수집 실패', message: '페이지에서 데이터를 가져오는 데 실패했습니다.' });
        return;
    }

    const collectedFarmers = response.data;

    if (collectedFarmers.length === 0) {
        chrome.notifications.create({ type: 'basic', iconUrl: 'icon48.png', title: '데이터 없음', message: "페이지에서 처리할 '승인대기' 항목을 찾지 못했습니다." });
        return;
    }

    // 날짜(C열, 인덱스 2) 기준으로 오름차순(오래된 순) 정렬
    collectedFarmers.sort((a, b) => {
        const dateA = new Date(`2024/${a[2]}`);
        const dateB = new Date(`2024/${b[2]}`);
        return dateA - dateB;
    });

    // 2. 수집된 데이터를 시트로 전송 (기존 sendDataToSheets 로직 재사용)
    sendDataToSheets(collectedFarmers);
}

/**
 * 전달받은 데이터를 구글 시트로 전송하는 함수
 * @param {Array} dataToSend - 시트로 보낼 데이터 배열
 */
async function sendDataToSheets(dataToSend) {
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
            const columnToCkeck = 'C';
            const getRange = `${SHEET_NAME}!${columnToCkeck}:${columnToCkeck}`;
            const getResponse = await fetch(`${BASE_API_URL}/${encodeURIComponent(getRange)}`, { headers: { 'Authorization': `Bearer ${token}` } });
            const getData = await getResponse.json();
            if (!getResponse.ok) throw new Error(`시트 조회 실패: ${getData.error?.message}`);

            const lastRow = getData.values ? getData.values.length : 0;
            const nextRow = lastRow + 1;

            const updateRange = `${SHEET_NAME}!A${nextRow}`;
            const updateResponse = await fetch(`${BASE_API_URL}/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: dataToSend })
            });
            const updateResult = await updateResponse.json();
            if (!updateResponse.ok) throw new Error(`시트 업데이트 실패: ${updateResult.error?.message}`);

            chrome.notifications.create({
                type: 'basic', iconUrl: 'icon48.png',
                title: '전송 성공!',
                message: `${dataToSend.length}개의 스토어를 시트 ${nextRow}행부터 성공적으로 전송했습니다.`
            });
            // 더 이상 데이터를 초기화할 필요가 없음 (누적하지 않으므로)

        } catch (error) {
            console.error('API 호출 오류:', error);
            chrome.notifications.create({
                type: 'basic', iconUrl: 'icon4c.png',
                title: '전송 실패', message: `오류가 발생했습니다: ${error.message}`
            });
        }
    });
}
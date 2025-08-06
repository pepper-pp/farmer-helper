'use strict';

/**
 * 페이지의 모든 행을 스캔하여 '승인대기' 상태인 행에 하이라이트 클래스를 적용하는 함수.
 */
function highlightPendingRows() {
    const statusCells = document.querySelectorAll('td[data-col-name="channelStatus"]');
    statusCells.forEach(cell => {
        const row = cell.closest('tr');
        if (!row || row.classList.contains('farmer-helper-highlight')) {
            return;
        }
        if (cell.querySelector('a.link_click')?.textContent.trim() === '승인대기') {
            row.classList.add('farmer-helper-highlight');
        }
    });
}

/**
 * background.js로부터 메시지를 수신하는 리스너.
 * 'collectData' 요청을 받으면 페이지의 모든 '승인대기' 데이터를 수집하여 응답한다.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 'collectData' 타입의 요청인지 확인
    if (request.type === 'collectData') {
        console.log('[파머 서포터] background로부터 데이터 수집 요청을 받았습니다.');

        const allPendingFarmers = [];
        // 하이라이트된 모든 '승인대기' 행을 찾는다.
        const highlightedRows = document.querySelectorAll('.farmer-helper-highlight');

        highlightedRows.forEach(row => {
            try {
                const storeName = row.querySelector('td[data-col-name="name"]')?.textContent.trim() || '';
                const applyDateText = row.querySelector('td[data-col-name="lastModifiedAt"]')?.textContent.trim() || '';

                if (storeName && applyDateText) {
                    const dateObj = new Date(applyDateText);
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    const formattedDate = `${month}/${day}`;

                    // C열, F열에 맞춘 데이터 배열 생성
                    const farmerData = ['', '', formattedDate, '', '', storeName];
                    allPendingFarmers.push(farmerData);
                }
            } catch (error) {
                console.error('[파머 서포터] 특정 행의 데이터 수집 중 오류:', error, row);
            }
        });

        console.log(`[파머 서포터] ${allPendingFarmers.length}개의 '승인대기' 데이터를 수집했습니다.`);
        // 수집된 데이터를 background.js로 응답한다.
        sendResponse({ data: allPendingFarmers });
    }
    // 비동기 응답을 위해 true를 반환해야 할 수 있으므로 유지합니다.
    return true;
});


// --- 페이지 로드 및 동적 변경 감지 ---

function initializeObserver() {
    const observer = new MutationObserver((mutations) => {
        setTimeout(highlightPendingRows, 50);
    });

    const targetNodeSelector = 'cu-grid-list .body .base.area tbody';
    const targetNode = document.querySelector(targetNodeSelector);

    if (targetNode) {
        console.log(`[파머 서포터] 테이블 감시를 시작합니다.`);
        observer.observe(targetNode, { childList: true });
    } else {
        setTimeout(initializeObserver, 500);
    }
}

// 최초 페이지 로드 및 초기화
setTimeout(() => {
    highlightPendingRows();
    initializeObserver();
}, 500);
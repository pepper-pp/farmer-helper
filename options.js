// options.js
'use strict';

const spreadsheetIdEl = document.getElementById('spreadsheetId');
const sheetNameEl = document.getElementById('sheetName');
const saveBtn = document.getElementById('save-btn');
const loginBtn = document.getElementById('login-btn');
const statusEl = document.getElementById('status');

// 저장된 설정 불러오기
function restoreOptions() {
    chrome.storage.sync.get(['spreadsheetId', 'sheetName'], (items) => {
        spreadsheetIdEl.value = items.spreadsheetId || '';
        sheetNameEl.value = items.sheetName || '';
    });
}

// 설정 저장
saveBtn.addEventListener('click', () => {
    const spreadsheetId = spreadsheetIdEl.value.trim();
    const sheetName = sheetNameEl.value.trim();
    if (!spreadsheetId || !sheetName) {
        statusEl.textContent = 'ID와 시트 이름을 모두 입력해주세요.';
        statusEl.style.display = 'block';
        statusEl.style.backgroundColor = '#f2dede';
        statusEl.style.color = '#a94442';
        return;
    }
    chrome.storage.sync.set({ spreadsheetId, sheetName }, () => {
        statusEl.textContent = '설정이 저장되었습니다.';
        statusEl.style.display = 'block';
        statusEl.style.backgroundColor = '#dff0d8';
        statusEl.style.color = '#3c763d';
        setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
    });
});

// 구글 로그인 버튼
loginBtn.addEventListener('click', () => {
    // getAuthToken을 호출하여 로그인 창을 띄움
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError || !token) {
            statusEl.textContent = '로그인에 실패했거나 취소되었습니다.';
             statusEl.style.display = 'block';
        } else {
             statusEl.textContent = '성공적으로 로그인되었습니다.';
             statusEl.style.display = 'block';
             // 원한다면 토큰을 제거하여 로그아웃 상태로 만들 수 있음
             // chrome.identity.removeCachedAuthToken({ token: token }, () => {});
        }
    });
});


document.addEventListener('DOMContentLoaded', restoreOptions);
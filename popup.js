'use strict';

const sendBtn = document.getElementById('send-btn');
const optionsLinkBtn = document.getElementById('options-link-btn');

sendBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'sendToSheets' });
    window.close(); // 버튼 클릭 후 팝업 닫기
});

optionsLinkBtn.addEventListener('click', (event) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
});
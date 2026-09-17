// ==UserScript==
// @name         Screen Answer (Claude)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Small corner box: capture the screen, ask Claude, show a short answer. Shortcuts: Shift+Cmd+§ capture, Shift+Cmd+\\ hide/show.
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      api.anthropic.com
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const MODEL = 'claude-opus-5';

    // --- API key: stored locally via Tampermonkey, NOT hardcoded in the script ---
    function getKey() {
        let k = GM_getValue('anthropic_api_key', '');
        if (!k) {
            k = prompt('Enter your Anthropic API key (stored locally in Tampermonkey, sk-ant-...):', '');
            if (k) GM_setValue('anthropic_api_key', k.trim());
        }
        return k ? k.trim() : '';
    }

    // --- UI: one small box, bottom-right, honest label ---
    const box = document.createElement('div');
    box.style.cssText = [
        'position:fixed', 'bottom:16px', 'right:16px', 'z-index:2147483647',
        'width:220px', 'font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif',
        'background:#1e293b', 'color:#e2e8f0', 'border:1px solid #334155',
        'border-radius:10px', 'box-shadow:0 4px 16px rgba(0,0,0,.35)', 'overflow:hidden'
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'padding:6px 10px;background:#2563eb;color:#fff;font-weight:600;cursor:move;user-select:none;display:flex;justify-content:space-between;align-items:center;gap:6px';

    const title = document.createElement('span');
    title.textContent = 'AI Answer';
    title.style.cssText = 'flex:1';

    const btn = document.createElement('button');
    btn.textContent = 'Capture';
    btn.style.cssText = 'border:0;border-radius:6px;background:#0f172a;color:#fff;font-size:12px;padding:2px 8px;cursor:pointer';

    header.appendChild(title);
    header.appendChild(btn);

    // Collapsed pill shown when hidden
    const pill = document.createElement('div');
    pill.textContent = 'AI';
    pill.style.cssText = [
        'position:fixed', 'bottom:16px', 'right:16px', 'z-index:2147483647',
        'display:none', 'width:32px', 'height:32px', 'border-radius:16px',
        'background:#2563eb', 'color:#fff', 'font:600 13px -apple-system,Segoe UI,Roboto,sans-serif',
        'align-items:center', 'justify-content:center', 'cursor:pointer',
        'box-shadow:0 4px 16px rgba(0,0,0,.35)'
    ].join(';');
    pill.style.display = 'none';

    function setHidden(h) {
        box.style.display = h ? 'none' : 'block';
        pill.style.display = h ? 'flex' : 'none';
    }
    pill.addEventListener('click', () => setHidden(false));

    const out = document.createElement('div');
    out.textContent = 'Click Capture, then pick a screen/window to share.';
    out.style.cssText = 'padding:10px;min-height:32px;white-space:pre-wrap;word-break:break-word';

    box.appendChild(header);
    box.appendChild(out);
    document.body.appendChild(box);
    document.body.appendChild(pill);

    // --- Drag by the header ---
    (function drag() {
        let sx, sy, ox, oy, moving = false;
        header.addEventListener('mousedown', e => {
            if (e.target === btn) return;
            moving = true; sx = e.clientX; sy = e.clientY;
            const r = box.getBoundingClientRect(); ox = r.left; oy = r.top;
            box.style.right = 'auto'; box.style.bottom = 'auto';
            box.style.left = ox + 'px'; box.style.top = oy + 'px';
            e.preventDefault();
        });
        window.addEventListener('mousemove', e => {
            if (!moving) return;
            box.style.left = (ox + e.clientX - sx) + 'px';
            box.style.top = (oy + e.clientY - sy) + 'px';
        });
        window.addEventListener('mouseup', () => moving = false);
    })();

    // --- Capture one frame of the shared screen ---
    async function capturePng() {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 } });
        const track = stream.getVideoTracks()[0];
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();
        await new Promise(r => setTimeout(r, 250)); // let a frame land
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        track.stop();
        return canvas.toDataURL('image/png').split(',')[1]; // base64 only
    }

    // --- Ask Claude, short answer ---
    function ask(b64) {
        const key = getKey();
        if (!key) { out.textContent = 'No API key set.'; return; }
        out.textContent = 'Thinking…';

        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://api.anthropic.com/v1/messages',
            headers: {
                'content-type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            data: JSON.stringify({
                model: MODEL,
                max_tokens: 400,
                output_config: { effort: 'low' },
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
                        { type: 'text', text: 'Answer the question shown in the image as briefly as possible — just the answer, no explanation unless a short one is needed.' }
                    ]
                }]
            }),
            onload: res => {
                try {
                    const data = JSON.parse(res.responseText);
                    if (data.error) { out.textContent = 'Error: ' + data.error.message; return; }
                    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
                    out.textContent = text || '(no answer)';
                } catch (e) {
                    out.textContent = 'Bad response: ' + res.responseText.slice(0, 200);
                }
            },
            onerror: () => { out.textContent = 'Network error.'; }
        });
    }

    async function runCapture() {
        if (btn.disabled) return;
        setHidden(false); // make sure the answer is visible
        try {
            btn.disabled = true;
            out.textContent = 'Capturing…';
            const b64 = await capturePng();
            ask(b64);
        } catch (e) {
            out.textContent = 'Capture cancelled or failed.';
        } finally {
            btn.disabled = false;
        }
    }

    btn.addEventListener('click', runCapture);

    // Keyboard shortcuts (Cmd on Mac, Ctrl on Windows/Linux):
    //   Shift + Cmd + §  -> capture
    //   Shift + Cmd + \  -> hide / show toggle
    window.addEventListener('keydown', e => {
        if (!(e.shiftKey && (e.metaKey || e.ctrlKey))) return;
        const isSection = e.key === '§' || e.key === '±' || e.code === 'IntlBackslash' || e.code === 'Backquote';
        const isBackslash = e.code === 'Backslash' || e.key === '\\' || e.key === '|';
        if (isSection) {
            e.preventDefault();
            runCapture();
        } else if (isBackslash) {
            e.preventDefault();
            setHidden(box.style.display === 'none' ? false : true);
        }
    }, true);
})();

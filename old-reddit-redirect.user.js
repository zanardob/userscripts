// ==UserScript==
// @name         Old Reddit Redirect
// @namespace    https://zanardo.dev/
// @version      2.0.4
// @author       .zb
// @description  Old Reddit version by default, with a menu toggle for the new UI
// @license      GPL-3.0-only
// @homepageURL  https://github.com/zanardob/userscripts
// @supportURL   https://github.com/zanardob/userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/zanardob/userscripts/main/old-reddit-redirect.user.js
// @updateURL    https://raw.githubusercontent.com/zanardob/userscripts/main/old-reddit-redirect.user.js
// @icon         https://raw.githubusercontent.com/zanardob/userscripts/main/icons/old-reddit-redirect.svg
// @match        https://www.reddit.com/*
// @match        https://reddit.com/*
// @match        https://old.reddit.com/*
// @grant        GM_registerMenuCommand
// @noframes
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const host = location.hostname;
    if (host !== 'www.reddit.com' && host !== 'reddit.com' && host !== 'old.reddit.com') return;

    const attrs = 'Domain=reddit.com; Path=/; SameSite=Lax; Secure';
    const hasBypass = document.cookie.split('; ').includes('orr_new_ui=1');
    const isOld = host === 'old.reddit.com';
    const canMenu = typeof GM_registerMenuCommand === 'function';

    if (isOld || hasBypass) {
        if (canMenu) {
            GM_registerMenuCommand('Use new Reddit', () => {
                document.cookie = 'orr_new_ui=1; ' + attrs;
                location.hostname = 'www.reddit.com';
            });
            GM_registerMenuCommand('Use old Reddit', () => {
                document.cookie = 'orr_new_ui=; Max-Age=0; ' + attrs;
                location.hostname = 'old.reddit.com';
            });
        }
        return;
    }

    location.hostname = 'old.reddit.com';
})();


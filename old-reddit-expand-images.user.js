// ==UserScript==
// @name         Old Reddit Expand Images
// @namespace    https://zanardo.dev/
// @version      1.1.1
// @author       .zb
// @description  Show inline images in old Reddit comments and posts instead of &lt;image&gt; links
// @license      GPL-3.0-only
// @homepageURL  https://github.com/zanardob/userscripts
// @supportURL   https://github.com/zanardob/userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/zanardob/userscripts/main/old-reddit-expand-images.user.js
// @updateURL    https://raw.githubusercontent.com/zanardob/userscripts/main/old-reddit-expand-images.user.js
// @match        https://old.reddit.com/*
// @grant        none
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const LINK_TEXT = '<image>';
    const PROCESSED = 'oreiProcessed';
    const FAILED = 'oreiFailed';

    function addStyles() {
        if (document.getElementById('orei-styles')) return;

        const style = document.createElement('style');
        style.id = 'orei-styles';
        style.textContent = `
            .md a.orei-link {
                display: inline-block;
                max-width: 100%;
                line-height: 0;
                text-decoration: none;
                vertical-align: top;
            }

            .md a.orei-link img.orei-image {
                display: block;
                width: auto;
                height: auto;
                max-width: min(100%, 640px);
                max-height: 320px;
                border-radius: 4px;
                cursor: zoom-in;
                user-select: none;
            }

            .md a.orei-link.orei-zoomed {
                max-width: none;
            }

            .md a.orei-link.orei-zoomed img.orei-image {
                max-width: none;
                max-height: none;
            }

            .md a.orei-link.orei-dragging img.orei-image {
                cursor: nwse-resize;
            }
        `;
        document.head.appendChild(style);
    }

    function isImageLink(link) {
        if (link.localName !== 'a') return false;
        if (link.dataset[PROCESSED] || link.dataset[FAILED]) return false;
        if (link.textContent.trim() !== LINK_TEXT) return false;
        if (!link.closest('.md')) return false;

        return /^https?:\/\//i.test(link.href);
    }

    function cleanupRes(link) {
        let node = link.nextElementSibling;
        const annotation = node && node.classList.contains('keyNavAnnotation') ? node : null;

        if (annotation) node = node.nextElementSibling;
        if (!node) return;

        let removed = false;

        if (node.classList.contains('res-freetext-expando')) {
            const box = node.nextElementSibling;
            if (box && box.classList.contains('res-expando-box')) box.remove();

            node.remove();
            removed = true;
        } else if (node.classList.contains('expando-button') || node.classList.contains('res-expando-box')) {
            const box = node.nextElementSibling;
            if (box && box.classList.contains('res-expando-box')) box.remove();

            node.remove();
            removed = true;
        }

        if (removed && annotation) annotation.remove();
    }

    function cleanupAllRes() {
        for (const link of document.querySelectorAll('a.orei-link')) {
            cleanupRes(link);
        }
    }

    function showImage(link) {
        const originalTitle = link.getAttribute('title');
        const img = document.createElement('img');

        link.dataset[PROCESSED] = '1';
        link.classList.add('orei-link');
        link.title = 'Drag to zoom image';

        img.className = 'orei-image';
        img.alt = 'Embedded image';
        img.draggable = false;
        img.loading = 'lazy';
        img.decoding = 'async';

        let suppressClick = false;

        const onClick = (event) => {
            if (!suppressClick) return;

            suppressClick = false;
            event.preventDefault();
            event.stopPropagation();
        };

        const preventDrag = (event) => event.preventDefault();

        const onMouseDown = (event) => {
            if (event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const rect = img.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const startX = event.clientX;
            const startY = event.clientY;
            const startWidth = rect.width;
            const startHeight = rect.height;
            const startDiagonal = Math.max(1, Math.hypot(startX - rect.left, startY - rect.top));
            let moved = false;

            const onMouseMove = (moveEvent) => {
                if (!(moveEvent.buttons & 1)) {
                    onMouseUp();
                    return;
                }

                if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 3) {
                    return;
                }

                if (!moved) {
                    moved = true;

                    link.classList.add('orei-zoomed', 'orei-dragging');
                    img.style.width = `${startWidth}px`;
                    img.style.height = `${startHeight}px`;
                }

                const diagonal = Math.max(1, Math.hypot(moveEvent.clientX - rect.left, moveEvent.clientY - rect.top));
                const scale = Math.max(0.05, diagonal / startDiagonal);
                const width = Math.max(40, startWidth * scale);
                const height = width * (startHeight / startWidth);

                img.style.width = `${width}px`;
                img.style.height = `${height}px`;
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                link.classList.remove('orei-dragging');

                if (moved) {
                    suppressClick = true;
                    window.setTimeout(() => { suppressClick = false; }, 0);
                }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            event.preventDefault();
        };

        link.addEventListener('click', onClick);
        img.addEventListener('dragstart', preventDrag);
        img.addEventListener('mousedown', onMouseDown);

        img.addEventListener('error', () => {
            link.removeEventListener('click', onClick);
            img.removeEventListener('dragstart', preventDrag);
            img.removeEventListener('mousedown', onMouseDown);

            link.dataset[FAILED] = '1';
            delete link.dataset[PROCESSED];
            link.classList.remove('orei-link', 'orei-zoomed', 'orei-dragging');

            img.style.width = '';
            img.style.height = '';

            if (originalTitle === null) {
                link.removeAttribute('title');
            } else {
                link.title = originalTitle;
            }

            link.textContent = LINK_TEXT;
        }, { once: true });

        link.replaceChildren(img);
        cleanupRes(link);
        img.src = link.href;
    }

    function scan(root) {
        if (root.nodeType === Node.ELEMENT_NODE && root.localName === 'a' && isImageLink(root)) {
            showImage(root);
        }

        if (!root.querySelectorAll) return;

        for (const link of root.querySelectorAll('a')) {
            if (isImageLink(link)) showImage(link);
        }
    }

    function observe() {
        const pending = new Set();
        let scheduled = false;

        const flush = () => {
            scheduled = false;

            cleanupAllRes();

            const roots = [...pending];
            pending.clear();

            for (const root of roots) {
                if (root.isConnected) scan(root);
            }
        };

        const queue = (root) => {
            pending.add(root);
            if (scheduled) return;

            scheduled = true;
            requestAnimationFrame(flush);
        };

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    const root = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
                    if (root) queue(root);
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    addStyles();
    scan(document);
    observe();
})();

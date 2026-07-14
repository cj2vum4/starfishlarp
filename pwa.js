(function () {
    'use strict';

    var installButton = document.getElementById('pwaInstallButton');
    var installLabel = document.getElementById('pwaInstallLabel');
    var toast = document.getElementById('pwaToast');
    var toastMessage = document.getElementById('pwaToastMessage');
    var toastAction = document.getElementById('pwaToastAction');
    var toastClose = document.getElementById('pwaToastClose');
    var deferredInstallPrompt = null;
    var toastTimer = null;
    var refreshing = false;
    var updateRequested = false;
    var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    document.documentElement.dataset.pwaStatus = 'supported';

    function showToast(message, options) {
        if (!toast || !toastMessage) return;
        options = options || {};
        window.clearTimeout(toastTimer);
        toastMessage.textContent = message;

        if (options.actionLabel && typeof options.onAction === 'function') {
            toastAction.textContent = options.actionLabel;
            toastAction.hidden = false;
            toastAction.onclick = options.onAction;
        } else {
            toastAction.hidden = true;
            toastAction.onclick = null;
        }

        toast.hidden = false;
        if (options.duration !== 0) {
            toastTimer = window.setTimeout(function () {
                toast.hidden = true;
            }, options.duration || 5000);
        }
    }

    if (toastClose) {
        toastClose.addEventListener('click', function () {
            window.clearTimeout(toastTimer);
            toast.hidden = true;
        });
    }

    function revealInstallButton(label) {
        if (!installButton || isStandalone) return;
        installLabel.textContent = label;
        installButton.setAttribute('aria-label', label);
        installButton.hidden = false;
    }

    window.addEventListener('beforeinstallprompt', function (event) {
        event.preventDefault();
        deferredInstallPrompt = event;
        revealInstallButton('安裝 App');
    });

    if (isIos && !isStandalone) {
        revealInstallButton('加入主畫面');
    }

    if (installButton) {
        installButton.addEventListener('click', async function () {
            if (deferredInstallPrompt) {
                installButton.disabled = true;
                try {
                    deferredInstallPrompt.prompt();
                    await deferredInstallPrompt.userChoice;
                    installButton.hidden = true;
                } catch (error) {
                    showToast('目前無法開啟安裝視窗，請稍後再試。');
                } finally {
                    deferredInstallPrompt = null;
                    installButton.disabled = false;
                }
                return;
            }

            if (isIos) {
                showToast('在 Safari 點擊「分享」按鈕，再選擇「加入主畫面」。', { duration: 7000 });
            }
        });
    }

    window.addEventListener('appinstalled', function () {
        deferredInstallPrompt = null;
        if (installButton) installButton.hidden = true;
        showToast('海星劇本殺已安裝完成。');
    });

    window.addEventListener('offline', function () {
        showToast('目前已離線，仍可瀏覽已儲存的內容。');
    });

    window.addEventListener('online', function () {
        showToast('網路已恢復連線。');
    });

    function offerUpdate(worker) {
        showToast('網站有新版本可用。', {
            duration: 0,
            actionLabel: '立即更新',
            onAction: function () {
                updateRequested = true;
                worker.postMessage({ type: 'SKIP_WAITING' });
            }
        });
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('./service-worker.js').then(function (registration) {
                document.documentElement.dataset.pwaStatus = 'registered';
                navigator.serviceWorker.ready.then(function () {
                    document.documentElement.dataset.pwaStatus = navigator.serviceWorker.controller ? 'controlled' : 'ready';
                });

                if (registration.waiting && navigator.serviceWorker.controller) {
                    offerUpdate(registration.waiting);
                }

                registration.addEventListener('updatefound', function () {
                    var worker = registration.installing;
                    if (!worker) return;
                    worker.addEventListener('statechange', function () {
                        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                            offerUpdate(worker);
                        }
                    });
                });

                registration.update().catch(function () { /* next visit will retry */ });
            }).catch(function (error) {
                document.documentElement.dataset.pwaStatus = 'error';
                console.warn('Service worker registration failed:', error);
            });
        });

        navigator.serviceWorker.addEventListener('controllerchange', function () {
            document.documentElement.dataset.pwaStatus = 'controlled';
            if (!updateRequested || refreshing) return;
            refreshing = true;
            window.location.reload();
        });
    }
})();

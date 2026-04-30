// ==UserScript==
// @name         TwitchAdSolutions (twitch-brave-fix)
// @namespace    https://github.com/ryanbr/TwitchAdSolutions
// @version      1.1.0
// @description  Bypass Brave fingerprint detection on Twitch GQL/integrity requests by retrying via GM_xmlHttpRequest with header spoofs (Sec-Ch-Ua brand rewrite from Brave to Google Chrome with synthetic fallback when userAgentData hidden, Sec-Ch-Ua-Platform, Sec-Ch-Ua-Mobile, Firefox User-Agent, explicit Origin/Referer/Host, Accept-Language). Also hides navigator.brave so Twitch JS can't preemptively flag the session. Companion to vaft / video-swap-new — fixes Brave login and integrity-check failures that block subsequent ad-blocking GQL calls. Userscript-only (Tampermonkey / Violentmonkey / Greasemonkey 4+); not available as a uBlock Origin scriptlet because GM.xmlHttpRequest is a userscript-manager API.
// @updateURL    https://github.com/ryanbr/TwitchAdSolutions/raw/master/vaft/twitch-brave-fix.user.js
// @downloadURL  https://github.com/ryanbr/TwitchAdSolutions/raw/master/vaft/twitch-brave-fix.user.js
// @author       https://github.com/ryanbr/TwitchAdSolutions
// @match        *://*.twitch.tv/*
// @run-at       document-start
// @grant        GM_xmlHttpRequest
// @grant        GM.xmlHttpRequest
// @connect      gql.twitch.tv
// @connect      passport.twitch.tv
// ==/UserScript==
(function() {
    let _isNested = false;
    try { _isNested = window.frameElement !== null; } catch (_e) { _isNested = true; }
    if (_isNested) {
        const _host = document.location.hostname;
        const _isEmbedContext = _host === 'player.twitch.tv' || _host === 'embed.twitch.tv' || document.location.pathname.startsWith('/embed/');
        if (!_isEmbedContext) return;
    }
    {
        const _clipHost = document.location.hostname;
        const _clipPath = document.location.pathname || '';
        if (_clipHost === 'clips.twitch.tv' || /^\/[^/]+\/clip\/[^/]+/.test(_clipPath)) return;
    }
    'use strict';
    const ourVersion = 2;
    console.log('[TwitchBraveFix] v1.1.0 loading');
    if (typeof window.twitchBraveFixVersion !== 'undefined' && window.twitchBraveFixVersion >= ourVersion) {
        console.log('[TwitchBraveFix] CONFLICT: skipped — another instance already active (v' + window.twitchBraveFixVersion + ')');
        return;
    }
    window.twitchBraveFixVersion = ourVersion;

    // Hide navigator.brave before Twitch's bundle runs so navigator.brave.isBrave() can't preemptively
    // flag the session. Brave exposes this property even in Strict shields mode, so it's the most
    // reliable Brave detector. The standard isBrave pattern short-circuits cleanly on `undefined`.
    try {
        if ('brave' in navigator) {
            Object.defineProperty(navigator, 'brave', {
                get: () => undefined,
                configurable: true,
            });
        }
    } catch (_e) { /* non-configurable on some Brave builds; accept the risk and rely on header spoofs */ }

    const gmXhr = (typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function') ? GM.xmlHttpRequest
                : (typeof GM_xmlHttpRequest === 'function') ? GM_xmlHttpRequest
                : null;
    if (!gmXhr) {
        console.log('[TwitchBraveFix] GM.xmlHttpRequest unavailable — install via Tampermonkey, Violentmonkey, or Greasemonkey 4+ for the fallback to work. Stopping.');
        return;
    }

    let isProblematicBrowser = false;
    const realFetch = window.fetch;

    function isInterceptable(url) {
        if (typeof url !== 'string') return false;
        return url.indexOf('gql.twitch.tv/gql') !== -1
            || url.indexOf('gql.twitch.tv/integrity') !== -1
            || url.indexOf('passport.twitch.tv/integrity') !== -1;
    }

    function getChromeMajor() {
        const m = navigator.userAgent.match(/Chrome\/(\d+)/);
        return m && m[1] ? parseInt(m[1], 10) : 138;
    }

    // Synthetic Chrome-N Sec-Ch-Ua used when navigator.userAgentData is hidden (Brave Strict mode)
    // or unavailable. Format matches what real Chromium ships, so the absence of "Brave" looks natural.
    function getSyntheticSecChUa() {
        const v = getChromeMajor();
        return '"Not_A Brand";v="99", "Google Chrome";v="' + v + '", "Chromium";v="' + v + '"';
    }

    async function getSpoofedSecChUa() {
        const uaData = navigator.userAgentData;
        if (uaData && typeof uaData.getHighEntropyValues === 'function') {
            try {
                const { brands } = await uaData.getHighEntropyValues(['brands']);
                if (brands && brands.length) {
                    return brands.map(b => {
                        const brand = b.brand === 'Brave' ? 'Google Chrome' : b.brand;
                        return '"' + brand + '";v="' + b.version + '"';
                    }).join(', ');
                }
            } catch (_e) { /* fall through to synthetic */ }
        }
        return getSyntheticSecChUa();
    }

    function getSpoofedPlatform() {
        const ua = navigator.userAgent;
        if (/Android/i.test(ua)) return '"Android"';
        if (/iPhone|iPad|iPod/i.test(ua)) return '"iOS"';
        if (/Windows/i.test(ua)) return '"Windows"';
        if (/Mac OS X|Macintosh/i.test(ua)) return '"macOS"';
        if (/Linux/i.test(ua)) return '"Linux"';
        return '"Windows"';
    }

    function getSpoofedMobile() {
        return /Mobile/.test(navigator.userAgent) ? '?1' : '?0';
    }

    function getSpoofedFirefoxUA() {
        const ua = navigator.userAgent;
        const platformMatch = ua.match(/\(([^)]+)\)/);
        const platform = platformMatch ? platformMatch[1] : 'Windows NT 10.0; Win64; x64';
        const firefoxVersion = getChromeMajor() + 2;
        return 'Mozilla/5.0 (' + platform + '; rv:' + firefoxVersion + '.0) Gecko/20100101 Firefox/' + firefoxVersion + '.0';
    }

    function parseRawHeaders(headersStr) {
        const headers = new Headers();
        if (!headersStr) return headers;
        const lines = headersStr.trim().split(/[\r\n]+/);
        for (const line of lines) {
            const idx = line.indexOf(':');
            if (idx < 0) continue;
            const name = line.slice(0, idx).trim();
            const value = line.slice(idx + 1).trim();
            if (name) {
                try { headers.append(name, value); } catch (_e) { /* skip illegal header names from set-cookie etc. */ }
            }
        }
        return headers;
    }

    function gmRespToFetchResp(gmResp) {
        return new Response(gmResp.responseText || '', {
            status: gmResp.status || 0,
            statusText: gmResp.statusText || '',
            headers: parseRawHeaders(gmResp.responseHeaders),
        });
    }

    async function readBodyAsText(input, init) {
        if (init && typeof init.body === 'string') return init.body;
        if (init && init.body && typeof init.body.text === 'function') {
            try { return await init.body.text(); } catch (_e) { return undefined; }
        }
        if (input instanceof Request) {
            try { return await input.clone().text(); } catch (_e) { return undefined; }
        }
        return undefined;
    }

    function collectHeaders(input, init) {
        const out = {};
        if (input instanceof Request && input.headers) {
            input.headers.forEach((v, k) => { out[k] = v; });
        }
        if (init && init.headers) {
            if (init.headers instanceof Headers) {
                init.headers.forEach((v, k) => { out[k] = v; });
            } else if (Array.isArray(init.headers)) {
                for (const [k, v] of init.headers) out[k] = v;
            } else {
                for (const k of Object.keys(init.headers)) out[k] = init.headers[k];
            }
        }
        return out;
    }

    async function gmRetry(url, method, bodyText, baseHeaders) {
        const spoofedSecChUa = await getSpoofedSecChUa();
        const spoofedUA = getSpoofedFirefoxUA();
        const headers = Object.assign({}, baseHeaders || {});
        if (spoofedSecChUa) headers['Sec-Ch-Ua'] = spoofedSecChUa;
        headers['Sec-Ch-Ua-Mobile'] = getSpoofedMobile();
        headers['Sec-Ch-Ua-Platform'] = getSpoofedPlatform();
        headers['User-Agent'] = spoofedUA;
        headers['Accept-Language'] = 'en-US,en;q=0.9';
        headers['Referer'] = 'https://www.twitch.tv/';
        headers['Origin'] = 'https://www.twitch.tv/';
        headers['Host'] = 'gql.twitch.tv';
        return new Promise((resolve, reject) => {
            gmXhr({
                method: method || 'GET',
                url: url,
                data: bodyText,
                headers: headers,
                onload: resp => resolve(resp),
                onerror: err => reject(err),
                ontimeout: () => reject(new Error('TwitchBraveFix: GM_xmlHttpRequest timeout')),
            });
        });
    }

    async function maybeRetryOnErrors(url, method, bodyText, headers, response) {
        if (response.status !== 200) return response;
        const cloned = response.clone();
        let bodyTextResp;
        try { bodyTextResp = await cloned.text(); } catch (_e) { return response; }
        let parsed;
        try { parsed = JSON.parse(bodyTextResp); } catch (_e) { return response; }
        // Twitch's tell: HTTP 200 with a top-level `errors` field means fingerprint validation failed.
        // Genuine GQL responses are either `data` or an array of `data`-shaped objects; `errors` only
        // appears when the request was rejected at the gateway level.
        if (typeof parsed?.errors === 'undefined' && !(Array.isArray(parsed) && parsed.some(p => typeof p?.errors !== 'undefined'))) {
            return response;
        }
        console.log('[TwitchBraveFix] GQL errors detected — switching to GM_xmlHttpRequest path with header spoofs');
        isProblematicBrowser = true;
        try {
            const gmResp = await gmRetry(url, method, bodyText, headers);
            return gmRespToFetchResp(gmResp);
        } catch (e) {
            console.log('[TwitchBraveFix] GM_xmlHttpRequest retry failed; returning original errored response:', (e && e.message) || e);
            return new Response(bodyTextResp, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            });
        }
    }

    window.fetch = async function _braveFixFetch(input, init) {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (!isInterceptable(url)) {
            return realFetch.apply(this, arguments);
        }
        const method = (init && init.method) || (input && input.method) || 'GET';
        const headers = collectHeaders(input, init);
        const bodyText = await readBodyAsText(input, init);
        if (isProblematicBrowser) {
            try {
                const gmResp = await gmRetry(url, method, bodyText, headers);
                return gmRespToFetchResp(gmResp);
            } catch (e) {
                console.log('[TwitchBraveFix] GM_xmlHttpRequest path failed; falling back to native fetch:', (e && e.message) || e);
                return realFetch.apply(this, arguments);
            }
        }
        const response = await realFetch.apply(this, arguments);
        return maybeRetryOnErrors(url, method, bodyText, headers, response);
    };

    console.log('[TwitchBraveFix] window.fetch hook installed + navigator.brave hidden — will sniff first GQL response for errors and retry via GM_xmlHttpRequest if present');
})();

// youtube-transcript.esm.js
'use strict'; // 保持 CommonJS 严格模式

const fetch = require('node-fetch'); // 确保安装
const { HttpsProxyAgent } = require('https-proxy-agent'); // 确保安装

// --- 关键修改：从环境变量中读取 PROXY_URL ---
const PROXY_URL = process.env.PROXY_URL; // 现在从环境变量读取代理 URL
// ---------------------------------------------

const RE_YOUTUBE = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)';

// 自定义错误类 (保持不变)
class YoutubeTranscriptError extends Error {
    constructor(message) {
        super(`[YoutubeTranscript] 🚨 ${message}`);
        this.name = 'YoutubeTranscriptError';
    }
}
class YoutubeTranscriptTooManyRequestError extends YoutubeTranscriptError {
    constructor() {
        super('YouTube is receiving too many requests from this IP and now requires solving a captcha to continue');
        this.name = 'YoutubeTranscriptTooManyRequestError';
    }
}
class YoutubeTranscriptVideoUnavailableError extends YoutubeTranscriptError {
    constructor(videoId) {
        super(`The video is no longer available (${videoId})`);
        this.name = 'YoutubeTranscriptVideoUnavailableError';
    }
}
class YoutubeTranscriptDisabledError extends YoutubeTranscriptError {
    constructor(videoId) {
        super(`Transcript is disabled on this video (${videoId})`);
        this.name = 'YoutubeTranscriptDisabledError';
    }
}
class YoutubeTranscriptNotAvailableError extends YoutubeTranscriptError {
    constructor(videoId) {
        super(`No transcripts are available for this video (${videoId})`);
        this.name = 'YoutubeTranscriptNotAvailableError';
    }
}
class YoutubeTranscriptNotAvailableLanguageError extends YoutubeTranscriptError {
    constructor(lang, availableLangs, videoId) {
        super(`No transcripts are available in ${lang} this video (${videoId}). Available languages: ${availableLangs.join(', ')}`);
        this.name = 'YoutubeTranscriptNotAvailableLanguageError';
    }
}

/**
 * Class to retrieve transcript if exist
 */
class YoutubeTranscript {
    /**
     * Fetch transcript from YTB Video
     * @param videoId Video url or video identifier
     * @param config Get transcript in a specific language ISO
     */
    static async fetchTranscript(videoId, config) { // 标记为 async 函数
        const identifier = this.retrieveVideoId(videoId);
        // 使用从环境变量读取的 PROXY_URL 来创建代理 agent
        const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined; 

        // 第一次请求：获取视频页面以解析字幕轨道信息
        const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${identifier}`, {
            headers: {
                ...((config === null || config === void 0 ? void 0 : config.lang) && { 'Accept-Language': config.lang }),
                'User-Agent': USER_AGENT
            },
            agent: agent // 确保这里传递了 agent
        });
        const videoPageBody = await videoPageResponse.text();

        const splittedHTML = videoPageBody.split('"captions":');
        if (splittedHTML.length <= 1) {
            if (videoPageBody.includes('class="g-recaptcha"')) {
                throw new YoutubeTranscriptTooManyRequestError();
            }
            if (!videoPageBody.includes('"playabilityStatus":')) {
                throw new YoutubeTranscriptVideoUnavailableError(videoId);
            }
            throw new YoutubeTranscriptDisabledError(videoId);
        }

        let captions;
        try {
            captions = JSON.parse(splittedHTML[1].split(',"videoDetails')[0].replace(/\n/g, ''));
        } catch (e) {
            throw new YoutubeTranscriptDisabledError(videoId);
        }

        if (!captions || !captions['playerCaptionsTracklistRenderer']) {
            throw new YoutubeTranscriptDisabledError(videoId);
        }

        const captionTracks = captions.playerCaptionsTracklistRenderer.captionTracks;

        if (!captionTracks || captionTracks.length === 0) {
            throw new YoutubeTranscriptNotAvailableError(videoId);
        }

        let transcriptURL;
        // 处理 "default" 语言参数，如果 lang 是 "default" 或未提供，则使用第一个字幕轨道
        if (config && config.lang && config.lang !== 'default') {
            const selectedTrack = captionTracks.find((track) => track.languageCode === config.lang);
            if (!selectedTrack) {
                throw new YoutubeTranscriptNotAvailableLanguageError(config.lang, captionTracks.map((track) => track.languageCode), videoId);
            }
            transcriptURL = selectedTrack.baseUrl;
        } else {
            transcriptURL = captionTracks[0].baseUrl; // 如果是 "default" 或未指定，则使用第一个字幕轨道
        }

        // 第二次请求：获取字幕内容
        const transcriptResponse = await fetch(`${transcriptURL}&fmt=json3&xorb=2&xobt=3&xovt=3`, {
            headers: {
                // 仅当明确指定了非 "default" 语言时才发送 Accept-Language 头
                ...((config && config.lang && config.lang !== 'default') && { 'Accept-Language': config.lang }),
                'User-Agent': USER_AGENT
            },
            agent: agent // 确保这里传递了 agent
        });

        if (!transcriptResponse.ok) {
            throw new YoutubeTranscriptNotAvailableError(videoId);
        }

        const transcriptBody = await transcriptResponse.json(); // 直接解析为 JSON
        return transcriptBody; // 直接返回解析后的 JSON 对象
    }

    /**
     * Retrieve video id from url or string
     * @param videoId video url or video id
     */
    static retrieveVideoId(videoId) {
        if (videoId.length === 11) {
            return videoId;
        }
        const matchId = videoId.match(RE_YOUTUBE);
        if (matchId && matchId.length) {
            return matchId[1];
        }
        throw new YoutubeTranscriptError('Impossible to retrieve Youtube video ID.');
    }
}

// 使用 CommonJS 导出所有类
module.exports = {
    YoutubeTranscript,
    YoutubeTranscriptDisabledError,
    YoutubeTranscriptError,
    YoutubeTranscriptNotAvailableError,
    YoutubeTranscriptNotAvailableLanguageError,
    YoutubeTranscriptTooManyRequestError,
    YoutubeTranscriptVideoUnavailableError
};
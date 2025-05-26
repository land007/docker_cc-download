// index.js
const express = require('express');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fetch = require('node-fetch'); // 确保已安装 node-fetch

// 从本地文件导入 YoutubeTranscript 类及相关错误类
// 确保 'youtube-transcript.esm.js' 文件与此 'index.js' 在同一目录下
const {
    YoutubeTranscript,
    YoutubeTranscriptError,
    YoutubeTranscriptTooManyRequestError,
    YoutubeTranscriptVideoUnavailableError,
    YoutubeTranscriptDisabledError,
    YoutubeTranscriptNotAvailableError,
    YoutubeTranscriptNotAvailableLanguageError
} = require('./youtube-transcript.esm.js');

const app = express();
const port = process.env.PORT || 3000; // API 监听端口

// 从环境变量获取代理 URL，如果没有设置则为 undefined
const PROXY_URL = process.env.PROXY_URL;

// --- API 接口 ---
app.get('/transcript/:videoId', async (req, res) => {
    const videoId = req.params.videoId;
    // 允许通过查询参数指定语言，例如 /transcript/VIDEO_ID?lang=en
    // 如果不指定或为 "default"，则获取默认字幕
    const lang = req.query.lang;

    try {
        // 调用 YoutubeTranscript 类的静态方法获取字幕
        // 注意：这里需要传递 `proxyAgent` 给 fetchTranscript 方法，
        // 但您提供的 youtube-transcript.esm.js 内部已经硬编码了 PROXY_URL，
        // 所以这里我们假设内部会处理代理。
        const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });

        res.json({
            success: true,
            videoId: videoId,
            lang: lang || 'default', // 返回实际使用的语言或 'default'
            transcript: transcript
        });
    } catch (error) {
        console.error(`获取视频 ${videoId} 字幕时发生错误:`, error.message);

        let statusCode = 500;
        let errorMessage = 'An unexpected error occurred.';

        // 根据错误类型返回不同的状态码和错误信息
        if (error instanceof YoutubeTranscriptTooManyRequestError) {
            statusCode = 429; // Too Many Requests
            errorMessage = error.message;
        } else if (error instanceof YoutubeTranscriptVideoUnavailableError) {
            statusCode = 404; // Not Found
            errorMessage = error.message;
        } else if (error instanceof YoutubeTranscriptDisabledError || error instanceof YoutubeTranscriptNotAvailableError) {
            statusCode = 404; // Not Found (字幕不可用或被禁用)
            errorMessage = error.message;
        } else if (error instanceof YoutubeTranscriptNotAvailableLanguageError) {
            statusCode = 404; // Not Found (指定语言的字幕不可用)
            errorMessage = error.message;
        } else if (error instanceof YoutubeTranscriptError) {
            statusCode = 400; // Bad Request (例如：无法识别视频 ID)
            errorMessage = error.message;
        }

        res.status(statusCode).json({
            success: false,
            videoId: videoId,
            lang: lang || 'default',
            error: errorMessage
        });
    }
});

// --- 根路径响应 ---
app.get('/', (req, res) => {
    res.send('YouTube 字幕 API 正在运行。使用 `/transcript/:videoId` 获取字幕。');
});

// --- 启动服务器 ---
app.listen(port, () => {
    console.log(`YouTube 字幕 API 监听在 http://localhost:${port}`);
    if (PROXY_URL) {
        console.log(`正在使用代理: ${PROXY_URL}`);
    } else {
        console.log('未配置代理。如果需要，请设置 PROXY_URL 环境变量。');
    }
});
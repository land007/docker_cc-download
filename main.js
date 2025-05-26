// const { YoutubeTranscript } = require('youtube-transcript');
const { YoutubeTranscript } = require('./youtube-transcript.esm.js');

YoutubeTranscript.fetchTranscript('https://www.youtube.com/watch?v=6gQGB6lpRYs')
  .then(console.log)
  .catch(console.error);
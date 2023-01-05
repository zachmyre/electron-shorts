const fs = require('fs');
const ytdl = require('ytdl-core');
const cp = require('child_process');
const readline = require('readline');
const ffmpeg = require('ffmpeg-static');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fluent_ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');

const youtube_status = document.getElementById('youtube_status');
const youtube_id = document.getElementById('youtube_id');
const youtube_video_input = document.getElementById('youtube_video_input');
const youtube_download_btn = document.getElementById('youtube_download_btn');
const youtube_start_input = document.getElementById('start_time');
const youtube_end_input = document.getElementById('end_time');
const youtube_clip_btn = document.getElementById('youtube_clip_btn');
var youtube_data = {
    url: '',
    id: '',
    subtitles: ''
}
var transcribed_audio;
youtube_status.innerHTML = "ready for action.";
youtube_id.innerHTML = "null";


youtube_download_btn.addEventListener('click', async () => {
    try{
        fs.unlinkSync("./assets/out.mp4");
        fs.unlinkSync('./assets/video_out.mp4');
    }catch(error){
        console.log('unlinkSync catch');
        console.log(error);
    }
    youtube_data.url = youtube_video_input.value;
    youtube_data.id = getYoutubeID(youtube_data.url);
    if (!youtube_data.id) {
        youtube_status.className = "text-red-500";
        youtube_status.innerHTML = "Invalid link, please use youtube links only.";
        return;
    }
    youtube_id.innerHTML = youtube_data.id;
    youtube_status.className = '';
    youtube_status.innerHTML = "id acquired."
    await download_video(youtube_data.url);
    const pythonProcess = cp.spawn('python',["./transcribe.py", youtube_data.id]);
    const json_text = await axios.get("../assets/text.json");
    youtube_data.subtitles = json_text.data;
    console.log(youtube_data.subtitles);
    youtube_status.innerHTML = "Subtitles acquired";
})

youtube_clip_btn.addEventListener("click", () => {
    if(!youtube_data.url){
        youtube_status.className = "text-red-500";
        youtube_status.innerHTML = "You must download a youtube video first!";
        return;
    }
    fluent_ffmpeg.setFfmpegPath(ffmpegPath);
    fluent_ffmpeg('./assets/out.mp4')
    .setStartTime(`${youtube_start_input.value}`)
    .setDuration(youtube_end_input.value-youtube_start_input.value)
    .output('./assets/video_out.mp4')
    .on('end', function(err) {
        if(!err) { console.log('conversion Done') }
    })
    .on('error', err => console.log('error: ', err))
    .run()
})


function download_video(youtube_url) {
    return new Promise(function(resolve, reject) {
    const ref = youtube_url;
    const tracker = {
        start: Date.now(),
        audio: { downloaded: 0, total: Infinity },
        video: { downloaded: 0, total: Infinity },
        merged: { frame: 0, speed: '0x', fps: 0 },
    };

    // Get audio and video streams
    const audio = ytdl(ref, { quality: 'highestaudio' })
        .on('progress', (_, downloaded, total) => {
            tracker.audio = { downloaded, total };
        });
    const video = ytdl(ref, { quality: 'highestvideo' })
        .on('progress', (_, downloaded, total) => {
            tracker.video = { downloaded, total };
        });

    // Prepare the progress bar
    let progressbarHandle = null;
    const progressbarInterval = 1000;
    const showProgress = () => {
        readline.cursorTo(process.stdout, 0);
        const toMB = i => (i / 1024 / 1024).toFixed(2);

        process.stdout.write(`Audio  | ${(tracker.audio.downloaded / tracker.audio.total * 100).toFixed(2)}% processed `);
        process.stdout.write(`(${toMB(tracker.audio.downloaded)}MB of ${toMB(tracker.audio.total)}MB).${' '.repeat(10)}\n`);

        process.stdout.write(`Video  | ${(tracker.video.downloaded / tracker.video.total * 100).toFixed(2)}% processed `);
        process.stdout.write(`(${toMB(tracker.video.downloaded)}MB of ${toMB(tracker.video.total)}MB).${' '.repeat(10)}\n`);
        youtube_status.innerHTML = `${(tracker.audio.downloaded / tracker.audio.total * 100).toFixed(2)}%`;
        process.stdout.write(`Merged | processing frame ${tracker.merged.frame} `);
        process.stdout.write(`(at ${tracker.merged.fps} fps => ${tracker.merged.speed}).${' '.repeat(10)}\n`);

        process.stdout.write(`running for: ${((Date.now() - tracker.start) / 1000 / 60).toFixed(2)} Minutes.`);
        readline.moveCursor(process.stdout, 0, -3);
    };

    // Start the ffmpeg child process
    const ffmpegProcess = cp.spawn(ffmpeg, [
        // Remove ffmpeg's console spamming
        '-loglevel', '8', '-hide_banner',
        // Redirect/Enable progress messages
        '-progress', 'pipe:3',
        // Set inputs
        '-i', 'pipe:4',
        '-i', 'pipe:5',
        // Map audio & video from streams
        '-map', '0:a',
        '-map', '1:v',
        // Keep encoding
        '-c:v', 'copy',
        // Define output file
        'assets/out.mp4',
    ], {
        windowsHide: true,
        stdio: [
            /* Standard: stdin, stdout, stderr */
            'inherit', 'inherit', 'inherit',
            /* Custom: pipe:3, pipe:4, pipe:5 */
            'pipe', 'pipe', 'pipe',
        ],
    });
    ffmpegProcess.on('close', () => {
        console.log('done');
        // Cleanup
        process.stdout.write('\n\n\n\n');
        youtube_status.innerHTML = "Done!"
        youtube_video_input.value = '';
        clearInterval(progressbarHandle);
        resolve();
    });

    // Link streams
    // FFmpeg creates the transformer streams and we just have to insert / read data
    ffmpegProcess.stdio[3].on('data', chunk => {
        // Start the progress bar
        if (!progressbarHandle) progressbarHandle = setInterval(showProgress, progressbarInterval);
        // Parse the param=value list returned by ffmpeg
        const lines = chunk.toString().trim().split('\n');
        const args = {};
        for (const l of lines) {
            const [key, value] = l.split('=');
            args[key.trim()] = value.trim();
        }
        tracker.merged = args;
    });
    audio.pipe(ffmpegProcess.stdio[4]);
    video.pipe(ffmpegProcess.stdio[5]);
})
}

function getYoutubeID(url) {
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    var match = url.match(regExp);
    return (match && match[7].length == 11) ? match[7] : false;
}
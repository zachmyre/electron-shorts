const fs = require('fs');
const ytdl = require('ytdl-core');
const cp = require('child_process');
const readline = require('readline');
const ffmpeg = require('ffmpeg-static');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fluent_ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
fluent_ffmpeg.setFfmpegPath(ffmpegPath);


// https://stackoverflow.com/questions/35848367/adding-subtitles-with-fluent-ffmpeg


//https://www.youtube.com/watch?v=efs3QRr8LWw&t=2s&ab_channel=PowerfulJRE
//5386 -> 5407

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
setStatus("Ready for war.");
youtube_id.innerHTML = "none";


youtube_download_btn.addEventListener('click', async () => {
    try{
        fs.unlinkSync("./assets/out.mp4");
        fs.unlinkSync('./assets/test.mp4');
        fs.unlinkSync('./assets/text.srt')
    }catch(error){
        console.log('unlinkSync catch');
        console.log(error);
    }
    youtube_data.url = youtube_video_input.value;
    youtube_data.id = getYoutubeID(youtube_data.url);
    if (!youtube_data.id) {
         setStatus("Invalid link, please use youtube links only.", true);
        return;
    }
    youtube_id.innerHTML = youtube_data.id;
    youtube_status.className = '';
    setStatus("ID retrieved.")
    await download_video(youtube_data.url);
    await generateSubtitles();
    setStatus("Adding subtitles to video..");
    fluent_ffmpeg('./assets/out.mp4')
            .outputOptions(
                '-vf subtitles=./assets/text.srt'
            )
            .on('error', function(err) {
                console.log('Error: ' + err.message);
                setStatus("Error adding subtitles: " + err.message, true);
            })
            .on('end', () => {
                console.log('done')
                setStatus("Done adding subtitles!");
            })
            .save('./assets/test.mp4');
})

youtube_clip_btn.addEventListener("click", () => {
    // if(!youtube_data.url){
    //     setStatus("You must download a youtube video first!", true);
    //     return;
    // }
    
    fluent_ffmpeg('./assets/test.mp4')
    .setStartTime(`${youtube_start_input.value}`)
    .setDuration(youtube_end_input.value-youtube_start_input.value)
    .size('1920x1080').aspect('9:16')
    .output('./assets/video_out.mp4')
    .on('end', function(err) {
        if(!err) { setStatus("Clip conversion finished!") }
    })
    .on('error', err => setStatus("Erro on clip conversion: " + err, true))
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
        setStatus(`${(tracker.video.downloaded / tracker.video.total * 100).toFixed(2)}%`);
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
        setStatus("Done downloading video!");
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

function generateSubtitles(){
    return new Promise((resolve, reject) => {
        cp.spawn('python',["./transcribe.py", youtube_data.id]);
        setTimeout(() => {
            resolve();
        }, 15000)
    })
}

function getYoutubeID(url) {
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    var match = url.match(regExp);
    return (match && match[7].length == 11) ? match[7] : false;
}

function setStatus(status, error = false){
    youtube_status.className = error ? "text-red-500" : "text-green-500";
    youtube_status.innerHTML = status;
}

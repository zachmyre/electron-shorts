import sys
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import SRTFormatter

# Must be a single transcript.
transcript = YouTubeTranscriptApi.get_transcript(sys.argv[1])

formatter = SRTFormatter()

# .format_transcript(transcript) turns the transcript into a JSON string.
srt_formatted = formatter.format_transcript(transcript)


# Now we can write it out to a file.
with open('./assets/text.srt', 'w', encoding='utf-8') as json_file:
    json_file.write(srt_formatted)
sys.stdout.flush()

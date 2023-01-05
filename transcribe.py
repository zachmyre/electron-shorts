import sys
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import JSONFormatter

# Must be a single transcript.
transcript = YouTubeTranscriptApi.get_transcript(sys.argv[1])

formatter = JSONFormatter()

# .format_transcript(transcript) turns the transcript into a JSON string.
json_formatted = formatter.format_transcript(transcript)


# Now we can write it out to a file.
with open('./assets/text.json', 'w', encoding='utf-8') as json_file:
    json_file.write(json_formatted)
sys.stdout.flush()

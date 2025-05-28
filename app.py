from flask import Flask, request, jsonify, send_file, render_template, url_for, session
from flask_cors import CORS
import os
import json
from datetime import datetime
from helper import (
    get_video_details,
    summarize,
    translate,
    write_summaries_to_word,
    run_tldw_colab,
    pipeline
)
import yt_dlp

last_summary = None
app = Flask(__name__)
CORS(app, supports_credentials=True)  # Enable CORS with credentials
app.secret_key = os.urandom(24)  # Required for session

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/summarize', methods=['POST'])
def summarize_api():
    try:
        data = request.get_json()
        print("Received data in summarize_api:", data)
        
        if not data:
            print("Error: No data provided in request")
            return jsonify({"error": "No data provided"}), 400
            
        links = data.get('links', [])
        language = data.get('language', 'English')
        
        if not links:
            print("Error: No links provided")
            return jsonify({"error": "No links provided"}), 400
            
        print(f"Processing {len(links)} links in {language}")
        
        # Process each link
        processed_links = []
        for link in links:
            if not link:
                continue
                
            # Handle playlist links
            if "playlist?list=" in link:
                try:
                    playlist_id = link.split("list=")[1].split("&")[0]
                    print(f"Processing playlist: {playlist_id}")
                    
                    # Configure yt-dlp options for playlist extraction
                    ydl_opts = {
                        'extract_flat': True,
                        'quiet': True,
                        'no_warnings': True,
                        'force_generic_extractor': False
                    }
                    
                    # Extract playlist information
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        playlist_info = ydl.extract_info(f"https://www.youtube.com/playlist?list={playlist_id}", download=False)
                        if playlist_info and 'entries' in playlist_info:
                            for entry in playlist_info['entries']:
                                if entry and entry.get('id'):
                                    video_url = f"https://www.youtube.com/watch?v={entry['id']}"
                                    processed_links.append(video_url)
                            print(f"Added {len(playlist_info['entries'])} videos from playlist")
                except Exception as e:
                    print(f"Error processing playlist {link}: {str(e)}")
                    continue
            else:
                # Handle regular video links
                if "youtu.be" in link:
                    video_id = link.split("/")[-1].split("?")[0]
                    processed_links.append(f"https://www.youtube.com/watch?v={video_id}")
                elif "youtube.com" in link:
                    video_id = link.split("v=")[-1].split("&")[0]
                    processed_links.append(f"https://www.youtube.com/watch?v={video_id}")
                else:
                    processed_links.append(link)
            
        if not processed_links:
            print("Error: No valid links found")
            return jsonify({"error": "No valid links found"}), 400
            
        print(f"Starting pipeline with {len(processed_links)} processed links")
        result = pipeline(processed_links, language)
        print("Pipeline result:", result)
        
        # Format the response
        formatted_result = []
        for i, item in enumerate(result):
            print(f"Processing item {i+1} of {len(result)}")
            try:
                # Extract video ID from the processed link
                video_url = processed_links[i] if i < len(processed_links) else None
                video_id = None
                if video_url:
                    if "youtu.be" in video_url:
                        video_id = video_url.split("/")[-1].split("?")[0]
                    elif "youtube.com" in video_url:
                        video_id = video_url.split("v=")[-1].split("&")[0]
                    else:
                        video_id = video_url
                
                formatted_item = {
                    'title': item['title'],
                    'summary': item['summary'],
                    'translated_summary': item.get('translated_summary'),
                    'videoId': video_id,
                    'language': language
                }
                formatted_result.append(formatted_item)
                print(f"Formatted item {i+1} done")
            except Exception as e:
                print(f"Error formatting item {i+1}: {str(e)}")
                print(f"Error type: {type(e)}")
                import traceback
                print(f"Error traceback: {traceback.format_exc()}")
                continue
        
        print("Returning formatted result:", formatted_result)
        return jsonify(formatted_result)
        
    except Exception as e:
        print(f"Error in summarize_api: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        print(f"Error traceback: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@app.route('/download_docx', methods=['POST'])
def download_docx():
    try:
        print("Starting docx download process")
        data = request.get_json()
        print("Received data for download:", data)
        
        if not data or not isinstance(data, list):
            print("Error: Invalid data format for download")
            return jsonify({'error': 'No valid data provided for download'}), 400

        filename = "output.docx"
        print(f"Generating Word document: {filename}")
        success = write_summaries_to_word(data, filename)
        
        if success:
            print("Word document generated successfully")
            return send_file(filename, as_attachment=True)
        else:
            print("Failed to generate Word document")
            return jsonify({'error': 'Failed to generate Word document'}), 500
    except Exception as e:
        print(f"Error in download_docx: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        print(f"Error traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/highlight', methods=['POST'])
def highlight():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        video_url = data.get('video_url')
        if not video_url:
            return jsonify({'error': 'Missing "video_url" in request'}), 400

        # Generate a unique filename for this request
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = f"highlight_{timestamp}.mp4"

        # Generate the highlight video with progress updates
        output_path = run_tldw_colab(video_url, output_file=output_file)
        
        if output_path and os.path.exists(output_path):
            try:
                # Send the file for display instead of download
                response = send_file(
                    output_path,
                    mimetype='video/mp4',
                    as_attachment=False  # Changed to False to display instead of download
                )
                
                # Clean up the file after sending
                @response.call_on_close
                def cleanup():
                    try:
                        os.remove(output_path)
                    except Exception as e:
                        print(f"Error cleaning up file {output_path}: {str(e)}")
                
                return response
            except Exception as e:
                # Clean up on error
                if os.path.exists(output_path):
                    os.remove(output_path)
                raise e
        else:
            return jsonify({'error': 'Failed to generate highlight video'}), 500
            
    except Exception as e:
        print(f"Error in highlight: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_playlist_videos', methods=['POST'])
def get_playlist_videos():
    try:
        data = request.get_json()
        if not data or 'playlist_id' not in data:
            return jsonify({'error': 'No playlist ID provided'}), 400

        playlist_id = data['playlist_id']
        print(f"Processing playlist: {playlist_id}")

        # Configure yt-dlp options for playlist extraction
        ydl_opts = {
            'extract_flat': True,
            'quiet': True,
            'no_warnings': True,
            'force_generic_extractor': False
        }

        # Extract playlist information
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                playlist_info = ydl.extract_info(f"https://www.youtube.com/playlist?list={playlist_id}", download=False)
                if not playlist_info or 'entries' not in playlist_info:
                    return jsonify({'error': 'Failed to extract playlist information'}), 400

                # Extract video information
                videos = []
                for entry in playlist_info['entries']:
                    if entry:
                        videos.append({
                            'id': entry.get('id'),
                            'title': entry.get('title'),
                            'duration': entry.get('duration'),
                            'url': f"https://www.youtube.com/watch?v={entry.get('id')}"
                        })

                print(f"Found {len(videos)} videos in playlist")
                return jsonify({'videos': videos})

            except Exception as e:
                print(f"Error extracting playlist: {str(e)}")
                return jsonify({'error': f'Failed to extract playlist: {str(e)}'}), 400

    except Exception as e:
        print(f"Error processing playlist request: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

import os
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import requests

load_dotenv()
app = Flask(__name__)

# Put your Roboflow Workflow URL in .env.
ROBOFLOW_WORKFLOW_URL = os.getenv("ROBOFLOW_WORKFLOW_URL", "").strip()
ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY", "").strip()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/detect", methods=["POST"])
def detect():
    image = request.files.get("image")
    if not image or not image.filename:
        return jsonify({"error": "Please choose an image first."}), 400

    load_dotenv(override=True)
    workflow_url = os.getenv("ROBOFLOW_WORKFLOW_URL", "").strip()
    api_key = os.getenv("ROBOFLOW_API_KEY", "").strip()

    if not workflow_url or not api_key:
        return jsonify({
            "error": "Roboflow is not configured yet. Add your Workflow URL and API key to the .env file."
        }), 400

    try:
        # Roboflow models expect multipart form key 'file', while Workflows expect 'image'
        field_name = "image" if "/workflows/" in workflow_url else "file"
        params = {"api_key": api_key, "confidence": 15}
        response = requests.post(
            workflow_url,
            params=params,
            files={field_name: (image.filename, image.stream, image.mimetype or "application/octet-stream")},
            timeout=60,
        )
        response.raise_for_status()
        return jsonify(response.json())
    except requests.RequestException as exc:
        return jsonify({
            "error": "Could not reach Roboflow. Check the Workflow URL, internet connection, and API key.",
            "details": str(exc)
        }), 502
    except ValueError:
        return jsonify({"error": "Roboflow returned a response that was not valid JSON."}), 502

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

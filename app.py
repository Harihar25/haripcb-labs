import os
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import requests

load_dotenv()

# HTML, CSS and JavaScript files are in the repository root.
app = Flask(
    __name__,
    template_folder=".",
    static_folder=".",
    static_url_path="/static"
)

ROBOFLOW_WORKFLOW_URL = os.getenv("ROBOFLOW_WORKFLOW_URL", "").strip()
ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY", "").strip()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/style.css")
def style():
    return app.send_static_file("style.css")


@app.route("/script.js")
def script():
    return app.send_static_file("script.js")


@app.route("/detect", methods=["POST"])
def detect():
    image = request.files.get("image")

    if not image or not image.filename:
        return jsonify({
            "error": "Please choose an image first."
        }), 400

    workflow_url = os.getenv("ROBOFLOW_WORKFLOW_URL", "").strip()
    api_key = os.getenv("ROBOFLOW_API_KEY", "").strip()

    if not workflow_url or not api_key:
        return jsonify({
            "error": "Roboflow is not configured. Please add ROBOFLOW_WORKFLOW_URL and ROBOFLOW_API_KEY in Render Environment Variables."
        }), 500

    try:
        field_name = "image" if "/workflows/" in workflow_url else "file"

        params = {
            "api_key": api_key,
            "confidence": 15
        }

        response = requests.post(
            workflow_url,
            params=params,
            files={
                field_name: (
                    image.filename,
                    image.stream,
                    image.mimetype or "application/octet-stream"
                )
            },
            timeout=60
        )

        response.raise_for_status()

        return jsonify(response.json())

    except requests.RequestException:
        return jsonify({
            "error": "Could not connect to Roboflow. Please check the Workflow URL, API key and Render environment variables."
        }), 502

    except ValueError:
        return jsonify({
            "error": "Roboflow returned an invalid JSON response."
        }), 502


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False
    )

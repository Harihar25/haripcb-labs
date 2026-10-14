const input = document.getElementById("imageInput");
const fileName = document.getElementById("fileName");
const viewerWrapper = document.getElementById("viewerWrapper");
const canvas = document.getElementById("defectCanvas");
const ctx = canvas.getContext("2d");
const detectionPill = document.getElementById("detectionPill");
const controlsBar = document.getElementById("controlsBar");
const confidenceSlider = document.getElementById("confidenceSlider");
const confidenceVal = document.getElementById("confidenceVal");
const button = document.getElementById("detectButton");
const statusText = document.getElementById("status");
const defectsSummary = document.getElementById("defectsSummary");
const rawJsonDetails = document.getElementById("rawJsonDetails");
const result = document.getElementById("result");

let currentImage = null;
let allPredictions = [];

// Neon cyan Roboflow palette & class-specific accents
const DEFECT_COLORS = {
  "missing hole": "#00f0bd",
  "mouse bite": "#ff9f43",
  "open circuit": "#0abde3",
  "short": "#ff4d4f",
  "spur": "#a55eea",
  "spurious copper": "#ff6b81"
};

function getDefectColor(className) {
  const name = (className || "").toLowerCase();
  for (const [key, color] of Object.entries(DEFECT_COLORS)) {
    if (name.includes(key)) return color;
  }
  return "#00f0bd"; // Default Roboflow neon teal
}

function hexToRgba(hex, alpha) {
  const c = hex.replace("#", "");
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function cleanClassName(className) {
  return (className || "").replace(/^[0-9]+\s*/, "");
}

function drawCanvas(predictions = []) {
  if (!currentImage) return;

  canvas.width = currentImage.naturalWidth || currentImage.width;
  canvas.height = currentImage.naturalHeight || currentImage.height;

  // 1. Draw raw PCB image
  ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);

  if (!predictions || predictions.length === 0) return;

  // Dynamic scaling so boxes and labels look sharp on high-res PCB photos
  const scale = Math.max(canvas.width, canvas.height) / 750;
  const lineWidth = Math.max(2, Math.round(2.5 * scale));
  const fontSize = Math.max(11, Math.round(13 * scale));

  predictions.forEach((pred) => {
    const color = getDefectColor(pred.class);
    const w = pred.width;
    const h = pred.height;
    const x = pred.x - w / 2;
    const y = pred.y - h / 2;

    // Subtle translucent fill
    ctx.fillStyle = hexToRgba(color, 0.18);
    ctx.fillRect(x, y, w, h);

    // Neon bounding box border
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, y, w, h);

    // Label tag with confidence (matching Roboflow)
    const conf = Math.round((pred.confidence || 0) * 100);
    const cleanName = cleanClassName(pred.class);
    const label = `${cleanName} ${conf}%`;

    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
    const textWidth = ctx.measureText(label).width;
    const padX = 5 * scale;
    const padY = 3 * scale;
    const tagH = fontSize + padY * 2;
    const tagW = textWidth + padX * 2;

    const tagY = Math.max(0, y - tagH);

    // Tag background
    ctx.fillStyle = color;
    ctx.fillRect(x, tagY, tagW, tagH);

    // Dark text on neon background for high contrast
    ctx.fillStyle = "#041416";
    ctx.fillText(label, x + padX, tagY + fontSize + padY * 0.2);
  });
}

function updateVisuals() {
  const threshold = parseInt(confidenceSlider.value, 10) / 100;
  confidenceVal.textContent = `${confidenceSlider.value}%`;

  const filtered = allPredictions.filter((p) => (p.confidence || 0) >= threshold);

  // Redraw canvas with filtered boxes
  drawCanvas(filtered);

  // Update floating detection pill
  detectionPill.textContent = `${filtered.length} object${filtered.length === 1 ? "" : "s"} detected`;
  detectionPill.hidden = false;

  // Update summary chips
  if (allPredictions.length > 0) {
    if (filtered.length === 0) {
      defectsSummary.className = "defects-summary clean";
      defectsSummary.innerHTML = `<h3>✅ No Defects Above ${confidenceSlider.value}%</h3><p style="margin:0; color:#9cb1c9;">Lower the slider to see lower-confidence candidates.</p>`;
    } else {
      defectsSummary.className = "defects-summary defects-found";
      const badges = filtered.map((p) => {
        const color = getDefectColor(p.class);
        const name = cleanClassName(p.class);
        const conf = Math.round((p.confidence || 0) * 100);
        return `<span class="defect-badge" style="background:${color}; color:#041416;">⚠️ ${name} • ${conf}%</span>`;
      }).join("");

      defectsSummary.innerHTML = `
        <h3>⚠️ ${filtered.length} Defect${filtered.length > 1 ? "s" : ""} Spotted</h3>
        <div class="defects-grid">${badges}</div>
      `;
    }
    defectsSummary.hidden = false;
  }
}

confidenceSlider.addEventListener("input", updateVisuals);

input.addEventListener("change", () => {
  const file = input.files && input.files[0];
  statusText.textContent = "";
  defectsSummary.hidden = true;
  defectsSummary.innerHTML = "";
  rawJsonDetails.hidden = true;
  controlsBar.hidden = true;
  detectionPill.hidden = true;
  allPredictions = [];

  if (!file) {
    fileName.textContent = "PNG, JPG, or JPEG";
    viewerWrapper.hidden = true;
    currentImage = null;
    return;
  }

  fileName.textContent = file.name;
  const img = new Image();
  img.onload = () => {
    currentImage = img;
    drawCanvas([]);
    viewerWrapper.hidden = false;
  };
  img.src = URL.createObjectURL(file);
});

button.addEventListener("click", async () => {
  const file = input.files && input.files[0];
  if (!file) {
    statusText.textContent = "Choose a PCB image first.";
    return;
  }

  const formData = new FormData();
  formData.append("image", file);
  button.disabled = true;
  statusText.textContent = "Scanning PCB image with Roboflow…";
  defectsSummary.hidden = true;
  rawJsonDetails.hidden = true;

  try {
    const response = await fetch("/detect", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Detection failed.");

    allPredictions = data.predictions || [];
    statusText.textContent = "";

    // Show controls and render detections
    controlsBar.hidden = false;
    updateVisuals();

    // Populate expandable raw JSON
    result.textContent = JSON.stringify(data, null, 2);
    rawJsonDetails.hidden = false;
  } catch (error) {
    statusText.textContent = error.message || "Something went wrong.";
  } finally {
    button.disabled = false;
  }
});

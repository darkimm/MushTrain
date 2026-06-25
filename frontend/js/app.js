/* ── State ───────────────────────────────────────────── */
const state = {
  file: null,
  imageSrc: null,
  history: [],
  pieChart: null,
  lineChart: null
};

/* ── Init ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Nav tabs
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Drag and drop
  const dz = document.getElementById('drop-zone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('active'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('active'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('active');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) setFile(file);
  });
});

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
});

/* ── Tab switching ───────────────────────────────────── */
function switchTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + tab));
  if (tab === 'dashboard') loadDashboard();
}

/* ── Image loading ───────────────────────────────────── */
function loadImage(input) {
  const file = input.files[0];
  if (!file) return;
  setFile(file);
  input.value = '';
}

function setFile(file) {
  state.file = file;
  state.imageSrc = URL.createObjectURL(file);

  const placeholder = document.getElementById('drop-placeholder');
  const preview = document.getElementById('preview');
  placeholder.classList.add('hidden');
  preview.src = state.imageSrc;
  preview.classList.remove('hidden');

  document.getElementById('btn-classify').disabled = false;

  // Reset result
  document.getElementById('result-empty').classList.remove('hidden');
  document.getElementById('result-content').classList.add('hidden');
}

/* ── Classify ────────────────────────────────────────── */
async function classifyImage() {
  if (!state.file) return;

  const btn = document.getElementById('btn-classify');
  const btnText = document.getElementById('classify-text');
  const spinner = document.getElementById('classify-spinner');

  btn.disabled = true;
  btnText.textContent = 'Classifying…';
  spinner.classList.remove('hidden');

  try {
    const formData = new FormData();
    formData.append('file', state.file);

    const res = await fetch('/classify', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || 'Classification failed');

    renderResult(data);
    addHistory(data);

  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Classify Again';
    spinner.classList.add('hidden');
  }
}

/* ── Render result ───────────────────────────────────── */
function renderResult(data) {
  const { classification: cls, confidence } = data;

  document.getElementById('result-empty').classList.add('hidden');
  document.getElementById('result-content').classList.remove('hidden');

  const clsEl = document.getElementById('result-class');
  clsEl.textContent = cls.charAt(0).toUpperCase() + cls.slice(1);
  clsEl.className = 'result-class ' + cls;

  ['fresh', 'damaged', 'rotten'].forEach(c => {
    const pct = Math.round(confidence[c] || 0);
    document.getElementById('bar-' + c).style.width = pct + '%';
    document.getElementById('pct-' + c).textContent = pct + '%';
  });

  document.getElementById('result-time').textContent = new Date().toLocaleTimeString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/* ── History ─────────────────────────────────────────── */
function addHistory(data) {
  const { classification: cls, confidence } = data;
  const conf = Math.round(confidence[cls] || 0);
  state.history.unshift({ cls, conf, src: state.imageSrc });
  if (state.history.length > 5) state.history.pop();
  renderHistory();
}

function renderHistory() {
  const wrap = document.getElementById('history-wrap');
  if (state.history.length === 0) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = `
    <div class="history-title">Recent</div>
    <div class="history-list">
      ${state.history.map(h => `
        <div class="history-item">
          <img class="history-thumb" src="${h.src}" alt="">
          <span class="history-cls ${h.cls}">${h.cls.charAt(0).toUpperCase() + h.cls.slice(1)}</span>
          <span class="history-conf">${h.conf}% confidence</span>
        </div>
      `).join('')}
    </div>
  `;
}

/* ── Dashboard ───────────────────────────────────────── */
async function loadDashboard() {
  try {
    const [stats, breakdown, timeline, recent] = await Promise.all([
      fetch('/dashboard/stats').then(r => r.json()),
      fetch('/dashboard/breakdown').then(r => r.json()),
      fetch('/dashboard/timeline').then(r => r.json()),
      fetch('/dashboard/recent').then(r => r.json())
    ]);

    renderStats(stats);
    renderPieChart(breakdown);
    renderLineChart(timeline);
    renderRecent(recent);
  } catch (err) {
    console.error('Dashboard load failed:', err);
  }
}

function renderStats(stats) {
  document.getElementById('dash-total').textContent = stats.totalScans || 0;

  const cls = stats.mostCommon;
  document.getElementById('dash-common').textContent =
    cls && cls !== '—' ? cls.charAt(0).toUpperCase() + cls.slice(1) : '—';

  if (stats.lastScanAt) {
    document.getElementById('dash-last').textContent =
      new Date(stats.lastScanAt).toLocaleString('en-MY', {
        timeZone: 'Asia/Kuala_Lumpur',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
  }
}

function renderPieChart(data) {
  const total = (data.fresh || 0) + (data.damaged || 0) + (data.rotten || 0);
  const empty = document.getElementById('pie-empty');
  const canvas = document.getElementById('chart-pie');

  if (total === 0) {
    empty.classList.remove('hidden');
    canvas.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  canvas.classList.remove('hidden');

  if (state.pieChart) state.pieChart.destroy();
  state.pieChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Fresh', 'Damaged', 'Rotten'],
      datasets: [{
        data: [data.fresh || 0, data.damaged || 0, data.rotten || 0],
        backgroundColor: ['#1a9e6e', '#c47a15', '#b93333'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
      }
    }
  });
}

function renderLineChart(data) {
  const canvas = document.getElementById('chart-line');
  const empty = document.getElementById('line-empty');

  if (!data.labels || data.labels.length === 0) {
    empty.classList.remove('hidden');
    canvas.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  canvas.classList.remove('hidden');

  const labels = data.labels.map(d => {
    const date = new Date(d);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  });

  if (state.lineChart) state.lineChart.destroy();
  state.lineChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Classifications',
        data: data.counts,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79,70,229,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

function renderRecent(recent) {
  const container = document.getElementById('recent-list');
  if (!recent || recent.length === 0) {
    container.innerHTML = '<div class="empty-state">No classifications yet</div>';
    return;
  }

  container.innerHTML = recent.map(item => {
    const cls = item.classification;
    const conf = Math.round(item.confidence?.[cls] || 0);
    const time = new Date(item.createdAt).toLocaleString('en-MY', {
        timeZone: 'Asia/Kuala_Lumpur',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    return `
      <div class="recent-item">
        <img class="recent-thumb"
             src="data:${item.mimetype};base64,${item.imageData}"
             alt="${cls}">
        <span class="recent-cls ${cls}">${cls.charAt(0).toUpperCase() + cls.slice(1)}</span>
        <span class="recent-conf">${conf}% confidence</span>
        <span class="recent-time">${time}</span>
      </div>
    `;
  }).join('');
}

/* ── Camera ──────────────────────────────────────────── */
let cameraStream = null;
let facingMode = 'environment';

async function openCamera() {
  const modal = document.getElementById('camera-modal');
  const video = document.getElementById('camera-video');

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = cameraStream;
    modal.classList.add('open');
  } catch (err) {
    if (err.name === 'NotAllowedError') alert('Camera permission denied.');
    else if (err.name === 'NotFoundError') alert('No camera found on this device.');
    else alert('Camera error: ' + err.message);
  }
}

function closeCamera() {
  const modal = document.getElementById('camera-modal');
  const video = document.getElementById('camera-video');
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  video.srcObject = null;
  modal.classList.remove('open');
}

async function flipCamera() {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
  const video = document.getElementById('camera-video');
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode },
      audio: false
    });
    video.srcObject = cameraStream;
  } catch (err) {
    alert('Could not switch camera: ' + err.message);
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
  }
}

function capturePhoto() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob(blob => {
    const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
    setFile(file);
    closeCamera();
  }, 'image/jpeg', 0.92);
}
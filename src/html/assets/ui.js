/* ========== UI & Interaction Utilities ========== */

const UI = (() => {
  // --- Toast Notification System ---
  function initToast() {
    if (!document.querySelector('.toast-container')) {
      const tc = document.createElement('div');
      tc.className = 'toast-container';
      document.body.appendChild(tc);
    }
  }

  function showToast(msg, type = 'info', duration = 3000) {
    const container = document.querySelector('.toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(40px)';
      t.style.transition = '0.3s ease-in';
      setTimeout(() => t.remove(), 300);
    }, duration);
  }

  // --- Drag and Drop Setup ---
  function setupDragDrop(zoneId, inputId, onFileCallback) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    if (!zone || !input) return;

    // Click to upload
    zone.addEventListener('click', (e) => {
      if(e.target !== input) input.click();
    });

    // File input change
    input.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        onFileCallback(e.target.files[0]);
      }
    });

    // Drag events
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        input.files = e.dataTransfer.files; // Sync the underlying input
        onFileCallback(e.dataTransfer.files[0]);
      }
    });
  }

  // --- File Size Formatter ---
  function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    // Clamp the unit index: a size past 1 TB used to print "1234 undefined" (i past the array),
    // and a negative size gave NaN. Use the magnitude so the largest named unit is TB.
    const raw = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    const i = Math.min(Math.max(raw, 0), sizes.length - 1);
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToast);
  } else {
    initToast();
  }

  return { showToast, setupDragDrop, formatBytes };
})();

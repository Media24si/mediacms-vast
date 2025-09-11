/**
 * MediaCMS Embed Empty Player
 * Lightweight embed player for ad-friendly integration
 */

(function() {
  'use strict';

  // Configuration from page data attributes
  function getPageConfig() {
    const container = document.getElementById('page-embed-empty');
    if (!container) return null;

    return {
      media: container.dataset.media,
      autoplay: container.dataset.autoplay === '1',
      muted: container.dataset.muted === '1',
      loop: container.dataset.loop === '1',
      poster: container.dataset.poster === '1',
      start: parseInt(container.dataset.start || '0', 10),
      ratio: container.dataset.ratio || '',
      preset: container.dataset.preset || 'empty'
    };
  }

  // PostMessage API for parent communication
  function sendMessage(type, data = {}) {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: type,
        source: 'mediacms-embed-empty',
        timestamp: Date.now(),
        ...data
      }, '*');
    }
  }

  // Simple video player for empty preset
  function createEmptyVideoPlayer(videoElement, sources, config) {
    let isMuted = config.muted;
    let showMuteControl = false;
    let tapTimer = null;

    // Set video attributes
    videoElement.muted = isMuted;
    videoElement.autoplay = config.autoplay;
    videoElement.playsInline = true;
    videoElement.controls = false;
    videoElement.preload = 'metadata';
    videoElement.loop = config.loop;

    // Add sources
    sources.forEach(source => {
      const sourceEl = document.createElement('source');
      sourceEl.src = source.src;
      if (source.type) {
        sourceEl.type = source.type;
      }
      videoElement.appendChild(sourceEl);
    });

    // Create mute control
    const muteButton = document.createElement('button');
    muteButton.className = 'vjs-mute-control';
    muteButton.setAttribute('aria-label', isMuted ? 'Unmute' : 'Mute');
    muteButton.setAttribute('aria-pressed', isMuted.toString());
    
    const muteIcon = document.createElement('i');
    muteIcon.className = 'material-icons';
    muteIcon.textContent = isMuted ? 'volume_off' : 'volume_up';
    muteButton.appendChild(muteIcon);

    // Add mute control to container
    const container = videoElement.parentElement;
    container.appendChild(muteButton);

    // Mute toggle handler
    function toggleMute() {
      isMuted = !videoElement.muted;
      videoElement.muted = isMuted;
      muteIcon.textContent = isMuted ? 'volume_off' : 'volume_up';
      muteButton.setAttribute('aria-label', isMuted ? 'Unmute' : 'Mute');
      muteButton.setAttribute('aria-pressed', isMuted.toString());
      
      sendMessage('mutechange', { muted: isMuted });
    }

    muteButton.addEventListener('click', toggleMute);

    // Show/hide mute control
    function showMute() {
      showMuteControl = true;
      container.classList.add('vjs-show-mute');
    }

    function hideMute() {
      showMuteControl = false;
      container.classList.remove('vjs-show-mute');
    }

    // Desktop hover events
    container.addEventListener('mouseenter', showMute);
    container.addEventListener('mouseleave', hideMute);

    // Mobile tap events
    container.addEventListener('touchstart', function(e) {
      e.stopPropagation();
      showMute();
      container.classList.add('vjs-tap-show');
      
      if (tapTimer) clearTimeout(tapTimer);
      
      tapTimer = setTimeout(function() {
        hideMute();
        container.classList.remove('vjs-tap-show');
        tapTimer = null;
      }, 3000);
    });

    // Video event handlers
    videoElement.addEventListener('loadedmetadata', function() {
      if (config.start > 0 && config.start < videoElement.duration) {
        videoElement.currentTime = config.start;
      }
      sendMessage('ready');
    });

    videoElement.addEventListener('play', function() {
      sendMessage('play');
    });

    videoElement.addEventListener('pause', function() {
      sendMessage('pause');
    });

    videoElement.addEventListener('ended', function() {
      sendMessage('ended');
    });

    videoElement.addEventListener('error', function() {
      sendMessage('error', {
        error: videoElement.error?.message || 'Video playback error'
      });
    });

    // Try autoplay
    if (config.autoplay) {
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(function(error) {
          console.warn('Autoplay was prevented:', error);
          // Autoplay failed, video remains paused but ready
        });
      }
    }

    return {
      mute: function() { 
        if (!isMuted) toggleMute(); 
      },
      unmute: function() { 
        if (isMuted) toggleMute(); 
      },
      play: function() { 
        return videoElement.play(); 
      },
      pause: function() { 
        videoElement.pause(); 
      },
      destroy: function() {
        if (tapTimer) clearTimeout(tapTimer);
        muteButton.remove();
      }
    };
  }

  // Load media data and initialize player
  function loadMediaData() {
    const config = getPageConfig();
    if (!config) return;

    // Mock implementation - in real app this would fetch from API
    // For now, we'll use a simple video element approach
    const container = document.getElementById('page-embed-empty');
    
    // Create video element
    const video = document.createElement('video');
    video.className = 'video-js vjs-mediacms native-dimensions vjs-embed-empty';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';

    // Add error handling
    video.addEventListener('error', function() {
      container.innerHTML = `
        <div class="player-container player-container-error" style="width: 100%; height: 100%;">
          <div class="player-container-inner" style="width: 100%; height: 100%;">
            <div class="error-container">
              <div class="error-container-inner">
                <span class="icon-wrap">
                  <i class="material-icons">error_outline</i>
                </span>
                <span class="msg-wrap">Video could not be loaded</span>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    // For demonstration, add a sample video source
    // In production, this would come from the media API
    const sources = [
      { 
        src: '/media/' + config.media + '/video.mp4', 
        type: 'video/mp4' 
      }
    ];

    container.appendChild(video);
    
    // Initialize empty player
    const player = createEmptyVideoPlayer(video, sources, config);
    
    // Store player reference globally
    window.MediaCMSEmptyPlayer = player;
    
    // Send initial ready message
    sendMessage('ready', {
      config: config
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadMediaData);
  } else {
    loadMediaData();
  }

  // Listen for parent messages (optional)
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type && window.MediaCMSEmptyPlayer) {
      const player = window.MediaCMSEmptyPlayer;
      
      switch (event.data.type) {
        case 'play':
          player.play();
          break;
        case 'pause':
          player.pause();
          break;
        case 'mute':
          player.mute();
          break;
        case 'unmute':
          player.unmute();
          break;
      }
    }
  });

})();
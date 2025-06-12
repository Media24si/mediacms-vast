/**
 * VAST Pro Plugin for Video.js
 * Based on Nuevo VAST Pro plugin (https://www.nuevodevel.com/nuevo/showcase/vast-pro)
 */
(function(window, videojs) {
  'use strict';

  // Cross-compatibility for Video.js 5 and 6.
  const registerPlugin = videojs.registerPlugin || videojs.plugin;

  /**
   * VAST Pro plugin for Video.js
   *
   * @function vastPro
   * @param {Object} options - Plugin options object
   */
  const vastPro = function(options) {
    const player = this;
    const defaults = {
      vastUrl: null,
      skipButton: true,
      skipButtonText: 'Skip Ad',
      skipTime: 5,
      adText: 'Advertisement',
      adCountdown: true,
      maxAdsPerBreak: 1,
      timeout: 5000
    };

    // Merge default options with the ones provided
    options = videojs.mergeOptions(defaults, options);

    // Store the VAST URL
    let vastUrl = options.vastUrl;

    // Variables for tracking ad state
    let adPlaying = false;
    let adContainer = null;
    let skipButton = null;
    let adTextDisplay = null;
    let countdownDisplay = null;
    let adSkippableTime = options.skipTime;
    let adCountdownInterval = null;
    let adDuration = 0;
    let vastXml = null;
    let vastMediaFile = null;
    let vastClickthrough = null;
    let vastImpressions = [];
    let vastTrackingEvents = {};

    /**
     * Initialize the plugin
     */
    function init() {
      // Create ad container
      createAdContainer();

      // Listen for player events
      player.on('play', checkForAds);
      player.on('ended', onContentEnded);
      player.on('dispose', cleanupPlugin);
    }

    /**
     * Create the ad container and UI elements
     */
    function createAdContainer() {
      // Create ad container
      adContainer = document.createElement('div');
      adContainer.className = 'vjs-vast-pro-ad-container';
      adContainer.style.display = 'none';
      adContainer.style.position = 'absolute';
      adContainer.style.top = '0';
      adContainer.style.left = '0';
      adContainer.style.width = '100%';
      adContainer.style.height = '100%';
      adContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      adContainer.style.zIndex = '2';

      // Create skip button if enabled
      if (options.skipButton) {
        skipButton = document.createElement('div');
        skipButton.className = 'vjs-vast-pro-skip-button';
        skipButton.style.position = 'absolute';
        skipButton.style.bottom = '60px';
        skipButton.style.right = '10px';
        skipButton.style.padding = '10px';
        skipButton.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        skipButton.style.color = 'white';
        skipButton.style.cursor = 'pointer';
        skipButton.style.display = 'none';
        skipButton.style.borderRadius = '3px';
        skipButton.style.fontFamily = 'Arial, sans-serif';
        skipButton.style.fontSize = '14px';
        skipButton.innerHTML = `Wait ${adSkippableTime}s to skip`;

        skipButton.addEventListener('click', onSkipButtonClick);
        adContainer.appendChild(skipButton);
      }

      // Create ad text display
      adTextDisplay = document.createElement('div');
      adTextDisplay.className = 'vjs-vast-pro-ad-text';
      adTextDisplay.style.position = 'absolute';
      adTextDisplay.style.top = '10px';
      adTextDisplay.style.left = '10px';
      adTextDisplay.style.padding = '5px 10px';
      adTextDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      adTextDisplay.style.color = 'white';
      adTextDisplay.style.borderRadius = '3px';
      adTextDisplay.style.fontFamily = 'Arial, sans-serif';
      adTextDisplay.style.fontSize = '14px';
      adTextDisplay.innerHTML = options.adText;
      adContainer.appendChild(adTextDisplay);

      // Create countdown display if enabled
      if (options.adCountdown) {
        countdownDisplay = document.createElement('div');
        countdownDisplay.className = 'vjs-vast-pro-countdown';
        countdownDisplay.style.position = 'absolute';
        countdownDisplay.style.top = '10px';
        countdownDisplay.style.right = '10px';
        countdownDisplay.style.padding = '5px 10px';
        countdownDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        countdownDisplay.style.color = 'white';
        countdownDisplay.style.borderRadius = '3px';
        countdownDisplay.style.fontFamily = 'Arial, sans-serif';
        countdownDisplay.style.fontSize = '14px';
        adContainer.appendChild(countdownDisplay);
      }

      // Add click handling for the ad
      adContainer.addEventListener('click', onAdClick);

      // Add ad container to player
      player.el().appendChild(adContainer);
    }

    /**
     * Check if we need to play ads
     */
    function checkForAds() {
      // Only play ads if we have a VAST URL and we're not already playing an ad
      if (vastUrl && !adPlaying) {
        loadVastUrl(vastUrl);
      }
    }

    /**
     * Load and parse the VAST XML from the provided URL
     */
    function loadVastUrl(url) {
      // Create a new XMLHttpRequest
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = options.timeout;

      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 400) {
          try {
            const parser = new DOMParser();
            vastXml = parser.parseFromString(xhr.responseText, 'text/xml');
            parseVastXml();
          } catch (e) {
            console.error('Error parsing VAST XML:', e);
            resumeContent();
          }
        } else {
          console.error('Error loading VAST XML:', xhr.status);
          resumeContent();
        }
      };

      xhr.onerror = function() {
        console.error('Error loading VAST XML');
        resumeContent();
      };

      xhr.ontimeout = function() {
        console.error('VAST XML request timeout');
        resumeContent();
      };

      xhr.send();
    }

    /**
     * Parse the VAST XML to extract ad information
     */
    function parseVastXml() {
      if (!vastXml) {
        resumeContent();
        return;
      }

      // Extract media file URL
      const mediaFiles = vastXml.querySelectorAll('MediaFile');
      if (!mediaFiles.length) {
        console.error('No media files found in VAST XML');
        resumeContent();
        return;
      }

      // Find a compatible media file (preferably MP4)
      for (let i = 0; i < mediaFiles.length; i++) {
        const mediaFile = mediaFiles[i];
        const type = mediaFile.getAttribute('type');
        if (type && (type.indexOf('mp4') !== -1 || type.indexOf('video/mp4') !== -1)) {
          vastMediaFile = mediaFile.textContent.trim();
          break;
        }
      }

      if (!vastMediaFile) {
        // If no MP4 found, use the first media file
        vastMediaFile = mediaFiles[0].textContent.trim();
      }

      // Extract clickthrough URL
      const clickthrough = vastXml.querySelector('ClickThrough');
      if (clickthrough) {
        vastClickthrough = clickthrough.textContent.trim();
      }

      // Extract impression URLs
      const impressions = vastXml.querySelectorAll('Impression');
      vastImpressions = [];
      for (let i = 0; i < impressions.length; i++) {
        vastImpressions.push(impressions[i].textContent.trim());
      }

      // Extract tracking events
      const trackingEvents = vastXml.querySelectorAll('Tracking');
      vastTrackingEvents = {};

      for (let i = 0; i < trackingEvents.length; i++) {
        const event = trackingEvents[i];
        const eventName = event.getAttribute('event');
        const eventUrl = event.textContent.trim();

        if (eventName && eventUrl) {
          if (!vastTrackingEvents[eventName]) {
            vastTrackingEvents[eventName] = [];
          }
          vastTrackingEvents[eventName].push(eventUrl);
        }
      }

      // Start playing the ad
      playAd();
    }

    /**
     * Play the VAST ad
     */
    function playAd() {
      if (!vastMediaFile) {
        resumeContent();
        return;
      }

      // Save current content state
      const contentSrc = player.currentSrc();
      const contentTime = player.currentTime();

      // Set ad playing flag
      adPlaying = true;

      // Show ad container
      adContainer.style.display = 'block';

      // Set ad source and play
      player.src(vastMediaFile);
      player.play();

      // Track impressions
      trackImpressions();

      // Track ad start
      trackEvent('start');

      // Set up ad event listeners
      player.one('ended', function() {
        trackEvent('complete');
        endAd();
        player.src(contentSrc);
        player.currentTime(contentTime);
        player.play();
      });

      player.one('loadedmetadata', function() {
        adDuration = player.duration();
        updateCountdown();

        if (options.skipButton) {
          startSkipCountdown();
        }
      });

      player.on('timeupdate', onAdTimeUpdate);
    }

    /**
     * Handle ad timeupdate event
     */
    function onAdTimeUpdate() {
      if (adPlaying) {
        const currentTime = player.currentTime();
        const timeRemaining = Math.max(0, Math.floor(adDuration - currentTime));

        // Track quartile events
        const percentComplete = currentTime / adDuration;
        if (percentComplete >= 0.25 && percentComplete < 0.5) {
          trackEvent('firstQuartile');
        } else if (percentComplete >= 0.5 && percentComplete < 0.75) {
          trackEvent('midpoint');
        } else if (percentComplete >= 0.75 && percentComplete < 1) {
          trackEvent('thirdQuartile');
        }

        // Update countdown
        if (options.adCountdown && countdownDisplay) {
          countdownDisplay.innerHTML = `Ad: ${timeRemaining}s`;
        }
      }
    }

    /**
     * Start the skip button countdown
     */
    function startSkipCountdown() {
      if (!skipButton) return;

      skipButton.style.display = 'block';

      let countdown = adSkippableTime;
      skipButton.innerHTML = `Wait ${countdown}s to skip`;

      adCountdownInterval = setInterval(function() {
        countdown--;
        if (countdown <= 0) {
          clearInterval(adCountdownInterval);
          skipButton.innerHTML = options.skipButtonText;
          skipButton.classList.add('enabled');
        } else {
          skipButton.innerHTML = `Wait ${countdown}s to skip`;
        }
      }, 1000);
    }

    /**
     * Update the ad countdown display
     */
    function updateCountdown() {
      if (options.adCountdown && countdownDisplay && adDuration) {
        countdownDisplay.innerHTML = `Ad: ${Math.floor(adDuration)}s`;
      }
    }

    /**
     * Track VAST impression URLs
     */
    function trackImpressions() {
      vastImpressions.forEach(function(url) {
        firePixel(url);
      });
    }

    /**
     * Track VAST events
     */
    function trackEvent(eventName) {
      if (vastTrackingEvents[eventName]) {
        vastTrackingEvents[eventName].forEach(function(url) {
          firePixel(url);
        });
      }
    }

    /**
     * Fire a tracking pixel
     */
    function firePixel(url) {
      if (!url) return;

      const img = new Image();
      img.src = url;
    }

    /**
     * Handle skip button click
     */
    function onSkipButtonClick() {
      if (adPlaying && skipButton.classList.contains('enabled')) {
        trackEvent('skip');
        endAd();
        player.play();
      }
    }

    /**
     * Handle ad click
     */
    function onAdClick() {
      if (adPlaying && vastClickthrough) {
        trackEvent('click');
        window.open(vastClickthrough, '_blank');
        player.pause();
      }
    }

    /**
     * End the ad and clean up
     */
    function endAd() {
      adPlaying = false;
      adContainer.style.display = 'none';

      if (adCountdownInterval) {
        clearInterval(adCountdownInterval);
        adCountdownInterval = null;
      }

      if (skipButton) {
        skipButton.style.display = 'none';
        skipButton.classList.remove('enabled');
      }

      player.off('timeupdate', onAdTimeUpdate);
    }

    /**
     * Resume content playback
     */
    function resumeContent() {
      endAd();
    }

    /**
     * Handle content ended event
     */
    function onContentEnded() {
      // Reset for next play
      adPlaying = false;
    }

    /**
     * Clean up the plugin when player is disposed
     */
    function cleanupPlugin() {
      if (adCountdownInterval) {
        clearInterval(adCountdownInterval);
      }

      player.off('play', checkForAds);
      player.off('ended', onContentEnded);
      player.off('timeupdate', onAdTimeUpdate);

      if (adContainer && adContainer.parentNode) {
        adContainer.parentNode.removeChild(adContainer);
      }
    }

    /**
     * Update the VAST URL
     */
    function updateVastUrl(url) {
      vastUrl = url;
    }

    // Initialize the plugin
    init();

    // Expose public methods
    this.vastPro = {
      updateVastUrl: updateVastUrl
    };
  };

  // Register the plugin with video.js
  registerPlugin('vastPro', vastPro);

})(window, videojs);
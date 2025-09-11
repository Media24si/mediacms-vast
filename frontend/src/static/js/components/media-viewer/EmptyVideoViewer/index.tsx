import React, { useRef, useEffect, useState, CSSProperties } from 'react';
import { SiteConsumer } from '../../../utils/contexts/';
import { MediaPageStore, VideoViewerStore } from '../../../utils/stores/';
import { formatInnerLink, addClassname, removeClassname } from '../../../utils/helpers/';
import { BrowserCache } from '../../../utils/classes/';
import {
  orderedSupportedVideoFormats,
  videoAvailableCodecsAndResolutions,
  extractDefaultVideoResolution,
} from '../VideoViewer/functions';

// Simplified video player for empty embed
// import { createEmptyPlayer } from '../../video-player/EmptyVideoPlayer';

interface EmptyVideoViewerProps {
  data: any;
  siteUrl: string;
  containerStyles?: CSSProperties;
  preset: string;
}

// Type definitions for video info structure
interface VideoInfo {
  [key: string]: {
    format: string[];
    url: string[];
  };
  Auto?: {
    format: string[];
    url: string[];
  };
}

interface SupportedFormats {
  order: string[];
  support: {
    [key: string]: boolean;
  };
}

const EmptyVideoViewer: React.FC<EmptyVideoViewerProps> = ({ data, siteUrl, containerStyles, preset }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayPlayer, setDisplayPlayer] = useState(false);
  const [playerInstance, setPlayerInstance] = useState<any>(null);
  const [showMuteControl, setShowMuteControl] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [tapTimer, setTapTimer] = useState<NodeJS.Timeout | null>(null);

  // Process video sources
  const videoSources: Array<{src: string; type?: string}> = [];
  let videoPoster = '';

  // Set poster image
  if (typeof data.poster_url === 'string') {
    videoPoster = formatInnerLink(data.poster_url, siteUrl);
  } else if (typeof data.thumbnail_url === 'string') {
    videoPoster = formatInnerLink(data.thumbnail_url, siteUrl);
  }

  // Process video sources with proper type guards
  const videoInfo: VideoInfo = videoAvailableCodecsAndResolutions(data.encodings_info, data.hls_info) || {};
  if (Object.keys(videoInfo).length > 0) {
    let quality: any = VideoViewerStore.get('video-quality');
    if (quality === null || (quality === 'Auto' && !videoInfo.Auto)) {
      quality = 720;
    }

    const defaultResolution = extractDefaultVideoResolution(quality, videoInfo);

    // Add HLS source if available
    if (quality === 'Auto' && videoInfo.Auto) {
      videoSources.push({ src: videoInfo.Auto.url[0] });
    }

    const supportedFormats: SupportedFormats = orderedSupportedVideoFormats() || { order: [], support: {} };

    // Add progressive sources - check if resolution exists in videoInfo
    const resolutionData = videoInfo[defaultResolution];
    if (resolutionData && resolutionData.format && resolutionData.url) {
      for (let i = 0; i < resolutionData.format.length; i++) {
        if (resolutionData.format[i] === 'hls') {
          videoSources.push({ src: resolutionData.url[i] });
          break;
        }
      }
    }

    // Add other formats - with proper type checking
    if (data.encodings_info && data.encodings_info[defaultResolution]) {
      const encodingData = data.encodings_info[defaultResolution];
      for (const format in encodingData) {
        if (encodingData.hasOwnProperty(format) && supportedFormats.support[format as keyof typeof supportedFormats.support]) {
          const formatData = encodingData[format];
          if (formatData && formatData.url) {
            videoSources.push({
              src: formatInnerLink(formatData.url, siteUrl),
              type: getVideoMimeType(format)
            });
          }
        }
      }
    }
  }

  // Helper function to get MIME type for video format
  function getVideoMimeType(format: string): string | undefined {
    const mimeTypes: { [key: string]: string } = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'ogg': 'video/ogg',
      'h264': 'video/mp4',
      'h265': 'video/mp4',
      'vp9': 'video/webm',
      'vp8': 'video/webm',
    };
    return mimeTypes[format];
  }

  // Handle hover events for desktop
  const handleMouseEnter = () => {
    setShowMuteControl(true);
  };

  const handleMouseLeave = () => {
    setShowMuteControl(false);
  };

  // Handle tap events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setShowMuteControl(true);

    // Clear existing timer
    if (tapTimer) {
      clearTimeout(tapTimer);
    }

    // Hide after 3 seconds
    const timer = setTimeout(() => {
      setShowMuteControl(false);
      setTapTimer(null);
    }, 3000);

    setTapTimer(timer);
  };

  // Handle mute toggle
  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const newMutedState = !videoRef.current.muted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);

      // Send PostMessage event
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'mutechange',
          source: 'mediacms-embed-empty',
          muted: newMutedState
        }, '*');
      }
    }
  };

  // Initialize video player
  useEffect(() => {
    if (videoSources.length === 0) {
      MediaPageStore.set('media-load-error-type', 'noSources');
      MediaPageStore.set('media-load-error-message', 'No video sources available');
      return;
    }

    if (videoRef.current) {
      const video = videoRef.current;

      // Set video attributes for empty preset
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.controls = false;
      video.preload = 'metadata';

      // Set poster
      if (videoPoster) {
        video.poster = videoPoster;
      }

      // Add video sources
      videoSources.forEach((source, index) => {
        const sourceEl = document.createElement('source');
        sourceEl.src = source.src;
        if (source.type) {
          sourceEl.type = source.type;
        }
        video.appendChild(sourceEl);
      });

      // Handle video events
      video.addEventListener('loadedmetadata', () => {
        // Send ready event
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'ready',
            source: 'mediacms-embed-empty'
          }, '*');
        }
      });

      video.addEventListener('play', () => {
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'play',
            source: 'mediacms-embed-empty'
          }, '*');
        }
      });

      video.addEventListener('pause', () => {
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'pause',
            source: 'mediacms-embed-empty'
          }, '*');
        }
      });

      video.addEventListener('ended', () => {
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'ended',
            source: 'mediacms-embed-empty'
          }, '*');
        }
      });

      video.addEventListener('error', () => {
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'error',
            source: 'mediacms-embed-empty',
            error: video.error?.message || 'Video playback error'
          }, '*');
        }
      });

      // Try to autoplay
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn('Autoplay was prevented:', error);
          // Autoplay failed, video will remain paused
        });
      }

      setDisplayPlayer(true);
    }

    return () => {
      if (tapTimer) {
        clearTimeout(tapTimer);
      }
    };
  }, []);

  if (MediaPageStore.get('media-load-error-type')) {
    return (
      <div className="player-container player-container-error" style={containerStyles}>
        <div className="player-container-inner" style={containerStyles}>
          <div className="error-container">
            <div className="error-container-inner">
              <span className="icon-wrap">
                <i className="material-icons">error_outline</i>
              </span>
              <span className="msg-wrap">{MediaPageStore.get('media-load-error-message')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="player-container vjs-embed-empty"
      style={containerStyles}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
    >
      <div className="player-container-inner" style={containerStyles}>
        {displayPlayer && (
          <div className="video-player">
            <video
              ref={videoRef}
              className="video-js vjs-mediacms native-dimensions"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />

            {/* Hover-only mute control */}
            <button
              className={`vjs-mute-control ${showMuteControl ? 'visible' : ''}`}
              onClick={handleMuteToggle}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              aria-pressed={isMuted}
            >
              <i className="material-icons">
                {isMuted ? 'volume_off' : 'volume_up'}
              </i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmptyVideoViewer;
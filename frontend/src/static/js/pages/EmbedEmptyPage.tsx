import React, { useState, useEffect, CSSProperties } from 'react';
import { SiteConsumer } from '../utils/contexts/';
import { MediaPageStore } from '../utils/stores/';
import { MediaPageActions } from '../utils/actions/';
import EmptyVideoViewer from '../components/media-viewer/EmptyVideoViewer';

const wrapperStyles = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'block',
  background: '#000',
} as CSSProperties;

const containerStyles = {
  width: '100%',
  height: '100%',
} as CSSProperties;

export const EmbedEmptyPage: React.FC = () => {
  const [loadedVideo, setLoadedVideo] = useState(false);
  const [failedMediaLoad, setFailedMediaLoad] = useState(false);

  const onLoadedVideoData = () => {
    setLoadedVideo(true);
  };

  const onMediaLoadError = () => {
    setFailedMediaLoad(true);
  };

  useEffect(() => {
    MediaPageStore.on('loaded_video_data', onLoadedVideoData);
    MediaPageStore.on('loaded_media_error', onMediaLoadError);
    MediaPageActions.loadMediaData();
    
    // Send PostMessage ready event
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'ready', source: 'mediacms-embed-empty' }, '*');
    }

    return () => {
      MediaPageStore.removeListener('loaded_video_data', onLoadedVideoData);
      MediaPageStore.removeListener('loaded_media_error', onMediaLoadError);
    };
  }, []);

  return (
    <div className="embed-empty-wrap" style={wrapperStyles}>
      {failedMediaLoad && (
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
      )}
      {loadedVideo && (
        <SiteConsumer>
          {(site) => (
            <EmptyVideoViewer 
              data={MediaPageStore.get('media-data')} 
              siteUrl={site.url} 
              containerStyles={containerStyles}
              preset="empty"
            />
          )}
        </SiteConsumer>
      )}
    </div>
  );
};
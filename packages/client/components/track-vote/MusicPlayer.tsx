import React from 'react';
import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import YoutubePlayer, { YoutubeIframeRef } from 'react-native-youtube-iframe';

export type MusicPlayerRef = YoutubeIframeRef | null;

type MusicPlayerProps = {
    videoId: string;
    videoState: 'playing' | 'stopped';
    playerHeight: number;
    setPlayerRef: (playerRef: MusicPlayerRef) => void;
    onTrackReady: () => void;
};

function noop() {
    return undefined;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({
    videoId,
    videoState,
    playerHeight,
    setPlayerRef,
    onTrackReady,
}) => {
    const ref = useRef();
    const playerRef = setPlayerRef as unknown as any;

    return (
        <Pressable onPress={noop} onLongPress={noop}>
            <View pointerEvents="none">
                <YoutubePlayer
                    ref={playerRef}
                    height={playerHeight}
                    play={videoState === 'playing'}
                    videoId={videoId}
                    //FIX for android see https://stackoverflow.com/questions/63171131/when-rendering-iframes-with-html-android-crashes-while-navigating-back-to-s
                    webViewStyle={{ opacity: 0.99 }}
                    onReady={onTrackReady}
                />
            </View>
        </Pressable>
    );
};

export default MusicPlayer;

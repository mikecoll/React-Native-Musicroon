import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useBackHandler } from '@react-native-community/hooks';
import { useMachine } from '@xstate/react';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useSx, View } from 'dripsy';
import React, { useMemo, useRef } from 'react';
import { TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { assign, createMachine, Sender } from 'xstate';
import { AppScreen, AppScreenContainer, Typo } from '../components/kit';
import AppModalHeader from '../components/kit/AppModalHeader';
import MusicPlayer, {
    MusicPlayerRef,
} from '../components/track-vote/MusicPlayer';
import { useMusicPlayer } from '../contexts/MusicPlayerContext';
import { useLayout } from '../hooks/useLayout';
import {
    AppMusicPlayerMachineEvent,
    AppMusicPlayerMachineState,
} from '../machines/appMusicPlayerMachine';

function useFormatSeconds(seconds: number): string {
    const truncatedSecondsToMilliseconds = Math.trunc(seconds) * 1000;
    const formattedTime = useMemo(() => {
        return format(truncatedSecondsToMilliseconds, 'mm:ss', {
            locale: enUS,
        });
    }, [truncatedSecondsToMilliseconds]);

    return formattedTime;
}

type MusicPlayerWithControlsProps = {
    videoId: string;
    trackTitle: string;
    trackArtist: string;
    isPlaying: boolean;
    onPlayingToggle: () => void;
    onNextTrackPress: () => void;
    playerRef: React.MutableRefObject<MusicPlayerRef>;
    totalDuration: number;
    elapsedTime: number;
};

type MusicPlayerControlButtonProps = {
    iconName: React.ComponentProps<typeof Ionicons>['name'];
    variant?: 'prominent' | 'normal';
    adjustIconHorizontally?: 2 | 1;
    onPress: () => void;
};

const MusicPlayerControlButton: React.FC<MusicPlayerControlButtonProps> = ({
    iconName,
    adjustIconHorizontally,
    variant = 'normal',
    onPress,
}) => {
    const sx = useSx();

    return (
        <TouchableOpacity
            style={sx({
                width: 56,
                height: 56,
                padding: 'm',
                marginLeft: 'm',
                marginRight: 'm',
                backgroundColor:
                    variant === 'prominent' ? 'white' : 'transparent',
                borderRadius: 'full',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
            })}
            onPress={onPress}
        >
            <Ionicons
                name={iconName}
                style={sx({
                    color: variant === 'prominent' ? 'greyLight' : 'white',
                    fontSize: 'xl',
                    right:
                        adjustIconHorizontally !== undefined
                            ? -1 * adjustIconHorizontally
                            : 0,
                })}
            />
        </TouchableOpacity>
    );
};

const MusicPlayerWithControls: React.FC<MusicPlayerWithControlsProps> = ({
    videoId,
    trackTitle,
    trackArtist,
    isPlaying,
    onPlayingToggle,
    onNextTrackPress,
    playerRef,
    totalDuration,
    elapsedTime,
}) => {
    const [{ width: containerWidth }, onContainerLayout] = useLayout();
    const playerHeight = (containerWidth * 9) / 16;
    const formattedElapsedTime = useFormatSeconds(elapsedTime);
    const formattedTotalDuration = useFormatSeconds(totalDuration);

    return (
        <View sx={{ flex: 1 }} onLayout={onContainerLayout}>
            <MusicPlayer
                playerRef={playerRef}
                videoId={videoId}
                videoState={isPlaying ? 'playing' : 'stopped'}
                playerHeight={playerHeight}
            />

            <Typo sx={{ marginTop: 'l', fontSize: 'm', fontWeight: '600' }}>
                {trackTitle}
            </Typo>
            <Typo sx={{ marginTop: 's', fontSize: 's', color: 'greyLighter' }}>
                {trackArtist}
            </Typo>

            <View sx={{ marginTop: 'm' }}>
                <Slider
                    disabled
                    value={elapsedTime}
                    minimumValue={0}
                    maximumValue={totalDuration}
                    minimumTrackTintColor="white"
                />

                <View
                    sx={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                    }}
                >
                    <Typo sx={{ fontSize: 'xs', color: 'greyLighter' }}>
                        {formattedElapsedTime}
                    </Typo>

                    <Typo sx={{ fontSize: 'xs', color: 'greyLighter' }}>
                        {formattedTotalDuration}
                    </Typo>
                </View>
            </View>

            <View
                sx={{
                    marginTop: 'm',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <MusicPlayerControlButton
                    iconName={isPlaying ? 'pause' : 'play'}
                    variant="prominent"
                    adjustIconHorizontally={2}
                    onPress={onPlayingToggle}
                />

                <MusicPlayerControlButton
                    iconName="play-forward"
                    onPress={onNextTrackPress}
                />
            </View>
        </View>
    );
};

type MusicControlMachineContext = {
    duration: number;
    elapsedTime: number;
};

type MusicControlMachineEvent =
    | { type: 'LOAD_DURATION'; duration: number }
    | {
          type: 'TOGGLE';
      }
    | {
          type: 'UPDATE_ELAPSED_TIME';
          elapsedTime: number;
      };

const musicControlMachine = createMachine<
    MusicControlMachineContext,
    MusicControlMachineEvent
>(
    {
        context: {
            duration: 0,
            elapsedTime: 0,
        },

        initial: 'loading',

        states: {
            loading: {
                invoke: {
                    src: 'getDuration',
                },

                on: {
                    LOAD_DURATION: {
                        target: 'paused',
                        actions: 'setDuration',
                    },
                },
            },

            paused: {
                on: {
                    TOGGLE: {
                        target: 'playing',
                    },
                },
            },

            playing: {
                invoke: {
                    src: 'pollPlayerElapsedTime',
                },

                on: {
                    TOGGLE: 'paused',

                    UPDATE_ELAPSED_TIME: {
                        actions: 'setElapsedTime',
                    },
                },
            },
        },
    },
    {
        actions: {
            setElapsedTime: assign((context, event) => {
                if (event.type !== 'UPDATE_ELAPSED_TIME') {
                    return context;
                }

                return {
                    ...context,
                    elapsedTime: event.elapsedTime,
                };
            }),

            setDuration: assign((context, event) => {
                if (event.type !== 'LOAD_DURATION') {
                    return context;
                }

                return {
                    ...context,
                    duration: event.duration,
                };
            }),
        },
    },
);

type TheMusicPlayerFullScreenProps = {
    dismissFullScreenPlayer: () => void;
    roomName?: string;
    sendToMachine: Sender<AppMusicPlayerMachineEvent>;
    machineState: AppMusicPlayerMachineState;
};

const TheMusicPlayerFullScreen: React.FC<TheMusicPlayerFullScreenProps> = ({
    dismissFullScreenPlayer,
    roomName,
    sendToMachine,
    machineState,
}) => {
    const roomId = roomName;
    const insets = useSafeAreaInsets();
    const playerRef = useRef<MusicPlayerRef | null>(null);
    const [state, send] = useMachine(musicControlMachine, {
        services: {
            getDuration: () => (sendBack) => {
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                const timerId = setInterval(async () => {
                    const duration = await fetchMusicPlayerTotalDuration();

                    sendBack({
                        type: 'LOAD_DURATION',
                        duration,
                    });
                }, 1000);

                return () => {
                    clearInterval(timerId);
                };
            },

            pollPlayerElapsedTime: () => (sendBack) => {
                const INTERVAL = 200;
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                const timerId = setInterval(async () => {
                    const elapsedTime = await fetchMusicPlayerElapsedTime();

                    sendBack({
                        type: 'UPDATE_ELAPSED_TIME',
                        elapsedTime,
                    });
                }, INTERVAL);

                return () => {
                    clearInterval(timerId);
                };
            },
        },
    });

    function handlePlayingStateToggle() {
        send({
            type: 'TOGGLE',
        });
    }

    async function fetchMusicPlayerTotalDuration(): Promise<number> {
        const player = playerRef.current;
        if (player === null) {
            throw new Error(
                'playerRef is null, the reference has not been set correctly',
            );
        }

        const elapsedTime: number = await player.getDuration();

        return elapsedTime;
    }

    async function fetchMusicPlayerElapsedTime(): Promise<number> {
        const player = playerRef.current;
        if (player === null) {
            throw new Error(
                'playerRef is null, the reference has not been set correctly',
            );
        }

        const elapsedTime: number = await player.getCurrentTime();

        return elapsedTime;
    }

    function handleNextTrackPress() {
        console.log('play next track');
    }

    return (
        <AppScreen>
            <AppModalHeader
                insetTop={insets.top}
                dismiss={() => {
                    dismissFullScreenPlayer();
                }}
                HeaderLeft={() => (
                    <View sx={{ flex: 1 }}>
                        <Typo numberOfLines={1} sx={{ fontSize: 'm' }}>
                            {roomId}
                        </Typo>

                        <Typo
                            sx={{
                                fontSize: 's',
                                color: 'greyLighter',
                                marginTop: 'xs',
                            }}
                        >
                            2 Listeners
                        </Typo>
                    </View>
                )}
            />

            <AppScreenContainer>
                <MusicPlayerWithControls
                    playerRef={playerRef}
                    videoId="55SwKPVMVM4"
                    trackTitle="Monde Nouveau"
                    trackArtist="Feu! Chatterton"
                    isPlaying={machineState.matches('connectedToRoom.play')}
                    onPlayingToggle={() => {
                        sendToMachine('PLAY_PAUSE_TOGGLE');
                    }}
                    onNextTrackPress={handleNextTrackPress}
                    elapsedTime={state.context.elapsedTime}
                    totalDuration={state.context.duration}
                />
            </AppScreenContainer>
        </AppScreen>
    );
};

type TheMusicPlayerMiniProps = {
    height: number;
    roomName?: string;
    currentTrackName?: string;
    currentTrackArtist?: string;
};

const TheMusicPlayerMini: React.FC<TheMusicPlayerMiniProps> = ({
    height,
    ...props
}) => {
    const sx = useSx();
    const isInRoom = props.roomName !== undefined;
    const firstLine =
        isInRoom === true ? props.roomName : 'Join a room to listen to music';
    const secondLine =
        isInRoom === true
            ? `${props.currentTrackName} • ${props.currentTrackArtist}`
            : '-';

    return (
        <View
            sx={{
                height,
                flexDirection: 'row',
                alignItems: 'center',
                paddingLeft: 'l',
                paddingRight: 'l',
            }}
        >
            <View
                sx={{
                    flex: 1,
                    justifyContent: 'center',
                    marginRight: 'xl',
                }}
            >
                <Typo numberOfLines={1} sx={{ fontSize: 's' }}>
                    {firstLine}
                </Typo>

                <Typo
                    numberOfLines={1}
                    sx={{ fontSize: 'xs', color: 'greyLighter' }}
                >
                    {secondLine}
                </Typo>
            </View>

            <TouchableOpacity
                disabled={isInRoom === false}
                onPress={() => {
                    console.log('toggle');
                }}
            >
                <Ionicons
                    name="pause"
                    style={sx({
                        fontSize: 'xl',
                        color: 'white',
                    })}
                />
            </TouchableOpacity>
        </View>
    );
};

type TheMusicPlayerProps = {
    isFullScreen: boolean;
    setIsFullScren: (isOpen: boolean) => void;
};

const TheMusicPlayer: React.FC<TheMusicPlayerProps> = ({
    isFullScreen,
    setIsFullScren,
}) => {
    const MINI_PLAYER_HEIGHT = 52;
    const sx = useSx();
    const { state, sendToMachine } = useMusicPlayer();
    const { currentRoom, currentTrack } = state.context;
    const isInRoom = currentRoom !== undefined;
    function openPlayerInFullScreen() {
        if (isInRoom === true) {
            setIsFullScren(true);
        }
    }

    useBackHandler(() => {
        if (isFullScreen) {
            setIsFullScren(false);
            return true;
        }

        return false;
    });

    return (
        <TouchableWithoutFeedback onPress={openPlayerInFullScreen}>
            <View
                style={sx({
                    backgroundColor: 'greyLight',
                    borderBottomColor: 'black',
                    borderBottomWidth: 1,
                    position: isFullScreen ? 'absolute' : 'relative',
                    top: isFullScreen ? -1 * MINI_PLAYER_HEIGHT : 0,
                    bottom: 0,
                    right: 0,
                    left: 0,
                    zIndex: 20,
                })}
            >
                <TheMusicPlayerMini
                    height={MINI_PLAYER_HEIGHT}
                    roomName={currentRoom?.name}
                    currentTrackName={currentTrack?.name}
                    currentTrackArtist={currentTrack?.artistName}
                />

                {isInRoom && (
                    <View
                        style={{
                            flex: 1,
                            transform: [{ translateY: isFullScreen ? 0 : 200 }],
                        }}
                    >
                        <TheMusicPlayerFullScreen
                            dismissFullScreenPlayer={() => {
                                setIsFullScren(false);
                            }}
                            roomName={currentRoom?.name}
                            sendToMachine={sendToMachine}
                            machineState={state}
                        />
                    </View>
                )}
            </View>
        </TouchableWithoutFeedback>
    );
};

export default TheMusicPlayer;

import React, { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text, useSx, View } from 'dripsy';
import { FlatList, TouchableOpacity } from 'react-native';
import { useActor, useMachine } from '@xstate/react';
import { ActorRef } from 'xstate';
import { MpeRoomSummary, UserProfileInformation } from '@musicroom/types';
import { RefreshControl } from 'react-native-web-refresh-control';
import invariant from 'tiny-invariant';
import {
    AppScreen,
    AppScreenContainer,
    AppScreenHeader,
    AppScreenWithSearchBar,
} from '../../components/kit';
import { UserMusicPlaylistEditorSearchScreenProps } from '../../types';
import { useMusicPlaylistsActor } from '../../hooks/useMusicPlaylistsActor';
import {
    AppScreenHeaderWithSearchBarMachineEvent,
    AppScreenHeaderWithSearchBarMachineState,
} from '../../machines/appScreenHeaderWithSearchBarMachine';
import { libraryMpeRoomSearchMachine } from '../../machines/mpeRoomUniversalSearchMachine';
import { IS_TEST } from '../../constants/Env';
import { getUserProfileInformation } from '../../services/UserProfileService';
import { getFakeUserID } from '../../contexts/SocketContext';
import { userInformationMachine } from './userInformationMachine';

interface PlaylistListItemProps {
    roomSummary: MpeRoomSummary;
    onPress: (roomSummary: MpeRoomSummary) => void;
}

const PlaylistListItem: React.FC<PlaylistListItemProps> = ({
    roomSummary,
    onPress,
}) => {
    const { roomID, roomName } = roomSummary;
    return (
        <TouchableOpacity
            testID={`mpe-room-card-${roomID}`}
            onPress={() => {
                onPress(roomSummary);
            }}
        >
            <View>
                <Text sx={{ color: 'white' }}>{roomName}</Text>
            </View>
        </TouchableOpacity>
    );
};

const LoadingScreen: React.FC<
    UserMusicPlaylistEditorSearchScreenProps & { isLoading: boolean }
> = ({ navigation, isLoading }) => {
    const insets = useSafeAreaInsets();

    return (
        <AppScreen>
            <AppScreenHeader
                title="User's MPE rooms"
                insetTop={insets.top}
                canGoBack={true}
                goBack={() => {
                    navigation.goBack();
                }}
            />

            <AppScreenContainer testID="default-profile-page-screen">
                {isLoading === true ? (
                    <Text>LOADING</Text>
                ) : (
                    <>
                        <Text>User not found</Text>
                        <Button
                            title="Go back"
                            onPress={() => navigation.goBack()}
                        />
                    </>
                )}
            </AppScreenContainer>
        </AppScreen>
    );
};

const MpeRoomsList: React.FC<
    UserMusicPlaylistEditorSearchScreenProps & {
        userProfileInformation: UserProfileInformation;
    }
> = ({ navigation, userProfileInformation }) => {
    const insets = useSafeAreaInsets();
    const sx = useSx();
    const [screenOffsetY, setScreenOffsetY] = useState(0);
    const initialNumberOfItemsToRender = IS_TEST ? Infinity : 10;

    const [libraryRoomState, libraryRoomSend] = useMachine(
        libraryMpeRoomSearchMachine,
    );
    const mpeRooms = libraryRoomState.context.rooms;
    const hasMoreRoomsToFetch = libraryRoomState.context.hasMore;
    const isLoadingRooms = libraryRoomState.hasTag('fetching');
    const searchBarActor: ActorRef<
        AppScreenHeaderWithSearchBarMachineEvent,
        AppScreenHeaderWithSearchBarMachineState
    > = libraryRoomState.children.searchBarMachine;
    const [searchState, sendToSearch] = useActor(searchBarActor);
    const showHeader = searchState.hasTag('showHeaderTitle');

    function handleLoadMore() {
        libraryRoomSend({
            type: 'LOAD_MORE_ITEMS',
        });
    }

    function handleRefresh() {
        libraryRoomSend({
            type: 'REFRESH',
        });
    }

    const { appMusicPlaylistsActorRef } = useMusicPlaylistsActor();

    function handleRoomPress({ roomID, roomName }: MpeRoomSummary) {
        appMusicPlaylistsActorRef.send({
            type: 'DISPLAY_MPE_ROOM_VIEW',
            roomID,
            roomName,
        });
    }

    return (
        <AppScreenWithSearchBar
            testID="library-mpe-rooms-list"
            title={`${userProfileInformation.userNickname}'s MPE rooms`}
            searchInputPlaceholder="Search a room..."
            showHeader={showHeader}
            screenOffsetY={showHeader === true ? 0 : screenOffsetY}
            setScreenOffsetY={setScreenOffsetY}
            searchQuery={searchState.context.searchQuery}
            sendToSearch={sendToSearch}
            canGoBack
            goBack={() => {
                navigation.goBack();
            }}
        >
            <FlatList
                testID="library-mpe-room-search-flat-list"
                data={mpeRooms}
                refreshControl={
                    <RefreshControl
                        refreshing={isLoadingRooms}
                        onRefresh={handleRefresh}
                    />
                }
                renderItem={({ item }) => {
                    return (
                        <PlaylistListItem
                            roomSummary={item}
                            onPress={handleRoomPress}
                        />
                    );
                }}
                keyExtractor={({ roomID }) => roomID}
                ListEmptyComponent={() => {
                    return (
                        <Text sx={{ color: 'white' }}>
                            You have not joined any MPE rooms
                        </Text>
                    );
                }}
                ListFooterComponent={
                    hasMoreRoomsToFetch === true
                        ? () => {
                              return (
                                  <View
                                      sx={{
                                          flexDirection: 'row',
                                          justifyContent: 'center',
                                          alignItems: 'center',
                                      }}
                                  >
                                      <TouchableOpacity
                                          onPress={handleLoadMore}
                                          style={sx({
                                              borderRadius: 'full',
                                              borderWidth: 2,
                                              borderColor: 'secondary',
                                              paddingX: 'l',
                                              paddingY: 's',
                                          })}
                                      >
                                          <Text
                                              sx={{
                                                  color: 'secondary',
                                                  fontWeight: 'bold',
                                              }}
                                          >
                                              Load more
                                          </Text>
                                      </TouchableOpacity>
                                  </View>
                              );
                          }
                        : undefined
                }
                // This is here that we ensure the Flat List will not show items
                // on an unsafe area.
                contentContainerStyle={{
                    paddingBottom: insets.bottom,
                }}
                onEndReachedThreshold={0.5}
                initialNumToRender={initialNumberOfItemsToRender}
            />
        </AppScreenWithSearchBar>
    );
};

const UserMusicPlaylistEditorSearchScreen: React.FC<UserMusicPlaylistEditorSearchScreenProps> =
    (props) => {
        const {
            route: {
                params: { userID },
            },
        } = props;

        const [state] = useMachine(userInformationMachine, {
            services: {
                "Fetch user's information": () => async (sendBack) => {
                    try {
                        const response = await getUserProfileInformation({
                            tmpAuthUserID: getFakeUserID(),
                            userID,
                        });

                        sendBack({
                            type: '__RETRIEVE_USER_PROFILE_INFORMATION_SUCCESS',
                            userProfileInformation: response,
                        });
                    } catch (e) {
                        console.log('error occured');
                        sendBack({
                            type: '__RETRIEVE_USER_PROFILE_INFORMATION_FAILURE',
                        });
                    }
                },
            },
        });
        const isKnownUser = state.hasTag('known user');
        const isUnknownUser = isKnownUser === false;

        if (isUnknownUser === true) {
            const isLoading = state.hasTag('loading');

            return <LoadingScreen {...props} isLoading={isLoading} />;
        }

        const userProfileInformation = state.context.userProfileInformation;
        invariant(
            userProfileInformation !== undefined,
            'When the user is known, the user profile information must be defined',
        );

        return (
            <MpeRoomsList
                {...props}
                userProfileInformation={userProfileInformation}
            />
        );
    };

export default UserMusicPlaylistEditorSearchScreen;

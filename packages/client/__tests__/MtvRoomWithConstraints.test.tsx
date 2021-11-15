import {
    MtvPlayingModes,
    MtvRoomUsersListElement,
    MtvWorkflowState,
    MtvWorkflowStateWithUserRelatedInformation,
} from '@musicroom/types';
import { NavigationContainer } from '@react-navigation/native';
import {
    LocationObject,
    LocationPermissionResponse,
    PermissionStatus,
} from 'expo-location';
import { datatype, random } from 'faker';
import React from 'react';
import {
    getCurrentPositionAsyncMocked,
    requestForegroundPermissionsAsyncMocked,
} from '../jest.setup';
import { RootNavigator } from '../navigation';
import { isReadyRef, navigationRef } from '../navigation/RootNavigation';
import { serverSocket } from '../services/websockets';
import { generateTrackMetadata } from '../tests/data';
import {
    fireEvent,
    getFakeUsersList,
    noop,
    render,
    waitFor,
    within,
} from '../tests/tests-utils';

/* eslint-disable @typescript-eslint/require-await */

describe('Room with constraints tests', () => {
    afterAll(() => {
        requestForegroundPermissionsAsyncMocked.mockClear();
        getCurrentPositionAsyncMocked.mockClear();
    });

    it(`TOTO S AMERE`, async () => {
        requestForegroundPermissionsAsyncMocked.mockImplementationOnce(
            async () => {
                const res: LocationPermissionResponse = {
                    canAskAgain: true,
                    expires: 'never',
                    granted: true,
                    status: 'granted' as PermissionStatus.GRANTED,
                };
                return res;
            },
        );

        const location: LocationObject = {
            timestamp: datatype.number(),
            coords: {
                accuracy: 4,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                latitude: datatype.number({
                    min: -80,
                    max: 75,
                }),
                longitude: datatype.number({
                    min: -180,
                    max: 175,
                }),
                speed: null,
            },
        };

        getCurrentPositionAsyncMocked.mockImplementation(async () => {
            return location;
        });

        const tracksList = [
            generateTrackMetadata({
                score: 0,
            }),
        ];

        const roomCreatorUserID = datatype.uuid();
        const initialState: MtvWorkflowStateWithUserRelatedInformation = {
            name: random.words(),
            roomID: datatype.uuid(),
            playing: false,
            playingMode: MtvPlayingModes.Values.BROADCAST,
            roomCreatorUserID,
            isOpen: false,
            isOpenOnlyInvitedUsersCanVote: false,
            hasTimeAndPositionConstraints: true,
            timeConstraintIsValid: false,
            delegationOwnerUserID: null,
            userRelatedInformation: {
                hasControlAndDelegationPermission: true,
                userFitsPositionConstraint: false,
                emittingDeviceID: datatype.uuid(),
                userID: roomCreatorUserID,
                userHasBeenInvited: false,
                tracksVotedFor: [],
            },
            usersLength: 1,
            currentTrack: null,
            tracks: tracksList,
            minimumScoreToBePlayed: 1,
        };

        serverSocket.on('GET_CONTEXT', () => {
            serverSocket.emit('RETRIEVE_CONTEXT', initialState);
        });

        const screen = render(
            <NavigationContainer
                ref={navigationRef}
                onReady={() => {
                    isReadyRef.current = true;
                }}
            >
                <RootNavigator colorScheme="dark" toggleColorScheme={noop} />
            </NavigationContainer>,
        );

        expect(screen.getAllByText(/home/i).length).toBeGreaterThanOrEqual(1);

        const musicPlayerMini = screen.getByTestId('music-player-mini');
        expect(musicPlayerMini).toBeTruthy();

        fireEvent.press(musicPlayerMini);

        const musicPlayerFullScreen = await screen.findByA11yState({
            expanded: true,
        });
        expect(musicPlayerFullScreen).toBeTruthy();

        console.log('0');
        //Track cards should be disabled
        await waitFor(() => {
            expect(screen.getByText(tracksList[0].title)).toBeTruthy();
            expect(
                screen.getByTestId(`${tracksList[0].id}-track-card`),
            ).toBeEnabled();
            expect(screen.getByText(tracksList[0].title)).toBeEnabled();
            expect(screen.getByText(new RegExp(`0/1`))).toBeTruthy();
        });

        //Emit new permission server socket event
        const initialStateCpyA = {
            ...initialState,
            timeConstraintIsValid: true,
            userRelatedInformation: {
                ...initialState.userRelatedInformation,
                userFitsPositionConstraint: false,
            },
        };
        serverSocket.emit('USER_PERMISSIONS_UPDATE', initialStateCpyA);

        console.log('1');
        //Track cards should be disabled
        await waitFor(() => {
            expect(
                screen.getByTestId(`${tracksList[0].id}-track-card`),
            ).toBeEnabled();
            expect(screen.getByText(tracksList[0].title)).toBeEnabled();
        });

        //Emit new permission server socket event

        const initialStateCpyB = {
            ...initialStateCpyA,
            userRelatedInformation: {
                ...initialStateCpyA.userRelatedInformation,
                userFitsPositionConstraint: true,
            },
        };
        serverSocket.emit('USER_PERMISSIONS_UPDATE', initialStateCpyB);

        console.log('2');
        //Track cards should be enabled
        await waitFor(() => {
            expect(
                screen.getByTestId(`${tracksList[0].id}-track-card`),
            ).toBeEnabled();
            expect(screen.getByText(tracksList[0].title)).toBeEnabled();
        });
    });
});

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { MtvRoomUsersListElement } from '@musicroom/types';
import {
    render as rtlRender,
    RenderAPI,
    RenderOptions,
} from '@testing-library/react-native';
import { DripsyProvider } from 'dripsy';
import { datatype, random } from 'faker';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MusicPlayerContextProvider } from '../contexts/MusicPlayerContext';
import { SocketContextProvider } from '../contexts/SocketContext';
import { UserContextProvider } from '../contexts/UserContext';
import { useTheme } from '../hooks/useTheme';
import { ServerSocket, serverSocket } from '../services/websockets';

export type SizeTerms = 'xs' | 's' | 'm' | 'l' | 'xl';
export type BackgroundTerms = 'primary' | 'seconday' | 'white' | 'text';

const AllTheProviders: React.FC = ({ children }) => {
    const { theme } = useTheme();

    return (
        <DripsyProvider theme={theme}>
            <SafeAreaProvider
                initialMetrics={{
                    frame: { x: 0, y: 0, width: 0, height: 0 },
                    insets: { top: 0, left: 0, right: 0, bottom: 0 },
                }}
            >
                <BottomSheetModalProvider>
                    <SocketContextProvider>
                        <UserContextProvider>
                            <MusicPlayerContextProvider setDisplayModal={noop}>
                                {children}
                            </MusicPlayerContextProvider>
                        </UserContextProvider>
                    </SocketContextProvider>
                </BottomSheetModalProvider>
            </SafeAreaProvider>
        </DripsyProvider>
    );
};

export * from '@testing-library/react-native';

export function render(
    component: React.ReactElement<unknown>,
    options?: RenderOptions,
): RenderAPI & { serverSocket: ServerSocket } {
    const utils = rtlRender(component, {
        wrapper: AllTheProviders,
        ...options,
    });

    return {
        ...utils,
        serverSocket,
    };
}

export function waitForTimeout(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

export function noop(): void {
    return undefined;
}

export function getFakeUsersList({
    length,
    directMode,
    isMeIsCreator,
}: {
    length?: number;
    directMode: boolean;
    isMeIsCreator?: boolean;
}): MtvRoomUsersListElement[] {
    const len = length || 10;

    const minRandomIndex = 1;
    const getRandomIndex = () =>
        Math.floor(Math.random() * (len - minRandomIndex + 1) + minRandomIndex);

    const getFakeUser = (): MtvRoomUsersListElement => ({
        hasControlAndDelegationPermission: false,
        isCreator: false,
        isDelegationOwner: false,
        isMe: false,
        nickname: random.word(),
        userID: datatype.uuid(),
    });

    const fakeUsersArray: MtvRoomUsersListElement[] = Array.from({
        length: len,
    }).map(() => getFakeUser());

    fakeUsersArray[0] = {
        ...fakeUsersArray[0],
        isCreator: true,
        hasControlAndDelegationPermission: true,
        isDelegationOwner: directMode || false,
        isMe: isMeIsCreator || false,
    };

    if (!isMeIsCreator) {
        const isMeIndex = getRandomIndex();
        fakeUsersArray[isMeIndex].isMe = true;
    }

    return fakeUsersArray;
}

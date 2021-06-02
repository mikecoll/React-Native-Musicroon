import { Button } from '@dripsy/core';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Block, Title } from '../components/kit';
import Player from '../components/MusicPlayer';
import { HomeTabHomeXScreenProps } from '../types';

const HomeScreen: React.FC<HomeTabHomeXScreenProps> = ({ navigation }) => {
    return (
        <Block as={SafeAreaView} background={'primary'}>
            <Title>This is a basic home</Title>

            <Player />

            <Button
                title="Go to Music Track Vote"
                onPress={() => {
                    navigation.navigate('MusicTrackVoteSearch');
                }}
            />

            <Button
                title="Go settings"
                onPress={() => {
                    navigation.navigate('Settings');
                }}
            />
            <Button
                title="Go chat"
                onPress={() => {
                    navigation.navigate('Chat');
                }}
            />
        </Block>
    );
};

export default HomeScreen;

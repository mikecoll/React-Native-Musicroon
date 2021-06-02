import React, { useEffect } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMachine } from '@xstate/react';
import { searchTrackMachine } from '../machines/searchTrackMachine';
import { Block, FlexRowContainer, TextInput, Title } from '../components/kit';

import { SearchTabSearchTracksScreenProps } from '../types';

const SearchTrackScreen: React.FC<SearchTabSearchTracksScreenProps> = ({
    navigation,
}) => {
    const [state, send] = useMachine(searchTrackMachine);
    useEffect(() => {
        if (
            state.matches('fetchedTracks') &&
            state.context.tracks !== undefined
        ) {
            navigation.navigate('SearchTrackResults', {
                tracks: state.context.tracks,
            });
        }
    }, [state, navigation]);

    function sendQuery() {
        send({
            type: 'SEND_REQUEST',
        });
    }

    function handleInputChangeText(searchQuery: string) {
        send({
            type: 'UPDATE_SEARCH_QUERY',
            searchQuery,
        });
    }

    return (
        <Block as={SafeAreaView} background="primary">
            <Title>Search a track</Title>
            <FlexRowContainer>
                <TextInput
                    placeholderTextColor={'white'}
                    placeholder={'Search a song here...'}
                    onChangeText={handleInputChangeText}
                />

                <TouchableOpacity
                    style={styles.searchSubmitButton}
                    onPress={sendQuery}
                >
                    <Text style={styles.searchSubmitButtonText}>✅</Text>
                </TouchableOpacity>
            </FlexRowContainer>

            <Button
                title="Go to home"
                onPress={() => {
                    navigation.navigate('Home', {
                        screen: 'HomeX',
                    });
                }}
            />
        </Block>
    );
};

const styles = StyleSheet.create({
    searchSubmitButton: {
        padding: 12,
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
    },

    searchSubmitButtonText: {
        textAlign: 'center',
        fontSize: 18,
    },
});

export default SearchTrackScreen;

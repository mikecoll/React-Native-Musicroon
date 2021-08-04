import React from 'react';
import { Text, View } from 'dripsy';

interface MusicPlayerFullScreenTracksListItemProps {
    index: number;
    title: string;
    artistName: string;
    score: number;
    minimumScore: number;
}

const MusicPlayerFullScreenTracksListItem: React.FC<MusicPlayerFullScreenTracksListItemProps> =
    ({ title, artistName, score, minimumScore }) => {
        return (
            <View
                sx={{
                    flex: 1,
                    padding: 'm',
                    backgroundColor: 'greyLight',
                    borderRadius: 's',
                    flexDirection: 'row',

                    marginBottom: 'm',
                }}
            >
                <View sx={{ flex: 1 }}>
                    <Text
                        sx={{
                            color: 'white',
                            marginBottom: 'xs',
                        }}
                    >
                        {title}
                    </Text>

                    <Text
                        sx={{
                            color: 'greyLighter',
                            fontSize: 'xxs',
                        }}
                    >
                        {artistName}
                    </Text>
                </View>

                <View
                    sx={{
                        justifyContent: 'center',
                        paddingLeft: 's',
                    }}
                >
                    <Text sx={{ color: 'greyLighter' }}>
                        {score}/{minimumScore}
                    </Text>
                </View>
            </View>
        );
    };

export default MusicPlayerFullScreenTracksListItem;
